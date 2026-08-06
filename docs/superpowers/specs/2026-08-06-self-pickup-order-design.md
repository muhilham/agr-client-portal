# Self-Pickup Order — Design Spec

**Status:** Approved
**Date:** 2026-08-06
**Repo:** `agr-client-portal`
**Related:** `docs/superpowers/specs/2026-05-01-portal-shipping-cost-design.md`, `docs/superpowers/specs/2026-05-03-dynamic-biteship-couriers-design.md`, `agroastery-web` (`docs/superpowers/specs/2026-07-20-self-pickup-checkout-design.md` — prior art from the B2C storefront)

## Goal

Let a client choose "Ambil Sendiri" (self pickup) instead of courier shipping at order review. Single fixed pickup location, no scheduling, address becomes optional when pickup is chosen.

## Motivation

Some B2B clients collect orders directly from Agroastery's warehouse instead of paying for courier shipping. The portal currently forces every order through the Biteship rate flow, which requires a saved address and always charges shipping cost.

## Prior Art — `agroastery-web`

The sibling B2C storefront shipped an equivalent feature (`feat/self-pickup-checkout`, 2026-07-20). Its key decision governs this design: **it added no new DB column.** Migrations for the shared Supabase project are authored and applied from a separate `agr-ops` repo (confirmed for this repo too — see `2026-04-30-portal-order-status-split-design.md`, "migration was authored and applied from `agr-ops`"). Instead it encodes pickup as a sentinel value on the existing `shipping_courier` text column (`shipping_courier = 'pickup'`), with `shipping_service`/`shipping_etd` left `null` and `shipping_cost = 0`.

This repo's `orders` table has the same shape (`shipping_courier`, `shipping_service`, `shipping_cost`, `shipping_etd` — all already nullable except `shipping_cost`, per `createOrder.ts`). We adopt the same sentinel pattern here: **no migration required.**

One gap flagged in the prior-art review: `agroastery-web` repeats the `shipping_courier === "pickup"` check as a raw string literal in ~6 files with no shared helper. This design avoids that by centralizing the discriminator behind one constant and one guard function from the start.

Address handling differs from `agroastery-web` and is **not** ported: their `ecom_orders.shipping_address` is a jsonb column on the order row, so they fake a pickup "address" object to keep downstream UI working. This repo doesn't store address on the order at all — the invoice route joins `addresses` separately, at read time. So here, "address optional for pickup" just means: skip the address requirement/lookup when the order is a pickup order. No jsonb trick needed.

## Architecture

### Discriminator

`lib/shipping.ts`:
```ts
export const PICKUP_COURIER_CODE = 'pickup'

export function isPickupOrder(order: { shipping_courier: string | null }): boolean {
  return order.shipping_courier === PICKUP_COURIER_CODE
}
```
Every downstream check (order detail page, invoice route, Telegram notification) imports `isPickupOrder` / `PICKUP_COURIER_CODE` instead of comparing raw strings.

### Components

| Component | File | Responsibility |
|---|---|---|
| `validateCartItems()` | `lib/shipping.ts` | Extracted from `loadShippingContext` — catalog/qty validation, no address or Biteship call. Uses `getSupabaseAdmin()` (via `getCatalogForClient`, already service-role) to fetch authoritative `effectivePrice` per product and recompute `subtotal`/`totalAmount` server-side — **never trusts client-submitted prices**, matching existing `loadShippingContext` behavior (project rule: prices re-validated server-side on every order submission). Used by both fulfillment paths. |
| `getPickupLocation()` | `lib/shipping.ts` | Wraps existing `getBiteshipLocation(BITESHIP_ORIGIN_LOCATION_ID)`. Returns `{ name, address, postal_code, contact_phone: string \| null } \| null`. `contact_phone` typed optional — `BiteshipLocation` casts the raw fetch response (`json as BiteshipLocation`) with no runtime validation, so the field isn't guaranteed present despite its non-optional type. `PickupInfoCard` hides the phone line when null/falsy. No new env var. |
| `getPickupInfo()` action | `app/portal/order/_actions/getPickupInfo.ts` (new) | Validates cart via `validateCartItems`, fetches pickup location. Returns `{ ok: true; location } \| { ok: false; error: 'INVALID_CART' \| 'ORIGIN_NOT_CONFIGURED' }`. |
| `PickupInfoCard` | `app/portal/order/review/_components/PickupInfoCard.tsx` (new) | Static display of pickup location name/address/phone. Mirrors `AddressCard` styling. |
| `FulfillmentToggle` | `app/portal/order/review/_components/FulfillmentToggle.tsx` (new) | Segmented control: "Kirim" / "Ambil Sendiri". Default "Kirim". |

`loadShippingContext` keeps its current signature/behavior for the SHIPPING path (calls `validateCartItems` internally instead of inlining the loop).

### Schema (`lib/schemas/order.ts`)

```ts
export const fulfillmentMethodSchema = z.enum(['SHIPPING', 'PICKUP']).default('SHIPPING')

export const createOrderInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(100),
  notes: z.string().max(500).optional(),
  fulfillmentMethod: fulfillmentMethodSchema,
  shippingSelection: shippingSelectionSchema.optional(),
}).refine(
  (data) => data.fulfillmentMethod === 'PICKUP' || data.shippingSelection != null,
  { message: 'shippingSelection required for SHIPPING', path: ['shippingSelection'] }
)
```
`fulfillmentMethod` is request-only — never persisted as its own column, mirroring `agroastery-web`'s pattern. It exists purely to drive server-side branching in `createOrder`.

### Data Flow

**Review page (`app/portal/order/review/page.tsx`):**
1. Mount → `FulfillmentToggle` defaults to SHIPPING → existing `loadShippingRates` behavior unchanged (requires address, calls Biteship).
2. User switches to PICKUP → cancel/ignore in-flight shipping fetch, call `getPickupInfo()` instead → hide `AddressCard`/`CourierPicker` → show `PickupInfoCard` → "Ongkir" line reads "Gratis (Ambil Sendiri)" → `canSubmit` becomes true once pickup info loads (no rate selection required).
3. Switching back to SHIPPING re-triggers `loadShippingRates`.
4. Submit → `createOrder({ items, notes, fulfillmentMethod, shippingSelection? })`.

**`createOrder.ts` branch:**
- `SHIPPING`: unchanged — `loadShippingContext`, `findRateMatch`, insert with real courier/service/etd/cost.
- `PICKUP`: `validateCartItems` for items + totalAmount, `getPickupLocation` for `ORIGIN_NOT_CONFIGURED` check, insert with `shipping_courier: 'pickup'`, `shipping_service: null`, `shipping_etd: null`, `shipping_cost: 0`.

**Order detail page (`app/portal/orders/[id]/page.tsx`):**
- Select `shipping_courier` as already done (no new column to select).
- Shipping section render condition changes from `shipping_cost != null` to `!isPickupOrder(order)` for the courier/ETD/cost block; add a static "Ambil Sendiri" block when `isPickupOrder(order)` is true. No live Biteship call — one fixed location, static copy is enough (matches `agroastery-web`'s approach of not re-fetching location per view).

**Invoice route (`app/api/invoice/[id]/route.ts`):**
- Select `shipping_courier` alongside existing columns.
- Address lookup (`addresses` table query, lines 44-55) only enforced when `!isPickupOrder(order)`. When pickup and no address exists, `InvoiceData.recipientName`/`addressLine`/`postalCode` become optional/omitted; `lib/invoice/document.tsx` renders a "Ambil Sendiri di [warehouse]" line instead of the address block. This closes a real bug: today, any client with zero saved addresses gets a hard 404 on invoice download, and pickup makes zero-address clients possible for the first time.
- `InvoiceData` type (`lib/invoice/document.tsx`) must mark `recipientName`, `addressLine`, `postalCode` as optional (`?:`) so the pickup branch is type-checked, not just runtime-omitted.

**Telegram (`lib/telegram.ts`):**
- `sendOrderNotification` payload's `shippingCourier` already carries the sentinel; no new field needed. Message construction branches: when `shippingCourier === PICKUP_COURIER_CODE`, render "📦 Ambil Sendiri" instead of "🚚 Ongkir: ..." line, skip the courier/service parenthetical. `orderId` is already passed through from `createOrder.ts` (`order.id`, line 120) for both fulfillment paths — the pickup branch must not drop it, since it's required for `notification_logs` insert.

### Pickup location

Single fixed location, reused from existing `BITESHIP_ORIGIN_LOCATION_ID` config via `getBiteshipLocation()` — no new env var, no locations table. If unset/unresolvable, PICKUP path surfaces the same `ORIGIN_NOT_CONFIGURED` error the SHIPPING path already has a message for ("Pengiriman tidak tersedia, hubungi admin").

### Scheduling

None. Order is flagged pickup; admin coordinates timing via existing Telegram notification channel, same as current manual ops flow. No date/time picker, no `pickup_at` field.

## Error Handling

| Scenario | Behavior |
|---|---|
| PICKUP + Biteship origin not configured | `ORIGIN_NOT_CONFIGURED`, same error surface/message as SHIPPING path |
| PICKUP + invalid cart (bad product/qty) | `INVALID_CART`, via shared `validateCartItems` |
| Toggle switched mid-fetch (race) | Same re-invocation guard pattern `loadShippingRates` already uses — latest call wins, stale response ignored |
| Invoice download, pickup order, no saved address | No longer 404s — renders pickup note instead of address block |

## UI

`FulfillmentToggle` sits above the "Pengiriman" section on the review page, default "Kirim" selected. Segmented-button style consistent with existing `CourierPicker` radio-card look (`border-brand-crema` active state). No new page/route.

## Testing

- E2E (`e2e/tests/shipping.spec.ts`): add pickup flow — toggle to "Ambil Sendiri", submit without touching address, assert order created with `shipping_courier = 'pickup'`.
- E2E: order detail page shows pickup block, not courier/ETD block.
- E2E: invoice download succeeds for a pickup order with zero saved addresses. Test must explicitly delete/clean any seeded addresses for the test client before order submission — otherwise the seed helper's default address (see `e2e seed helper inserts default address for test client`) makes this scenario impossible to actually exercise, and the test would pass without covering the zero-address path.
- Existing SHIPPING-path tests unchanged — `fulfillmentMethod` defaults through the toggle's default state, no regression expected.

## Out of Scope

- Multiple pickup locations (would need a real table + location picker — noted as a natural next step if ever needed, per the `agroastery-web` review's flag that the sentinel pattern doesn't extend to multi-location).
- Pickup scheduling / date-time slots.
- Any "ready for pickup" status or automated notification when the order is ready — admin coordinates manually, same as today.
- `agr-ops` / admin dashboard changes — out of this repo's scope; admin already reads `shipping_courier` as free text and will display `'pickup'` correctly without changes, though a follow-up there to render it as "Ambil Sendiri" instead of a raw courier code is worth flagging to that team.
- COD / pay-on-pickup — not applicable, this repo has no online payment step to exempt (orders are UNPAID until admin marks paid, regardless of fulfillment method).

## Files to Modify

| File | Action |
|---|---|
| `lib/schemas/order.ts` | Modify — add `fulfillmentMethod`, make `shippingSelection` conditional |
| `lib/shipping.ts` | Modify — extract `validateCartItems`, add `PICKUP_COURIER_CODE`, `isPickupOrder`, `getPickupLocation` |
| `app/portal/order/_actions/getPickupInfo.ts` | Create |
| `app/portal/order/_actions/createOrder.ts` | Modify — branch on `fulfillmentMethod` |
| `app/portal/order/review/page.tsx` | Modify — toggle state, conditional fetch/render |
| `app/portal/order/review/_components/FulfillmentToggle.tsx` | Create |
| `app/portal/order/review/_components/PickupInfoCard.tsx` | Create |
| `app/portal/orders/[id]/page.tsx` | Modify — pickup-aware shipping section |
| `app/api/invoice/[id]/route.ts` | Modify — optional address lookup for pickup |
| `lib/invoice/document.tsx` | Modify — pickup note when address absent |
| `lib/telegram.ts` | Modify — pickup-aware message line |
| `e2e/tests/shipping.spec.ts` | Modify — add pickup coverage |
