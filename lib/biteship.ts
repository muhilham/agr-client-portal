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
    const json = (await res.json()) as BiteshipLocation & {
      coordinate?: { latitude?: number | null; longitude?: number | null } | null
    }
    // The live API nests GPS under `coordinate`; top-level latitude/longitude is
    // the legacy/mock shape. On-demand couriers (lalamove, gojek, grab) are
    // silently dropped from /rates/couriers when origin coords are missing.
    // Rebuild explicitly (no spread of raw API fields); non-finite values
    // become null so they get stripped before the rates call.
    const lat = json.coordinate?.latitude ?? json.latitude
    const lng = json.coordinate?.longitude ?? json.longitude
    return {
      id: json.id,
      name: json.name,
      contact_name: json.contact_name,
      contact_phone: json.contact_phone,
      address: json.address,
      postal_code: json.postal_code,
      latitude: typeof lat === 'number' && Number.isFinite(lat) ? lat : null,
      longitude: typeof lng === 'number' && Number.isFinite(lng) ? lng : null,
    }
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

interface BiteshipCourier {
  courier_code: string
  courier_name: string
}

interface BiteshipCouriersResponse {
  success?: boolean
  couriers?: BiteshipCourier[]
}

const CACHE_TTL_MS = 3_600_000 // 1 hour
const courierCache = new Map<string, { codes: string[]; fetchedAt: number }>()

export async function getBiteshipCouriers(): Promise<string[] | null> {
  const apiKey = getApiKey()
  const cached = courierCache.get(apiKey)

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.codes
  }

  try {
    const res = await fetchWithTimeout(`${BITESHIP_BASE_URL}/couriers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      console.error('[Biteship] couriers error:', res.status, await res.text())
      return null
    }

    const json = (await res.json()) as BiteshipCouriersResponse
    const codes = (json.couriers ?? [])
      .map((c) => c.courier_code)
      .filter(Boolean)

    if (codes.length === 0) {
      console.warn('[Biteship] couriers response empty')
      return null
    }

    courierCache.set(apiKey, { codes, fetchedAt: Date.now() })
    return codes
  } catch (err) {
    console.error('[Biteship] getBiteshipCouriers failed:', err)
    return null
  }
}

export async function getBiteshipRates(params: BiteshipRatesParams): Promise<BiteshipRate[]> {
  try {
    // Strip null lat/lng values — Biteship requires postal codes if coordinates are missing
    const body: Record<string, unknown> = { ...params }
    for (const key of Object.keys(body)) {
      if (body[key] == null) {
        delete body[key]
      }
    }

    const res = await fetchWithTimeout(`${BITESHIP_BASE_URL}/rates/couriers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
