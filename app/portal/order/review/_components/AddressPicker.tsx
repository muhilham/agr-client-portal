'use client'

import { addressLabelText } from '@/lib/addressLabel'
import type { AddressOption } from '@/lib/shipping'

interface AddressPickerProps {
  addresses: AddressOption[]
  selectedId: string | null
  onSelect: (addressId: string) => void
  /** True while rates for the newly picked destination are loading. */
  disabled?: boolean
}

/**
 * #101: branch picker shown only when the client has 2+ saved addresses.
 * Picking is per-order — it never writes `is_default` back to the address row.
 */
export default function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  disabled = false,
}: AddressPickerProps) {
  return (
    <fieldset
      data-testid="address-picker"
      className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-4 py-4 flex flex-col gap-3 min-w-0"
    >
      <legend className="text-brand-parchment text-xs uppercase tracking-wider px-1">
        Alamat Pengiriman
      </legend>
      <p className="text-brand-parchment text-xs opacity-70">
        Pilih cabang tujuan pengiriman pesanan ini
      </p>

      <div className="flex flex-col gap-2">
        {addresses.map((address, index) => {
          const checked = address.id === selectedId
          const label = addressLabelText(address, index)
          return (
            <label
              key={address.id}
              data-testid={`address-option-${address.id}`}
              className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${checked
                  ? 'border-brand-crema bg-[rgba(245,235,201,0.08)]'
                  : 'border-[rgba(245,235,201,0.2)] hover:bg-[rgba(245,235,201,0.04)]'}`}
            >
              <input
                type="radio"
                name="delivery-address"
                value={address.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(address.id)}
                data-testid={`address-radio-${address.id}`}
                className="mt-1 h-4 w-4 shrink-0 accent-[#f5ebc9]"
              />
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-brand-crema text-sm font-medium break-words">{label}</span>
                  {address.is_default && (
                    <span className="text-[10px] uppercase tracking-wide text-brand-honey border border-brand-honey rounded px-1.5 py-0.5">
                      Utama
                    </span>
                  )}
                </span>
                <span className="text-brand-parchment text-xs break-words">
                  {address.recipient_name}
                </span>
                <span className="text-brand-parchment text-xs break-words">
                  {address.address_line}
                </span>
                <span className="text-brand-parchment text-xs">{address.postal_code}</span>
              </span>
            </label>
          )
        })}
      </div>

      {disabled && (
        <p className="text-brand-parchment text-xs italic">Menghitung ongkir untuk alamat ini…</p>
      )}
    </fieldset>
  )
}
