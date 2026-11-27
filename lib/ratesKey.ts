/**
 * #101: identity of a shipping-rate request.
 *
 * The destination address is part of the key on purpose: the review page
 * throttles identical rate calls, so a key that only covered cart lines would
 * swallow an address switch (and leave the previous branch's couriers on
 * screen). Extracted here so the rule is unit-testable without rendering the
 * page.
 */
export interface RateKeyItem {
  productId: string
  variantId?: string | null
  quantity: number
}

export function ratesKey(items: RateKeyItem[], addressId: string | null): string {
  const lines = items
    .map((i) => `${i.productId}:${i.variantId ?? ''}:${i.quantity}`)
    .join(',')
  return `${lines}|addr:${addressId ?? ''}`
}
