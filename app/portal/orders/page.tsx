import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FulfillmentBadge } from '@/components/FulfillmentBadge'
import { PaymentBadge } from '@/components/PaymentBadge'
import LogoutButton from '@/app/portal/_components/LogoutButton'
import { getClientAccessByEmail } from '@/lib/clients/active-client'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status === 'inactive') redirect('/auth/unauthorized?state=inactive')
  if (clientAccess.status === 'unregistered') redirect('/auth/unauthorized')

  const { client } = clientAccess

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, fulfillment_status, payment_status, total_amount, shipping_cost, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  const fmt = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

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
          <div
            className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-10 flex flex-col items-center gap-4 text-center"
            data-testid="empty-orders"
          >
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
          <div
            className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden"
            data-testid="orders-list"
          >
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
              <p className="text-brand-parchment text-xs uppercase tracking-wider">No. Pesanan</p>
              <p className="text-brand-parchment text-xs uppercase tracking-wider">Tanggal</p>
              <p className="text-brand-parchment text-xs uppercase tracking-wider text-right">Total</p>
              <p className="text-brand-parchment text-xs uppercase tracking-wider">Status</p>
            </div>
            <div className="divide-y divide-[rgba(245,235,201,0.1)]">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="relative group"
                  data-testid={`order-row-${order.id}`}
                >
                  <Link
                    href={`/portal/orders/${order.id}`}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4
                      hover:bg-[rgba(245,235,201,0.04)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between sm:block">
                      <p className="text-brand-crema text-sm font-medium">
                        {order.order_number}
                      </p>
                      <div className="flex gap-1.5">
                        <FulfillmentBadge status={order.fulfillment_status} />
                        <PaymentBadge status={order.payment_status} />
                      </div>
                    </div>
                    <p className="text-brand-parchment text-xs sm:text-sm sm:self-center">
                      {fmt.format(new Date(order.created_at))}
                    </p>
                    <p className="text-brand-crema text-sm font-semibold sm:self-center sm:text-right" data-testid={`order-grand-total-${order.id}`}>
                      {formatIDR(order.total_amount + (order.shipping_cost ?? 0))}
                    </p>
                    <div className="hidden sm:flex sm:self-center">
                      <div className="flex gap-1.5">
                        <FulfillmentBadge status={order.fulfillment_status} />
                        <PaymentBadge status={order.payment_status} />
                      </div>
                    </div>
                  </Link>
                  <Link
                    href={`/portal?reorder=${order.id}`}
                    data-testid={`reorder-row-${order.id}`}
                    title="Pesan Ulang"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover:opacity-100
                      hover:bg-[rgba(245,235,201,0.08)] transition-all text-brand-parchment hover:text-brand-honey"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                      <path d="M8 16H3v5"/>
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/portal"
          data-testid="new-order-link"
          className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
            hover:bg-brand-honey transition-colors text-center min-h-[44px] flex items-center justify-center"
        >
          Buat Pesanan Baru
        </Link>
      </div>
    </main>
  )
}

function formatIDR(amount: number) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}
