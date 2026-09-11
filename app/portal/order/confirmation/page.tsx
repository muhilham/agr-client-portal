'use server'

import { createClient } from '@/lib/supabase/server'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { redirect } from 'next/navigation'
import {
  BANK_ACCOUNTS,
  formatIDR,
} from '@/lib/payment'
import { isPickupOrder, FREE_COURIER_CODE, MANUAL_COURIER_CODE } from '@/lib/shipping'
import Link from 'next/link'

type OrderItems = {
  id: string
  product_name: string
  unit_price: number
  quantity: number
  subtotal: number
}[]

async function ConfirmationContent({
  orderId,
}: {
  orderId: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status !== 'active') redirect('/')

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, fulfillment_status, payment_status, total_amount,
       shipping_cost, shipping_courier, shipping_service, shipping_etd,
       shipping_address, notes, created_at`
    )
    .eq('id', orderId)
    .single()

  if (!order) redirect('/portal')

  const items = (order as unknown as { order_items: OrderItems }).order_items ?? []
  const grandTotal = Number(order.total_amount) + (order.shipping_cost != null ? Number(order.shipping_cost) : 0)

  return (
    <main className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Brand */}
        <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
          Agroastery
        </span>

        {/* Success card */}
        <div
          className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-5 flex flex-col items-center gap-3"
          data-testid="confirmation-card"
        >
          <div className="text-4xl">✅</div>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-brand-crema">
              Pesanan Diterima!
            </h1>
            <p className="text-brand-parchment text-xs leading-relaxed">
              Pesanan Anda telah berhasil dikirim. Tim kami akan segera memprosesnya.
            </p>
          </div>

          <div className="w-full rounded-lg bg-brand-black border border-[rgba(245,235,201,0.15)] px-4 py-2.5">
            <p className="text-brand-parchment text-xs mb-0.5">Nomor Pesanan</p>
            <p
              className="text-brand-crema font-semibold text-base tracking-wider"
              data-testid="order-number"
            >
              {order.order_number}
            </p>
          </div>
        </div>

        {/* Order summary */}
        <div className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden text-left">
          <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
            <p className="text-brand-parchment text-xs uppercase tracking-wider">
              Ringkasan Pesanan
            </p>
          </div>

          {/* Items */}
          <div className="divide-y divide-[rgba(245,235,201,0.1)]">
            {items.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3.5 flex items-center justify-between gap-4"
                data-testid={`confirmation-item-${item.id}`}
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

          {/* Totals */}
          <div className="px-5 py-3.5 border-t border-[rgba(245,235,201,0.25)] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-brand-parchment text-sm">Subtotal</p>
              <p className="text-brand-crema text-sm font-semibold">
                {formatIDR(Number(order.total_amount))}
              </p>
            </div>
            {!isPickupOrder(order as { shipping_courier?: string }) && order.shipping_cost != null && (
              <div className="flex items-center justify-between">
                <p className="text-brand-parchment text-sm">Ongkir</p>
                <p className="text-brand-crema text-sm font-semibold">
                  {formatIDR(Number(order.shipping_cost))}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-[rgba(245,235,201,0.1)]">
              <p className="text-brand-crema text-sm font-medium">Total</p>
              <p
                className="text-brand-honey text-base font-semibold"
                data-testid="confirmation-grand-total"
              >
                {formatIDR(grandTotal)}
              </p>
            </div>
          </div>

          {/* Shipping promise */}
          {!isPickupOrder(order as { shipping_courier?: string }) && (
            <div className="px-5 py-3 border-t border-[rgba(245,235,201,0.15)] flex flex-col gap-1">
              {order.shipping_courier === FREE_COURIER_CODE && (
                <p className="text-brand-parchment text-xs">
                  <span className="text-brand-crema font-medium">Pengiriman: </span>
                  Gratis — estimasi {order.shipping_etd ?? '3–5 hari'}
                </p>
              )}
              {order.shipping_courier === MANUAL_COURIER_CODE && (
                <p className="text-brand-parchment text-xs">
                  <span className="text-brand-crema font-medium">Pengiriman: </span>
                  Manual (dihitung admin)
                </p>
              )}
              {order.shipping_courier &&
                order.shipping_courier !== FREE_COURIER_CODE &&
                order.shipping_courier !== MANUAL_COURIER_CODE && (
                  <p className="text-brand-parchment text-xs">
                    <span className="text-brand-crema font-medium">
                      {order.shipping_courier} — {order.shipping_service}
                    </span>
                    {order.shipping_etd ? ` · Estimasi ${order.shipping_etd}` : ''}
                  </p>
                )}
              <p className="text-brand-parchment text-xs">
                Pesanan diproses dalam 1×24 jam kerja setelah transfer terkonfirmasi.
              </p>
            </div>
          )}

          {isPickupOrder(order as { shipping_courier?: string }) && (
            <div className="px-5 py-3 border-t border-[rgba(245,235,201,0.15)]">
              <p className="text-brand-parchment text-xs">
                <span className="text-brand-crema font-medium">Pengambilan: </span>
                Ambil sendiri di gudang Agroastery
              </p>
            </div>
          )}
        </div>

        {/* Payment instructions — UNPAID only */}
        {order.payment_status === 'UNPAID' && (
          <div className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
            <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
              <p className="text-brand-parchment text-xs uppercase tracking-wider">
                Transfer Pembayaran
              </p>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-brand-parchment text-sm">Total yang harus dibayar</span>
                <span className="text-brand-honey text-lg font-semibold">
                  {formatIDR(grandTotal)}
                </span>
              </div>

              <div className="border-t border-[rgba(245,235,201,0.1)]" />

              {BANK_ACCOUNTS.map(({ bank, account, a_n }) => (
                <div key={bank} className="flex flex-col gap-1">
                  <p className="text-brand-crema text-sm font-medium">{bank}</p>
                  <p className="text-brand-parchment text-xs">Rekening</p>
                  <p className="text-brand-crema text-sm font-mono">{account}</p>
                  <p className="text-brand-parchment text-xs">a.n. {a_n}</p>
                </div>
              ))}

              <div className="border-t border-[rgba(245,235,201,0.1)]" />

              <p className="text-brand-parchment text-xs leading-relaxed">
                Transfer sesuai nominal di atas. Pesanan diproses setelah transfer terkonfirmasi.
              </p>

              <p className="text-brand-parchment text-xs leading-relaxed">
                Tanpa konfirmasi, pesanan tidak dapat diproses.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Link
            href="/portal/orders"
            data-testid="view-orders-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors duration-150 min-h-[44px] flex items-center justify-center"
          >
            Riwayat Pesanan
          </Link>
          <Link
            href="/portal"
            data-testid="back-to-catalog-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            Buat Pesanan Baru
          </Link>
        </div>
      </div>
    </main>
  )
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; orderNumber?: string; grandTotal?: string }>
}) {
  const { id } = await searchParams

  if (!id) {
    redirect('/portal')
  }

  return <ConfirmationContent orderId={id} />
}
