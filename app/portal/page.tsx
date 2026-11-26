import { createClient } from '@/lib/supabase/server'
import { getCatalogForClient } from '@/lib/catalog'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { redirect } from 'next/navigation'
import CatalogView from './_components/CatalogView'

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ reorder?: string; src?: string }>
}) {
  const { reorder, src } = await searchParams
  // Attribution-only marker from WhatsApp stock-reminder links (agr-ops scanner).
  const isFromReminder = src === 'reminder'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status === 'inactive') redirect('/auth/unauthorized?state=inactive')
  if (clientAccess.status === 'unregistered') {
    const params = new URLSearchParams({ state: 'unregistered', email: user.email })
    redirect(`/auth/unauthorized?${params}`)
  }

  const { client } = clientAccess

  const catalog = await getCatalogForClient(client.id)

  // #411 decision 6: read the ledger through the client-RLS view; the
  // card renders only when ≥1 entry exists (count>0), never on balance alone.
  const [{ data: creditBal }, { count: creditEntryCount }] = await Promise.all([
    supabase
      .from('client_credit_balances')
      .select('balance')
      .eq('client_id', client.id)
      .maybeSingle(),
    supabase
      .from('credit_entries')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id),
  ])
  const credit = (creditEntryCount ?? 0) > 0
    ? { hasCredit: true, balance: Number(creditBal?.balance ?? 0) }
    : null

  return <CatalogView client={client} email={user.email} catalog={catalog} reorderOrderId={reorder} fromReminder={isFromReminder} credit={credit} />
}
