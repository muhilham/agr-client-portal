import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getCatalogForClient } from '@/lib/catalog'
import { getBiteshipLocation, getBiteshipRates, getBiteshipCouriers, type BiteshipLocation, type BiteshipRate } from '@/lib/biteship'

export interface AddressDisplay {
  recipient_name: string
  address_line: string
  postal_code: string
}

export interface RateOption {
  courier_code: string
  courier_name: string
  service_code: string
  service_name: string
  etd: string
  price: number
}

export interface ValidatedItem {
  productId: string
  productName: string
  unit: string
  unitPrice: number
  quantity: number
  subtotal: number
  shipWeightGrams: number
}

export type ShippingContext =
  | { ok: true; address: AddressDisplay; originLocation: BiteshipLocation; rates: BiteshipRate[]; validatedItems: ValidatedItem[] }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' }

export async function loadShippingContext(
  clientId: string,
  items: { productId: string; quantity: number }[]
): Promise<ShippingContext> {
  const supabase = getSupabaseAdmin()

  // 1. Default address (fallback to any address if no default)
  let addressRow = await supabase
    .from('addresses')
    .select('recipient_name, address_line, postal_code')
    .eq('client_id', clientId)
    .eq('is_default', true)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        console.error('[Shipping] address query error:', error)
        return null
      }
      return data
    })

  if (!addressRow) {
    // Fallback: use any address for this client
    addressRow = await supabase
      .from('addresses')
      .select('recipient_name, address_line, postal_code')
      .eq('client_id', clientId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data ?? null)
  }

  if (!addressRow) {
    return { ok: false, error: 'NO_ADDRESS' }
  }

  const address: AddressDisplay = {
    recipient_name: addressRow.recipient_name,
    address_line: addressRow.address_line,
    postal_code: addressRow.postal_code,
  }

  // 2. Products
  const catalog = await getCatalogForClient(clientId)
  const catalogMap = new Map(catalog.map((p) => [p.id, p]))

  const validatedItems: ValidatedItem[] = []

  for (const item of items) {
    const product = catalogMap.get(item.productId)
    if (!product) {
      return { ok: false, error: 'INVALID_CART' }
    }
    if (item.quantity < product.minQty) {
      return { ok: false, error: 'INVALID_CART' }
    }
    validatedItems.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      unitPrice: product.effectivePrice,
      quantity: item.quantity,
      subtotal: product.effectivePrice * item.quantity,
      shipWeightGrams: product.shipWeightGrams,
    })
  }

  // 3. Origin
  const originLocationId = process.env.BITESHIP_ORIGIN_LOCATION_ID
  if (!originLocationId) {
    return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
  }

  const origin = await getBiteshipLocation(originLocationId)
  if (!origin) {
    return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
  }

  // 4. Build Biteship items
  const biteshipItems = validatedItems.map((i) => ({
    name: i.productName,
    value: i.unitPrice,
    weight: i.shipWeightGrams,
    quantity: i.quantity,
  }))

  // 5. Call rates (dynamic couriers with fallback)
  const dynamicCouriers = await getBiteshipCouriers()
  const couriers = dynamicCouriers?.join(',')
    ?? process.env.BITESHIP_COURIERS
    ?? 'jne,tiki,sicepat,anteraja,jnt,ninja'

  const rates = await getBiteshipRates({
    origin_postal_code: origin.postal_code,
    origin_latitude: origin.latitude,
    origin_longitude: origin.longitude,
    destination_postal_code: address.postal_code,
    couriers,
    items: biteshipItems,
  })

  if (rates.length === 0) {
    return { ok: false, error: 'RATES_UNAVAILABLE' }
  }

  return { ok: true, address, originLocation: origin, rates, validatedItems }
}

export function groupRatesByCourier(rates: BiteshipRate[]): RateOption[] {
  const grouped = new Map<string, BiteshipRate>()

  for (const rate of rates) {
    const existing = grouped.get(rate.courier_code)
    if (!existing || rate.price < existing.price) {
      grouped.set(rate.courier_code, rate)
    }
  }

  return Array.from(grouped.values()).map((r) => ({
    courier_code: r.courier_code,
    courier_name: r.courier_name,
    service_code: r.courier_service_code,
    service_name: r.courier_service_name,
    etd: r.duration,
    price: r.price,
  }))
}

export function findRateMatch(
  rates: BiteshipRate[],
  courierCode: string,
  serviceCode: string
): BiteshipRate | null {
  return rates.find(
    (r) => r.courier_code === courierCode && r.courier_service_code === serviceCode
  ) ?? null
}
