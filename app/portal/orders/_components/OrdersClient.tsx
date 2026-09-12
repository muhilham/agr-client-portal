'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { FulfillmentBadge } from '@/components/FulfillmentBadge'
import { PaymentBadge } from '@/components/PaymentBadge'

type Order = {
  id: string
  order_number: string
  fulfillment_status: string
  payment_status: string
  total_amount: number
  shipping_cost: number | null
  created_at: string
}

const PAGE_SIZE = 20

const FULFILLMENT_FILTERS = [
  { value: 'all', label: 'Semua Status' },
  { value: 'PENDING', label: 'Sedang Diproses' },
  { value: 'SHIPPED', label: 'Sudah Dikirim' },
  { value: 'DELIVERED', label: 'Diterima' },
  { value: 'CANCELLED', label: 'Batal' },
]

const PAYMENT_FILTERS = [
  { value: 'all', label: 'Semua Pembayaran' },
  { value: 'PAID', label: 'Lunas' },
  { value: 'UNPAID', label: 'Belum Lunas' },
]

function formatIDR(amount: number) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

function formatMonth(ts: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'long',
    year: 'numeric',
  }).format(new Date(ts))
}

function formatDate(ts: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts))
}

export default function OrdersClient({
  initialOrders,
}: {
  initialOrders: Order[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [displayedOrders, setDisplayedOrders] = useState<Order[]>(initialOrders)
  const [hasMore, setHasMore] = useState(initialOrders.length === PAGE_SIZE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fulfillmentFilter = searchParams.get('fulfillment') ?? 'all'
  const paymentFilter = searchParams.get('payment') ?? 'all'

  // Client-side filter over all fetched orders
  const filteredOrders = useMemo(() => {
    return displayedOrders.filter((o) => {
      const matchFulfillment = fulfillmentFilter === 'all' || o.fulfillment_status === fulfillmentFilter
      const matchPayment = paymentFilter === 'all' || o.payment_status === paymentFilter
      return matchFulfillment && matchPayment
    })
  }, [displayedOrders, fulfillmentFilter, paymentFilter])

  // Group by month
  const groupedOrders = useMemo(() => {
    const groups: { month: string; orders: Order[] }[] = []
    for (const order of filteredOrders) {
      const month = formatMonth(order.created_at)
      const last = groups[groups.length - 1]
      if (last && last.month === month) {
        last.orders.push(order)
      } else {
        groups.push({ month, orders: [order] })
      }
    }
    return groups
  }, [filteredOrders])

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`/orders?${params.toString()}`, { scroll: false })
  }

  async function loadMore() {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const lastOrder = displayedOrders[displayedOrders.length - 1]
      const params = new URLSearchParams({
        after: lastOrder.id,
        limit: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) throw new Error('Failed to load more orders')
      const { orders: nextOrders } = await res.json() as { orders: Order[] }
      setDisplayedOrders((prev) => [...prev, ...nextOrders])
      setHasMore(nextOrders.length === PAGE_SIZE)
    } catch (err) {
      console.error('[OrdersClient] loadMore failed:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={fulfillmentFilter}
          onChange={(e) => setFilter('fulfillment', e.target.value)}
          className="rounded-lg border border-[rgba(245,235,201,0.25)] bg-brand-midnight text-brand-parchment text-sm px-3 py-2 min-h-[44px] focus:outline-none focus:border-brand-crema"
          aria-label="Filter status pengiriman"
        >
          {FULFILLMENT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setFilter('payment', e.target.value)}
          className="rounded-lg border border-[rgba(245,235,201,0.25)] bg-brand-midnight text-brand-parchment text-sm px-3 py-2 min-h-[44px] focus:outline-none focus:border-brand-crema"
          aria-label="Filter status pembayaran"
        >
          {PAYMENT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {(fulfillmentFilter !== 'all' || paymentFilter !== 'all') && (
          <button
            onClick={() => router.push('/orders', { scroll: false })}
            className="text-sm text-brand-parchment hover:text-brand-crema transition-colors underline underline-offset-4 min-h-[44px] flex items-center"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-10 flex flex-col items-center gap-4 text-center">
          <span className="text-4xl opacity-30">🔍</span>
          <p className="text-brand-parchment text-sm">Tidak ada pesanan yang cocok dengan filter.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
          {groupedOrders.map((group) => (
            <div key={group.month}>
              {/* Sticky month header */}
              <div className="sticky top-[65px] z-10 bg-brand-midnight border-b border-[rgba(245,235,201,0.15)] px-5 py-2">
                <p className="text-brand-parchment text-xs font-medium uppercase tracking-wider">
                  {group.month}
                </p>
              </div>
              <div className="divide-y divide-[rgba(245,235,201,0.1)]">
                {group.orders.map((order) => (
                  <div
                    key={order.id}
                    className="relative group"
                    data-testid={`order-row-${order.id}`}
                  >
                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4 hover:bg-[rgba(245,235,201,0.04)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between sm:block">
                        <p className="text-brand-crema text-sm font-medium">{order.order_number}</p>
                        <div className="flex gap-1.5 sm:hidden">
                          <FulfillmentBadge status={order.fulfillment_status} />
                          <PaymentBadge status={order.payment_status} />
                        </div>
                      </div>
                      <p className="text-brand-parchment text-xs sm:text-sm sm:self-center">
                        {formatDate(order.created_at)}
                      </p>
                      <p className="text-brand-crema text-sm font-semibold sm:self-center sm:text-right" data-testid={`order-grand-total-${order.id}`}>
                        {formatIDR(order.total_amount + (order.shipping_cost ?? 0))}
                      </p>
                      <div className="hidden sm:flex sm:self-center gap-1.5">
                        <FulfillmentBadge status={order.fulfillment_status} />
                        <PaymentBadge status={order.payment_status} />
                      </div>
                    </Link>
                    <Link
                      href={`/portal?reorder=${order.id}`}
                      data-testid={`reorder-row-${order.id}`}
                      aria-label="Pesan Ulang"
                      title="Pesan Ulang"
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[rgba(245,235,201,0.08)] transition-all text-brand-parchment hover:text-brand-honey"
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
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoadingMore}
          className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-parchment text-sm font-medium hover:bg-[rgba(245,235,201,0.08)] transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {isLoadingMore ? 'Memuat...' : 'Tampilkan lebih banyak'}
        </button>
      )}
    </div>
  )
}
