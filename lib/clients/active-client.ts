import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type ActiveClient = {
  id: string
  name: string
  company_name: string
}

export type ClientAccessResult =
  | { status: 'active'; client: ActiveClient }
  | { status: 'inactive' }
  | { status: 'unregistered' }

export async function getActiveClientByEmail(email: string): Promise<ActiveClient | null> {
  const { data: client } = await getSupabaseAdmin()
    .from('clients')
    .select('id, name, company_name')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()

  return client
}

export async function getClientAccessByEmail(email: string): Promise<ClientAccessResult> {
  const activeClient = await getActiveClientByEmail(email)
  if (activeClient) {
    return { status: 'active', client: activeClient }
  }

  const { data: client } = await getSupabaseAdmin()
    .from('clients')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  return client ? { status: 'inactive' } : { status: 'unregistered' }
}
