'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CatalogProduct } from '@/lib/catalog'
import ProductCard from './ProductCard'
import StickyCart from './StickyCart'
import LogoutButton from './LogoutButton'

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

export default function CatalogView({ client, catalog }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})

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
            <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
              Agroastery
            </span>
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
          {/* Welcome banner */}
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
              <h2 className="text-brand-parchment text-sm uppercase tracking-widest">
                Katalog Produk
              </h2>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                data-testid="product-grid"
              >
                {catalog.map((product) => (
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
