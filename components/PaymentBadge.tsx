const LABEL: Record<string, string> = {
  UNPAID: 'Menunggu Pembayaran',
  PAID:   'Sudah Dibayar',
}

const STYLES: Record<string, string> = {
  UNPAID: 'bg-zinc-700 text-zinc-200',
  PAID:   'bg-emerald-700 text-emerald-100',
}

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${STYLES[status] ?? 'bg-zinc-700 text-zinc-200'}`}
      data-testid="payment-badge"
    >
      {LABEL[status] ?? status}
    </span>
  )
}
