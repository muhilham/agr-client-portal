'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { CatalogProduct } from '@/lib/catalog'
import { linesOf } from '@/lib/variantResolver'
import { imageDisplayState } from '@/lib/image-fallback'

type Props = {
  product: CatalogProduct
  /** Qty per ORDER LINE id: variantId for #90 chips, productId for flat rows. */
  quantities: Record<string, number>
  onQuantityChange: (lineId: string, qty: number) => void
}

export default function ProductCard({ product, quantities, onQuantityChange }: Props) {
  // #90: variant-mode products render one chip per price-unambiguous size
  // line (lib/variantResolver §rule 3); everything else keeps the flat card.
  const lines = linesOf(product)
  const isVariantMode = product.variants.length > 0
  const [selectedLineId, setSelectedLineId] = useState<string>(lines[0]?.lineId ?? product.id)
  const activeLine = lines.find((l) => l.lineId === selectedLineId) ?? lines[0]
  const lineId = activeLine?.lineId ?? product.id
  const minQty = activeLine?.minQty ?? product.minQty
  const unitLabel = isVariantMode && activeLine ? activeLine.label : product.unit
  const activeQty = quantities[lineId] ?? 0

  const [hint, setHint] = useState<'none' | 'live' | 'adjusted'>('none')
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const hintId = `minqty-hint-${lineId}`
  const showsHint = minQty > 1 && hint !== 'none'

  useEffect(() => {
    if (hint !== 'adjusted') return

    const timeout = window.setTimeout(() => setHint('none'), 2500)
    return () => window.clearTimeout(timeout)
  }, [hint])

  const setLiveHint = (qty: number) => {
    if (minQty > 1 && qty > 0 && qty < minQty) {
      setHint('live')
      return
    }

    setHint('none')
  }

  const handleChange = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) {
      onQuantityChange(lineId, 0)
      setHint('none')
      return
    }
    onQuantityChange(lineId, num)
    setLiveHint(num)
  }

  const handleBlur = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num === 0) {
      onQuantityChange(lineId, 0)
      setHint('none')
      return
    }

    if (num < minQty) {
      onQuantityChange(lineId, minQty)
      if (minQty > 1) setHint('adjusted')
    }
  }

  return (
    <div
      className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden flex flex-col"
      data-testid={`product-card-${product.id}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-brand-black">
        {imageDisplayState(product.imageUrl, failedUrl === product.imageUrl) === 'image' ? (
          <Image
            src={product.imageUrl!}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover"
            onError={() => setFailedUrl(product.imageUrl!)}
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
          {!isVariantMode && (
            <p className="text-brand-parchment text-xs">{product.unit}</p>
          )}
          {product.description && (
            <p className="text-brand-parchment text-xs opacity-70 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {isVariantMode ? (
          /* #90 size chips: label + effective price; cliff min visible pre-typing */
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Ukuran"
            data-testid={`variant-chips-${product.id}`}
          >
            {product.variants.map((v) => {
              const selected = v.variantId === activeLine?.variantId
              return (
                <button
                  key={v.variantId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`variant-chip-${v.variantId}`}
                  onClick={() => {
                    setSelectedLineId(v.variantId)
                    setHint('none')
                  }}
                  className={`min-h-[44px] px-3.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
                    selected
                      ? 'bg-brand-crema border-brand-crema text-brand-black font-semibold'
                      : 'border-[rgba(245,235,201,0.25)] text-brand-parchment hover:bg-[rgba(245,235,201,0.08)]'
                  }`}
                >
                  <span>{v.label}</span>
                  <span className="font-semibold">· {formatIDR(v.effectivePrice)}</span>
                  {v.minQty > 1 && (
                    <span
                      className={`text-[11px] font-bold ${
                        selected ? 'text-brand-black/70' : 'text-brand-honey'
                      }`}
                    >
                      · min {v.minQty}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-brand-crema font-semibold text-base">
            {formatIDR(product.effectivePrice)}
          </p>
        )}

        {/* Qty input */}
        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextQuantity = Math.max(0, activeQty - 1)
                onQuantityChange(lineId, nextQuantity)
                setLiveHint(nextQuantity)
              }}
              data-testid={`qty-decrement-${lineId}`}
              className="w-10 h-10 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema hover:bg-[rgba(245,235,201,0.08)] transition-colors flex items-center justify-center text-lg font-medium min-w-[40px] min-h-[44px]"
              aria-label="Kurangi"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={activeQty === 0 ? '' : activeQty}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={(e) => handleBlur(e.target.value)}
              placeholder={`Min ${minQty}`}
              data-testid={`qty-input-${lineId}`}
              aria-describedby={showsHint ? hintId : undefined}
              className="flex-1 h-10 min-h-[44px] rounded-lg border border-[rgba(245,235,201,0.25)] bg-transparent text-brand-crema text-center text-[16px] focus:outline-none focus:border-brand-crema placeholder:text-brand-parchment placeholder:opacity-50"
            />
            <button
              onClick={() => {
                const nextQuantity = activeQty + 1
                onQuantityChange(lineId, nextQuantity)
                setLiveHint(nextQuantity)
              }}
              data-testid={`qty-increment-${lineId}`}
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
              data-testid={`minqty-hint-${lineId}`}
              className={`mt-1 text-xs ${hint === 'adjusted' ? 'text-brand-honey' : 'text-brand-parchment opacity-60'}`}
            >
              {hint === 'adjusted'
                ? `Minimum ${minQty} ${unitLabel} — jumlah disesuaikan.`
                : `Minimum ${minQty} ${unitLabel}.`}
            </p>
          )}
        </div>

        {minQty > 1 && (
          <p className="text-xs text-brand-parchment opacity-60">
            Minimum pemesanan: {minQty} {unitLabel}
          </p>
        )}
      </div>
    </div>
  )
}

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}
