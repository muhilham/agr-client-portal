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
      → load products including ship_weight_grams (via getCatalogForClient, see below)
      → load origin via getBiteshipLocation(BITESHIP_ORIGIN_LOCATION_ID) (see lib/biteship.ts)
      → POST Biteship /v1/rates/couriers
      → group by courier_code, pick min-price service per courier
      → return { ok: true, rates: RateOption[], address: AddressDisplay }
  → render courier list (radio), client picks one
  → submit disabled until selection
  → grand total = subtotal + selected.price (live)

Confirm submit
  → createOrder({items, notes, shippingSelection})
      → validate input via Zod schema
      → loadShippingContext (validates cart, address, origin, rates — server-side)
      → findRateMatch on returned rates
        → null: return { ok: false, error: 'Kurir tidak lagi tersedia, silakan pilih ulang' }
      → INSERT orders with shipping fields (using Biteship's price)
      → INSERT order_items
      → Telegram notif with shipping fields
      → return { id, order_number }
```

### External

- Biteship REST API: `/v1/locations/{id}` (origin lookup) + `/v1/rates/couriers` (rates).
  - Rates response shape (simplified): `{ pricing: BiteshipRate[], error?: string }`. Empty `pricing: []` treated as `RATES_UNAVAILABLE`.
- Env vars added to portal `.env.example`:
  - `BITESHIP_API_KEY`
  - `BITESHIP_ORIGIN_LOCATION_ID`

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `.env.example` | modify | Add `BITESHIP_API_KEY` + `BITESHIP_ORIGIN_LOCATION_ID` |
| `package.json` | modify | Add `zod` direct dependency (currently transitive only) |
| `lib/supabase/admin.ts` | new | `getSupabaseAdmin()` returning service-role client; reused by every portal server action that touches RLS-protected tables |
| `lib/biteship.ts` | new | `getBiteshipLocation(id)` (wrapped with `React.cache` for RSC deduplication; server actions rely on per-request reset), `getBiteshipRates(params)` typed wrappers with 10-second fetch timeout |
| `lib/shipping.ts` | new | `groupRatesByCourier` (min-price service per courier — intentional MVP simplification), `findRateMatch(rates, courierCode, serviceCode)`, `loadShippingContext(clientId, items)` shared helper used by both `getShippingRates` and `createOrder` to eliminate duplication (loads address + products + origin + builds Biteship items + calls rates). Returns `ShippingContext = { ok: true, address, originLocation, rates, validatedItems } \| { ok: false, error }`. |
| `lib/catalog.ts` | modify | `CatalogProduct` includes `ship_weight_grams`; query selects column. Replace existing `as unknown as {...}` cast with explicit row-typed interface (or `.returns<...>()` typing) to keep the new field type-safe. |
| `lib/telegram.ts` | modify | `sendOrderNotification` accepts shipping fields. **Also remove the existing `throw err` in the catch block (line ~95)** — the function is documented as non-blocking but currently rethrows, forcing every caller to wrap in try/catch. After fix: log via `console.error`, set `status='failed'`, `finally` block still inserts `notification_logs`, then return `void`. |
| `lib/schemas/order.ts` | new | Zod schemas: `getShippingRatesInputSchema`, `createOrderInputSchema`, `shippingSelectionSchema` |
| `app/portal/order/_actions/getShippingRates.ts` | new | Server action returning grouped rates + address |
| `app/portal/order/_actions/createOrder.ts` | modify | Accept `shippingSelection`, re-validate, save fields |
| `app/portal/order/review/page.tsx` | modify | Fetch rates on mount, courier picker, grand total, retry |
| `app/portal/order/review/_components/CourierPicker.tsx` | new | Radio list of `RateOption[]`. `data-testid` attributes: `courier-picker`, `courier-option-{courier_code}`, `courier-price-{courier_code}`, `courier-etd-{courier_code}`. |
| `app/portal/order/review/_components/AddressCard.tsx` | new | Default address card or empty state. `data-testid`: `address-card`, `address-card-empty`. |
| `app/portal/orders/[id]/page.tsx` | modify | Render shipping section + grand total. Add `export const dynamic = 'force-dynamic'`. |
| `app/portal/orders/page.tsx` | modify | List grand total = subtotal + shipping_cost. Add `export const dynamic = 'force-dynamic'`. |

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

export function groupRatesByCourier(rates: BiteshipRate[]): RateOption[]

// `serviceCode` matches Biteship's `courier_service_code` (e.g. "REG", "OKE"),
// not display name. Naming is intentional to mirror the API field exactly.
export function findRateMatch(
  rates: BiteshipRate[],
  courierCode: string,
  serviceCode: string,
): BiteshipRate | null

// Shared by getShippingRates + createOrder to avoid duplicated address/origin/rates flow
export type ShippingContext =
  | { ok: true; address: AddressDisplay; originLocation: BiteshipLocation; rates: BiteshipRate[]; validatedItems: ValidatedItem[] }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' }

export async function loadShippingContext(
  clientId: string,
  items: { productId: string; quantity: number }[],
): Promise<ShippingContext>

// app/portal/order/_actions/getShippingRates.ts
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

## Shared Helper: `loadShippingContext`

Lives in `lib/shipping.ts`. Encapsulates address + products + origin + rates flow used by both server actions. All SELECTs use `getSupabaseAdmin()` per CLAUDE.md rule (RLS-protected tables: `clients`, `products`, `addresses`).

Steps:
1. **Default address:** `getSupabaseAdmin().from('addresses').select(...).eq('client_id', clientId).eq('is_default', true).maybeSingle()`. None → `{ ok: false, error: 'NO_ADDRESS' }`.
   - **Verify during implementation:** Confirm `addresses` table columns match `AddressDisplay` fields (`recipient_name`, `address_line`, `postal_code`). If columns differ, adjust the select and type.
2. **Products:** `getCatalogForClient(clientId)`. **MANDATORY:** `lib/catalog.ts` must be updated to use `getSupabaseAdmin()` instead of `createClient()` for all SELECTs from `products` and `client_products` (RLS-protected tables). Replace the existing `as unknown as {...}` cast with an explicit typed interface or `.returns<...>()` query. Validate every `productId` exists and `quantity >= minQty`. Mismatch → `{ ok: false, error: 'INVALID_CART' }`.
3. **Origin (env-guarded, no non-null assertion):**
   ```typescript
   const originLocationId = process.env.BITESHIP_ORIGIN_LOCATION_ID
   if (!originLocationId) return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
   const origin = await getBiteshipLocation(originLocationId)
   if (!origin) return { ok: false, error: 'ORIGIN_NOT_CONFIGURED' }
   ```
4. **Build Biteship items:** Per Biteship API contract, `items[].value` is **per-unit** declared value (used for insurance), not line total. Use unit price:
   ```typescript
   { name: product.name, value: product.effectivePrice, weight: product.ship_weight_grams, quantity }
   ```
5. **Call rates:** `getBiteshipRates({ origin..., destination..., items, couriers: '' })`. Failure or empty `pricing: []` → `{ ok: false, error: 'RATES_UNAVAILABLE' }`.
6. **Return:** `{ ok: true, address, originLocation: origin, rates, validatedItems }` where `validatedItems` are the cart items enriched with product names, unit prices, and `ship_weight_grams` from the catalog.

## Server Action: `getShippingRates`

1. **Validate input:** `getShippingRatesInputSchema.safeParse(input)`. Failure → `{ ok: false, error: 'INVALID_INPUT' }`.
2. **Auth:** load user via `createClient().auth.getUser()`. Look up `clients` row by email using `getSupabaseAdmin()`. Missing → throw (genuine bug, not user-recoverable).
3. **Load context:** `const ctx = await loadShippingContext(client.id, parsed.items)`. If `!ctx.ok` → return `{ ok: false, error: ctx.error }`.
4. **Group + return:** `groupRatesByCourier(ctx.rates)` → `{ ok: true, rates, address: ctx.address }`.

## Server Action: `createOrder` (modified)

**Return shape changes:** Now returns `CreateOrderResult` discriminated union (no thrown errors for known failure modes). Aligns with `getShippingRates` so review page handles both with one branch style. Genuine bugs (DB connection failure, etc.) still propagate via thrown Error.

**Verification:** `grep -r "createOrder" app/ e2e/` confirms only `app/portal/order/review/page.tsx` calls this action. No other callers to update.

Input adds (validated via `createOrderInputSchema`):
```typescript
shippingSelection: { courier_code: string; service_code: string }
```

Steps:
1. **Validate input:** `createOrderInputSchema.safeParse(input)`. Failure → `{ ok: false, error: 'Permintaan tidak valid' }`.
2. **Auth:** load user via `createClient().auth.getUser()`. Look up `clients` row by email using `getSupabaseAdmin()`. Missing → throw (genuine bug, not user-recoverable).
3. **Load context:** `const ctx = await loadShippingContext(client.id, parsed.items)`. This single call validates cart contents (product existence, min qty), loads the address, fetches origin, and gets Biteship rates. Map `ctx.error` → Indonesian:
    - `NO_ADDRESS` → `'Alamat pengiriman tidak ditemukan'`
    - `INVALID_CART` → `'Isi keranjang tidak valid, silakan kembali ke katalog'`
    - `ORIGIN_NOT_CONFIGURED` → `'Pengiriman tidak tersedia, hubungi admin'`
    - `RATES_UNAVAILABLE` → `'Pengiriman tidak dapat dihitung'`
4. **Match courier:** `findRateMatch(ctx.rates, shippingSelection.courier_code, shippingSelection.service_code)`. Null → `{ ok: false, error: 'Kurir tidak lagi tersedia, silakan pilih ulang' }`.
5. **Compute subtotal:** `const totalAmount = ctx.validatedItems.reduce((sum, i) => sum + i.subtotal, 0)`.
6. **Generate order number:** `const orderNumber = await supabase.rpc('generate_order_number')`.
7. **INSERT `orders`** (auth-context `createClient()`) with existing fields plus new shipping fields from `match` (Biteship authoritative price):
   - `order_number: orderNumber`
   - `client_id: client.id`
   - `fulfillment_status: 'PENDING'`
   - `payment_status: 'UNPAID'`
   - `notes: parsed.notes?.slice(0, 200) ?? null`
   - `total_amount: totalAmount`
   - `shipping_cost: match.price`
   - `shipping_courier: match.courier_code`
   - `shipping_service: match.courier_service_code`
   - `shipping_etd: match.duration`
8. **INSERT `order_items`** from `ctx.validatedItems`.
9. **Telegram notify** (non-blocking try/catch). Payload includes `orderId` (required by existing signature):
   ```typescript
   {
     orderId: order.id,                           // REQUIRED — existing field, must include
     orderNumber: order.order_number,
     clientName: client.name,
     items: ctx.validatedItems.map((i) => ({ name: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })),
     totalAmount,                                 // subtotal only (sum of item subtotals)
     shippingCost: match.price,
     shippingCourier: match.courier_name,
     shippingService: match.courier_service_name,
     createdAt: new Date(),
   }
   ```
    **Semantics:** `totalAmount` = subtotal (sum of `order_items.subtotal`). `shippingCost` is separate. The Telegram message template must be updated to show both subtotal and shipping cost, then a grand total:
   ```
   💰 Subtotal: Rp X
   🚚 Ongkir:   Rp Y (courier — service)
   ───────────
   💰 Total:    Rp X+Y
   ```
10. Return `{ ok: true, id: order.id, order_number: order.order_number }`.

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

Mount → `getShippingRates({items})` once via `useEffect`. Result mapped to state.

**Trade-off:** Server actions are POST and have no Next.js data cache. Every mount (including back/forward navigation, soft refresh, browser bfcache miss) triggers a fresh Biteship rates API call. Acceptable for MVP — review page mounts are rare per user session and the response is cart-dependent (cache key would need cart hash). If Biteship cost becomes significant, add a short-window in-memory memo keyed on `(clientId, addressId, sortedCartHash)` in `loadShippingContext`.

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

`data-testid` attributes on review page: `shipping-section`, `shipping-subtotal`, `shipping-cost`, `shipping-total`, `retry-rates-button`.

If submit returns `'Kurir tidak lagi tersedia'` error → reset state to `loading` and re-fetch rates. User must reselect.

## Order Detail Page

Add a Shipping section after Items, before Notes — **rendered conditionally**: hide entirely for legacy orders where `shipping_cost IS NULL` (no shipping data to display).

```tsx
{order.shipping_cost != null && (
  <section data-testid="order-shipping-section">
    <h2>Pengiriman</h2>
    <div data-testid="order-shipping-courier">Kurir: {order.shipping_courier} — {order.shipping_service}</div>
    <div data-testid="order-shipping-etd">Estimasi: {order.shipping_etd}</div>
    <div data-testid="order-shipping-cost">Biaya: {formatIDR(order.shipping_cost)}</div>
  </section>
)}
```

Total block restructured:
```
Subtotal:     Rp X
Shipping:     Rp Y                  (only shown if shipping_cost != null)
Grand Total:  Rp X+Y                (= Rp X if shipping_cost is null)
```

Both the shipping line in the total block and the standalone Shipping section are gated on `shipping_cost != null` — legacy orders show only the original Total layout.

`data-testid` attributes: `order-shipping-section`, `order-shipping-courier`, `order-shipping-etd`, `order-shipping-cost`, `order-subtotal`, `order-grand-total`.

## Order List Page

Existing query select extended with `shipping_cost` only (no `shipping_courier` — list intentionally compact, courier shown only on detail page). Display column shows `total_amount + (shipping_cost ?? 0)`. No new columns or layout — single grand-total figure replaces existing total.

`data-testid` attribute: `order-grand-total-{order.id}` on the total cell.

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

**Biteship timeout:** All Biteship API calls (`getBiteshipLocation`, `getBiteshipRates`) must use a 10-second `fetch` timeout. Timeout or network failure is treated as `RATES_UNAVAILABLE`.

Telegram notification stays non-blocking (existing try/catch).

## Race Conditions

- Address deleted between review and submit → `createOrder` re-fetch hits `NO_ADDRESS` → returns `{ ok: false, error: 'Alamat pengiriman tidak ditemukan' }`.
- Product deactivated → `loadShippingContext` validation returns `{ ok: false, error: 'INVALID_CART' }`.
- Biteship price drifts → user pays current Biteship price (may differ from review screen). Acceptable per design choice.

## Testing

**Approach:** Playwright E2E with Biteship mocked at `page.route()`. No unit layer in repo.

**File paths (be explicit):**
- New test file: `e2e/tests/shipping.spec.ts`
- New Biteship mock helper: `e2e/helpers/biteship.ts` (new directory `e2e/helpers/`) — exports `mockBiteshipRates`, `mockBiteshipLocation`, `mockBiteshipFailure`.
- New seed helper: `e2e/helpers/seed.ts` — exports `seedClientWithDefaultAddress({ email, addressOverrides? })`. Existing `e2e/setup/auth.setup.ts` handles auth-only seed; this new helper extends with `addresses` row insertion (uses service-role Supabase client). Reused by all shipping tests.

**Note:** Verify `playwright.config.ts` does not exclude `e2e/helpers/` from `testMatch` / `testIgnore`. If it uses a glob like `e2e/**/*.spec.ts`, helpers are already excluded. If it uses `e2e/tests/**/*.spec.ts`, no change needed.

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

- **Origin location caching:** `getBiteshipLocation` uses `React.cache` for RSC deduplication only. In server actions, the cache resets per request, so each checkout may call the location endpoint twice (review + submit). Replace with a module-level `Map` memo (keyed by `BITESHIP_ORIGIN_LOCATION_ID`) if Biteship call volume becomes a concern.
- **Rates caching (review → submit duplicate):** `loadShippingContext` is called twice per checkout (review mount + submit). A 30-second in-memory `Map` keyed by `(clientId, addressId, sortedCartHash)` would eliminate the duplicate Biteship call in the common case. Add if cost becomes significant.
- **Biteship API quotas / rate limiting:** No client-side throttling or server-side debounce in this spec. Each review-page mount + retry click = 1 rates call; each submit = 1 more. If Biteship enforces per-second limits, add an in-memory token bucket or short-window memoization (per client + cart hash). Confirm Biteship plan limits before launch.
- **`products.ship_weight_grams` admin UI** not in this spec. Until agr-ops adds it, defaults to 1000g — clients see possibly inaccurate shipping cost for non-1kg products.
- **Confirmation page** does not show shipping summary (intentional, minimal by design).
- **Insurance / COD / scheduled delivery** not exposed.
- **Single default address only.** Multi-address picker = future.
