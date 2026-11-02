// lib/catalog.test.ts
//
// #297 guard: after agr-ops migration 068, client_products can hold
// per-variant cliff rows (variant_id NOT NULL). The portal catalog is still
// flat (size chips = portal #90, not built). A variant cliff must never leak
// into the whole-product price — getCatalogForClient must read ONLY the
// variant_id IS NULL row, and must state that filter explicitly.
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
        returns: () => Promise.resolve(RESULT[table]),
      }
      return builder
    },
  }),
}))

const RESULT: Record<string, { data: unknown[]; error: null }> = {}

beforeEach(() => {
  captures.length = 0
  RESULT['products'] = { data: [], error: null }
  RESULT['client_products'] = { data: [], error: null }
})

describe('getCatalogForClient — variant cliff isolation (#297)', () => {
  it('filters client_products to the whole-product row (variant_id IS NULL)', async () => {
    const { getCatalogForClient } = await import('./catalog')
    await getCatalogForClient(CLIENT_ID)

    const cp = captures.find((c) => c.table === 'client_products')
    expect(cp).toBeTruthy()
    expect(cp!.filters).toContainEqual(['eq', 'client_id', CLIENT_ID])
    expect(cp!.filters).toContainEqual(['is', 'variant_id', null])
  })

  it('flat custom_price still wins over base_price for the whole-product row', async () => {
    RESULT['client_products'] = {
      data: [
        {
          custom_price: 85000,
          min_qty: 5,
          variant_id: null,
          products: {
            id: 'p-1', name: 'Gayo', description: null, unit: 'bag', sku: 'G-1',
            base_price: 100000, image_url: null, is_global: false, is_active: true,
            ship_weight_grams: 1000,
          },
        },
      ],
      error: null,
    }
    const { getCatalogForClient } = await import('./catalog')
    const catalog = await getCatalogForClient(CLIENT_ID)
    const p = catalog.find((c) => c.id === 'p-1')
    expect(p).toMatchObject({ effectivePrice: 85000, minQty: 5, isClientAssigned: true })
  })
})
