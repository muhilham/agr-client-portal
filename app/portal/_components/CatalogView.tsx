'use client'

import { useState, useEffect, useReducer } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CatalogProduct } from '@/lib/catalog'
import ProductCard from './ProductCard'
import StickyCart from './StickyCart'
import LogoutButton from './LogoutButton'

type ReorderItem = {
  product_name: string
  unit_price: number
  quantity: number
}

type ReorderState = {
  reorderUnavailableCount: number
  reorderSuccessCount: number
  isReorderLoading: boolean
}

type ReorderAction = { type: 'RESET' } | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RESULTS'; payload: { unavailableCount: number; successCount: number; quantities: Record<string, number> } }

function reorderReducer(state: ReorderState, action: ReorderAction): ReorderState {
  switch (action.type) {
    case 'RESET':
      return { reorderUnavailableCount: 0, reorderSuccessCount: 0, isReorderLoading: true }
    case 'SET_LOADING':
      return { ...state, isReorderLoading: action.payload }
    case 'SET_RESULTS':
      return {
        ...state,
        isReorderLoading: false,
        reorderUnavailableCount: action.payload.unavailableCount,
        reorderSuccessCount: action.payload.successCount,
      }
    default:
      return state
  }
}

export type CartItem = {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  minQty: number
  unit: string
}

type Client = {
  id: string
  name: string
  company_name: string
}

type Props = {
  client: Client
  catalog: CatalogProduct[]
  reorderOrderId?: string
}

function getGreeting(): string {
  const hour = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false,
  }).format(new Date())
  const h = parseInt(hour, 10)
  if (h >= 5 && h < 11) return 'Selamat pagi'
  if (h >= 11 && h < 15) return 'Selamat siang'
  if (h >= 15 && h < 19) return 'Selamat sore'
  return 'Selamat malam'
}

export default function CatalogView({ client, catalog, reorderOrderId }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<'mine' | 'other'>('mine')
  const [reorderState, dispatch] = useReducer(reorderReducer, {
    reorderUnavailableCount: 0,
    reorderSuccessCount: 0,
    isReorderLoading: false,
  })

  // Handle reorder from history — reset when reorderOrderId changes
  useEffect(() => {
    if (!reorderOrderId) return

    // Reset previous state before fetching new reorder (batched via useReducer to avoid cascading renders)
    dispatch({ type: 'RESET' })

    fetch(`/api/reorders/${reorderOrderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !data.items) {
          dispatch({ type: 'SET_LOADING', payload: false })
          return
        }

        const catalogMap = new Map(
          catalog.map((p) => [p.name.toLowerCase(), p])
        )
        const unavailable: string[] = []
        const newQuantities: Record<string, number> = {}

        for (const item of data.items as ReorderItem[]) {
          const product = catalogMap.get(item.product_name.toLowerCase())
          if (product && item.quantity >= product.minQty) {
            newQuantities[product.id] = item.quantity
          } else {
            unavailable.push(item.product_name)
          }
        }

        setQuantities(newQuantities)
        dispatch({ type: 'SET_RESULTS', payload: { unavailableCount: unavailable.length, successCount: Object.keys(newQuantities).length, quantities: newQuantities } })
      })
      .catch(() => {
        // Silently fail — user can still browse catalog normally
      })
      .finally(() => {
        dispatch({ type: 'SET_LOADING', payload: false })
      })
  }, [reorderOrderId, catalog])

  const myProducts = catalog.filter((p) => p.isClientAssigned)
  const otherProducts = catalog.filter((p) => !p.isClientAssigned)
  const showTabs = myProducts.length > 0 && otherProducts.length > 0
  const displayedProducts = showTabs ? (tab === 'mine' ? myProducts : otherProducts) : catalog

  const handleQuantityChange = (productId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: qty }))
  }

  const cart: CartItem[] = catalog
    .filter((p) => (quantities[p.id] ?? 0) >= p.minQty)
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      unitPrice: p.effectivePrice,
      quantity: quantities[p.id],
      minQty: p.minQty,
      unit: p.unit,
    }))

  const greeting = getGreeting()

  return (
    <>
      <div className="min-h-screen bg-brand-black pb-36">
        {/* Nav */}
        <nav className="sticky top-0 z-40 bg-brand-black border-b border-[rgba(245,235,201,0.25)] px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Image
              src="/agroastery-logo.svg"
              alt="Agroastery"
              width={120}
              height={19}
            />
            <div className="flex items-center gap-4">
              <Link
                href="/portal/orders"
                className="text-brand-parchment text-sm hover:text-brand-crema transition-colors"
                data-testid="orders-nav-link"
              >
                Riwayat Pesanan
              </Link>
              <LogoutButton />
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
          {/* Reorder loading state */}
          {reorderState.isReorderLoading && (
            <div className="rounded-xl border border-brand-honey/50 bg-[rgba(245,235,201,0.06)] px-5 py-3 text-sm text-brand-parchment flex items-center gap-3">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-honey border-t-transparent rounded-full" />
              Memuat produk dari pesanan sebelumnya...
            </div>
          )}

          {/* Reorder success confirmation */}
          {!reorderState.isReorderLoading && reorderState.reorderSuccessCount > 0 && (
            <div className="rounded-xl border border-green-500/50 bg-green-500/10 px-5 py-3 text-sm text-green-400 flex items-center gap-3">
              <span>✓</span>
              {reorderState.reorderSuccessCount} item dari pesanan sebelumnya telah ditambahkan ke keranjang.
            </div>
          )}

          {/* Welcome banner */}
          {reorderState.reorderUnavailableCount > 0 && (
            <div className="rounded-xl border border-brand-honey/50 bg-[rgba(245,235,201,0.06)] px-5 py-3 text-sm text-brand-parchment">
              {reorderState.reorderUnavailableCount} produk tidak lagi tersedia dan tidak ditambahkan ke keranjang.
            </div>
          )}
          <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4">
            <p className="text-brand-parchment text-sm">{greeting},</p>
            <p className="text-brand-crema font-semibold text-lg mt-0.5">
              {client.name}
            </p>
            {client.company_name && (
              <p className="text-brand-parchment text-xs mt-0.5 opacity-70">
                {client.company_name}
              </p>
            )}
          </div>

          {/* Catalog */}
          {catalog.length === 0 ? (
            <div
              className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-10 flex flex-col items-center gap-4 text-center"
              data-testid="empty-catalog"
            >
              <span className="text-4xl opacity-30">📦</span>
              <p className="text-brand-parchment text-sm">
                Belum ada produk yang tersedia untuk akun Anda.
              </p>
              <p className="text-brand-parchment text-xs opacity-60">
                Hubungi tim Agroastery untuk informasi lebih lanjut.
              </p>
            </div>
          ) : (
            <>
              {showTabs && (
                <div role="tablist" className="flex border-b border-[rgba(245,235,201,0.2)]">
                  <button
                    role="tab"
                    data-testid="tab-mine"
                    aria-selected={tab === 'mine'}
                    onClick={() => setTab('mine')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      tab === 'mine'
                        ? 'border-brand-crema text-brand-crema'
                        : 'border-transparent text-brand-parchment opacity-60'
                    }`}
                  >
                    Produk Saya
                  </button>
                  <button
                    role="tab"
                    data-testid="tab-other"
                    aria-selected={tab === 'other'}
                    onClick={() => setTab('other')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      tab === 'other'
                        ? 'border-brand-crema text-brand-crema'
                        : 'border-transparent text-brand-parchment opacity-60'
                    }`}
                  >
                    Produk Lainnya
                  </button>
                </div>
              )}
              {!showTabs && (
                <h2 className="text-brand-parchment text-sm uppercase tracking-widest">
                  Katalog Produk
                </h2>
              )}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                data-testid="product-grid"
              >
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantities[product.id] ?? 0}
                    onQuantityChange={handleQuantityChange}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <StickyCart cart={cart} />
    </>
  )
}
