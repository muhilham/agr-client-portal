import { cache } from 'react'

const BITESHIP_BASE_URL = 'https://api.biteship.com/v1'

function getApiKey(): string {
  const key = process.env.BITESHIP_API_KEY
  if (!key) throw new Error('Missing BITESHIP_API_KEY')
  return key
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeout?: number } = {}) {
  const { timeout = 10_000, ...rest } = init
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

export interface BiteshipLocation {
  id: string
  name: string
  contact_name: string
  contact_phone: string
  address: string
  postal_code: string
  latitude: number | null
  longitude: number | null
}

export const getBiteshipLocation = cache(async (id: string): Promise<BiteshipLocation | null> => {
  try {
    const res = await fetchWithTimeout(`${BITESHIP_BASE_URL}/locations/${id}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json as BiteshipLocation
  } catch (err) {
    console.error('[Biteship] getBiteshipLocation failed:', err)
    return null
  }
})

export interface BiteshipRatesItem {
  name: string
  value: number
  weight: number
  quantity: number
}

export interface BiteshipRatesParams {
  origin_postal_code: string
  origin_latitude?: number | null
  origin_longitude?: number | null
  destination_postal_code: string
  destination_latitude?: number | null
  destination_longitude?: number | null
  couriers: string
  items: BiteshipRatesItem[]
}

export interface BiteshipRate {
  courier_code: string
  courier_name: string
  courier_service_code: string
  courier_service_name: string
  duration: string
  price: number
}

export async function getBiteshipRates(params: BiteshipRatesParams): Promise<BiteshipRate[]> {
  try {
    const res = await fetchWithTimeout(`${BITESHIP_BASE_URL}/rates/couriers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[Biteship] rates error:', res.status, body)
      return []
    }

    const json = await res.json()
    const pricing = (json as { pricing?: BiteshipRate[] }).pricing ?? []
    return pricing
  } catch (err) {
    console.error('[Biteship] getBiteshipRates failed:', err)
    return []
  }
}
