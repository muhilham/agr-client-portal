'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrder } from '../_actions/createOrder'
import { getShippingRates } from '../_actions/getShippingRates'
import { getPickupInfo } from '../_actions/getPickupInfo'
import { CartItem } from '../../_components/CatalogView'
import AddressCard, { AddressCardEmpty } from './_components/AddressCard'
import CourierPicker from './_components/CourierPicker'
import FulfillmentToggle, { type FulfillmentMethod } from './_components/FulfillmentToggle'
import PickupInfoCard from './_components/PickupInfoCard'
import type { RateOption, AddressDisplay, PickupLocation } from '@/lib/shipping'

type RatesState =
  | { kind: 'loading' }
  | { kind: 'ready'; rates: RateOption[]; address: AddressDisplay }
  | { kind: 'no_address' }
  | { kind: 'error'; message: string }

type PickupState =
  | { kind: 'loading' }
  | { kind: 'ready'; location: PickupLocation }
  | { kind: 'error'; message: string }

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

async function loadShippingRates(
  items: CartItem[],
  setRatesState: React.Dispatch<React.SetStateAction<RatesState>>,
  setSelectedRate: React.Dispatch<React.SetStateAction<RateOption | null>>,
  requestIdRef: React.MutableRefObject<number>,
  myRequestId: number
) {
  setRatesState({ kind: 'loading' })
  setSelectedRate(null)
  const result = await getShippingRates({
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  })
  if (requestIdRef.current !== myRequestId) return // a newer request superseded this one — ignore
  if (!result.ok) {
    if (result.error === 'NO_ADDRESS') {
      setRatesState({ kind: 'no_address' })
    } else {
      const messages: Record<string, string> = {
        INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
        ORIGIN_NOT_CONFIGURED: 'Pengiriman tidak tersedia, hubungi admin',
        RATES_UNAVAILABLE: 'Tidak dapat menghitung ongkir saat ini',
        INVALID_INPUT: 'Permintaan tidak valid',
      }
      setRatesState({ kind: 'error', message: messages[result.error] ?? 'Terjadi kesalahan' })
    }
    return
  }
  setRatesState({ kind: 'ready', rates: result.rates, address: result.address })
}

async function loadPickupInfo(
  items: CartItem[],
  setPickupState: React.Dispatch<React.SetStateAction<PickupState>>,
  requestIdRef: React.MutableRefObject<number>,
  myRequestId: number
) {
  setPickupState({ kind: 'loading' })
  const result = await getPickupInfo({
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  })
  if (requestIdRef.current !== myRequestId) return // a newer request superseded this one — ignore
  if (!result.ok) {
    const messages: Record<string, string> = {
      INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
      ORIGIN_NOT_CONFIGURED: 'Pengambilan tidak tersedia, hubungi admin',
      INVALID_INPUT: 'Permintaan tidak valid',
    }
    setPickupState({ kind: 'error', message: messages[result.error] ?? 'Terjadi kesalahan' })
    return
  }
  setPickupState({ kind: 'ready', location: result.location })
}

export default function OrderReviewPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = sessionStorage.getItem('cart')
    if (!stored) return []
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('SHIPPING')
  const [ratesState, setRatesState] = useState<RatesState>({ kind: 'loading' })
  const [selectedRate, setSelectedRate] = useState<RateOption | null>(null)
  const [pickupState, setPickupState] = useState<PickupState>({ kind: 'loading' })
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (cart.length === 0) {
      router.replace('/portal')
      return
    }
    const myRequestId = ++requestIdRef.current
    if (fulfillmentMethod === 'SHIPPING') {
      loadShippingRates(cart, setRatesState, setSelectedRate, requestIdRef, myRequestId)
    } else {
      loadPickupInfo(cart, setPickupState, requestIdRef, myRequestId)
    }
  }, [router, cart, fulfillmentMethod])

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const shippingCost = fulfillmentMethod === 'PICKUP' ? 0 : (selectedRate?.price ?? 0)
  const grandTotal = subtotal + shippingCost

  const handleConfirm = async () => {
    if (fulfillmentMethod === 'SHIPPING' && (!selectedRate || ratesState.kind !== 'ready')) return
    if (fulfillmentMethod === 'PICKUP' && pickupState.kind !== 'ready') return

    setSubmitting(true)
    setError(null)

    const result = await createOrder({
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      notes: notes.trim() || undefined,
      fulfillmentMethod,
      shippingSelection:
        fulfillmentMethod === 'SHIPPING' && selectedRate
          ? { courier_code: selectedRate.courier_code, service_code: selectedRate.service_code }
          : undefined,
    })

    if (!result.ok) {
      if (result.error === 'Kurir tidak lagi tersedia, silakan pilih ulang') {
        setRatesState({ kind: 'loading' })
        const myRequestId = ++requestIdRef.current
        loadShippingRates(cart, setRatesState, setSelectedRate, requestIdRef, myRequestId)
      }
      setError(result.error)
      setSubmitting(false)
      return
    }

    sessionStorage.removeItem('cart')
    router.push(
      `/portal/order/confirmation?id=${result.id}&orderNumber=${encodeURIComponent(result.order_number)}`
    )
  }

  const canSubmit =
    fulfillmentMethod === 'SHIPPING'
      ? ratesState.kind === 'ready' && selectedRate != null
      : pickupState.kind === 'ready'

  const isLoading =
    fulfillmentMethod === 'SHIPPING' ? ratesState.kind === 'loading' : pickupState.kind === 'loading'

  if (isLoading) {
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
            <p className="text-brand-parchment text-sm font-medium">Subtotal</p>
            <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-subtotal">
              {formatIDR(subtotal)}
            </p>
          </div>
        </div>

        {/* Fulfillment */}
        <div data-testid="shipping-section" className="flex flex-col gap-3">
          <p className="text-brand-parchment text-xs uppercase tracking-wider">Pengiriman</p>

          <FulfillmentToggle value={fulfillmentMethod} onChange={setFulfillmentMethod} />

          {fulfillmentMethod === 'SHIPPING' && (
            <>
              {ratesState.kind === 'no_address' && <AddressCardEmpty />}

              {ratesState.kind === 'error' && (
                <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-3">
                  <p className="text-brand-parchment text-sm">{ratesState.message}</p>
                  <button
                    onClick={() => {
                      const myRequestId = ++requestIdRef.current
                      loadShippingRates(cart, setRatesState, setSelectedRate, requestIdRef, myRequestId)
                    }}
                    data-testid="retry-rates-button"
                    className="text-brand-crema text-sm underline underline-offset-4 hover:text-brand-honey transition-colors self-start"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {ratesState.kind === 'ready' && (
                <>
                  <AddressCard address={ratesState.address} />
                  <CourierPicker
                    rates={ratesState.rates}
                    selected={selectedRate}
                    onSelect={setSelectedRate}
                  />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      {selectedRate ? formatIDR(selectedRate.price) : '—'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {fulfillmentMethod === 'PICKUP' && (
            <>
              {pickupState.kind === 'error' && (
                <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-3">
                  <p className="text-brand-parchment text-sm">{pickupState.message}</p>
                  <button
                    onClick={() => {
                      const myRequestId = ++requestIdRef.current
                      loadPickupInfo(cart, setPickupState, requestIdRef, myRequestId)
                    }}
                    data-testid="retry-pickup-button"
                    className="text-brand-crema text-sm underline underline-offset-4 hover:text-brand-honey transition-colors self-start"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {pickupState.kind === 'ready' && (
                <>
                  <PickupInfoCard location={pickupState.location} />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      Gratis (Ambil Sendiri)
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Grand total */}
        <div className="flex items-center justify-between px-1">
          <p className="text-brand-crema text-base font-semibold">Total</p>
          <p className="text-brand-crema text-lg font-semibold" data-testid="shipping-total">
            {formatIDR(grandTotal)}
          </p>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <label htmlFor="notes" className="text-brand-parchment text-sm">
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
            disabled={submitting || !canSubmit}
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
