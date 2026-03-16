const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-zinc-700 text-zinc-200',
  CONFIRMED: 'bg-blue-900 text-blue-200',
  SHIPPED:   'bg-amber-900 text-amber-200',
  DELIVERED: 'bg-emerald-900 text-emerald-200',
  PAID:      'bg-emerald-700 text-emerald-100',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Menunggu',
  CONFIRMED: 'Dikonfirmasi',
  SHIPPED:   'Dikirim',
  DELIVERED: 'Terkirim',
  PAID:      'Lunas',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-zinc-700 text-zinc-200'}`}
      data-testid="status-badge"
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
