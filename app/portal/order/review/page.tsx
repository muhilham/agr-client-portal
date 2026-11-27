'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrder } from '../_actions/createOrder'
import { getShippingRates } from '../_actions/getShippingRates'
import { getPickupInfo } from '../_actions/getPickupInfo'
import { CartItem } from '../../_components/CatalogView'
import AddressCard, { AddressCardEmpty } from './_components/AddressCard'
import AddressPicker from './_components/AddressPicker'
import CourierPicker from './_components/CourierPicker'
import { CourierSkeletonRows, PickupSkeletonCard } from './_components/ShippingSkeletons'
import FulfillmentToggle, { type FulfillmentMethod } from './_components/FulfillmentToggle'
import PickupInfoCard from './_components/PickupInfoCard'
import type { RateOption, AddressDisplay, AddressOption, PickupLocation } from '@/lib/shipping'
import { ratesKey } from '@/lib/ratesKey'

type RatesState =
  | { kind: 'loading' }
  | { kind: 'free_shipping'; address: AddressDisplay; addresses: AddressOption[] }
  | { kind: 'ready'; rates: RateOption[]; address: AddressDisplay; addresses: AddressOption[] }
  | { kind: 'no_address' }
  | { kind: 'error'; message: string }

type PickupState =
  | { kind: 'loading' }
  | { kind: 'ready'; location: PickupLocation }
  | { kind: 'error'; message: string }

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

// Client-side throttle: minimum 1500ms between identical shipping-rate calls.
// Keyed by items-signature so cart changes always bypass the throttle.
const THROTTLE_MS = 1_500

let lastRatesCallKey = ''
let lastRatesCallAt = 0

function canCallRates(key: string): boolean {
  const now = Date.now()
  if (key === lastRatesCallKey && now - lastRatesCallAt < THROTTLE_MS) return false
  lastRatesCallKey = key
  lastRatesCallAt = now
  return true
}

// #90: ship item input for rates/pickup/create — variantId rides along so
// the server resolves per-line price, MOQ and weight (omitted for flat).
// #101: the destination address is part of the rates key (lib/ratesKey), so a
// branch switch re-quotes instead of being swallowed by the throttle above.
function toOrderItemInput(i: CartItem): { productId: string; variantId?: string; quantity: number } {
  return i.variantId
    ? { productId: i.productId, variantId: i.variantId, quantity: i.quantity }
    : { productId: i.productId, quantity: i.quantity }
}

async function loadShippingRates(
  items: CartItem[],
  addressId: string | null,
  setRatesState: React.Dispatch<React.SetStateAction<RatesState>>,
  setSelectedRate: React.Dispatch<React.SetStateAction<RateOption | null>>,
  setIsManual: React.Dispatch<React.SetStateAction<boolean>>,
  setAddresses: React.Dispatch<React.SetStateAction<AddressOption[]>>,
  setSelectedAddressId: React.Dispatch<React.SetStateAction<string | null>>,
  requestIdRef: React.MutableRefObject<number>,
  myRequestId: number
) {
  setRatesState({ kind: 'loading' })
  setSelectedRate(null)
  setIsManual(false)
  const result = await getShippingRates({
    items: items.map(toOrderItemInput),
    ...(addressId ? { addressId } : {}),
  })
  if (requestIdRef.current !== myRequestId) return
  if (!result.ok) {
    if (result.error === 'NO_ADDRESS') {
      setAddresses([])
      setRatesState({ kind: 'no_address' })
      return
    }
    if (result.error === 'INVALID_ADDRESS') {
      // The picked branch vanished mid-checkout (staff deleted it). Drop the
      // selection so the retry re-resolves the default and re-renders the list.
      setSelectedAddressId(null)
      setRatesState({
        kind: 'error',
        message: 'Alamat yang dipilih sudah tidak tersedia. Pilih ulang alamat pengiriman.',
      })
      return
    }
    const messages: Record<string, string> = {
      INVALID_CART: 'Beberapa produk tidak lagi tersedia. Keranjang kamu diperbarui.',
      ORIGIN_NOT_CONFIGURED: 'Pengiriman belum bisa dilakukan. Coba lagi nanti, atau pilih ongkir manual.',
      RATES_UNAVAILABLE: 'Belum bisa hitung ongkir sekarang. Coba lagi 1 menit, atau pilih ongkir manual.',
      INVALID_INPUT: 'Permintaan tidak valid',
      ACCOUNT_INACTIVE: 'Akun Anda tidak aktif. Hubungi tim Agroastery.',
    }
    setRatesState({ kind: 'error', message: messages[result.error] ?? 'Terjadi kesalahan. Kalau masih gagal, hubungi tim Agroastery.' })
    return
  }
  setAddresses(result.addresses)
  if (result.kind === 'free_shipping') {
    setRatesState({ kind: 'free_shipping', address: result.address, addresses: result.addresses })
  } else {
    setRatesState({ kind: 'ready', rates: result.rates, address: result.address, addresses: result.addresses })
  }
}

async function loadPickupInfo(
  items: CartItem[],
  setPickupState: React.Dispatch<React.SetStateAction<PickupState>>,
  requestIdRef: React.MutableRefObject<number>,
  myRequestId: number
) {
  setPickupState({ kind: 'loading' })
  const result = await getPickupInfo({
    items: items.map(toOrderItemInput),
  })
  if (requestIdRef.current !== myRequestId) return // a newer request superseded this one — ignore
  if (!result.ok) {
    const messages: Record<string, string> = {
      INVALID_CART: 'Beberapa produk tidak lagi tersedia. Keranjang kamu diperbarui.',
      ORIGIN_NOT_CONFIGURED: 'Pengambilan tidak tersedia saat ini. Hubungi tim Agroastery.',
      INVALID_INPUT: 'Permintaan tidak valid',
      ACCOUNT_INACTIVE: 'Akun Anda tidak aktif. Hubungi tim Agroastery.',
    }
    setPickupState({ kind: 'error', message: messages[result.error] ?? 'Terjadi kesalahan. Kalau masih gagal, hubungi tim Agroastery.' })
    return
  }
  setPickupState({ kind: 'ready', location: result.location })
}

export default function OrderReviewPage() {
  const router = useRouter()
  const [cart] = useState<CartItem[]>(() => {
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
  const [cartToken] = useState(() => (typeof crypto !== 'undefined' ? crypto.randomUUID() : ''))
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('SHIPPING')
  const [ratesState, setRatesState] = useState<RatesState>({ kind: 'loading' })
  const [selectedRate, setSelectedRate] = useState<RateOption | null>(null)
  const [isManual, setIsManual] = useState(false)
  const [pickupState, setPickupState] = useState<PickupState>({ kind: 'loading' })
  // #101: branch list + current pick. `selectedAddressId === null` means "let the
  // server resolve the staff default"; it is never written back to the address row.
  const [addresses, setAddresses] = useState<AddressOption[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (cart.length === 0) {
      router.replace('/portal')
      return
    }
    if (fulfillmentMethod === 'SHIPPING') {
      const key = ratesKey(cart, selectedAddressId)
      // Throttle BEFORE taking a request id: a skipped call must not orphan the
      // in-flight one (React StrictMode invokes effects twice in dev, which
      // otherwise leaves the page stuck on the loading skeleton forever).
      if (!canCallRates(key)) return
      const myRequestId = ++requestIdRef.current
      loadShippingRates(cart, selectedAddressId, setRatesState, setSelectedRate, setIsManual, setAddresses, setSelectedAddressId, requestIdRef, myRequestId)
    } else {
      const myRequestId = ++requestIdRef.current
      loadPickupInfo(cart, setPickupState, requestIdRef, myRequestId)
    }
  }, [router, cart, fulfillmentMethod, selectedAddressId])

  // #101: what the picker shows as checked — an explicit pick, else the address
  // the server resolved (staff default). Kept separate from `selectedAddressId`
  // so the initial default quote never triggers a second, identical request.
  const effectiveAddressId =
    selectedAddressId ??
    (ratesState.kind === 'ready' || ratesState.kind === 'free_shipping'
      ? ratesState.address.id ?? null
      : null)

  // #101: switching branch re-quotes for the new destination. Only the state
  // changes here — the effect above owns the request (and its request-id guard
  // drops any in-flight answer for the address we just left).
  const handleAddressChange = (addressId: string) => {
    if (addressId === effectiveAddressId) return
    setSelectedAddressId(addressId)
  }

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  // #24: the chargeable shipping cost is only *known* in settled states. While
  // rates load, no courier is picked, manual mode is on, or the address/error
  // state stands, we must NOT render a total that silently treats ongkir as 0.
  const shippingCostKnown =
    fulfillmentMethod === 'PICKUP'
      ? true // pickup is always Gratis
      : ratesState.kind === 'free_shipping'
        ? true
        : ratesState.kind === 'ready' && !isManual && !!selectedRate
  const shippingCost = fulfillmentMethod === 'PICKUP' ? 0
    : ratesState.kind === 'free_shipping' ? 0
    : isManual ? 0
    : selectedRate?.price ?? 0
  // Pending-total footnote: what the Total line is NOT yet including.
  const pendingShippingNote =
    fulfillmentMethod === 'SHIPPING' && !shippingCostKnown
      ? ratesState.kind === 'loading' ? 'Menghitung ongkir…'
      : isManual ? 'Ongkir akan dihitung admin'
      : ratesState.kind === 'ready' ? 'Pilih kurir untuk melihat total akhir'
      : ratesState.kind === 'no_address' ? 'Lengkapi alamat untuk menghitung ongkir'
      : 'Ongkir belum bisa dihitung'
      : null

  const grandTotal = subtotal + shippingCost

  const handleConfirm = async () => {
    if (fulfillmentMethod === 'SHIPPING') {
      if (ratesState.kind === 'free_shipping') {
        // free shipping — proceed
      } else if (isManual) {
        // manual — proceed
      } else if (!selectedRate || ratesState.kind !== 'ready') {
        return
      }
    } else if (fulfillmentMethod === 'PICKUP' && pickupState.kind !== 'ready') {
      return
    }

    setSubmitting(true)
    setError(null)

    let shippingSelection
    if (fulfillmentMethod === 'SHIPPING') {
      const addressPick = effectiveAddressId ? { addressId: effectiveAddressId } : {}
      if (ratesState.kind === 'free_shipping') {
        shippingSelection = { mode: 'free', ...addressPick }
      } else if (isManual) {
        shippingSelection = { mode: 'manual', ...addressPick }
      } else if (selectedRate) {
        shippingSelection = {
          mode: 'biteship',
          courier_code: selectedRate.courier_code,
          service_code: selectedRate.service_code,
          ...addressPick,
        }
      }
    }

    const result = await createOrder({
      cartToken,
      items: cart.map(toOrderItemInput),
      notes: notes.trim() || undefined,
      fulfillmentMethod,
      shippingSelection,
    })

    if (!result.ok) {
      if (result.error_code === 'COURIER_CHANGED') {
        setRatesState({ kind: 'loading' })
        const myRequestId = ++requestIdRef.current
        loadShippingRates(cart, effectiveAddressId, setRatesState, setSelectedRate, setIsManual, setAddresses, setSelectedAddressId, requestIdRef, myRequestId)
      }
      if (result.error_code === 'INVALID_ADDRESS') {
        // The branch was deleted between quote and confirm: drop the stale pick
        // and re-resolve (the error message below explains what happened).
        setSelectedAddressId(null)
        setRatesState({ kind: 'loading' })
        const myRequestId = ++requestIdRef.current
        loadShippingRates(cart, null, setRatesState, setSelectedRate, setIsManual, setAddresses, setSelectedAddressId, requestIdRef, myRequestId)
      }
      setError(result.message)
      setSubmitting(false)
      return
    }

    sessionStorage.removeItem('cart')
    // Idempotent replay: if we got a cached result, still navigate to confirmation
    router.push(
      `/portal/order/confirmation?id=${result.id}&orderNumber=${encodeURIComponent(result.order_number)}&grandTotal=${grandTotal}`
    )
  }

  const canSubmit =
    fulfillmentMethod === 'SHIPPING'
      ? ratesState.kind === 'ready' || ratesState.kind === 'free_shipping' || isManual
      : pickupState.kind === 'ready'

  // #24: no full-page early return while rates load — items, address chrome and
  // notes stay interactive; only the courier area swaps to skeleton rows.
  // #101: 2+ saved branches get a picker; 0/1 keep the exact pre-#101 card.
  const addressBlock = (address: AddressDisplay) =>
    addresses.length > 1 ? (
      <AddressPicker
        addresses={addresses}
        selectedId={effectiveAddressId}
        onSelect={handleAddressChange}
      />
    ) : (
      <AddressCard address={address} />
    )

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
                key={`${item.productId}:${item.variantId ?? ''}`}
                className="px-5 py-4 flex items-center justify-between gap-4"
                data-testid={`order-item-${item.variantId ?? item.productId}`}
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-brand-crema text-sm font-medium truncate">
                    {item.productName}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ''}
                  </p>
                  <p className="text-brand-parchment text-xs">
                    {item.quantity} {item.variantLabel ?? item.unit} × {formatIDR(item.unitPrice)}
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
              {ratesState.kind === 'loading' && (
                <>
                  {addresses.length > 1 && (
                    <AddressPicker
                      addresses={addresses}
                      selectedId={effectiveAddressId}
                      onSelect={handleAddressChange}
                      disabled
                    />
                  )}
                  <CourierSkeletonRows rows={3} />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-parchment text-sm italic" data-testid="shipping-cost">
                      Menghitung ongkir…
                    </p>
                  </div>
                </>
              )}

              {ratesState.kind === 'free_shipping' && (
                <>
                  {addressBlock(ratesState.address)}
                  <div className="rounded-xl border border-brand-honey bg-[rgba(245,235,201,0.06)] px-5 py-3">
                    <p className="text-brand-honey text-sm font-medium">Pengiriman Gratis</p>
                    <p className="text-brand-parchment text-xs">Ongkir ditanggung Agroastery</p>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      Gratis
                    </p>
                  </div>
                </>
              )}

              {ratesState.kind === 'no_address' && <AddressCardEmpty />}

              {ratesState.kind === 'error' && (
                <>
                  {/* #101: keep the branch list reachable when this destination
                      can't be quoted — otherwise a failed switch strands the
                      client on an error box with no way back. */}
                  {addresses.length > 1 && (
                    <AddressPicker
                      addresses={addresses}
                      selectedId={effectiveAddressId}
                      onSelect={handleAddressChange}
                    />
                  )}
                  <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-3">
                    <p className="text-brand-parchment text-sm" data-testid="rates-error-message">{ratesState.message}</p>
                    <button
                      onClick={() => {
                        const myRequestId = ++requestIdRef.current
                        loadShippingRates(cart, effectiveAddressId, setRatesState, setSelectedRate, setIsManual, setAddresses, setSelectedAddressId, requestIdRef, myRequestId)
                      }}
                      data-testid="retry-rates-button"
                      className="text-brand-crema text-sm underline underline-offset-4 hover:text-brand-honey transition-colors self-start"
                    >
                      Coba lagi
                    </button>
                  </div>
                </>
              )}

              {ratesState.kind === 'ready' && (
                <>
                  {addressBlock(ratesState.address)}
                  <CourierPicker
                    rates={ratesState.rates}
                    selected={selectedRate}
                    onSelect={(rate) => {
                      setSelectedRate(rate)
                      setIsManual(false)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsManual(true)
                      setSelectedRate(null)
                    }}
                    className="text-brand-parchment text-xs underline underline-offset-4 hover:text-brand-honey transition-colors self-start"
                  >
                    Kurir tidak tersedia? Gunakan ongkir manual
                  </button>
                  {isManual && (
                    <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-3">
                      <p className="text-brand-parchment text-sm">Ongkir akan dihitung oleh admin</p>
                      <p className="text-brand-parchment text-xs opacity-70">Silakan lanjutkan pesanan</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      {isManual ? '—' : selectedRate ? formatIDR(selectedRate.price) : '—'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {fulfillmentMethod === 'PICKUP' && (
            <>
              {pickupState.kind === 'loading' && (
                <>
                  <PickupSkeletonCard />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      Gratis (Ambil Sendiri)
                    </p>
                  </div>
                </>
              )}

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

        {/* Grand total — never render a sum that silently omits a not-yet-known ongkir (#24) */}
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center justify-between">
            <p className="text-brand-crema text-base font-semibold">Total</p>
            <p className="text-brand-crema text-lg font-semibold" data-testid="shipping-total">
              {formatIDR(subtotal)}
              {pendingShippingNote ? <span className="text-brand-parchment text-sm font-normal"> + ongkir</span> : null}
            </p>
          </div>
          {pendingShippingNote && (
            <p className="text-brand-parchment text-xs text-right" data-testid="shipping-total-note">
              {pendingShippingNote}
            </p>
          )}
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
