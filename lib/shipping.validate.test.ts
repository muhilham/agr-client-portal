// lib/shipping.validate.test.ts — #90: validateCartItems resolves the
// concrete ORDER LINE (price/MOQ/weight/label) server-side. The client's
// variantId is only a selector: unknown chip, missing chip on a variant
// product, or a chip id on a flat product all fail closed to INVALID_CART.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCatalogForClient = vi.fn()
vi.mock('@/lib/catalog', () => ({
  getCatalogForClient: (...args: unknown[]) => getCatalogForClient(...args),
}))

import { validateCartItems } from './shipping'
import type { CatalogProduct } from './catalog'

const CHIP: CatalogProduct = {
  id: 'p-chip', name: 'Toraja Sapan', description: null, unit: 'bag', sku: null,
  imageUrl: null, effectivePrice: 450000, minQty: 1, isGlobal: true,
  isClientAssigned: false, shipWeightGrams: 1000,
  variants: [
    { variantId: 'v-1k', label: '1kg', effectivePrice: 400000, minQty: 5, shipWeightGrams: 1000 },
    { variantId: 'v-200', label: '200g', effectivePrice: 120000, minQty: 1, shipWeightGrams: 200 },
  ],
}

const FLAT: CatalogProduct = {
  id: 'p-flat', name: 'House Blend', description: null, unit: 'bag', sku: null,
  imageUrl: null, effectivePrice: 90000, minQty: 3, isGlobal: true,
  isClientAssigned: false, shipWeightGrams: 500, variants: [],
}

beforeEach(() => {
  getCatalogForClient.mockResolvedValue([CHIP, FLAT])
})

describe('validateCartItems — per-line resolution (#90)', () => {
  it('resolves chip price, MOQ, weight and server-derived label', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-chip', variantId: 'v-1k', quantity: 5 }])
    expect(r.ok).toBe(true)
    expect(r.ok && r.validatedItems[0]).toMatchObject({
      unitPrice: 400000,
      subtotal: 2000000,
      shipWeightGrams: 1000,
      variantId: 'v-1k',
      variantLabel: '1kg',
    })
  })

  it('rejects chip line below its own MOQ (even above the flat min)', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-chip', variantId: 'v-1k', quantity: 4 }])
    expect(r).toEqual({ ok: false, error: 'INVALID_CART' })
  })

  it('accepts 200g × 3 while 1kg MOQ is 5 — MOQs are per line', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-chip', variantId: 'v-200', quantity: 3 }])
    expect(r.ok && r.validatedItems[0]).toMatchObject({ unitPrice: 120000, variantLabel: '200g' })
  })

  it('rejects a variant-mode product ordered without a chip selector', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-chip', quantity: 5 }])
    expect(r).toEqual({ ok: false, error: 'INVALID_CART' })
  })

  it('rejects an unknown/inactive chip id', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-chip', variantId: 'v-deleted', quantity: 5 }])
    expect(r).toEqual({ ok: false, error: 'INVALID_CART' })
  })

  it('rejects a chip id sent against a flat product', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-flat', variantId: 'v-1k', quantity: 3 }])
    expect(r).toEqual({ ok: false, error: 'INVALID_CART' })
  })

  it('flat product keeps whole-product price/MOQ and no variant fields', async () => {
    const r = await validateCartItems('c1', [{ productId: 'p-flat', quantity: 3 }])
    expect(r.ok && r.validatedItems[0]).toMatchObject({
      unitPrice: 90000,
      shipWeightGrams: 500,
      variantId: null,
      variantLabel: null,
    })
  })
})
