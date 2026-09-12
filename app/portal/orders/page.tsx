import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/app/portal/_components/LogoutButton'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import OrdersClient from './_components/OrdersClient'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
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

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, fulfillment_status, payment_status, total_amount, shipping_cost, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="min-h-screen bg-brand-black">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-brand-black border-b border-[rgba(245,235,201,0.25)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
            Agroastery
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/portal"
              className="text-brand-parchment text-sm hover:text-brand-crema transition-colors"
              data-testid="back-to-catalog-nav"
            >
              ← Katalog
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-brand-crema">Riwayat Pesanan</h1>

        {!orders || orders.length === 0 ? (
          <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-10 flex flex-col items-center gap-4 text-center">
            <span className="text-4xl opacity-30">📋</span>
            <p className="text-brand-parchment text-sm">Belum ada pesanan.</p>
            <Link
              href="/portal"
              className="text-brand-crema text-sm underline underline-offset-4 hover:text-brand-honey transition-colors"
            >
              Buat pesanan pertama Anda
            </Link>
          </div>
        ) : (
          <>
            <OrdersClient initialOrders={orders} />
            <Link
              href="/portal"
              data-testid="new-order-link"
              className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base hover:bg-brand-honey transition-colors text-center min-h-[44px] flex items-center justify-center"
            >
              Buat Pesanan Baru
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
