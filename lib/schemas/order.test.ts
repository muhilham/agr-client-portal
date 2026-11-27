// lib/schemas/order.test.ts — #101: addressId is an optional UUID selector on
// every shipping mode. Malformed ids must be rejected before any server call so
// the action can never be handed arbitrary text.
import { describe, expect, it } from 'vitest'

import { createOrderInputSchema, getShippingRatesInputSchema } from './order'

const ADDRESS_ID = '11111111-2222-4333-8444-555555555555'
const PRODUCT_ID = '99999999-8888-4777-8666-555555555555'
const ITEMS = [{ productId: PRODUCT_ID, quantity: 1 }]

describe('getShippingRatesInputSchema — address picker (#101)', () => {
  it('accepts an omitted addressId (single-address clients keep today\'s flow)', () => {
    expect(getShippingRatesInputSchema.safeParse({ items: ITEMS }).success).toBe(true)
  })

  it('accepts a uuid addressId', () => {
    const parsed = getShippingRatesInputSchema.safeParse({ items: ITEMS, addressId: ADDRESS_ID })
    expect(parsed.success && parsed.data.addressId).toBe(ADDRESS_ID)
  })

  it('rejects a non-uuid addressId', () => {
    expect(getShippingRatesInputSchema.safeParse({ items: ITEMS, addressId: 'not-a-uuid' }).success).toBe(
      false
    )
  })
})

describe('createOrderInputSchema — address picker (#101)', () => {
  it.each([
    [{ mode: 'free' as const }],
    [{ mode: 'manual' as const }],
    [{ mode: 'biteship' as const, courier_code: 'jne', service_code: 'REG' }],
  ])('accepts the chosen address on %o', (selection) => {
    const parsed = createOrderInputSchema.safeParse({
      items: ITEMS,
      fulfillmentMethod: 'SHIPPING',
      shippingSelection: { ...selection, addressId: ADDRESS_ID },
    })
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.shippingSelection?.addressId).toBe(ADDRESS_ID)
  })

  it('rejects a non-uuid addressId in every mode', () => {
    for (const selection of [
      { mode: 'free' as const },
      { mode: 'manual' as const },
      { mode: 'biteship' as const, courier_code: 'jne', service_code: 'REG' },
    ]) {
      const parsed = createOrderInputSchema.safeParse({
        items: ITEMS,
        fulfillmentMethod: 'SHIPPING',
        shippingSelection: { ...selection, addressId: 'branch-2' },
      })
      expect(parsed.success).toBe(false)
    }
  })

  it('still ignores an address on PICKUP orders (no address is shipped)', () => {
    const parsed = createOrderInputSchema.safeParse({
      items: ITEMS,
      fulfillmentMethod: 'PICKUP',
    })
    expect(parsed.success).toBe(true)
  })
})
