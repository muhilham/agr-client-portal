// lib/variantResolver.ts — issue #90 size-variant catalog resolver.
//
// Eligibility half (§Scope rules 1–2) MIRRORS `agr-ops/lib/variantCliffs.ts`
// exactly (cross-repo import impossible; parity fixtures are carried in
// lib/variantResolver.test.ts — change one, change both). The cliff editor
// validates eligibility with agr-ops' copy; this copy must agree or the
// portal prices chips the editor refuses to hang a cliff on.
//
// Grouping half (§Scope rule 3) is portal-only: it collapses the live reality
// of N variants per size (typically 4 grind values on the Varian axis) into
// price-unambiguous chips.

import type { CatalogProduct, CatalogVariantLine } from './catalog'

// ---------------------------------------------------------------------------
// Parity block — keep byte-equivalent semantics with agr-ops/lib/variantCliffs
// ---------------------------------------------------------------------------

const SIZE_AXIS_NAMES = new Set(['size', 'varian'])

const GRIND_VALUE_RE = /^(whole\s*beans?|beans?|grind\b.*|bundle)$/i
const BEANS_RE = /^whole\s*beans?$|^beans?$/i

export function normalizeAxisName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '')
}

export function isGrindVocabularyValue(value: string): boolean {
  return GRIND_VALUE_RE.test(value.trim())
}

/** PostgREST may hand the junction as an array or (1:1-inferred) a single
 *  object — normalize before iterating (same tolerance as agr-ops). */
export interface ResolverOptionValue {
  value: string
  product_options?: { name: string | null } | null
}
export interface ResolverVariant {
  id: string
  product_id?: string
  sku: string | null
  price: number
  is_active: boolean | null
  ship_weight_grams: number | null
  product_variant_option_values?:
    | { product_option_values: ResolverOptionValue | null }[]
    | { product_option_values: ResolverOptionValue | null }
    | null
}

/** Raw size label for a variant, or null when it is not an eligible size
 *  variant. Qualifying axis values are trimmed, de-duped, sorted, joined. */
export function resolveSizeLabel(variant: ResolverVariant): string | null {
  const labels: string[] = []
  const raw = variant.product_variant_option_values as unknown
  const junctions = Array.isArray(raw) ? raw : raw ? [raw] : []
  for (const j of junctions as { product_option_values: ResolverOptionValue | null }[]) {
    const pov = j.product_option_values
    if (!pov?.value) continue
    const axis = pov.product_options?.name
    if (!axis || !SIZE_AXIS_NAMES.has(normalizeAxisName(axis))) continue
    if (isGrindVocabularyValue(pov.value)) continue
    labels.push(pov.value.trim())
  }
  if (labels.length === 0) return null
  return [...new Set(labels)].sort().join(' · ')
}

/** Values that did NOT contribute to the size label ("the remainder"),
 *  used only to disambiguate chips in single-member price tiers — e.g.
 *  `1Kg · Grind Coarse`. Axis names alone can't decide this: `Varian` is a
 *  size-axis name but its grind values are never in the label, so they are
 *  legitimate remainder text. */
function remainderLabel(variant: ResolverVariant, sizeLabel: string | null): string | null {
  const inLabel = new Set((sizeLabel ?? '').split(' · ').map((s) => s.trim()))
  const raw = variant.product_variant_option_values as unknown
  const junctions = Array.isArray(raw) ? raw : raw ? [raw] : []
  const parts: string[] = []
  for (const j of junctions as { product_option_values: ResolverOptionValue | null }[]) {
    const pov = j.product_option_values
    if (!pov?.value) continue
    const value = pov.value.trim()
    if (inLabel.has(value)) continue
    parts.push(value)
  }
  return parts.length ? [...new Set(parts)].sort().join(' · ') : null
}

// ---------------------------------------------------------------------------
// §Scope rule 3 — chip construction per product
// ---------------------------------------------------------------------------

export interface CliffRow {
  variantId: string | null
  customPrice: number | null
  minQty: number | null
}

/**
 * One chip = one concrete variant binding.
 *
 * #307: the whole-product (default) cliff NO LONGER prices or moqs size
 * chips — that inheritance was the leak (a 1kg deal showed on every 100g
 * chip, up to 6.2x list). Chip pricing is now variant-cliff-or-list only.
 * Default rows remain legal as pure access grants (NULL/NULL) and for flat
 * products, which never reach this function (catalog skips products with
 * no variants and prices those cards from the default row directly).
 */
export function buildVariantLines(
  productId: string,
  basePrice: number,
  variants: ResolverVariant[],
  variantCliffs: Map<string, CliffRow>
): CatalogVariantLine[] {
  const eligible = variants
    .filter((v) => v.is_active !== false)
    .map((v) => ({ v, label: resolveSizeLabel(v) }))
    .filter((e): e is { v: ResolverVariant; label: string } => e.label !== null)
  if (eligible.length === 0) return []

  // group by normalized size label
  const groups = new Map<string, typeof eligible>()
  for (const e of eligible) {
    const key = e.label.toLowerCase().replace(/\s+/g, '')
    const g = groups.get(key) ?? []
    g.push(e)
    groups.set(key, g)
  }

  const effPrice = (v: ResolverVariant): number => {
    const vc = variantCliffs.get(v.id)
    if (vc?.customPrice != null) return vc.customPrice
    return v.price ?? basePrice
  }
  const effMin = (v: ResolverVariant): number => {
    // Contract (#307): variant cliff row or 1. A variant row always wins,
    // including min_qty = 1 (= "no minimum on this chip"); Math.max guards
    // editor slips (0/negative). Product-level minimums no longer reach
    // chips — whole-product cliffs are access grants, not size pricing.
    const vc = variantCliffs.get(v.id)
    if (vc?.minQty != null) return Math.max(1, vc.minQty)
    return 1
  }

  const bindLine = (members: ResolverVariant[], cliffTarget: ResolverVariant | null): ResolverVariant => {
    if (cliffTarget) return cliffTarget
    if (members.length === 1) return members[0]
    const beans = members.filter((m) => {
      const rem = remainderLabel(m, resolveSizeLabel(m))
      return rem != null && BEANS_RE.test(rem.trim())
    })
    if (beans.length > 0) return beans.sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    return [...members].sort((a, b) => (a.id < b.id ? -1 : 1))[0]
  }

  const lines: CatalogVariantLine[] = []
  for (const [, group] of groups) {
    const cliffed = group.filter((e) => variantCliffs.has(e.v.id))
    const free = group.filter((e) => !variantCliffs.has(e.v.id))

    // A cliff pins a concrete variant: it gets its own chip whenever the
    // group has more than one variant OR the cliff actually changes
    // price/MOQ vs the collapsed line (override-collapse, §rule 3).
    if (cliffed.length > 0) {
      if (group.length === 1 && free.length === 0 && cliffed.length === 1) {
        // single-member group: the cliff just prices the one chip, no suffix needed
        const v = cliffed[0].v
        lines.push({
          variantId: v.id,
          label: resolveSizeLabel(v)!,
          effectivePrice: effPrice(v),
          minQty: effMin(v),
          shipWeightGrams: v.ship_weight_grams ?? 0,
        })
        continue
      }
      for (const c of cliffed) {
        const label = c.label + (group.length > 1 ? chipSuffix(c.v, c.label) : '')
        lines.push({
          variantId: c.v.id,
          label,
          effectivePrice: effPrice(c.v),
          minQty: effMin(c.v),
          shipWeightGrams: c.v.ship_weight_grams ?? 0,
        })
      }
    }

    if (free.length > 0) {
      // tier by identical effective price (cliffed members already emitted)
      const tiers = new Map<number, ResolverVariant[]>()
      for (const e of free) {
        const p = effPrice(e.v)
        const t = tiers.get(p) ?? []
        t.push(e.v)
        tiers.set(p, t)
      }
      const multiTier = tiers.size > 1 || cliffed.length > 0
      for (const [price, members] of tiers) {
        const bound = bindLine(members, null)
        const base = resolveSizeLabel(bound)!
        let label = base
        if (members.length === 1 && multiTier) {
          // single-member tier in a mixed group carries the remainder
          label = base + chipSuffix(bound, base)
        }
        lines.push({
          variantId: bound.id,
          label,
          effectivePrice: price,
          minQty: effMin(bound),
          shipWeightGrams: bound.ship_weight_grams ?? 0,
        })
      }
    }
  }

  // chips ordered by cliff-first, then parsed gram weight ascending;
  // unparseable last (label order)
  const hasCliff = (l: CatalogVariantLine): boolean => variantCliffs.has(l.variantId)
  const grams = (l: string): number => {
    const m = l.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|gr\b|g\b)?/)
    if (!m) return Number.POSITIVE_INFINITY
    const n = parseFloat(m[1].replace(',', '.'))
    if (m[2]?.startsWith('kg') || m[2] === 'kilo') return n * 1000
    return n
  }
  lines.sort(
    (a, b) =>
      Number(hasCliff(b)) - Number(hasCliff(a)) ||
      grams(a.label) - grams(b.label) ||
      a.label.localeCompare(b.label)
  )

  // Label uniqueness within a card: two multi-member price tiers of the same
  // size (or odd raw-label collisions across groups) can collapse to the
  // plain label twice. Suffix the bound member's remainder so chips never
  // render identical text — mis-tap ambiguity was the primary failure mode.
  const byVariant = new Map(eligible.map((e) => [e.v.id, e.v]))
  const labelCount = new Map<string, number>()
  for (const l of lines) labelCount.set(l.label, (labelCount.get(l.label) ?? 0) + 1)
  for (const l of lines) {
    if ((labelCount.get(l.label) ?? 0) < 2) continue
    const v = byVariant.get(l.variantId)
    if (!v) continue
    const suffix = remainderLabel(v, l.label) ?? v.sku
    if (suffix) l.label = `${l.label} · ${suffix}`
  }

  return lines

  function chipSuffix(v: ResolverVariant, base: string): string {
    const rem = remainderLabel(v, base)
    return rem ? ` · ${rem}` : v.sku ? ` · ${v.sku}` : ''
  }
}

// ---------------------------------------------------------------------------
// Catalog-level helpers (line identity shared by cart/schema/UI/reorder)
// ---------------------------------------------------------------------------

export function lineIdOf(productId: string, variantId: string | null): string {
  return variantId ?? productId
}

/** Every orderable line of a catalog product: variant chips when present,
 *  else one flat line keyed by productId. */
export type CatalogLine = {
  lineId: string
  variantId: string | null
  label: string
  effectivePrice: number
  minQty: number
  shipWeightGrams: number
}

export function linesOf(product: CatalogProduct): CatalogLine[] {
  if (product.variants.length > 0) {
    return product.variants.map((v) => ({ ...v, lineId: v.variantId, variantId: v.variantId }))
  }
  return [
    {
      lineId: product.id,
      variantId: null,
      label: product.unit,
      effectivePrice: product.effectivePrice,
      minQty: product.minQty,
      shipWeightGrams: product.shipWeightGrams,
    },
  ]
}
