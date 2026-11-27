// lib/ratesKey.test.ts — #101: an address switch must produce a new rates key,
// otherwise the review page's 1500ms throttle swallows the re-quote and the
// previous branch's couriers stay on screen for the newly selected address.
import { describe, expect, it } from 'vitest'

import { ratesKey } from './ratesKey'

const CART = [
  { productId: 'p-1', quantity: 2 },
  { productId: 'p-2', variantId: 'v-1', quantity: 1 },
]

describe('ratesKey', () => {
  it('is stable for the same cart and destination', () => {
    expect(ratesKey(CART, 'addr-1')).toBe(ratesKey(CART, 'addr-1'))
  })

  it('changes when only the destination changes', () => {
    expect(ratesKey(CART, 'addr-1')).not.toBe(ratesKey(CART, 'addr-2'))
  })

  it('changes when an address is picked vs left to the server default', () => {
    expect(ratesKey(CART, null)).not.toBe(ratesKey(CART, 'addr-1'))
  })

  it('changes when only the cart quantity changes', () => {
    const heavier = [{ productId: 'p-1', quantity: 3 }]
    expect(ratesKey([{ productId: 'p-1', quantity: 2 }], 'addr-1')).not.toBe(ratesKey(heavier, 'addr-1'))
  })

  it('still distinguishes variant lines of the same product (#90)', () => {
    const a = [{ productId: 'p-2', variantId: 'v-1', quantity: 1 }]
    const b = [{ productId: 'p-2', variantId: 'v-2', quantity: 1 }]
    expect(ratesKey(a, 'addr-1')).not.toBe(ratesKey(b, 'addr-1'))
  })
})
