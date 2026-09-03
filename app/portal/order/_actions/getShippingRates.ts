'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveClientByEmail } from '@/lib/clients/active-client'
import { getShippingRatesInputSchema } from '@/lib/schemas/order'
import { loadShippingContext, groupRatesByCourier, type AddressDisplay, type RateOption } from '@/lib/shipping'

export type ShippingRatesResult =
  | { ok: true; kind: 'free_shipping'; address: AddressDisplay }
  | { ok: true; kind: 'rates'; rates: RateOption[]; address: AddressDisplay }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' | 'INVALID_INPUT' | 'ACCOUNT_INACTIVE' }

export async function getShippingRates(input: unknown): Promise<ShippingRatesResult> {
  const parsed = getShippingRatesInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'INVALID_INPUT' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthenticated')
  }

  const client = await getActiveClientByEmail(user.email)
  if (!client) {
    return { ok: false, error: 'ACCOUNT_INACTIVE' }
  }

  const ctx = await loadShippingContext(client.id, parsed.data.items)

  if (!ctx.ok) {
    return { ok: false, error: ctx.error }
  }

  if (ctx.kind === 'free_shipping') {
    return { ok: true, kind: 'free_shipping', address: ctx.address }
  }

  const rates = groupRatesByCourier(ctx.rates)

  return { ok: true, kind: 'rates', rates, address: ctx.address }
}
