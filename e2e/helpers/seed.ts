import { createClient } from '@supabase/supabase-js'

export async function seedClientWithDefaultAddress({
  email,
  addressOverrides = {},
  hasFreeShipping = false,
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

  await supabase.from('addresses').insert({
    client_id: client.id,
    recipient_name: addressOverrides.recipient_name ?? 'Test Recipient',
    phone: addressOverrides.phone ?? '081234567890',
    address_line: addressOverrides.address_line ?? 'Jl. Test No. 1, Jakarta',
    postal_code: addressOverrides.postal_code ?? '12345',
    is_default: addressOverrides.is_default ?? true,
  })

  if (hasFreeShipping) {
    await supabase.from('clients').update({ has_free_shipping: true }).eq('id', client.id)
  }
}
