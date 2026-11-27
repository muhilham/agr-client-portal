import { createClient } from '@supabase/supabase-js'

export async function seedClientWithDefaultAddress({
  email,
  addressOverrides = {},
  hasFreeShipping = false,
  clearAddress = false,
}: {
  email: string
  addressOverrides?: Partial<{
    recipient_name: string
    phone: string
    address_line: string
    postal_code: string
    is_default: boolean
  }>
  hasFreeShipping?: boolean
  /** Delete any existing addresses before inserting the default. */
  clearAddress?: boolean
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', email)
    .single()

  if (!client) {
    throw new Error(`Client not found for email: ${email}`)
  }

  if (clearAddress) {
    await supabase.from('addresses').delete().eq('client_id', client.id)
  }

  if (!clearAddress) {
    await supabase.from('addresses').insert({
      client_id: client.id,
      recipient_name: addressOverrides.recipient_name ?? 'Test Recipient',
      phone: addressOverrides.phone ?? '081234567890',
      address_line: addressOverrides.address_line ?? 'Jl. Test No. 1, Jakarta',
      postal_code: addressOverrides.postal_code ?? '12345',
      is_default: addressOverrides.is_default ?? true,
    })
  }

  if (hasFreeShipping) {
    await supabase.from('clients').update({ has_free_shipping: true }).eq('id', client.id)
  }
}

export interface SeedAddressInput {
  label?: string | null
  recipient_name?: string
  phone?: string
  address_line?: string
  postal_code?: string
  latitude?: number | null
  longitude?: number | null
  is_default?: boolean
}

/**
 * #101: replace a client's address list with an exact fixture. Unlike
 * seedClientWithDefaultAddress (which appends), this clears first, so a spec
 * can assert "2 addresses", "1 address" or "0 addresses" deterministically.
 * Passing `hasFreeShipping` also resets the flag — the other helper only ever
 * sets it to true, which leaks the free-shipping branch into later specs.
 */
export async function seedClientAddresses({
  email,
  addresses,
  hasFreeShipping,
}: {
  email: string
  addresses: SeedAddressInput[]
  hasFreeShipping?: boolean
}): Promise<{ clientId: string; addressIds: string[] }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: client } = await supabase.from('clients').select('id').eq('email', email).single()
  if (!client) {
    throw new Error(`Client not found for email: ${email}`)
  }

  const { error: deleteError } = await supabase.from('addresses').delete().eq('client_id', client.id)
  if (deleteError) throw new Error(`Failed to clear addresses: ${deleteError.message}`)

  // Insert row-by-row so the returned ids line up with the fixture order —
  // a bulk insert's RETURNING order is not guaranteed.
  const addressIds: string[] = []
  for (const [index, address] of addresses.entries()) {
    const { data: inserted, error } = await supabase
      .from('addresses')
      .insert({
        client_id: client.id,
        label: address.label ?? null,
        recipient_name: address.recipient_name ?? `Test Recipient ${index + 1}`,
        phone: address.phone ?? '081234567890',
        address_line: address.address_line ?? `Jl. Test No. ${index + 1}, Jakarta`,
        postal_code: address.postal_code ?? '12345',
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
        is_default: address.is_default ?? false,
      })
      .select('id')
      .single()
    if (error || !inserted) throw new Error(`Failed to seed address ${index + 1}: ${error?.message ?? 'no row'}`)
    addressIds.push(inserted.id)
  }

  if (typeof hasFreeShipping === 'boolean') {
    const { error: flagError } = await supabase
      .from('clients')
      .update({ has_free_shipping: hasFreeShipping })
      .eq('id', client.id)
    if (flagError) throw new Error(`Failed to set has_free_shipping: ${flagError.message}`)
  }

  return { clientId: client.id, addressIds }
}
