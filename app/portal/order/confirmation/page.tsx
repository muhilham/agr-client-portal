'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const AGROASTERY_WA = '6281288888993' // TODO: move to env

const BANK_ACCOUNTS = [
  { bank: 'Bank BCA', account: '0657237047', a_n: 'Muhammad Ilham' },
  { bank: 'Bank Mandiri', account: '1270009924133', a_n: 'Muhammad Ilham' },
]

function formatIDR(amount: number) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

function buildWhatsAppMessage(opts: { orderNumber: string; grandTotal: number }) {
  const text =
    `Hi Agroastery, saya sudah transfer untuk pesanan ${opts.orderNumber}. ` +
    `Total ${formatIDR(opts.grandTotal)}. ` +
    `Mohon dicek dan diproses. Terima kasih!`
  return encodeURIComponent(text)
}

function PaymentInstructions({ orderNumber, grandTotal }: { orderNumber: string; grandTotal: number }) {
  const waUrl =
    `https://wa.me/${AGROASTERY_WA}?text=${buildWhatsAppMessage({ orderNumber, grandTotal })}`

  return (
    <div className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
      <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
        <p className="text-brand-parchment text-xs uppercase tracking-wider">
          Transfer Pembayaran
        </p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-brand-parchment text-sm">Total yang harus dibayar</span>
          <span className="text-brand-honey text-lg font-semibold">
            {formatIDR(grandTotal)}
          </span>
        </div>

        <div className="border-t border-[rgba(245,235,201,0.1)]" />

        {/* Bank accounts */}
        {BANK_ACCOUNTS.map(({ bank, account, a_n }) => (
          <div key={bank} className="flex flex-col gap-1">
            <p className="text-brand-crema text-sm font-medium">{bank}</p>
            <p className="text-brand-parchment text-xs">Rekening</p>
            <p className="text-brand-crema text-sm font-mono">{account}</p>
            <p className="text-brand-parchment text-xs">a.n. {a_n}</p>
          </div>
        ))}

        <div className="border-t border-[rgba(245,235,201,0.1)]" />

        <p className="text-brand-parchment text-xs leading-relaxed">
          Transfer sesuai nominal di atas. Pesanan diproses setelah transfer terkonfirmasi.
        </p>

        {/* WhatsApp CTA */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 rounded-lg bg-[#25D366] text-white font-semibold text-base text-center hover:bg-[#20BD5A] transition-colors min-h-[48px] flex items-center justify-center gap-2"
          data-testid="saya-sudah-bayar-button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Saya Sudah Bayar
        </a>

        <p className="text-brand-parchment text-xs text-center">
          Tanpa konfirmasi, pesanan tidak dapat diproses.
        </p>
      </div>
    </div>
  )
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get('orderNumber') ?? '—'
  const grandTotalParam = searchParams.get('grandTotal')
  const grandTotal = grandTotalParam ? Number(grandTotalParam) : 0

  return (
    <main className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Brand */}
        <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
          Agroastery
        </span>

        {/* Success card */}
        <div
          className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-8 flex flex-col items-center gap-4"
          data-testid="confirmation-card"
        >
          <div className="text-5xl">✅</div>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-brand-crema">
              Pesanan Diterima!
            </h1>
            <p className="text-brand-parchment text-sm leading-relaxed">
              Pesanan Anda telah berhasil dikirim. Tim kami akan segera memprosesnya.
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

        {/* Payment instructions */}
        {grandTotal > 0 && (
          <PaymentInstructions orderNumber={orderNumber} grandTotal={grandTotal} />
        )}

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
