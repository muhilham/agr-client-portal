/**
 * Loading skeletons for the review page shipping section (#24).
 * CSS pulse only — no framer-motion (repo rule). Reduced-motion users get a
 * static placeholder instead of a pulsing one (motion-reduce:animate-none).
 */

const ROW_BASE =
  'rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-4 py-3 animate-pulse motion-reduce:animate-none'

export function CourierSkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div
      data-testid="courier-skeleton"
      aria-busy="true"
      aria-label="Menghitung ongkir"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={ROW_BASE}>
          <div className="h-3.5 w-2/5 rounded bg-[rgba(245,235,201,0.12)]" />
          <div className="mt-2 h-2.5 w-1/4 rounded bg-[rgba(245,235,201,0.08)]" />
        </div>
      ))}
    </div>
  )
}

export function PickupSkeletonCard() {
  return (
    <div
      data-testid="pickup-skeleton"
      aria-busy="true"
      aria-label="Memuat info pengambilan"
      className={ROW_BASE}
    >
      <div className="h-3.5 w-1/3 rounded bg-[rgba(245,235,201,0.12)]" />
      <div className="mt-2 h-2.5 w-3/5 rounded bg-[rgba(245,235,201,0.08)]" />
      <div className="mt-2 h-2.5 w-2/5 rounded bg-[rgba(245,235,201,0.08)]" />
    </div>
  )
}
