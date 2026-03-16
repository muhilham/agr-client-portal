'use client'

import { useRouter } from 'next/navigation'
import { CartItem } from './CatalogView'

type Props = {
  cart: CartItem[]
}

export default function StickyCart({ cart }: Props) {
  const router = useRouter()

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (cart.length === 0) return null

  const handleReview = () => {
    sessionStorage.setItem('cart', JSON.stringify(cart))
    router.push('/portal/order/review')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3 bg-gradient-to-t from-brand-black via-brand-black to-transparent"
      data-testid="sticky-cart"
    >
      <div className="max-w-lg mx-auto rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-4 flex items-center justify-between gap-4 shadow-2xl">
        <div className="flex flex-col gap-0.5">
          <p className="text-brand-parchment text-xs">
            {itemCount} item dipilih
          </p>
          <p className="text-brand-crema font-semibold text-lg leading-tight">
            {formatIDR(total)}
          </p>
        </div>
        <button
          onClick={handleReview}
          data-testid="review-order-button"
          className="px-5 py-3 rounded-lg bg-brand-crema text-brand-black font-medium text-base
            hover:bg-brand-honey transition-colors duration-150 min-h-[44px] whitespace-nowrap"
        >
          Review Pesanan →
        </button>
      </div>
    </div>
  )
}

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}
