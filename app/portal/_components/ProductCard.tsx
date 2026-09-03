'use client'

import { useEffect, useState } from 'react'
import { CatalogProduct } from '@/lib/catalog'

type Props = {
  product: CatalogProduct
  quantity: number
  onQuantityChange: (productId: string, qty: number) => void
}

export default function ProductCard({ product, quantity, onQuantityChange }: Props) {
  const [hint, setHint] = useState<'none' | 'live' | 'adjusted'>('none')
  const hintId = `minqty-hint-${product.id}`
  const showsHint = product.minQty > 1 && hint !== 'none'

  useEffect(() => {
    if (hint !== 'adjusted') return

    const timeout = window.setTimeout(() => setHint('none'), 2500)
    return () => window.clearTimeout(timeout)
  }, [hint])

  const setLiveHint = (qty: number) => {
    if (product.minQty > 1 && qty > 0 && qty < product.minQty) {
      setHint('live')
      return
    }

    setHint('none')
  }

  const handleChange = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) {
      onQuantityChange(product.id, 0)
      setHint('none')
      return
    }
    onQuantityChange(product.id, num)
    setLiveHint(num)
  }

  const handleBlur = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num === 0) {
      onQuantityChange(product.id, 0)
      setHint('none')
      return
    }

    if (num < product.minQty) {
      onQuantityChange(product.id, product.minQty)
      if (product.minQty > 1) setHint('adjusted')
    }
  }

  return (
    <div
      className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden flex flex-col"
      data-testid={`product-card-${product.id}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-brand-black">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-20">☕</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1">
          <h3 className="text-brand-crema font-medium text-base leading-tight">
            {product.name}
          </h3>
          <p className="text-brand-parchment text-xs">{product.unit}</p>
          {product.description && (
            <p className="text-brand-parchment text-xs opacity-70 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        <p className="text-brand-crema font-semibold text-base">
          {formatIDR(product.effectivePrice)}
        </p>

        {/* Qty input */}
        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextQuantity = Math.max(0, quantity - 1)
                onQuantityChange(product.id, nextQuantity)
                setLiveHint(nextQuantity)
              }}
              data-testid={`qty-decrement-${product.id}`}
              className="w-10 h-10 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema hover:bg-[rgba(245,235,201,0.08)] transition-colors flex items-center justify-center text-lg font-medium min-w-[40px] min-h-[44px]"
              aria-label="Kurangi"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={quantity === 0 ? '' : quantity}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={(e) => handleBlur(e.target.value)}
              placeholder={`Min ${product.minQty}`}
              data-testid={`qty-input-${product.id}`}
              aria-describedby={showsHint ? hintId : undefined}
              className="flex-1 h-10 min-h-[44px] rounded-lg border border-[rgba(245,235,201,0.25)] bg-transparent text-brand-crema text-center text-[16px] focus:outline-none focus:border-brand-crema placeholder:text-brand-parchment placeholder:opacity-50"
            />
            <button
              onClick={() => {
                const nextQuantity = quantity + 1
                onQuantityChange(product.id, nextQuantity)
                setLiveHint(nextQuantity)
              }}
              data-testid={`qty-increment-${product.id}`}
              className="w-10 h-10 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema hover:bg-[rgba(245,235,201,0.08)] transition-colors flex items-center justify-center text-lg font-medium min-w-[40px] min-h-[44px]"
              aria-label="Tambah"
            >
              +
            </button>
          </div>
          {showsHint && (
            <p
              id={hintId}
              role="status"
              data-testid={`minqty-hint-${product.id}`}
              className={`mt-1 text-xs ${hint === 'adjusted' ? 'text-brand-honey' : 'text-brand-parchment opacity-60'}`}
            >
              {hint === 'adjusted'
                ? `Minimum ${product.minQty} ${product.unit} — jumlah disesuaikan.`
                : `Minimum ${product.minQty} ${product.unit}.`}
            </p>
          )}
        </div>

        {product.minQty > 1 && (
          <p className="text-xs text-brand-parchment opacity-60">
            Minimum pemesanan: {product.minQty} {product.unit}
          </p>
        )}
      </div>
    </div>
  )
}

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}
