import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { FulfillmentBadge } from '@/components/FulfillmentBadge'
import { PaymentBadge } from '@/components/PaymentBadge'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, fulfillment_status, payment_status, total_amount, shipping_cost, shipping_courier, shipping_service, shipping_etd, notes, created_at, updated_at,
      order_items (id, product_name, unit_price, quantity, subtotal)
    `)
    .eq('id', id)
    .single()

  // RLS ensures clients can only fetch their own orders
  if (!order) notFound()

  const fmt = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <main className="min-h-screen bg-brand-black">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-brand-black border-b border-[rgba(245,235,201,0.25)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
            Agroastery
          </span>
          <Link
            href="/portal/orders"
            className="text-brand-parchment text-sm hover:text-brand-crema transition-colors"
            data-testid="back-to-orders-link"
          >
            ← Pesanan
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-brand-crema" data-testid="order-number">
              {order.order_number}
            </h1>
            <p className="text-brand-parchment text-xs">
              {fmt.format(new Date(order.created_at))} WIB
            </p>
          </div>
          <div className="flex gap-1.5">
            <FulfillmentBadge status={order.fulfillment_status} />
            <PaymentBadge status={order.payment_status} />
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
            <p className="text-brand-parchment text-xs uppercase tracking-wider">Item</p>
          </div>
          <div className="divide-y divide-[rgba(245,235,201,0.1)]">
            {order.order_items.map((item) => (
              <div
                key={item.id}
                className="px-5 py-4 flex items-center justify-between gap-4"
                data-testid={`order-item-${item.id}`}
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-brand-crema text-sm font-medium truncate">
                    {item.product_name}
                  </p>
                  <p className="text-brand-parchment text-xs">
                    {item.quantity} × {formatIDR(item.unit_price)}
                  </p>
                </div>
                <p className="text-brand-crema text-sm font-semibold whitespace-nowrap">
                  {formatIDR(item.subtotal)}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-[rgba(245,235,201,0.25)] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-brand-parchment text-sm">Subtotal</p>
              <p className="text-brand-crema text-sm font-semibold" data-testid="order-subtotal">
                {formatIDR(order.total_amount)}
              </p>
            </div>
            {order.shipping_cost != null && (
              <div className="flex items-center justify-between">
                <p className="text-brand-parchment text-sm">Ongkir</p>
                <p className="text-brand-crema text-sm font-semibold">
                  {formatIDR(order.shipping_cost)}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-[rgba(245,235,201,0.1)]">
              <p className="text-brand-crema text-sm font-medium">Total</p>
              <p className="text-brand-crema text-lg font-semibold" data-testid="order-grand-total">
                {formatIDR(order.total_amount + (order.shipping_cost ?? 0))}
              </p>
            </div>
          </div>
        </div>

        {order.shipping_cost != null && (
          <section data-testid="order-shipping-section">
            <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
                <p className="text-brand-parchment text-xs uppercase tracking-wider">Pengiriman</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-1">
                <div data-testid="order-shipping-courier" className="text-brand-crema text-sm">
                  Kurir: {order.shipping_courier} — {order.shipping_service}
                </div>
                <div data-testid="order-shipping-etd" className="text-brand-parchment text-sm">
                  Estimasi: {order.shipping_etd}
                </div>
                <div data-testid="order-shipping-cost" className="text-brand-crema text-sm font-semibold">
                  Biaya: {formatIDR(order.shipping_cost)}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-2">
            <p className="text-brand-parchment text-xs uppercase tracking-wider">
              Catatan
            </p>
            <p
              className="text-brand-crema text-sm leading-relaxed"
              data-testid="order-notes"
            >
              {order.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/portal"
            data-testid="new-order-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors text-center min-h-[44px] flex items-center justify-center"
          >
            Buat Pesanan Baru
          </Link>
          <Link
            href="/portal/orders"
            data-testid="back-to-orders-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            ← Riwayat Pesanan
          </Link>
        </div>
      </div>
    </main>
  )
}

function formatIDR(amount: number) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}
