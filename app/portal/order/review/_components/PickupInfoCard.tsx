'use client'

import type { PickupLocation } from '@/lib/shipping'

interface PickupInfoCardProps {
  location: PickupLocation
}

export default function PickupInfoCard({ location }: PickupInfoCardProps) {
  return (
    <div
      data-testid="pickup-info-card"
      className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-1"
    >
      <p className="text-brand-parchment text-xs uppercase tracking-wider">Lokasi Pengambilan</p>
      <p className="text-brand-crema text-sm font-medium">{location.name}</p>
      <p className="text-brand-parchment text-sm">{location.address}</p>
      <p className="text-brand-parchment text-sm">{location.postal_code}</p>
      {location.contact_phone && (
        <p className="text-brand-parchment text-sm">{location.contact_phone}</p>
      )}
    </div>
  )
}
