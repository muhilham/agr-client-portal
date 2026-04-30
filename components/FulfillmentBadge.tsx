const STYLES: Record<string, string> = {
  PENDING:   'bg-zinc-700 text-zinc-200',
  CONFIRMED: 'bg-blue-900 text-blue-200',
  SHIPPED:   'bg-amber-900 text-amber-200',
  DELIVERED: 'bg-emerald-900 text-emerald-200',
  CANCELLED: 'bg-red-900 text-red-200',
}

export function FulfillmentBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${STYLES[status] ?? 'bg-zinc-700 text-zinc-200'}`}
      data-testid="fulfillment-badge"
    >
      {status}
    </span>
  )
}
