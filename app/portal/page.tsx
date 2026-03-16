import { createClient } from '@/lib/supabase/server'
import { getCatalogForClient } from '@/lib/catalog'
import { redirect } from 'next/navigation'
import CatalogView from './_components/CatalogView'

export default async function PortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company_name')
    .eq('email', user.email)
    .single()

  if (!client) redirect('/auth/unauthorized')

  const catalog = await getCatalogForClient(client.id)

  return <CatalogView client={client} catalog={catalog} />
}
