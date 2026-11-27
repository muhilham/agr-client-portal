import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getCatalogForClient } from '@/lib/catalog'
import { linesOf } from '@/lib/variantResolver'
import {
  getBiteshipLocation,
  getBiteshipRates,
  getBiteshipCouriers,
  type BiteshipLocation,
  type BiteshipRate,
} from '@/lib/biteship'

const DEFAULT_COURIERS = 'jne,tiki,sicepat,anteraja,jnt,ninja'

export const PICKUP_COURIER_CODE = 'pickup'
export const FREE_COURIER_CODE = 'free'
export const MANUAL_COURIER_CODE = 'manual'

export function isPickupOrder(order: { shipping_courier: string | null }): boolean {
  return order.shipping_courier === PICKUP_COURIER_CODE
}

export interface AddressDisplay {
  recipient_name: string
  address_line: string
  postal_code: string
  // Present when the address row has GPS. Required by Biteship to quote
  // on-demand couriers (lalamove/gojek/grab); postal-only lanes exclude them.
  latitude?: number | null
  longitude?: number | null
  // #101: identity of the chosen address row. Carried into the order snapshot
  // so ops can tell which branch an order ships to (the packing slip already
  // prints snapshot.label/phone) without a second lookup.
  id?: string
  label?: string | null
  phone?: string | null
}

export type ShippingAddressSnapshot = AddressDisplay & { backfilled?: boolean }

/**
 * #101: a client address as offered at checkout. `created_at` only exists for
 * the deterministic pre-selection order (see sortAddresses) — it is never
 * rendered or snapshotted.
 */
export interface AddressOption extends AddressDisplay {
  id: string
  label: string | null
  is_default: boolean | null
  created_at: string | null
}

const ADDRESS_COLUMNS =
  'id, label, recipient_name, phone, address_line, postal_code, latitude, longitude, is_default, created_at'

/**
 * #101: canonical address ordering — staff default first, then oldest first.
 * Identical to the rule agr-ops migration 029 used to backfill order snapshots
 * (`is_default DESC NULLS LAST, created_at ASC`), so a checkout default and a
 * historical backfill can never disagree. Ties break on id to keep the order
 * total (two rows can share created_at, and 9 live clients have no default).
 */
export function sortAddresses(addresses: AddressOption[]): AddressOption[] {
  return [...addresses].sort((a, b) => {
    // `is_default` is nullable in practice; only an explicit true counts, so a
    // NULL row sorts with the non-defaults instead of producing an unstable,
    // non-transitive comparator.
    const aDefault = a.is_default === true
    const bDefault = b.is_default === true
    if (aDefault !== bDefault) return aDefault ? -1 : 1
    const at = a.created_at ?? ''
    const bt = b.created_at ?? ''
    if (at !== bt) return at < bt ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export function addressToDisplay(address: AddressOption): AddressDisplay {
  return {
    id: address.id,
    label: address.label,
    phone: address.phone ?? null,
    recipient_name: address.recipient_name,
    address_line: address.address_line,
    postal_code: address.postal_code,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
  }
}

/**
 * #101: labels are optional free text in the ops dashboard (1 of 39 live rows
 * is blank), so the picker always needs a readable fallback per position.
 * Defined in a client-safe module and re-exported for server/test consumers.
 */
export { addressLabelText } from './addressLabel'

export type AddressSelection =
  | { ok: true; address: AddressOption; addresses: AddressOption[] }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_ADDRESS' }

/**
 * #101 trust posture: `requestedId` is only a selector. The caller-supplied id
 * is matched against the rows already scoped to this client — it is never fed
 * into a query — so a foreign id can only ever produce INVALID_ADDRESS, never
 * another client's address. An unknown id fails CLOSED: silently falling back
 * to the default would snapshot an address the client did not pick.
 */
export function selectCheckoutAddress(
  rows: AddressOption[],
  requestedId?: string | null
): AddressSelection {
  const addresses = sortAddresses(rows)
  if (addresses.length === 0) return { ok: false, error: 'NO_ADDRESS' }

  if (requestedId) {
    const match = addresses.find((a) => a.id === requestedId)
    if (!match) return { ok: false, error: 'INVALID_ADDRESS' }
    return { ok: true, address: match, addresses }
  }

  return { ok: true, address: addresses[0], addresses }
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
  /** #90: resolved chip line (server-derived label — never caller text). */
  variantId?: string | null
  variantLabel?: string | null
}

export interface PickupLocation {
  name: string
  address: string
  postal_code: string
  contact_phone: string | null
}

export type CartValidationResult =
  | { ok: true; validatedItems: ValidatedItem[] }
  | { ok: false; error: 'INVALID_CART' }

export async function validateCartItems(
  clientId: string,
  items: { productId: string; variantId?: string | null; quantity: number }[]
): Promise<CartValidationResult> {
  const catalog = await getCatalogForClient(clientId)
  const catalogMap = new Map(catalog.map((p) => [p.id, p]))

  const validatedItems: ValidatedItem[] = []

  for (const item of items) {
    const product = catalogMap.get(item.productId)
    if (!product) {
      return { ok: false, error: 'INVALID_CART' }
    }
    // #90: resolve the concrete ORDER LINE before trusting price/MOQ/weight.
    // Variant-mode products must carry the chip's variantId (a flat-shaped
    // request against a chip product is a stale/tampered cart, not a
    // whole-product order); flat products must not carry one.
    const lines = linesOf(product)
    const line =
      product.variants.length > 0
        ? lines.find((l) => l.variantId === item.variantId)
        : item.variantId == null
          ? lines[0]
          : undefined
    if (!line) {
      return { ok: false, error: 'INVALID_CART' }
    }
    if (item.quantity < line.minQty) {
      return { ok: false, error: 'INVALID_CART' }
    }
    validatedItems.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      unitPrice: line.effectivePrice,
      quantity: item.quantity,
      subtotal: line.effectivePrice * item.quantity,
      shipWeightGrams: line.shipWeightGrams,
      variantId: line.variantId ?? null,
      variantLabel: product.variants.length > 0 ? line.label : null,
    })
  }

  return { ok: true, validatedItems }
}

export async function getPickupLocation(): Promise<PickupLocation | null> {
  const originLocationId = process.env.BITESHIP_ORIGIN_LOCATION_ID
  if (!originLocationId) return null

  const origin = await getBiteshipLocation(originLocationId)
  if (!origin) return null

  return {
    name: origin.name,
    address: origin.address,
    postal_code: origin.postal_code,
    contact_phone: origin.contact_phone || null,
  }
}

export type ShippingContext =
  | { ok: true; kind: 'free_shipping'; address: AddressDisplay; addresses: AddressOption[] }
  | { ok: true; kind: 'rates'; address: AddressDisplay; addresses: AddressOption[]; originLocation: BiteshipLocation; rates: BiteshipRate[]; validatedItems: ValidatedItem[] }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' }

export async function listClientAddresses(clientId: string): Promise<AddressOption[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('client_id', clientId)

  if (error) {
    console.error('[Shipping] address query error:', error)
    return []
  }

  return (data ?? []) as AddressOption[]
}

export async function resolveCheckoutAddress(
  clientId: string,
  addressId?: string | null
): Promise<AddressSelection> {
  return selectCheckoutAddress(await listClientAddresses(clientId), addressId)
}

export async function loadShippingContext(
  clientId: string,
  items: { productId: string; variantId?: string | null; quantity: number }[],
  addressId?: string | null
): Promise<ShippingContext> {
  const supabase = getSupabaseAdmin()

  // 0. Check client free shipping flag
  const { data: clientRow } = await supabase
    .from('clients')
    .select('has_free_shipping')
    .eq('id', clientId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasFreeShipping = (clientRow as any)?.has_free_shipping === true

  // 1. Destination address — the client's pick when given, else the staff
  //    default. Owned-by-client scoping happens inside resolveCheckoutAddress.
  const selection = await resolveCheckoutAddress(clientId, addressId)
  if (!selection.ok) {
    return { ok: false, error: selection.error }
  }
  const address = addressToDisplay(selection.address)
  const addresses = selection.addresses

  if (hasFreeShipping) {
    return {
      ok: true,
      kind: 'free_shipping',
      address,
      addresses,
    }
  }

  // 2. Items
  const itemsResult = await validateCartItems(clientId, items)
  if (!itemsResult.ok) {
    return { ok: false, error: itemsResult.error }
  }
  const validatedItems = itemsResult.validatedItems

  // 3. Origin
  const originLocationId = process.env.BITESHIP_ORIGIN_LOCATION_ID
  if (!originLocationId) {
    return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
  }

  const origin = await getBiteshipLocation(originLocationId)
  if (!origin) {
    return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
  }

  // 4. Build Biteship items — totalized per line (weight = per-unit grams x qty,
  //    quantity collapsed to 1). Pos Indonesia's calculator on Biteship's side
  //    ignores per-line quantity and rates only `weight`, so per-unit weights
  //    underquote multi-quantity orders. Other couriers price identically either way.
  const biteshipItems = validatedItems.map((i) => ({
    name: i.variantLabel ? `${i.productName} · ${i.variantLabel}` : i.productName,
    value: i.subtotal,
    weight: i.shipWeightGrams * i.quantity,
    quantity: 1,
  }))

  // 5. Call rates (dynamic couriers with fallback)
  const dynamicCouriers = await getBiteshipCouriers()
  const couriers = (dynamicCouriers && dynamicCouriers.length > 0)
    ? dynamicCouriers.join(',')
    : process.env.BITESHIP_COURIERS ?? DEFAULT_COURIERS

  if (!couriers) {
    console.warn('[Shipping] No couriers available (dynamic fetch empty and no fallback configured)')
  }

  const rates = await getBiteshipRates({
    origin_postal_code: origin.postal_code,
    origin_latitude: origin.latitude,
    origin_longitude: origin.longitude,
    destination_postal_code: address.postal_code,
    destination_latitude: address.latitude,
    destination_longitude: address.longitude,
    couriers,
    items: biteshipItems,
  })

  if (rates.length === 0) {
    return { ok: false, error: 'RATES_UNAVAILABLE' }
  }

  return { ok: true, kind: 'rates', address, addresses, originLocation: origin, rates, validatedItems }
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
