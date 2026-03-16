'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrder } from '../_actions/createOrder'
import { CartItem } from '../../_components/CatalogView'

export default function OrderReviewPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('cart')
    if (!stored) {
      router.replace('/portal')
      return
    }
    try {
      setCart(JSON.parse(stored))
    } catch {
      router.replace('/portal')
      return
    }
    setLoaded(true)
  }, [router])

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const order = await createOrder({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        notes: notes.trim() || undefined,
      })
      sessionStorage.removeItem('cart')
      router.push(`/portal/order/confirmation?id=${order.id}&orderNumber=${encodeURIComponent(order.order_number)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.')
      setSubmitting(false)
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="text-brand-parchment text-sm">Memuat…</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-brand-black">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-brand-black border-b border-[rgba(245,235,201,0.25)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
            Agroastery
          </span>
          <Link
            href="/portal"
            className="text-brand-parchment text-sm hover:text-brand-crema transition-colors"
            data-testid="back-to-catalog-link"
          >
            ← Katalog
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-brand-crema">Review Pesanan</h1>

        {/* Items */}
        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
            <p className="text-brand-parchment text-xs uppercase tracking-wider">Item Pesanan</p>
          </div>
          <div className="divide-y divide-[rgba(245,235,201,0.1)]">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="px-5 py-4 flex items-center justify-between gap-4"
                data-testid={`order-item-${item.productId}`}
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-brand-crema text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-brand-parchment text-xs">
                    {item.quantity} {item.unit} × {formatIDR(item.unitPrice)}
                  </p>
                </div>
                <p className="text-brand-crema text-sm font-semibold whitespace-nowrap">
                  {formatIDR(item.unitPrice * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-[rgba(245,235,201,0.25)] flex items-center justify-between">
            <p className="text-brand-parchment text-sm font-medium">Total</p>
            <p className="text-brand-crema text-lg font-semibold" data-testid="order-total">
              {formatIDR(total)}
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="notes"
            className="text-brand-parchment text-sm"
          >
            Catatan (opsional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 200))}
            maxLength={200}
            rows={3}
            placeholder="Instruksi pengiriman, catatan khusus…"
            data-testid="notes-input"
            className="rounded-lg border border-[rgba(245,235,201,0.25)] bg-brand-midnight text-brand-crema
              placeholder:text-brand-parchment placeholder:opacity-50 px-4 py-3 text-[16px]
              focus:outline-none focus:border-brand-crema resize-none"
          />
          <p className="text-brand-parchment text-xs opacity-50 text-right">
            {notes.length}/200
          </p>
        </div>

        {error && (
          <div
            className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-red-300 text-sm"
            data-testid="order-error"
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting || cart.length === 0}
            data-testid="confirm-order-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors duration-150
              disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
          >
            {submitting ? 'Memproses…' : 'Konfirmasi Pesanan'}
          </button>
          <Link
            href="/portal"
            data-testid="back-to-catalog-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            ← Kembali ke Katalog
          </Link>
        </div>
      </div>
    </main>
  )
}

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}
