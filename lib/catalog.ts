import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  buildVariantLines,
  type CliffRow,
  type ResolverVariant,
} from '@/lib/variantResolver'

/** One orderable size chip bound to a concrete product_variants row (#90). */
export type CatalogVariantLine = {
  variantId: string
  /** Chip display label: raw size value, + disambiguating remainder for
   *  single-member price tiers (`1Kg`, `1Kg · Grind Coarse`). */
  label: string
  effectivePrice: number
  minQty: number
  shipWeightGrams: number
}

export type CatalogProduct = {
  id: string
  name: string
  description: string | null
  unit: string
  sku: string | null
  imageUrl: string | null
  effectivePrice: number
  minQty: number
  isGlobal: boolean
  isClientAssigned: boolean
  shipWeightGrams: number
  /** §Scope rule 3 chips. Empty array = flat product (grind-only / no size
   *  axis) — the base_price path. Never mix: cards render chips OR flat. */
  variants: CatalogVariantLine[]
}

type ProductRow = {
  id: string
  name: string
  description: string | null
  unit: string
  sku: string | null
  base_price: number
  image_url: string | null
  is_global: boolean
  is_active: boolean
  ship_weight_grams: number
}

type ClientProductRow = {
  custom_price: number | null
  min_qty: number | null
  variant_id: string | null
  products: ProductRow | null
}

type VariantRow = ResolverVariant & { product_id: string }

const EMBEDDED_PRODUCT =
  'id, name, description, unit, sku, base_price, image_url, is_global, is_active, ship_weight_grams'

export async function getCatalogForClient(clientId: string): Promise<CatalogProduct[]> {
  const supabase = getSupabaseAdmin()

  const { data: globalProducts, error: globalErr } = await supabase
    .from('products')
    .select('id, name, description, unit, sku, base_price, image_url, is_global, is_active, ship_weight_grams')
    .eq('is_active', true)
    .eq('is_global', true)
    .returns<ProductRow[]>()

  if (globalErr) throw globalErr

  const { data: clientProducts, error: clientErr } = await supabase
    .from('client_products')
    .select(`custom_price, min_qty, variant_id, products (${EMBEDDED_PRODUCT})`)
    .eq('client_id', clientId)
    .returns<ClientProductRow[]>()

  if (clientErr) throw clientErr

  // product-level cliff rows: variant_id IS NULL (#90: whole-product default
  // fallback price/MOQ). Variant cliff rows (variant_id NOT NULL) price the
  // concrete chip below — they must never leak into the whole product.
  const flatCliffByProduct = new Map<string, CliffRow>()
  const variantCliffsByVariant = new Map<string, CliffRow>()
  const clientProductMeta = new Map<string, { row: ClientProductRow; product: ProductRow }>()

  for (const cp of clientProducts ?? []) {
    const p = cp.products
    if (!p || !p.is_active) continue
    if (cp.variant_id == null) {
      flatCliffByProduct.set(p.id, { variantId: null, customPrice: cp.custom_price, minQty: cp.min_qty })
      clientProductMeta.set(p.id, { row: cp, product: p })
    } else {
      variantCliffsByVariant.set(cp.variant_id, { variantId: cp.variant_id, customPrice: cp.custom_price, minQty: cp.min_qty })
      // a variant-cliff-only assignment still makes the product visible; the
      // product embed arrives per row, register it once
      if (!clientProductMeta.has(p.id)) clientProductMeta.set(p.id, { row: cp, product: p })
    }
  }

  const catalog = new Map<string, CatalogProduct>()

  for (const p of globalProducts ?? []) {
    catalog.set(p.id, productOf(p, false, p.id))
  }

  for (const [pid, { product: p }] of clientProductMeta) {
    // #297: the client row overrides even for is_global products (assigned
    // price/MOQ win); keep isGlobal so "Produk Saya" tabbing stays stable.
    catalog.set(pid, productOf(p, true, pid))
  }

  function productOf(p: ProductRow, isAssigned: boolean, pid: string): CatalogProduct {
    const flatCliff = flatCliffByProduct.get(pid) ?? null
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      unit: p.unit,
      sku: p.sku,
      imageUrl: p.image_url,
      effectivePrice: flatCliff?.customPrice != null ? Number(flatCliff.customPrice) : Number(p.base_price),
      minQty: flatCliff?.minQty ?? 1,
      isGlobal: p.is_global,
      isClientAssigned: isAssigned,
      shipWeightGrams: Number(p.ship_weight_grams),
      variants: [],
    }
  }

  // #90: pull variant rows + option values for every visible product and
  // attach §rule 3 chips. Products whose variants all fail eligibility stay
  // flat (variants: []).
  const productIds = Array.from(catalog.keys())
  if (productIds.length > 0) {
    const { data: variantRows, error: variantErr } = await supabase
      .from('product_variants')
      .select(
        `id, product_id, sku, price, is_active, ship_weight_grams,
         product_variant_option_values ( product_option_values ( value, product_options ( name ) ) )`
      )
      .in('product_id', productIds)
      .eq('is_active', true)
      .returns<VariantRow[]>()

    if (variantErr) throw variantErr

    const byProduct = new Map<string, ResolverVariant[]>()
    for (const v of variantRows ?? []) {
      const list = byProduct.get(v.product_id) ?? []
      list.push(v)
      byProduct.set(v.product_id, list)
    }

    for (const [pid, product] of catalog) {
      const variants = byProduct.get(pid)
      if (!variants || variants.length === 0) continue
      const lines = buildVariantLines(
        pid,
        // at this point effectivePrice is raw base_price when no flat cliff
        // row exists; when one does, the resolver's productCliff branch
        // applies it before reaching this fallback.
        Number(product.effectivePrice),
        flatCliffByProduct.get(pid) ?? null,
        variants,
        variantCliffsByVariant
      )
      // basePrice fallback: product.effectivePrice already includes the flat
      // cliff override; variant rows carry their own marketplace price.
      if (lines.length > 0) {
        product.variants = lines
        // keep legacy flat fields coherent for variant-mode products: a stale
        // consumer (or a flat-shaped request) falls back to the canonical
        // first chip rather than mispricing from base_price.
        product.effectivePrice = lines[0].effectivePrice
        product.minQty = lines[0].minQty
        product.shipWeightGrams = lines[0].shipWeightGrams || product.shipWeightGrams
      }
    }
  }

  return Array.from(catalog.values())
}
