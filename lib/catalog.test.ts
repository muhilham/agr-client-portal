// lib/catalog.test.ts
//
// #90 catalog resolution: client_products holds BOTH whole-product cliff
// rows (variant_id NULL) and per-variant cliff rows (variant_id NOT NULL).
// Invariants:
//  1. whole-product price/MOQ may only come from the variant_id IS NULL row
//     (the #297 isolation guard — now enforced in code, not query filter);
//  2. variant cliff rows price the concrete chip line via product_variants
//     + option-value resolution (§rule 3);
//  3. products whose variants resolve no size labels stay flat.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Captured = { table: string; filters: Array<[string, ...unknown[]]> }

const captures: Captured[] = []

const CLIENT_ID = 'client-1'

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      const capture: Captured = { table, filters: [] }
      captures.push(capture)
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          capture.filters.push(['eq', col, val])
          return builder
        },
        is: (col: string, val: unknown) => {
          capture.filters.push(['is', col, val])
          return builder
        },
        in: (col: string, vals: unknown[]) => {
          capture.filters.push(['in', col, [...vals]])
          return builder
        },
        returns: () => Promise.resolve(RESULT[table] ?? { data: [], error: null }),
      }
      return builder
    },
  }),
}))

const RESULT: Record<string, { data: unknown[]; error: null }> = {}

function productRow(over: Record<string, unknown> = {}) {
  return {
    id: 'p-1', name: 'Gayo', description: null, unit: 'bag', sku: 'G-1',
    base_price: 100000, image_url: null, is_global: false, is_active: true,
    ship_weight_grams: 1000, ...over,
  }
}

/** option-value junction shaped exactly like the PostgREST embed. */
function variantRow(over: Record<string, unknown>, axes: Array<[string, string]>) {
  return {
    id: `v-${Math.random().toString(36).slice(2, 8)}`,
    product_id: 'p-1', sku: null, price: 100000, is_active: true,
    ship_weight_grams: 1000,
    product_variant_option_values: axes.map(([axis, value]) => ({
      product_option_values: { value, product_options: { name: axis } },
    })),
    ...over,
  }
}

beforeEach(() => {
  captures.length = 0
  RESULT['products'] = { data: [], error: null }
  RESULT['client_products'] = { data: [], error: null }
  RESULT['product_variants'] = { data: [], error: null }
})

describe('getCatalogForClient — whole-product cliff isolation (#297/#90)', () => {
  it('loads both cliff row kinds (no query-level variant_id filter anymore)', async () => {
    RESULT['client_products'] = {
      data: [
        { custom_price: 85000, min_qty: 5, variant_id: null, products: productRow() },
        { custom_price: 90000, min_qty: 3, variant_id: 'v-x', products: productRow() },
      ],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')
    // the variant row must NOT leak into whole-product pricing
    expect(p).toMatchObject({ effectivePrice: 85000, minQty: 5, isClientAssigned: true })
    expect(p!.variants).toEqual([]) // no eligible size chips in this fixture
  })

  it('flat custom_price still wins over base_price for the whole-product row', async () => {
    RESULT['client_products'] = {
      data: [{ custom_price: 85000, min_qty: 5, variant_id: null, products: productRow() }],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')
    expect(p).toMatchObject({ effectivePrice: 85000, minQty: 5, isClientAssigned: true })
  })

  it('a variant-cliff-only assignment makes the product visible at base_price', async () => {
    RESULT['client_products'] = {
      data: [{ custom_price: 90000, min_qty: 3, variant_id: 'v-ghost', products: productRow() }],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')
    expect(p).toMatchObject({ effectivePrice: 100000, minQty: 1, isClientAssigned: true })
  })
})

describe('getCatalogForClient — size chips (#90 §rule 3)', () => {
  it('collapses same-price grind variants into one chip bound to a canonical row', async () => {
    RESULT['products'] = { data: [productRow({ is_global: true })], error: null }
    RESULT['product_variants'] = {
      data: [
        variantRow({ id: 'v-1' }, [['Size', '1kg'], ['Varian', 'Grind Medium']]),
        variantRow({ id: 'v-2' }, [['Size', '1kg'], ['Varian', 'Grind Fine']]),
        variantRow({ id: 'v-3' }, [['Size', '1kg'], ['Varian', 'Whole Beans']]),
      ],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')!
    expect(p.variants).toHaveLength(1)
    // beans-preferred canonical binding (grind rows are B2C artifacts)
    expect(p.variants[0]).toMatchObject({ variantId: 'v-3', label: '1kg', effectivePrice: 100000, minQty: 1 })
  })

  it('prices the cliff chip and keeps sibling chips at marketplace price', async () => {
    RESULT['products'] = { data: [productRow({ is_global: true })], error: null }
    RESULT['client_products'] = {
      data: [{ custom_price: 400000, min_qty: 5, variant_id: 'v-200', products: productRow() }],
      error: null,
    }
    RESULT['product_variants'] = {
      data: [
        variantRow({ id: 'v-200', price: 500000 }, [['Size', '200g']]),
        variantRow({ id: 'v-1k', price: 421000 }, [['Size', '1kg']]),
      ],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')!
    // cliff chip sorts first (default line for card + re-cart)
    expect(p.variants.map((v) => v.variantId)).toEqual(['v-200', 'v-1k'])
    expect(p.variants[0]).toMatchObject({ label: '200g', effectivePrice: 400000, minQty: 5 })
    expect(p.variants[1]).toMatchObject({ label: '1kg', effectivePrice: 421000, minQty: 1 })
  })

  it('splits a mixed-price size group into one chip per price tier', async () => {
    // live shape: BRAZIL CERRADO 1kg — 421k (Grind Coarse only) vs
    // 424k (Medium + Fine + Whole Beans)
    RESULT['products'] = { data: [productRow({ is_global: true })], error: null }
    RESULT['product_variants'] = {
      data: [
        variantRow({ id: 'v-c', price: 421000 }, [['Size', '1Kg'], ['Varian', 'Grind Coarse']]),
        variantRow({ id: 'v-m', price: 424000 }, [['Size', '1Kg'], ['Varian', 'Grind Medium']]),
        variantRow({ id: 'v-f', price: 424000 }, [['Size', '1Kg'], ['Varian', 'Grind Fine']]),
        variantRow({ id: 'v-b', price: 424000 }, [['Size', '1Kg'], ['Varian', 'Whole Beans']]),
      ],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')!
    expect(p.variants).toHaveLength(2)
    const byPrice = Object.fromEntries(p.variants.map((v) => [v.effectivePrice, v]))
    // single-member tier carries the disambiguating remainder
    expect(byPrice[421000]).toMatchObject({ variantId: 'v-c', label: '1Kg · Grind Coarse' })
    // multi-member tier binds beans-preferred canonical, plain size label
    expect(byPrice[424000]).toMatchObject({ variantId: 'v-b', label: '1Kg' })
  })

  it('grind-only products stay flat (no chips)', async () => {
    RESULT['products'] = { data: [productRow({ is_global: true })], error: null }
    RESULT['product_variants'] = {
      data: [
        variantRow({ id: 'v-g1' }, [['Varian', 'Grind Medium']]),
        variantRow({ id: 'v-g2' }, [['Varian', 'Whole Beans']]),
      ],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')!
    expect(p.variants).toEqual([])
    expect(p.effectivePrice).toBe(100000)
  })
})
