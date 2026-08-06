# Self-Pickup Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client choose "Ambil Sendiri" (self pickup) instead of courier shipping at order review — no DB migration, no new address requirement, single fixed pickup location, no scheduling.

**Architecture:** Reuse the existing `orders.shipping_courier` text column as a sentinel (`'pickup'`) instead of adding a `fulfillment_method` column — this repo's schema is managed remotely (migrations live in `agr-ops`), and the sibling `agroastery-web` B2C storefront already proved this pattern out under the same constraint. A `fulfillmentMethod` field on the create-order request drives server branching only; it is never persisted as its own column. `lib/shipping.ts` gains a centralized `isPickupOrder()` guard so every downstream consumer (order detail, invoice, Telegram) checks the sentinel through one function instead of repeating the raw string.

**Tech Stack:** Next.js 16 App Router, Supabase (service-role admin client for cross-RLS reads), Zod, Playwright E2E (this repo has no unit-test runner — see Global Constraints).

## Global Constraints

- Server actions use service role key (`getSupabaseAdmin()`), never anon key, for any query that reads across RLS boundaries (products, client_products, other clients' data).
- All prices re-validated server-side on order submission — never trust client-submitted prices. `validateCartItems` must always read `effectivePrice` from `getCatalogForClient()`, never from request input.
- Order number generated via `generate_order_number()` DB function — never `COUNT(*)+1`.
- No localStorage anywhere — cart lives in React state / `sessionStorage` only (existing pattern, unchanged by this feature).
- All timestamps in Asia/Jakarta (WIB, UTC+7).
- No framer-motion, no moment.js, no full lodash imports.
- All input font-size >= 16px (prevents iOS Safari zoom) — applies to any new form inputs (none added by this feature; the fulfillment toggle uses buttons, not text input).
- `next/image` for ALL product images, never `<img>` — not applicable to this feature (no new images).
- **This repo has no unit-test runner** (`package.json` only defines `test:e2e*` via Playwright; confirmed by the prior `dynamic-biteship-couriers` spec's "Unit: Not applicable"). Pure-logic tasks (schema, `lib/shipping.ts` helpers) are verified with `npx tsc --noEmit`, not isolated unit tests. End-to-end behavior is verified by the two E2E tasks at the end of this plan, run against the fully-implemented feature — this mirrors how every prior feature in this repo's `docs/superpowers/specs/` history was tested, not textbook red-green TDD.
- Commit messages: conventional commits, scope `orders` for this feature, per this repo's `CLAUDE.md`.

---

### Task 1: Shared discriminator, cart validation, pickup location, schema

**Files:**
- Modify: `lib/shipping.ts` (full file)
- Modify: `lib/schemas/order.ts` (full file)

**Interfaces:**
- Produces: `PICKUP_COURIER_CODE: string`, `isPickupOrder(order: { shipping_courier: string | null }): boolean`, `validateCartItems(clientId: string, items: { productId: string; quantity: number }[]): Promise<{ ok: true; validatedItems: ValidatedItem[] } | { ok: false; error: 'INVALID_CART' }>`, `getPickupLocation(): Promise<PickupLocation | null>`, `interface PickupLocation { name: string; address: string; postal_code: string; contact_phone: string | null }`, `fulfillmentMethodSchema`, updated `createOrderInputSchema` (now requires `fulfillmentMethod`, `shippingSelection` optional).
- Consumes: existing `getCatalogForClient` (`lib/catalog.ts`), existing `getBiteshipLocation` (`lib/biteship.ts`), existing `ValidatedItem` interface (already exported from `lib/shipping.ts`, unchanged shape).

- [ ] **Step 1: Rewrite `lib/shipping.ts`**

Replace the entire file with:

```ts
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getCatalogForClient } from '@/lib/catalog'
import {
  getBiteshipLocation,
  getBiteshipRates,
  getBiteshipCouriers,
  type BiteshipLocation,
  type BiteshipRate,
} from '@/lib/biteship'

const DEFAULT_COURIERS = 'jne,tiki,sicepat,anteraja,jnt,ninja'

export const PICKUP_COURIER_CODE = 'pickup'

export function isPickupOrder(order: { shipping_courier: string | null }): boolean {
  return order.shipping_courier === PICKUP_COURIER_CODE
}

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
  items: { productId: string; quantity: number }[]
): Promise<CartValidationResult> {
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

  // 4. Build Biteship items
  const biteshipItems = validatedItems.map((i) => ({
    name: i.productName,
    value: i.unitPrice,
    weight: i.shipWeightGrams,
    quantity: i.quantity,
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
```

The only functional changes vs. the current file: the new `PICKUP_COURIER_CODE`/`isPickupOrder`/`PickupLocation`/`getPickupLocation`/`validateCartItems` exports, and step 2 of `loadShippingContext` now calls `validateCartItems` instead of inlining the loop (behavior identical — this is a pure extraction).

- [ ] **Step 2: Rewrite `lib/schemas/order.ts`**

Replace the entire file with:

```ts
import { z } from 'zod'

export const shippingSelectionSchema = z.object({
  courier_code: z.string().min(1).max(64),
  service_code: z.string().min(1).max(64),
})

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(10_000),
})

export const getShippingRatesInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(100),
})

export const fulfillmentMethodSchema = z.enum(['SHIPPING', 'PICKUP']).default('SHIPPING')

export const createOrderInputSchema = z
  .object({
    items: z.array(orderItemInputSchema).min(1).max(100),
    notes: z.string().max(500).optional(),
    fulfillmentMethod: fulfillmentMethodSchema,
    shippingSelection: shippingSelectionSchema.optional(),
  })
  .refine(
    (data) => data.fulfillmentMethod === 'PICKUP' || data.shippingSelection != null,
    { message: 'shippingSelection is required for SHIPPING orders', path: ['shippingSelection'] }
  )

export type GetShippingRatesInput = z.infer<typeof getShippingRatesInputSchema>
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/shipping.ts` or `lib/schemas/order.ts`. (Other files will now show errors because they haven't been updated yet — e.g. `createOrder.ts` calling `findRateMatch`/`loadShippingContext` is unaffected, but anything constructing `createOrderInputSchema` input without `fulfillmentMethod` will error. That's expected until Task 3.)

- [ ] **Step 4: Commit**

```bash
git add lib/shipping.ts lib/schemas/order.ts
git commit -m "feat(orders): add pickup discriminator, cart validation extraction, and schema"
```

---

### Task 2: `getPickupInfo` server action

**Files:**
- Create: `app/portal/order/_actions/getPickupInfo.ts`

**Interfaces:**
- Consumes: `validateCartItems`, `getPickupLocation`, `PickupLocation` from `lib/shipping.ts` (Task 1); `getShippingRatesInputSchema` from `lib/schemas/order.ts`.
- Produces: `getPickupInfo(input: unknown): Promise<PickupInfoResult>` where `PickupInfoResult = { ok: true; location: PickupLocation } | { ok: false; error: 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'INVALID_INPUT' }` — consumed by Task 5 (review page).

- [ ] **Step 1: Create the action**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getShippingRatesInputSchema } from '@/lib/schemas/order'
import { validateCartItems, getPickupLocation, type PickupLocation } from '@/lib/shipping'

export type PickupInfoResult =
  | { ok: true; location: PickupLocation }
  | { ok: false; error: 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'INVALID_INPUT' }

export async function getPickupInfo(input: unknown): Promise<PickupInfoResult> {
  const parsed = getShippingRatesInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'INVALID_INPUT' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthenticated')
  }

  const admin = getSupabaseAdmin()
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!client) {
    throw new Error('Client not found')
  }

  const itemsResult = await validateCartItems(client.id, parsed.data.items)
  if (!itemsResult.ok) {
    return { ok: false, error: itemsResult.error }
  }

  const location = await getPickupLocation()
  if (!location) {
    return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
  }

  return { ok: true, location }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/portal/order/_actions/getPickupInfo.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/portal/order/_actions/getPickupInfo.ts
git commit -m "feat(orders): add getPickupInfo server action"
```

---

### Task 3: `createOrder.ts` branch on fulfillment method

**Files:**
- Modify: `app/portal/order/_actions/createOrder.ts` (full file)

**Interfaces:**
- Consumes: `loadShippingContext`, `findRateMatch`, `validateCartItems`, `getPickupLocation`, `PICKUP_COURIER_CODE`, `type ValidatedItem` from `lib/shipping.ts` (Task 1); `createOrderInputSchema` from `lib/schemas/order.ts` (Task 1, now requires `fulfillmentMethod`).
- Produces: `createOrder(input: unknown): Promise<CreateOrderResult>` — unchanged signature/return type, consumed by Task 5 (review page) with a new required `fulfillmentMethod` field in its input.

- [ ] **Step 1: Rewrite `app/portal/order/_actions/createOrder.ts`**

Replace the entire file with:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createOrderInputSchema } from '@/lib/schemas/order'
import {
  loadShippingContext,
  findRateMatch,
  validateCartItems,
  getPickupLocation,
  PICKUP_COURIER_CODE,
  type ValidatedItem,
} from '@/lib/shipping'
import { sendOrderNotification } from '@/lib/telegram'

export type CreateOrderResult =
  | { ok: true; id: string; order_number: string }
  | { ok: false; error: string }

export async function createOrder(input: unknown): Promise<CreateOrderResult> {
  const parsed = createOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Permintaan tidak valid' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthenticated')
  }

  const admin = getSupabaseAdmin()
  const { data: client } = await admin
    .from('clients')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!client) {
    throw new Error('Client not found')
  }

  let orderItems: ValidatedItem[]
  let dbShippingCost: number
  let dbShippingCourier: string | null
  let dbShippingService: string | null
  let dbShippingEtd: string | null
  let notifShippingCourier: string | undefined
  let notifShippingService: string | undefined

  if (parsed.data.fulfillmentMethod === 'PICKUP') {
    const itemsResult = await validateCartItems(client.id, parsed.data.items)
    if (!itemsResult.ok) {
      return { ok: false, error: 'Isi keranjang tidak valid, silakan kembali ke katalog' }
    }
    const location = await getPickupLocation()
    if (!location) {
      return { ok: false, error: 'Pengiriman tidak tersedia, hubungi admin' }
    }

    orderItems = itemsResult.validatedItems
    dbShippingCost = 0
    dbShippingCourier = PICKUP_COURIER_CODE
    dbShippingService = null
    dbShippingEtd = null
    notifShippingCourier = PICKUP_COURIER_CODE
    notifShippingService = undefined
  } else {
    const ctx = await loadShippingContext(client.id, parsed.data.items)

    if (!ctx.ok) {
      const messages: Record<string, string> = {
        NO_ADDRESS: 'Alamat pengiriman tidak ditemukan',
        INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
        ORIGIN_NOT_CONFIGURED: 'Pengiriman tidak tersedia, hubungi admin',
        RATES_UNAVAILABLE: 'Pengiriman tidak dapat dihitung',
      }
      return { ok: false, error: messages[ctx.error] ?? 'Terjadi kesalahan' }
    }

    if (!parsed.data.shippingSelection) {
      return { ok: false, error: 'Metode pengiriman tidak dipilih' }
    }

    const match = findRateMatch(
      ctx.rates,
      parsed.data.shippingSelection.courier_code,
      parsed.data.shippingSelection.service_code
    )

    if (!match) {
      return { ok: false, error: 'Kurir tidak lagi tersedia, silakan pilih ulang' }
    }

    orderItems = ctx.validatedItems
    dbShippingCost = match.price
    dbShippingCourier = match.courier_code
    dbShippingService = match.courier_service_code
    dbShippingEtd = match.duration
    notifShippingCourier = match.courier_name
    notifShippingService = match.courier_service_name
  }

  const totalAmount = orderItems.reduce((sum, i) => sum + i.subtotal, 0)

  let orderNumber: string
  try {
    const { data, error } = await supabase.rpc('generate_order_number')
    if (error) throw error
    if (typeof data !== 'string') throw new Error('generate_order_number returned non-string')
    orderNumber = data
  } catch (err) {
    console.error('[createOrder] Failed to generate order number:', err)
    return { ok: false, error: 'Terjadi kesalahan, silakan coba lagi' }
  }

  let order: { id: string; order_number: string }
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: client.id,
        fulfillment_status: 'PENDING',
        payment_status: 'UNPAID',
        notes: parsed.data.notes?.slice(0, 500) ?? null,
        total_amount: totalAmount,
        shipping_cost: dbShippingCost,
        shipping_courier: dbShippingCourier,
        shipping_service: dbShippingService,
        shipping_etd: dbShippingEtd,
      })
      .select('id, order_number')
      .single()

    if (error || !data) throw error ?? new Error('Failed to create order')
    order = data
  } catch (err) {
    console.error('[createOrder] Failed to insert order:', err)
    return { ok: false, error: 'Terjadi kesalahan, silakan coba lagi' }
  }

  try {
    const { error } = await supabase.from('order_items').insert(
      orderItems.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.productName,
        unit_price: i.unitPrice,
        quantity: i.quantity,
        subtotal: i.subtotal,
      }))
    )
    if (error) throw error
  } catch (err) {
    console.error('[createOrder] Failed to insert order items:', err)
    return { ok: false, error: 'Terjadi kesalahan, silakan coba lagi' }
  }

  try {
    await sendOrderNotification({
      orderId: order.id,
      orderNumber: order.order_number,
      clientName: client.name,
      items: orderItems.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      totalAmount,
      shippingCost: dbShippingCost,
      shippingCourier: notifShippingCourier,
      shippingService: notifShippingService,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('[Telegram] Notification failed:', err)
  }

  return { ok: true, id: order.id, order_number: order.order_number }
}
```

Note: `dbShippingCost` is always passed to `sendOrderNotification` as `shippingCost` — for pickup this is `0`, which is `!= null`, so `lib/telegram.ts` takes the "has shipping" branch. Task 8 makes that branch pickup-aware (checks `notifShippingCourier === PICKUP_COURIER_CODE` before rendering the 🚚 line).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/portal/order/_actions/createOrder.ts`. `lib/telegram.ts` will still type-check fine here since `shippingCourier`/`shippingService` were already optional in its payload type.

- [ ] **Step 3: Commit**

```bash
git add app/portal/order/_actions/createOrder.ts
git commit -m "feat(orders): branch order creation on pickup vs shipping"
```

---

### Task 4: `FulfillmentToggle` and `PickupInfoCard` components

**Files:**
- Create: `app/portal/order/review/_components/FulfillmentToggle.tsx`
- Create: `app/portal/order/review/_components/PickupInfoCard.tsx`

**Interfaces:**
- Consumes: `PickupLocation` type from `lib/shipping.ts` (Task 1).
- Produces: `FulfillmentToggle({ value: 'SHIPPING' | 'PICKUP', onChange: (v) => void })`, `export type FulfillmentMethod = 'SHIPPING' | 'PICKUP'`, `PickupInfoCard({ location: PickupLocation })` — both consumed by Task 5 (review page).

- [ ] **Step 1: Create `FulfillmentToggle.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `PickupInfoCard.tsx`**

```tsx
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in either new file.

- [ ] **Step 4: Commit**

```bash
git add app/portal/order/review/_components/FulfillmentToggle.tsx app/portal/order/review/_components/PickupInfoCard.tsx
git commit -m "feat(orders): add FulfillmentToggle and PickupInfoCard components"
```

---

### Task 5: Wire the review page

**Files:**
- Modify: `app/portal/order/review/page.tsx` (full file)

**Interfaces:**
- Consumes: `getPickupInfo` (Task 2), `createOrder` (Task 3, now needs `fulfillmentMethod`), `FulfillmentToggle`/`FulfillmentMethod` (Task 4), `PickupInfoCard` (Task 4), `PickupLocation` type (Task 1).
- Produces: no new exports — this is the page component itself, exercised directly by Task 9/10 E2E tests via `data-testid="fulfillment-toggle"`, `data-testid="fulfillment-option-pickup"`, `data-testid="fulfillment-option-shipping"`, `data-testid="pickup-info-card"`.

**Race condition note:** the current `loadShippingRates` has no staleness guard — rapidly toggling SHIPPING→PICKUP→SHIPPING can let an in-flight `getShippingRates` response land after a newer `getPickupInfo` call already resolved, overwriting the correct state with stale data. Both loaders below take a shared `requestIdRef` and their own captured `myRequestId`; each discards its result if a newer request has started by the time it resolves.

- [ ] **Step 1: Rewrite `app/portal/order/review/page.tsx`**

Replace the entire file with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrder } from '../_actions/createOrder'
import { getShippingRates } from '../_actions/getShippingRates'
import { getPickupInfo } from '../_actions/getPickupInfo'
import { CartItem } from '../../_components/CatalogView'
import AddressCard, { AddressCardEmpty } from './_components/AddressCard'
import CourierPicker from './_components/CourierPicker'
import FulfillmentToggle, { type FulfillmentMethod } from './_components/FulfillmentToggle'
import PickupInfoCard from './_components/PickupInfoCard'
import type { RateOption, AddressDisplay, PickupLocation } from '@/lib/shipping'

type RatesState =
  | { kind: 'loading' }
  | { kind: 'ready'; rates: RateOption[]; address: AddressDisplay }
  | { kind: 'no_address' }
  | { kind: 'error'; message: string }

type PickupState =
  | { kind: 'loading' }
  | { kind: 'ready'; location: PickupLocation }
  | { kind: 'error'; message: string }

function formatIDR(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

async function loadShippingRates(
  items: CartItem[],
  setRatesState: React.Dispatch<React.SetStateAction<RatesState>>,
  setSelectedRate: React.Dispatch<React.SetStateAction<RateOption | null>>,
  requestIdRef: React.MutableRefObject<number>,
  myRequestId: number
) {
  setRatesState({ kind: 'loading' })
  setSelectedRate(null)
  const result = await getShippingRates({
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  })
  if (requestIdRef.current !== myRequestId) return // a newer request superseded this one — ignore
  if (!result.ok) {
    if (result.error === 'NO_ADDRESS') {
      setRatesState({ kind: 'no_address' })
    } else {
      const messages: Record<string, string> = {
        INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
        ORIGIN_NOT_CONFIGURED: 'Pengiriman tidak tersedia, hubungi admin',
        RATES_UNAVAILABLE: 'Tidak dapat menghitung ongkir saat ini',
        INVALID_INPUT: 'Permintaan tidak valid',
      }
      setRatesState({ kind: 'error', message: messages[result.error] ?? 'Terjadi kesalahan' })
    }
    return
  }
  setRatesState({ kind: 'ready', rates: result.rates, address: result.address })
}

async function loadPickupInfo(
  items: CartItem[],
  setPickupState: React.Dispatch<React.SetStateAction<PickupState>>,
  requestIdRef: React.MutableRefObject<number>,
  myRequestId: number
) {
  setPickupState({ kind: 'loading' })
  const result = await getPickupInfo({
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  })
  if (requestIdRef.current !== myRequestId) return // a newer request superseded this one — ignore
  if (!result.ok) {
    const messages: Record<string, string> = {
      INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
      ORIGIN_NOT_CONFIGURED: 'Pengambilan tidak tersedia, hubungi admin',
      INVALID_INPUT: 'Permintaan tidak valid',
    }
    setPickupState({ kind: 'error', message: messages[result.error] ?? 'Terjadi kesalahan' })
    return
  }
  setPickupState({ kind: 'ready', location: result.location })
}

export default function OrderReviewPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = sessionStorage.getItem('cart')
    if (!stored) return []
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('SHIPPING')
  const [ratesState, setRatesState] = useState<RatesState>({ kind: 'loading' })
  const [selectedRate, setSelectedRate] = useState<RateOption | null>(null)
  const [pickupState, setPickupState] = useState<PickupState>({ kind: 'loading' })
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (cart.length === 0) {
      router.replace('/portal')
      return
    }
    const myRequestId = ++requestIdRef.current
    if (fulfillmentMethod === 'SHIPPING') {
      loadShippingRates(cart, setRatesState, setSelectedRate, requestIdRef, myRequestId)
    } else {
      loadPickupInfo(cart, setPickupState, requestIdRef, myRequestId)
    }
  }, [router, cart, fulfillmentMethod])

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const shippingCost = fulfillmentMethod === 'PICKUP' ? 0 : (selectedRate?.price ?? 0)
  const grandTotal = subtotal + shippingCost

  const handleConfirm = async () => {
    if (fulfillmentMethod === 'SHIPPING' && (!selectedRate || ratesState.kind !== 'ready')) return
    if (fulfillmentMethod === 'PICKUP' && pickupState.kind !== 'ready') return

    setSubmitting(true)
    setError(null)

    const result = await createOrder({
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      notes: notes.trim() || undefined,
      fulfillmentMethod,
      shippingSelection:
        fulfillmentMethod === 'SHIPPING' && selectedRate
          ? { courier_code: selectedRate.courier_code, service_code: selectedRate.service_code }
          : undefined,
    })

    if (!result.ok) {
      if (result.error === 'Kurir tidak lagi tersedia, silakan pilih ulang') {
        setRatesState({ kind: 'loading' })
        const myRequestId = ++requestIdRef.current
        loadShippingRates(cart, setRatesState, setSelectedRate, requestIdRef, myRequestId)
      }
      setError(result.error)
      setSubmitting(false)
      return
    }

    sessionStorage.removeItem('cart')
    router.push(
      `/portal/order/confirmation?id=${result.id}&orderNumber=${encodeURIComponent(result.order_number)}`
    )
  }

  const canSubmit =
    fulfillmentMethod === 'SHIPPING'
      ? ratesState.kind === 'ready' && selectedRate != null
      : pickupState.kind === 'ready'

  const isLoading =
    fulfillmentMethod === 'SHIPPING' ? ratesState.kind === 'loading' : pickupState.kind === 'loading'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="text-brand-parchment text-sm">Memuat…</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-brand-black">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-brand-black border-b border-[rgba(245,235,201,0.25)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-brand-crema font-semibold tracking-widest text-sm uppercase">
            Agroastery
          </span>
          <Link
            href="/portal"
            className="text-brand-parchment text-sm hover:text-brand-crema transition-colors"
            data-testid="back-to-catalog-link"
          >
            ← Katalog
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-brand-crema">Review Pesanan</h1>

        {/* Items */}
        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
            <p className="text-brand-parchment text-xs uppercase tracking-wider">Item Pesanan</p>
          </div>
          <div className="divide-y divide-[rgba(245,235,201,0.1)]">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="px-5 py-4 flex items-center justify-between gap-4"
                data-testid={`order-item-${item.productId}`}
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-brand-crema text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-brand-parchment text-xs">
                    {item.quantity} {item.unit} × {formatIDR(item.unitPrice)}
                  </p>
                </div>
                <p className="text-brand-crema text-sm font-semibold whitespace-nowrap">
                  {formatIDR(item.unitPrice * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-[rgba(245,235,201,0.25)] flex items-center justify-between">
            <p className="text-brand-parchment text-sm font-medium">Subtotal</p>
            <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-subtotal">
              {formatIDR(subtotal)}
            </p>
          </div>
        </div>

        {/* Fulfillment */}
        <div data-testid="shipping-section" className="flex flex-col gap-3">
          <p className="text-brand-parchment text-xs uppercase tracking-wider">Pengiriman</p>

          <FulfillmentToggle value={fulfillmentMethod} onChange={setFulfillmentMethod} />

          {fulfillmentMethod === 'SHIPPING' && (
            <>
              {ratesState.kind === 'no_address' && <AddressCardEmpty />}

              {ratesState.kind === 'error' && (
                <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-3">
                  <p className="text-brand-parchment text-sm">{ratesState.message}</p>
                  <button
                    onClick={() => {
                      const myRequestId = ++requestIdRef.current
                      loadShippingRates(cart, setRatesState, setSelectedRate, requestIdRef, myRequestId)
                    }}
                    data-testid="retry-rates-button"
                    className="text-brand-crema text-sm underline underline-offset-4 hover:text-brand-honey transition-colors self-start"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {ratesState.kind === 'ready' && (
                <>
                  <AddressCard address={ratesState.address} />
                  <CourierPicker
                    rates={ratesState.rates}
                    selected={selectedRate}
                    onSelect={setSelectedRate}
                  />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      {selectedRate ? formatIDR(selectedRate.price) : '—'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {fulfillmentMethod === 'PICKUP' && (
            <>
              {pickupState.kind === 'error' && (
                <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4 flex flex-col gap-3">
                  <p className="text-brand-parchment text-sm">{pickupState.message}</p>
                  <button
                    onClick={() => {
                      const myRequestId = ++requestIdRef.current
                      loadPickupInfo(cart, setPickupState, requestIdRef, myRequestId)
                    }}
                    data-testid="retry-pickup-button"
                    className="text-brand-crema text-sm underline underline-offset-4 hover:text-brand-honey transition-colors self-start"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {pickupState.kind === 'ready' && (
                <>
                  <PickupInfoCard location={pickupState.location} />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-brand-parchment text-sm">Ongkir</p>
                    <p className="text-brand-crema text-sm font-semibold" data-testid="shipping-cost">
                      Gratis (Ambil Sendiri)
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Grand total */}
        <div className="flex items-center justify-between px-1">
          <p className="text-brand-crema text-base font-semibold">Total</p>
          <p className="text-brand-crema text-lg font-semibold" data-testid="shipping-total">
            {formatIDR(grandTotal)}
          </p>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <label htmlFor="notes" className="text-brand-parchment text-sm">
            Catatan (opsional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 200))}
            maxLength={200}
            rows={3}
            placeholder="Instruksi pengiriman, catatan khusus…"
            data-testid="notes-input"
            className="rounded-lg border border-[rgba(245,235,201,0.25)] bg-brand-midnight text-brand-crema
              placeholder:text-brand-parchment placeholder:opacity-50 px-4 py-3 text-[16px]
              focus:outline-none focus:border-brand-crema resize-none"
          />
          <p className="text-brand-parchment text-xs opacity-50 text-right">
            {notes.length}/200
          </p>
        </div>

        {error && (
          <div
            className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-red-300 text-sm"
            data-testid="order-error"
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting || !canSubmit}
            data-testid="confirm-order-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors duration-150
              disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
          >
            {submitting ? 'Memproses…' : 'Konfirmasi Pesanan'}
          </button>
          <Link
            href="/portal"
            data-testid="back-to-catalog-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            ← Kembali ke Katalog
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/portal/order/review/page.tsx`.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, sign in as the E2E test client, add an item to cart, go to review, click "Ambil Sendiri" — confirm the courier picker/address card disappear and a pickup location card appears with "Gratis (Ambil Sendiri)" as the shipping cost. Click "Kirim" — confirm it switches back to the courier flow. This is a manual check, not automated (no dev server available in this planning session).

- [ ] **Step 4: Commit**

```bash
git add app/portal/order/review/page.tsx
git commit -m "feat(orders): wire fulfillment toggle into order review page"
```

---

### Task 6: Order detail page — pickup-aware rendering

**Files:**
- Modify: `app/portal/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `isPickupOrder` from `lib/shipping.ts` (Task 1). `order.shipping_courier` is already selected by the existing query (line 27) — no select-string change needed.

- [ ] **Step 1: Add the import**

In `app/portal/orders/[id]/page.tsx`, add after the existing imports (after line 6, before `export const dynamic = 'force-dynamic'`):

```ts
import { isPickupOrder } from '@/lib/shipping'
```

- [ ] **Step 2: Guard the inline "Ongkir" line in the items card**

Find this block (existing lines 113-120):

```tsx
            {order.shipping_cost != null && (
              <div className="flex items-center justify-between">
                <p className="text-brand-parchment text-sm">Ongkir</p>
                <p className="text-brand-crema text-sm font-semibold">
                  {formatIDR(order.shipping_cost)}
                </p>
              </div>
            )}
```

Replace with:

```tsx
            {!isPickupOrder(order) && order.shipping_cost != null && (
              <div className="flex items-center justify-between">
                <p className="text-brand-parchment text-sm">Ongkir</p>
                <p className="text-brand-crema text-sm font-semibold">
                  {formatIDR(order.shipping_cost)}
                </p>
              </div>
            )}
```

(Without this guard, pickup orders would show a confusing "Ongkir: Rp 0" line.)

- [ ] **Step 3: Replace the shipping section with pickup-aware branching**

Find this block (existing lines 130-149):

```tsx
        {order.shipping_cost != null && (
          <section data-testid="order-shipping-section">
            <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
                <p className="text-brand-parchment text-xs uppercase tracking-wider">Pengiriman</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-1">
                <div data-testid="order-shipping-courier" className="text-brand-crema text-sm">
                  Kurir: {order.shipping_courier} — {order.shipping_service}
                </div>
                <div data-testid="order-shipping-etd" className="text-brand-parchment text-sm">
                  Estimasi: {order.shipping_etd}
                </div>
                <div data-testid="order-shipping-cost" className="text-brand-crema text-sm font-semibold">
                  Biaya: {formatIDR(order.shipping_cost)}
                </div>
              </div>
            </div>
          </section>
        )}
```

Replace with:

```tsx
        {!isPickupOrder(order) && order.shipping_cost != null && (
          <section data-testid="order-shipping-section">
            <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
                <p className="text-brand-parchment text-xs uppercase tracking-wider">Pengiriman</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-1">
                <div data-testid="order-shipping-courier" className="text-brand-crema text-sm">
                  Kurir: {order.shipping_courier} — {order.shipping_service}
                </div>
                <div data-testid="order-shipping-etd" className="text-brand-parchment text-sm">
                  Estimasi: {order.shipping_etd}
                </div>
                <div data-testid="order-shipping-cost" className="text-brand-crema text-sm font-semibold">
                  Biaya: {formatIDR(order.shipping_cost)}
                </div>
              </div>
            </div>
          </section>
        )}

        {isPickupOrder(order) && (
          <section data-testid="order-pickup-section">
            <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
                <p className="text-brand-parchment text-xs uppercase tracking-wider">Pengambilan</p>
              </div>
              <div className="px-5 py-4">
                <p data-testid="order-pickup-note" className="text-brand-crema text-sm">
                  Ambil Sendiri di lokasi gudang Agroastery
                </p>
              </div>
            </div>
          </section>
        )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/portal/orders/[id]/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/portal/orders/\[id\]/page.tsx
git commit -m "feat(orders): show pickup section on order detail page"
```

---

### Task 7: Invoice route + PDF — optional address for pickup

**Files:**
- Modify: `app/api/invoice/[id]/route.ts`
- Modify: `lib/invoice/document.tsx`

**Interfaces:**
- Consumes: `isPickupOrder` from `lib/shipping.ts` (Task 1).
- Produces: `InvoiceData` type gains `recipientName?`, `addressLine?`, `postalCode?` (now optional) and `isPickup?: boolean` — consumed by `lib/invoice/render.tsx` (unchanged, passes `InvoiceData` through as-is) and `InvoiceDocument`.

- [ ] **Step 1: Modify `app/api/invoice/[id]/route.ts`**

Add the import after the existing imports (after line 5):

```ts
import { isPickupOrder } from '@/lib/shipping'
```

Change the `orders` select (line 24-27) to include `shipping_courier`:

```ts
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, shipping_cost, shipping_courier, created_at, order_items (product_name, unit_price, quantity, subtotal)'
    )
    .eq('id', id)
    .single()
```

Replace the address-lookup block (existing lines 44-55):

```ts
  const admin = getSupabaseAdmin()
  const { data: addresses } = await admin
    .from('addresses')
    .select('recipient_name, address_line, postal_code, is_default')
    .eq('client_id', client.id)

  const address =
    (addresses ?? []).find((a) => a.is_default) ?? (addresses ?? [])[0]

  if (!address) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 })
  }
```

with:

```ts
  const isPickup = isPickupOrder(order)

  let address: { recipient_name: string; address_line: string; postal_code: string } | undefined

  if (!isPickup) {
    const admin = getSupabaseAdmin()
    const { data: addresses } = await admin
      .from('addresses')
      .select('recipient_name, address_line, postal_code, is_default')
      .eq('client_id', client.id)

    const found = (addresses ?? []).find((a) => a.is_default) ?? (addresses ?? [])[0]

    if (!found) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }
    address = found
  }
```

Update the `InvoiceData` construction (existing lines 68-83):

```ts
  const data: InvoiceData = {
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at),
    recipientName: address?.recipient_name,
    addressLine: address?.address_line,
    postalCode: address?.postal_code,
    isPickup,
    items: items.map((item) => ({
      productName: item.product_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotal: order.total_amount,
    shippingCost: order.shipping_cost ?? null,
    generatedAt: new Date(),
  }
```

- [ ] **Step 2: Modify `lib/invoice/document.tsx`**

Change the `InvoiceData` type (existing lines 15-30):

```ts
export type InvoiceData = {
  orderNumber: string
  orderDate: Date
  recipientName?: string
  addressLine?: string
  postalCode?: string
  isPickup?: boolean
  items: Array<{
    productName: string
    unitPrice: number
    quantity: number
    subtotal: number
  }>
  subtotal: number
  shippingCost: number | null
  generatedAt: Date
}
```

Replace the recipient column (existing lines 161-165):

```tsx
          <View style={s.infoCol}>
            <Text style={s.infoHeading}>To:  {data.recipientName}</Text>
            <Text style={s.infoText}>{data.addressLine}</Text>
            <Text style={s.infoText}>{data.postalCode}</Text>
          </View>
```

with:

```tsx
          <View style={s.infoCol}>
            {data.isPickup ? (
              <>
                <Text style={s.infoHeading}>Ambil Sendiri</Text>
                <Text style={s.infoText}>Diambil di lokasi gudang Agroastery</Text>
              </>
            ) : (
              <>
                <Text style={s.infoHeading}>To:  {data.recipientName}</Text>
                <Text style={s.infoText}>{data.addressLine}</Text>
                <Text style={s.infoText}>{data.postalCode}</Text>
              </>
            )}
          </View>
```

Pickup orders have `shipping_cost = 0` (not `null`), so the totals section's existing `data.shippingCost != null` guard would otherwise print a confusing "Shipping Cost: Rp 0" line. Find the totals block (existing lines 213-218):

```tsx
          {data.shippingCost != null && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Shipping Cost</Text>
              <Text style={s.totalVal}>{formatIDR(data.shippingCost)}</Text>
            </View>
          )}
```

Replace with:

```tsx
          {!data.isPickup && data.shippingCost != null && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Shipping Cost</Text>
              <Text style={s.totalVal}>{formatIDR(data.shippingCost)}</Text>
            </View>
          )}
          {data.isPickup && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Shipping Cost</Text>
              <Text style={s.totalVal}>Pickup (Gratis)</Text>
            </View>
          )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/api/invoice/[id]/route.ts` or `lib/invoice/document.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/api/invoice/\[id\]/route.ts lib/invoice/document.tsx
git commit -m "fix(orders): make invoice address optional for pickup orders"
```

---

### Task 8: Telegram notification — pickup-aware message

**Files:**
- Modify: `lib/telegram.ts`

**Interfaces:**
- Consumes: `PICKUP_COURIER_CODE` from `lib/shipping.ts` (Task 1).

- [ ] **Step 1: Add the import**

At the top of `lib/telegram.ts`, after `import { createClient } from '@/lib/supabase/server'` (line 1), add:

```ts
import { PICKUP_COURIER_CODE } from '@/lib/shipping'
```

- [ ] **Step 2: Branch the shipping line**

Find this block (existing lines 60-67):

```ts
    if (shippingCost != null) {
      lines.push(`🚚 <b>Ongkir: ${formatIDR(shippingCost)}</b> ${shippingCourier && shippingService ? `(${escapeHtml(shippingCourier)} — ${escapeHtml(shippingService)})` : ''}`)
      lines.push(``)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount + shippingCost)}</b>`)
    } else {
      lines.push(``)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount)}</b>`)
    }
```

Replace with:

```ts
    if (shippingCost != null) {
      if (shippingCourier === PICKUP_COURIER_CODE) {
        lines.push(`📦 <b>Ambil Sendiri</b>`)
      } else {
        lines.push(`🚚 <b>Ongkir: ${formatIDR(shippingCost)}</b> ${shippingCourier && shippingService ? `(${escapeHtml(shippingCourier)} — ${escapeHtml(shippingService)})` : ''}`)
      }
      lines.push(``)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount + shippingCost)}</b>`)
    } else {
      lines.push(``)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount)}</b>`)
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/telegram.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/telegram.ts
git commit -m "feat(orders): show pickup label in Telegram order notification"
```

---

### Task 9: E2E — pickup order submission and detail rendering

**Files:**
- Modify: `e2e/tests/portal.spec.ts`

**Interfaces:**
- Consumes: `mockBiteshipLocation` from `../helpers/biteship` (already imported at the top of the file); `getFirstProductId` helper (already defined at the top of the file); `data-testid`s produced by Tasks 4-6 (`fulfillment-option-pickup`, `pickup-info-card`, `shipping-cost`, `order-pickup-section`, `order-pickup-note`, `order-shipping-section`).

- [ ] **Step 1: Insert the new test block**

In `e2e/tests/portal.spec.ts`, find the end of the `test.describe('Order review → submission (CP-03 → CP-04)', ...)` block — it ends right before `test.describe('Order history (CP-05)', ...)` begins (the closing `})` of CP-03→CP-04, immediately followed by a blank line and then `test.describe('Order history (CP-05)', () => {`).

Insert this new block between them:

```ts
test.describe('Self-pickup order (CP-04b)', () => {
  let pickupOrderId: string | null = null

  test('submitting a pickup order redirects to confirmation without selecting a courier', async ({
    page,
  }) => {
    await mockBiteshipLocation(page)

    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await page.getByTestId('review-order-button').click()

    await page.getByTestId('fulfillment-option-pickup').click()

    const pickupCard = page.getByTestId('pickup-info-card')
    await expect(pickupCard).toBeVisible()
    await expect(page.getByTestId('shipping-cost')).toContainText('Gratis')

    await page.getByTestId('confirm-order-button').click()

    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    const url = page.url()
    pickupOrderId = new URL(url).searchParams.get('id')
  })

  test('pickup order detail page shows pickup section instead of courier info', async ({
    page,
  }) => {
    test.skip(!pickupOrderId, 'No pickup order created — run previous test first')

    await page.goto(`/portal/orders/${pickupOrderId}`)

    await expect(page.getByTestId('order-pickup-section')).toBeVisible()
    await expect(page.getByTestId('order-pickup-note')).toContainText('Ambil Sendiri')
    await expect(page.locator('[data-testid="order-shipping-section"]')).toHaveCount(0)
  })
})

```

- [ ] **Step 2: Run the new tests**

Run: `npm run test:e2e -- --grep "Self-pickup order"`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/portal.spec.ts
git commit -m "test(orders): add E2E coverage for pickup order submission and detail"
```

---

### Task 10: E2E — invoice download for a pickup order with zero saved addresses

**Files:**
- Modify: `e2e/tests/portal.spec.ts`

**Interfaces:**
- Consumes: `getTestIds()` and `adminSupabase()` helpers (already defined at the top of the file); `mockBiteshipLocation`; `data-testid`s from Tasks 4-5 and the existing `download-invoice-button` (from `DownloadInvoiceButton.tsx`, unmodified by this feature).

- [ ] **Step 1: Append the new test block at the very end of the file**

This must run last because it temporarily deletes the shared E2E test client's addresses — every other test in this file and in `shipping.spec.ts` depends on that client having an address. Add this as a new top-level block after the final closing `})` of the existing `test.describe('Invoice download (CP-06)', ...)` block (i.e., at the end of the file):

```ts

test.describe('Self-pickup invoice with zero addresses (CP-07)', () => {
  test.describe.configure({ mode: 'serial' })

  let backedUpAddresses: Record<string, unknown>[] = []

  test.beforeAll(async () => {
    const { clientId } = getTestIds()
    const supabase = adminSupabase()

    const { data } = await supabase.from('addresses').select('*').eq('client_id', clientId)
    backedUpAddresses = data ?? []

    if (backedUpAddresses.length > 0) {
      await supabase.from('addresses').delete().eq('client_id', clientId)
    }
  })

  test.afterAll(async () => {
    if (backedUpAddresses.length === 0) return
    const supabase = adminSupabase()
    await supabase.from('addresses').insert(
      backedUpAddresses.map(({ id: _id, ...rest }) => rest)
    )
  })

  test('pickup order + invoice download succeed with zero saved addresses', async ({ page }) => {
    await mockBiteshipLocation(page)

    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await page.getByTestId('review-order-button').click()

    await page.getByTestId('fulfillment-option-pickup').click()
    await expect(page.getByTestId('pickup-info-card')).toBeVisible()

    await page.getByTestId('confirm-order-button').click()
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    const orderId = new URL(page.url()).searchParams.get('id')

    await page.goto(`/portal/orders/${orderId}`)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('download-invoice-button').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^INV-.*\.pdf$/)
  })
})
```

- [ ] **Step 2: Run the full E2E suite**

Run: `npm run test:e2e`
Expected: all tests PASS, including the new CP-04b and CP-07 blocks. Confirm no earlier test (CP-02 through CP-06) fails due to a missing address — CP-07 runs last and restores addresses in `afterAll`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/portal.spec.ts
git commit -m "test(orders): add E2E coverage for zero-address pickup invoice download"
```

---

## Self-Review Notes

- **Spec coverage:** every "Files to Modify" row in the design spec maps to a task above (schema+shipping.ts → Task 1, getPickupInfo → Task 2, createOrder.ts → Task 3, review page components → Tasks 4-5, order detail → Task 6, invoice route+document → Task 7, telegram → Task 8, e2e → Tasks 9-10). No spec requirement is without a task.
- **Placeholder scan:** no TBD/TODO; every step shows real code, not descriptions of code.
- **Type consistency:** `PickupLocation` (Task 1) is used identically in `getPickupInfo.ts` (Task 2), `PickupInfoCard.tsx` (Task 4), and `review/page.tsx` (Task 5). `isPickupOrder` (Task 1) is used identically in `orders/[id]/page.tsx` (Task 6) and `invoice/[id]/route.ts` (Task 7). `PICKUP_COURIER_CODE` (Task 1) is used identically in `createOrder.ts` (Task 3) and `telegram.ts` (Task 8) — same string constant, same import path.
- **Additional fix found during planning, not in the original spec:** Task 6 Step 2 guards the inline "Ongkir" line in the items summary card (not just the dedicated shipping section) — without it, pickup orders would display a confusing "Ongkir: Rp 0" line. Flagging this here since it's a small scope addition beyond the literal spec text.
- **Fixes from review round 2:** Task 5's loaders now carry a `requestIdRef`/`myRequestId` staleness guard (the original draft's claim that `loadShippingRates` already had one was false — verified against the pre-existing file, it didn't). Task 7's PDF totals section now branches on `data.isPickup` so it prints "Pickup (Gratis)" instead of "Shipping Cost: Rp 0". Both design spec and this plan were updated together so they stay in sync.
