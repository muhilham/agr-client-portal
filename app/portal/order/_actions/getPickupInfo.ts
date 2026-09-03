'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveClientByEmail } from '@/lib/clients/active-client'
import { getShippingRatesInputSchema } from '@/lib/schemas/order'
import { validateCartItems, getPickupLocation, type PickupLocation } from '@/lib/shipping'

export type PickupInfoResult =
  | { ok: true; location: PickupLocation }
  | { ok: false; error: 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'INVALID_INPUT' | 'ACCOUNT_INACTIVE' }

export async function getPickupInfo(input: unknown): Promise<PickupInfoResult> {
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

  const itemsResult = await validateCartItems(client.id, parsed.data.items)
  if (!itemsResult.ok) {
    return { ok: false, error: itemsResult.error }
  }

  const location = await getPickupLocation()
  if (!location) {
    return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
  }

  return { ok: true, location }
}
