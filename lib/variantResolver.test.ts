// lib/variantResolver.test.ts
//
// The eligibility half (§Scope rules 1–2) MUST stay behaviorally identical
// to agr-ops/lib/variantCliffs.ts (tests/unit/variant-cliff-resolver.test.ts)
// — the cliff editor validates with that copy; the portal prices chips with
// this one. Parity cases below mirror the agr-ops fixture set intentionally.
import { describe, expect, it } from 'vitest'
import {
  buildVariantLines,
  isGrindVocabularyValue,
  lineIdOf,
  linesOf,
  normalizeAxisName,
  resolveSizeLabel,
  type CliffRow,
  type ResolverVariant,
} from './variantResolver'
import type { CatalogProduct } from './catalog'

function v(
  id: string,
  axes: Array<[string, string]>,
  over: Partial<ResolverVariant> = {}
): ResolverVariant {
  return {
    id,
    sku: null,
    price: 100000,
    is_active: true,
    ship_weight_grams: 500,
    product_variant_option_values: axes.map(([axis, value]) => ({
      product_option_values: { value, product_options: { name: axis } },
    })),
    ...over,
  }
}

describe('eligibility parity with agr-ops variantCliffs (§rules 1–2)', () => {
  it('Size axis value is the size label', () => {
    expect(resolveSizeLabel(v('a', [['Size', '1kg']]))).toBe('1kg')
  })

  it('Varian axis non-grind value is also a size label (Gayo 15gram case)', () => {
    expect(resolveSizeLabel(v('a', [['Varian', '15gram']]))).toBe('15gram')
  })

  it('grind vocabulary never yields a size label', () => {
    expect(resolveSizeLabel(v('a', [['Size', 'Grind Fine']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['Varian', 'Grind Medium']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['Varian', 'Whole Beans']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['Varian', 'beans']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['Varian', 'wholebean']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['Varian', 'bundle']]))).toBeNull()
  })

  it('grind-ish names outside the vocabulary still qualify (grinder...)', () => {
    expect(resolveSizeLabel(v('a', [['Size', 'grinder']]))).toBe('grinder')
  })

  it('axis names match case/whitespace-insensitively (SIZE, "S IZE")', () => {
    expect(resolveSizeLabel(v('a', [['SIZE', '250g']]))).toBe('250g')
    expect(resolveSizeLabel(v('a', [['S IZE', '250g']]))).toBe('250g')
  })

  it('spaced size values trim only, no re-write ("1 kg")', () => {
    expect(resolveSizeLabel(v('a', [['Size', ' 1 kg ']]))).toBe('1 kg')
  })

  it('non-size axes (Grind, WARNA, aroma, roast) never qualify', () => {
    expect(resolveSizeLabel(v('a', [['Grind', 'Medium']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['WARNA', 'HITAM']]))).toBeNull()
    expect(resolveSizeLabel(v('a', [['Aroma', 'honey']]))).toBeNull()
  })

  it('mixed axes: Size wins, grind value on another axis ignored', () => {
    expect(resolveSizeLabel(v('a', [['Size', '1kg'], ['Varian', 'Grind Fine']]))).toBe('1kg')
  })

  it('two qualifying axes merge, dedupe, sort, join with " · "', () => {
    expect(resolveSizeLabel(v('a', [['Size', '1kg'], ['Varian', '1kg'], ['Size', 'beans-free']]))).toBe('1kg · beans-free')
  })

  it('junction arrives as array or single object — both tolerated', () => {
    const single = {
      ...v('a', []),
      product_variant_option_values: {
        product_option_values: { value: '500g', product_options: { name: 'Size' } },
      },
    } as unknown as ResolverVariant
    expect(resolveSizeLabel(single)).toBe('500g')
  })

  it('null/empty option values tolerated', () => {
    expect(
      resolveSizeLabel({
        id: 'x', sku: null, price: 1, is_active: true, ship_weight_grams: 1,
        product_variant_option_values: [{ product_option_values: null }],
      })
    ).toBeNull()
  })

  it('normalizeAxisName/isGrindVocabularyValue match agr-ops semantics', () => {
    expect(normalizeAxisName('My Size')).toBe('mysize')
    expect(isGrindVocabularyValue(' Whole Beans ')).toBe(true)
    expect(isGrindVocabularyValue('1kg')).toBe(false)
  })
})

describe('buildVariantLines — chip grouping (§rule 3)', () => {
  const noCliffs = new Map<string, CliffRow>()

  it('grind-only variants produce no chips (flat product)', () => {
    const lines = buildVariantLines('p', 100000, null, [
      v('a', [['Varian', 'Grind Medium']]),
      v('b', [['Varian', 'Whole Beans']]),
    ], noCliffs)
    expect(lines).toEqual([])
  })

  it('collapses same-price grind family to one chip, beans-preferred canonical', () => {
    const lines = buildVariantLines('p', 100000, null, [
      v('a', [['Size', '1kg'], ['Varian', 'Grind Fine']]),
      v('b', [['Size', '1kg'], ['Varian', 'Whole Beans']]),
      v('c', [['Size', '1kg'], ['Varian', 'Grind Medium']]),
    ], noCliffs)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ variantId: 'b', label: '1kg', effectivePrice: 100000, minQty: 1 })
  })

  it('mixed-price size group splits per tier; single-member tier carries remainder', () => {
    // live shape: BRAZIL CERRADO 1kg — 421k Grind Coarse vs 424k {Med, Fine, Beans}
    const lines = buildVariantLines('p', 424000, null, [
      v('c', [['Size', '1Kg'], ['Varian', 'Grind Coarse']], { price: 421000 }),
      v('m', [['Size', '1Kg'], ['Varian', 'Grind Medium']], { price: 424000 }),
      v('f', [['Size', '1Kg'], ['Varian', 'Grind Fine']], { price: 424000 }),
      v('b', [['Size', '1Kg'], ['Varian', 'Whole Beans']], { price: 424000 }),
    ], noCliffs)
    expect(lines).toHaveLength(2)
    const byPrice = Object.fromEntries(lines.map((l) => [l.effectivePrice, l]))
    expect(byPrice[421000]).toMatchObject({ variantId: 'c', label: '1Kg · Grind Coarse' })
    expect(byPrice[424000]).toMatchObject({ variantId: 'b', label: '1Kg' })
  })

  it('two multi-member tiers never render identical chip labels', () => {
    const lines = buildVariantLines('p', 100000, null, [
      v('a', [['Size', '1kg'], ['Varian', 'Whole Beans']], { price: 421000 }),
      v('b', [['Size', '1kg'], ['Varian', 'Grind Fine']], { price: 421000 }),
      v('c', [['Size', '1kg'], ['Varian', 'Grind Medium']], { price: 424000 }),
      v('d', [['Size', '1kg'], ['Varian', 'Bundle']], { price: 424000 }),
    ], noCliffs)
    const labels = lines.map((l) => l.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('cliff pins its chip, sorts it first as the default line, prices/mins it', () => {
    const cliffs = new Map<string, CliffRow>([
      ['k', { variantId: 'k', customPrice: 400000, minQty: 5 }],
    ])
    const lines = buildVariantLines('p', 420000, null, [
      v('s', [['Size', '200g']], { price: 120000 }),
      v('k', [['Size', '1kg']], { price: 450000 }),
    ], cliffs)
    expect(lines.map((l) => l.variantId)).toEqual(['k', 's'])
    expect(lines[0]).toMatchObject({ effectivePrice: 400000, minQty: 5, label: '1kg' })
    expect(lines[1]).toMatchObject({ effectivePrice: 120000, minQty: 1, label: '200g' })
  })

  it('effective order: variant cliff > product cliff > marketplace variant price', () => {
    const productCliff: CliffRow = { variantId: null, customPrice: 380000, minQty: 4 }
    const cliffs = new Map<string, CliffRow>([
      ['k', { variantId: 'k', customPrice: 350000, minQty: 10 }],
    ])
    const lines = buildVariantLines('p', 400000, productCliff, [
      v('k', [['Size', '1kg']], { price: 450000 }),
      v('s', [['Size', '200g']], { price: 120000 }),
    ], cliffs)
    const k = lines.find((l) => l.variantId === 'k')!
    const s = lines.find((l) => l.variantId === 's')!
    expect(k).toMatchObject({ effectivePrice: 350000, minQty: 10 })
    // no variant row → product-level cliff row applies
    expect(s).toMatchObject({ effectivePrice: 380000, minQty: 4 })
  })

  it('variant cliff row wins MOQ even at min 1 (overrides product-level min)', () => {
    const productCliff: CliffRow = { variantId: null, customPrice: 380000, minQty: 5 }
    const cliffs = new Map<string, CliffRow>([
      ['k', { variantId: 'k', customPrice: null, minQty: 1 }],
    ])
    const lines = buildVariantLines('p', 400000, productCliff, [
      v('k', [['Size', '1kg']], { price: 450000 }),
      v('s', [['Size', '200g']], { price: 120000 }),
    ], cliffs)
    const k = lines.find((l) => l.variantId === 'k')!
    const s = lines.find((l) => l.variantId === 's')!
    // min 1 overrides the product 5; null customPrice falls through
    expect(k).toMatchObject({ effectivePrice: 380000, minQty: 1 })
    expect(s).toMatchObject({ effectivePrice: 380000, minQty: 5 })
  })

  it('chips sort by gram weight (200g before 1kg), cliff first', () => {
    const lines = buildVariantLines('p', 100000, null, [
      v('kg', [['Size', '1kg']]),
      v('g200', [['Size', '200gram']]),
      v('g500', [['Size', '500 g']]),
    ], noCliffs)
    expect(lines.map((l) => l.variantId)).toEqual(['g200', 'g500', 'kg'])
  })
})

describe('line identity helpers', () => {
  const flat: CatalogProduct = {
    id: 'p1', name: 'House', description: null, unit: 'bag', sku: null,
    imageUrl: null, effectivePrice: 90000, minQty: 3, isGlobal: true,
    isClientAssigned: false, shipWeightGrams: 1000, variants: [],
  }
  const chip: CatalogProduct = { ...flat, variants: [
    { variantId: 'v1', label: '1kg', effectivePrice: 400000, minQty: 5, shipWeightGrams: 1000 },
    { variantId: 'v2', label: '200g', effectivePrice: 120000, minQty: 1, shipWeightGrams: 200 },
  ] }

  it('flat product yields one productId-keyed line', () => {
    const lines = linesOf(flat)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ lineId: 'p1', variantId: null, effectivePrice: 90000, minQty: 3 })
  })

  it('variant product yields variantId-keyed lines', () => {
    const lines = linesOf(chip)
    expect(lines.map((l) => l.lineId)).toEqual(['v1', 'v2'])
    expect(lines.map((l) => l.variantId)).toEqual(['v1', 'v2'])
  })

  it('lineIdOf matches linesOf keying', () => {
    expect(lineIdOf('p1', null)).toBe('p1')
    expect(lineIdOf('p1', 'v1')).toBe('v1')
  })
})