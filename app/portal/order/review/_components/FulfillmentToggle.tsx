'use client'

export type FulfillmentMethod = 'SHIPPING' | 'PICKUP'

interface FulfillmentToggleProps {
  value: FulfillmentMethod
  onChange: (value: FulfillmentMethod) => void
}

export default function FulfillmentToggle({ value, onChange }: FulfillmentToggleProps) {
  return (
    <div
      data-testid="fulfillment-toggle"
      className="flex rounded-lg border border-[rgba(245,235,201,0.25)] overflow-hidden"
    >
      <button
        type="button"
        data-testid="fulfillment-option-shipping"
        onClick={() => onChange('SHIPPING')}
        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
          value === 'SHIPPING'
            ? 'bg-brand-crema text-brand-black'
            : 'text-brand-parchment hover:bg-[rgba(245,235,201,0.06)]'
        }`}
      >
        Kirim
      </button>
      <button
        type="button"
        data-testid="fulfillment-option-pickup"
        onClick={() => onChange('PICKUP')}
        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
          value === 'PICKUP'
            ? 'bg-brand-crema text-brand-black'
            : 'text-brand-parchment hover:bg-[rgba(245,235,201,0.06)]'
        }`}
      >
        Ambil Sendiri
      </button>
    </div>
  )
}
