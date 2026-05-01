'use client'

import { AddressDisplay } from '@/lib/shipping'

interface AddressCardProps {
  address: AddressDisplay
}

export default function AddressCard({ address }: AddressCardProps) {
  return (
    <div
      data-testid="address-card"
      className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-1"
    >
      <p className="text-brand-parchment text-xs uppercase tracking-wider">Alamat Pengiriman</p>
      <p className="text-brand-crema text-sm font-medium">{address.recipient_name}</p>
      <p className="text-brand-parchment text-sm">{address.address_line}</p>
      <p className="text-brand-parchment text-sm">{address.postal_code}</p>
    </div>
  )
}

export function AddressCardEmpty() {
  return (
    <div
      data-testid="address-card-empty"
      className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-6 text-center"
    >
      <p className="text-brand-parchment text-sm">Hubungi admin untuk menambahkan alamat pengiriman</p>
    </div>
  )
}
