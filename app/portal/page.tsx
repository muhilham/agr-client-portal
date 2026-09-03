import { createClient } from '@/lib/supabase/server'
import { getCatalogForClient } from '@/lib/catalog'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { redirect } from 'next/navigation'
import CatalogView from './_components/CatalogView'

export default async function PortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status === 'inactive') redirect('/auth/unauthorized?state=inactive')
  if (clientAccess.status === 'unregistered') redirect('/auth/unauthorized')

  const { client } = clientAccess

  const catalog = await getCatalogForClient(client.id)

  return <CatalogView client={client} catalog={catalog} />
}
