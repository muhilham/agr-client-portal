# Portal Shipping Cost — Biteship Rates at Checkout

**Status:** Draft — pending user review
**Date:** 2026-05-01
**Repo:** `agr-client-portal`
**Related:** `agr-ops/docs/superpowers/plans/2026-04-30-b2b-shipping-cost.md` (admin draft/sync flow)

## Goal

Let portal clients see Biteship-calculated shipping cost at checkout, pick a courier, and have shipping fields persisted on the order so admin can later create a Biteship draft from the agr-ops dashboard.

## Scope

**In scope:**
- Add Biteship rates fetch + courier picker to `/portal/order/review`.
- Persist `shipping_cost`, `shipping_courier`, `shipping_service`, `shipping_etd` on order insert.
- Server-side re-validation of price (per CLAUDE.md rule).
- Show shipping line on `/portal/orders/[id]` detail and grand total on `/portal/orders` list.
- Extend Telegram order notification with shipping fields.

**Out of scope:**
- Address CRUD in portal (admin manages addresses via agr-ops).
- `products.ship_weight_grams` migration + admin UI (lives in agr-ops).
- Confirmation page changes.
- Insurance, COD, delivery scheduling flags.
- Admin draft creation / live order sync (covered by agr-ops plan).

## Cross-Repo Dependency

This spec assumes `agr-ops` has already shipped a migration adding `products.ship_weight_grams NUMERIC DEFAULT 1000` (NOT NULL via default). Until that ships, portal blocks deployment.

The 6 order columns (`shipping_cost`, `shipping_courier`, `shipping_service`, `shipping_etd`, `biteship_draft_id`, `biteship_order_id`) come from the agr-ops migration `019_add_b2b_shipping_fields.sql`.

## Architecture

### Data flow

```
Review page mount (client)
  → useEffect: invoke server action getShippingRates({items})
      → load default address (addresses where is_default=true)
        → if none: return { ok: false, error: 'NO_ADDRESS' }
      → load products including ship_weight_grams
      → load origin via getBiteshipLocation(BITESHIP_ORIGIN_LOCATION_ID)
      → POST Biteship /v1/rates/couriers
      → group by courier_code, pick min-price service per courier
      → return { ok: true, rates: RateOption[], address: AddressDisplay }
  → render courier list (radio), client picks one
  → submit disabled until selection
  → grand total = subtotal + selected.price (live)

Confirm submit
  → createOrder({items, notes, shippingSelection})
      → existing item price re-validation
      → repeat address/products/origin/rates load (server-side)
      → findRateMatch on returned rates
        → null: throw "Kurir tidak lagi tersedia"
      → INSERT orders with shipping fields (using Biteship's price)
      → INSERT order_items
      → Telegram notif with shipping fields
      → return { id, order_number }
```

### External

- Biteship REST API: `/v1/locations/{id}` (origin lookup) + `/v1/rates/couriers` (rates).
- Env vars added to portal `.env.example`:
  - `BITESHIP_API_KEY`
  - `BITESHIP_ORIGIN_LOCATION_ID`

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `.env.example` | modify | Add `BITESHIP_API_KEY` + `BITESHIP_ORIGIN_LOCATION_ID` |
| `package.json` | modify | Add `zod` direct dependency (currently transitive only) |
| `lib/supabase/admin.ts` | new | `getSupabaseAdmin()` returning service-role client; reused by every portal server action that touches RLS-protected tables |
| `lib/biteship.ts` | new | `getBiteshipLocation(id)` (wrapped with `React.cache`), `getBiteshipRates(params)` typed wrappers |
| `lib/shipping.ts` | new | `groupRatesByCourier`, `findRateMatch`, `loadOriginLocation()` (calls cached `getBiteshipLocation`); pure helpers |
| `lib/catalog.ts` | modify | `CatalogProduct` includes `ship_weight_grams`; query selects column |
| `lib/telegram.ts` | modify | `sendOrderNotification` accepts shipping fields |
| `lib/schemas/order.ts` | new | Zod schemas: `getShippingRatesInputSchema`, `createOrderInputSchema`, `shippingSelectionSchema` |
| `app/portal/order/_actions/getShippingRates.ts` | new | Server action returning grouped rates + address |
| `app/portal/order/_actions/createOrder.ts` | modify | Accept `shippingSelection`, re-validate, save fields |
| `app/portal/order/review/page.tsx` | modify | Fetch rates on mount, courier picker, grand total, retry |
| `app/portal/order/review/_components/CourierPicker.tsx` | new | Radio list of `RateOption[]` |
| `app/portal/order/review/_components/AddressCard.tsx` | new | Default address card or empty state |
| `app/portal/orders/[id]/page.tsx` | modify | Render shipping section + grand total |
| `app/portal/orders/page.tsx` | modify | List grand total = subtotal + shipping_cost |

## Types

```typescript
// lib/biteship.ts
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

export interface BiteshipRatesItem {
  name: string
  value: number
  weight: number      // grams, per unit
  quantity: number
}

export interface BiteshipRatesParams {
  origin_postal_code: string
  origin_latitude?: number | null
  origin_longitude?: number | null
  destination_postal_code: string
  destination_latitude?: number | null
  destination_longitude?: number | null
  couriers: string    // comma-separated, empty = all
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

// lib/shipping.ts
export interface RateOption {
  courier_code: string
  courier_name: string
  service_code: string
  service_name: string
  etd: string
  price: number
}

export function groupRatesByCourier(rates: BiteshipRate[]): RateOption[]
export function findRateMatch(rates: BiteshipRate[], courier: string, service: string): BiteshipRate | null

// app/portal/order/_actions/getShippingRates.ts
export interface AddressDisplay {
  recipient_name: string
  address_line: string
  postal_code: string
}

export type ShippingRatesResult =
  | { ok: true; rates: RateOption[]; address: AddressDisplay }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' | 'INVALID_INPUT' }

export async function getShippingRates(input: unknown): Promise<ShippingRatesResult>

// createOrder now also returns a discriminated union (aligned with getShippingRates)
export type CreateOrderResult =
  | { ok: true; id: string; order_number: string }
  | { ok: false; error: string }   // user-facing Indonesian message

export async function createOrder(input: unknown): Promise<CreateOrderResult>
```

### Zod schemas (`lib/schemas/order.ts`)

```typescript
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

export const createOrderInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(100),
  notes: z.string().max(200).optional(),
  shippingSelection: shippingSelectionSchema,
})

export type GetShippingRatesInput = z.infer<typeof getShippingRatesInputSchema>
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>
```

Both server actions call `schema.safeParse(input)` first; failure → return `{ ok: false, error: 'INVALID_INPUT' }` (rates) or `{ ok: false, error: 'Permintaan tidak valid' }` (createOrder).

## Server Action: `getShippingRates`

All RLS-protected SELECTs (`clients`, `products`, `addresses`) MUST use `getSupabaseAdmin()` — the auth-context client (`createClient()`) is reserved for INSERTs into `orders`/`order_items` per existing portal exception. CLAUDE.md rule: server actions use service-role key, never anon key for cross-table reads.

1. **Validate input:** `getShippingRatesInputSchema.safeParse(input)`. Failure → `{ ok: false, error: 'INVALID_INPUT' }`.
2. **Auth:** load user via `createClient().auth.getUser()`. Look up `clients` row by email using `getSupabaseAdmin()`. Missing → throw.
3. **Default address:** `getSupabaseAdmin().from('addresses').select(...).eq('client_id', client.id).eq('is_default', true).maybeSingle()`. None → `{ ok: false, error: 'NO_ADDRESS' }`.
4. **Products:** call `getCatalogForClient(client.id)` (already uses admin client internally — verify; if not, fix). Validate every `productId` exists and `quantity >= minQty`. Mismatch → `{ ok: false, error: 'INVALID_CART' }`.
5. **Origin (env-guarded):**
   ```typescript
   const originLocationId = process.env.BITESHIP_ORIGIN_LOCATION_ID
   if (!originLocationId) return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
   const origin = await loadOriginLocation(originLocationId)  // wraps cached getBiteshipLocation
   if (!origin) return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
   ```
6. **Build items:** `{ name: product.name, value: product.effectivePrice * quantity, weight: product.ship_weight_grams, quantity }`.
7. **Call rates:** `getBiteshipRates({...})`. Pass empty `couriers: ''` (all). Failure or empty `pricing: []` → `{ ok: false, error: 'RATES_UNAVAILABLE' }`.
8. **Group + return:** `groupRatesByCourier(rates)` → `{ ok: true, rates, address: { recipient_name, address_line, postal_code } }`.

## Server Action: `createOrder` (modified)

**Return shape changes:** Now returns `CreateOrderResult` discriminated union (no thrown errors for known failure modes). Aligns with `getShippingRates` so review page handles both with one branch style. Genuine bugs (DB connection failure, etc.) still propagate via thrown Error.

Input adds (validated via `createOrderInputSchema`):
```typescript
shippingSelection: { courier_code: string; service_code: string }
```

Steps:
1. **Validate input:** `createOrderInputSchema.safeParse(input)`. Failure → `{ ok: false, error: 'Permintaan tidak valid' }`.
2. **Auth + items revalidation** (existing logic, but use `getSupabaseAdmin()` for `clients`/`products` reads). Item failures → `{ ok: false, error: '<Indonesian message>' }`.
3. **Re-run steps 3–7 of `getShippingRates`** (default address, origin via guarded env, rates call). Any rates step failure → `{ ok: false, error: <translated Indonesian message> }`.
4. **Match courier:** `findRateMatch(rates, shippingSelection.courier_code, shippingSelection.service_code)`. Null → `{ ok: false, error: 'Kurir tidak lagi tersedia, silakan pilih ulang' }`.
5. **INSERT `orders`** (auth-context `createClient()`) with new fields populated from `match` (Biteship authoritative price):
   - `shipping_cost: match.price`
   - `shipping_courier: match.courier_code`
   - `shipping_service: match.courier_service_code`
   - `shipping_etd: match.duration`
6. **INSERT `order_items`** (existing).
7. **Telegram notify** (non-blocking try/catch). Payload includes `orderId` (required by existing signature):
   ```typescript
   {
     orderId: order.id,                           // REQUIRED — existing field, must include
     orderNumber: order.order_number,
     clientName: client.name,
     items: validatedItems.map(...),
     totalAmount,
     shippingCost: match.price,
     shippingCourier: match.courier_name,
     shippingService: match.courier_service_name,
     createdAt: new Date(),
   }
   ```
8. Return `{ ok: true, id: order.id, order_number: order.order_number }`.

Review page replaces `try/catch` with discriminated-union check:
```typescript
const result = await createOrder({...})
if (!result.ok) { setError(result.error); setSubmitting(false); return }
sessionStorage.removeItem('cart')
router.push(`/portal/order/confirmation?id=${result.id}&orderNumber=${...}`)
```

## Review Page Behavior

State machine:
```typescript
type RatesState =
  | { kind: 'loading' }
  | { kind: 'ready'; rates: RateOption[]; address: AddressDisplay }
  | { kind: 'no_address' }
  | { kind: 'error'; message: string }
```

Mount → `getShippingRates({items})` once. Result mapped to state.
- `loading`: skeleton in courier section.
- `ready`: render `<AddressCard address={...} />` + `<CourierPicker rates={...} selected={selected} onSelect={setSelected} />`.
- `no_address`: render "Hubungi admin untuk menambahkan alamat pengiriman" block. Hide courier list. Hide submit.
- `error`: render message + Retry button (re-runs server action).

Submit button disabled unless `kind === 'ready' && selected != null`.

Grand total line:
```
Subtotal:     Rp 100.000
Shipping:     Rp 12.000   (selected.courier_name — selected.service_name)
─────────
Total:        Rp 112.000
```

If submit returns `'Kurir tidak lagi tersedia'` error → reset state to `loading` and re-fetch rates. User must reselect.

## Order Detail Page

Add a Shipping section after Items, before Notes:

```tsx
<section>
  <h2>Pengiriman</h2>
  <div>Kurir: {courier_name} — {service_name}</div>
  <div>Estimasi: {shipping_etd}</div>
  <div>Biaya: {formatIDR(shipping_cost)}</div>
</section>
```

Total block restructured:
```
Subtotal:     Rp X
Shipping:     Rp Y   (— if NULL)
Grand Total:  Rp X+Y
```

NULL `shipping_cost` (legacy orders) → render "—" for shipping, grand total = subtotal.

## Order List Page

Existing query select extended with `shipping_cost` only (no `shipping_courier` — list intentionally compact, courier shown only on detail page). Display column shows `total_amount + (shipping_cost ?? 0)`. No new columns or layout — single grand-total figure replaces existing total.

## Error Handling

| Code | UI message (Indonesian) |
|---|---|
| `INVALID_INPUT` | "Permintaan tidak valid" (zod parse fail; should be unreachable from happy UI flow) |
| `NO_ADDRESS` | "Hubungi admin untuk menambahkan alamat pengiriman" |
| `INVALID_CART` | "Isi keranjang tidak valid, silakan kembali ke katalog" |
| `ORIGIN_NOT_CONFIGURED` | "Pengiriman tidak tersedia, hubungi admin" |
| `RATES_UNAVAILABLE` | "Tidak dapat menghitung ongkir saat ini" + Retry button |
| Submit: courier disappeared | "Kurir tidak lagi tersedia, silakan pilih ulang" |
| Submit: address gone | "Alamat pengiriman tidak ditemukan" |

Generic logging via `console.error('[Biteship] ...', err)`. No raw API errors surfaced to user.

Telegram notification stays non-blocking (existing try/catch).

## Race Conditions

- Address deleted between review and submit → `createOrder` re-fetch hits `NO_ADDRESS` → throw.
- Product deactivated → existing item validation throws.
- Biteship price drifts → user pays current Biteship price (may differ from review screen). Acceptable per design choice.

## Testing

**Approach:** Playwright E2E with Biteship mocked at `page.route()`. No unit layer in repo.

New file: `e2e/tests/shipping.spec.ts`
New helpers: `e2e/helpers/biteship.ts` (`mockBiteshipRates`, `mockBiteshipLocation`, `mockBiteshipFailure`).

Cases:
1. Happy path — seed client + default address, mock rates with 3 couriers, pick one, submit, verify order detail shows shipping fields.
2. No address — seed client without addresses, expect "Hubungi admin" block.
3. Rates failure — mock 500, expect Retry button, second mock succeeds, list renders.
4. Empty courier response — mock empty `pricing: []`, expect `RATES_UNAVAILABLE` path.
5. Server price re-validation — mock review rates price=10000, submit rates price=15000, assert order saved with 15000.
6. Courier disappears between review and submit — pick courier, mock submit response without it, expect error toast and re-fetch.
7. Order list grand total — seed orders with/without shipping, assert displayed totals.
8. Telegram payload — spy on telegram fetch, assert body includes shipping line.

Address seeding helper extension required (current portal seed lacks `addresses` row creation).

## Known Gaps / Follow-ups

- **Origin location caching:** `getBiteshipLocation` wrapped with `React.cache` so a single render pass dedupes the lookup. Across requests, cache resets. In practice each checkout = 2 rates fetches (review + submit), 1–2 location fetches. Module-level memo (Map keyed by env id) is a low-risk follow-up if cost becomes a concern.
- **Biteship API quotas / rate limiting:** No client-side throttling or server-side debounce in this spec. Each review-page mount + retry click = 1 rates call; each submit = 1 more. If Biteship enforces per-second limits, add an in-memory token bucket or short-window memoization (per client + cart hash). Confirm Biteship plan limits before launch.
- **`products.ship_weight_grams` admin UI** not in this spec. Until agr-ops adds it, defaults to 1000g — clients see possibly inaccurate shipping cost for non-1kg products.
- **Confirmation page** does not show shipping summary (intentional, minimal by design).
- **Insurance / COD / scheduled delivery** not exposed.
- **Single default address only.** Multi-address picker = future.
