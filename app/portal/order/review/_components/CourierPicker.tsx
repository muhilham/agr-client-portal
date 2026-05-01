'use client'

import { RateOption } from '@/lib/shipping'

interface CourierPickerProps {
  rates: RateOption[]
  selected: RateOption | null
  onSelect: (rate: RateOption) => void
}

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export default function CourierPicker({ rates, selected, onSelect }: CourierPickerProps) {
  return (
    <div data-testid="courier-picker" className="flex flex-col gap-3">
      {rates.map((rate) => (
        <label
          key={`${rate.courier_code}-${rate.service_code}`}
          data-testid={`courier-option-${rate.courier_code}`}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
            selected?.courier_code === rate.courier_code
              ? 'border-brand-crema bg-[rgba(245,235,201,0.06)]'
              : 'border-[rgba(245,235,201,0.25)] bg-brand-midnight hover:bg-[rgba(245,235,201,0.03)]'
          }`}
        >
          <input
            type="radio"
            name="courier"
            value={rate.courier_code}
            checked={selected?.courier_code === rate.courier_code}
            onChange={() => onSelect(rate)}
            className="accent-brand-crema"
          />
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-brand-crema text-sm font-medium">
              {rate.courier_name} — {rate.service_name}
            </p>
            <p className="text-brand-parchment text-xs">
              Estimasi: {rate.etd}
            </p>
          </div>
          <p
            data-testid={`courier-price-${rate.courier_code}`}
            className="text-brand-crema text-sm font-semibold whitespace-nowrap"
          >
            {formatIDR(rate.price)}
          </p>
        </label>
      ))}
    </div>
  )
}
