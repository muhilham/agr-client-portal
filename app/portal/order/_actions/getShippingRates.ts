'use server'

import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getShippingRatesInputSchema } from '@/lib/schemas/order'
import { loadShippingContext, groupRatesByCourier, type AddressDisplay, type RateOption } from '@/lib/shipping'

export type ShippingRatesResult =
  | { ok: true; rates: RateOption[]; address: AddressDisplay }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' | 'INVALID_INPUT' }

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

  const admin = getSupabaseAdmin()
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!client) {
    throw new Error('Client not found')
  }

  const ctx = await loadShippingContext(client.id, parsed.data.items)

  if (!ctx.ok) {
    return { ok: false, error: ctx.error }
  }

  const rates = groupRatesByCourier(ctx.rates)

  return { ok: true, rates, address: ctx.address }
}
