'use client'

import { CatalogProduct } from '@/lib/catalog'

type Props = {
  product: CatalogProduct
  quantity: number
  onQuantityChange: (productId: string, qty: number) => void
}

export default function ProductCard({ product, quantity, onQuantityChange }: Props) {
  const handleChange = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) {
      onQuantityChange(product.id, 0)
      return
    }
    onQuantityChange(product.id, num)
  }

  const handleBlur = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < product.minQty) {
      onQuantityChange(product.id, 0)
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
        <div className="flex items-center gap-2 mt-auto">
          <button
            onClick={() =>
              onQuantityChange(product.id, Math.max(0, quantity - 1))
            }
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
            className="flex-1 h-10 min-h-[44px] rounded-lg border border-[rgba(245,235,201,0.25)] bg-transparent text-brand-crema text-center text-[16px] focus:outline-none focus:border-brand-crema placeholder:text-brand-parchment placeholder:opacity-50"
          />
          <button
            onClick={() => onQuantityChange(product.id, quantity + 1)}
            data-testid={`qty-increment-${product.id}`}
            className="w-10 h-10 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema hover:bg-[rgba(245,235,201,0.08)] transition-colors flex items-center justify-center text-lg font-medium min-w-[40px] min-h-[44px]"
            aria-label="Tambah"
          >
            +
          </button>
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
