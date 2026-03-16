'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get('orderNumber') ?? '—'

  return (
    <main className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 text-center">
        {/* Brand */}
        <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
          Agroastery
        </span>

        {/* Success card */}
        <div
          className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-8 flex flex-col items-center gap-5"
          data-testid="confirmation-card"
        >
          <div className="text-5xl">✅</div>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-brand-crema">
              Pesanan Diterima!
            </h1>
            <p className="text-brand-parchment text-sm leading-relaxed">
              Pesanan Anda telah berhasil dikirim. Tim kami akan segera
              memprosesnya.
            </p>
          </div>

          <div className="w-full rounded-lg bg-brand-black border border-[rgba(245,235,201,0.15)] px-4 py-3">
            <p className="text-brand-parchment text-xs mb-1">Nomor Pesanan</p>
            <p
              className="text-brand-crema font-semibold text-lg tracking-wider"
              data-testid="order-number"
            >
              {orderNumber}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Link
            href="/portal/orders"
            data-testid="view-orders-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors duration-150 min-h-[44px] flex items-center justify-center"
          >
            Riwayat Pesanan
          </Link>
          <Link
            href="/portal"
            data-testid="back-to-catalog-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            Buat Pesanan Baru
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-black flex items-center justify-center">
          <p className="text-brand-parchment text-sm">Memuat…</p>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
