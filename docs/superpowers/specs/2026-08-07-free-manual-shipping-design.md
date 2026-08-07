# Free Shipping & Manual Shipping Design

**Date:** 2026-08-07
**Status:** Approved
**Related:** `agr-ops` migration for `clients.has_free_shipping`

## Problem

Two new shipping scenarios needed for B2B clients:

1. **Free shipping** — specific VIP customers get shipping cost waived entirely.
2. **Manual shipping** — Biteship doesn't have courier options for some customers' areas, so admin must handle cost separately.

## Constraints

- Migrations only in `agr-ops` repo. This repo's `supabase/migrations/` is read-only reference.
- Minimal schema changes — reuses existing `shipping_courier` sentinel pattern (`'pickup'`).
- No new dependencies.
- `shipping_cost` server-side validation already happens; manual shipping cost will be `NULL` until admin fills it in agr-ops.

## Schema Changes (agr-ops only)

```sql
ALTER TABLE clients ADD COLUMN has_free_shipping BOOLEAN NOT NULL DEFAULT FALSE;
```

### `orders` sentinel values (no schema change, semantic convention)

| `shipping_courier` | Meaning | `shipping_cost` | `shipping_service` | `shipping_etd` |
|---|---|---|---|---|
| `'pickup'` | Ambil sendiri | `0` | `NULL` | `NULL` |
| `'free'` | Free shipping | `0` | `NULL` | `NULL` |
| `'manual'` | Admin handles later | `NULL` | `NULL` | `NULL` |
| `'jne'`, `'sicepat'`, etc. | Biteship courier | `> 0` | set | set |

## Server Actions

### `lib/shipping.ts` — `loadShippingContext`

Load `clients.has_free_shipping` early via `getSupabaseAdmin()`.

If `has_free_shipping = true`:
- Return `{ ok: true, freeShipping: true, address }` (skip Biteship API call entirely)
- `shipping_cost = 0`, `shipping_courier = 'free'`

If `has_free_shipping = false`:
- Proceed with existing Biteship flow
- If Biteship returns empty rates, show manual toggle as fallback

### `app/portal/order/_actions/getShippingRates.ts`

Returns new discriminated union:

```ts
type ShippingRatesResult =
  | { ok: true; kind: 'free_shipping'; address: AddressDisplay }
  | { ok: true; kind: 'rates'; rates: RateOption[]; address: AddressDisplay }
  | { ok: false; error: 'NO_ADDRESS' | 'INVALID_CART' | 'ORIGIN_NOT_CONFIGURED' | 'RATES_UNAVAILABLE' | 'INVALID_INPUT' }
```

Free shipping clients get `kind: 'free_shipping'` immediately — no Biteship API call.

### `app/portal/order/_actions/createOrder.ts`

Check `clients.has_free_shipping` before branching:

- **Free shipping**: `dbShippingCost = 0`, `dbShippingCourier = 'free'`, skip Biteship entirely.
- **Manual shipping selected**: `dbShippingCost = null`, `dbShippingCourier = 'manual'`, `dbShippingService = null`, `dbShippingEtd = null`.
- **Biteship path**: unchanged — re-validates `shippingSelection` via `findRateMatch`.

### Zod Schema Update (`lib/schemas/order.ts`)

```ts
export const shippingSelectionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('free') }),
  z.object({ mode: z.literal('manual') }),
  z.object({
    mode: z.literal('biteship'),
    courier_code: z.string().min(1).max(64),
    service_code: z.string().min(1).max(64),
  }),
])
```

`createOrderInputSchema` refinement updated:
```ts
.refine(
  (data) => data.fulfillmentMethod === 'PICKUP' || data.shippingSelection != null,
  { message: 'shippingSelection is required for SHIPPING orders', path: ['shippingSelection'] }
)
```

## Review Page UI Flow

`FulfillmentToggle` stays binary: **SHIPPING | PICKUP**.

When **SHIPPING** selected, three sub-states:

### A: Free Shipping
- Trigger: `clients.has_free_shipping = true`
- UI: Address card + "Pengiriman Gratis" badge. No courier picker.
- Ongkir: `Gratis`
- `shippingSelection`: `{ mode: 'free' }`

### B: Biteship (Normal)
- Trigger: Normal client, rates loaded successfully.
- UI: Address card + `CourierPicker` with Biteship rates.
- Below courier picker: "Kurir tidak tersedia? Gunakan ongkir manual" toggle link.
- Ongkir: `selectedRate.price`
- `shippingSelection`: `{ mode: 'biteship', courier_code, service_code }`

### C: Manual Shipping
- Trigger: User clicks manual toggle, OR Biteship returns empty rates.
- UI: Address card + info: "Ongkir akan dihitung oleh admin. Silakan lanjutkan pesanan."
- No courier picker.
- Ongkir: `—` (null)
- `shippingSelection`: `{ mode: 'manual' }`

### State Machine Diagram

```
SHIPPING selected
    │
    ├─ has_free_shipping? ──YES──► Free state (skip Biteship)
    │                              address + "Gratis" badge
    │                              mode: 'free'
    │
    └─ NO ──► loadShippingContext()
                  │
                  ├─ rates loaded ──► Biteship state
                  │                    CourierPicker
                  │                    + manual toggle link
                  │
                  └─ rates empty ──► Manual state (auto)
                                       OR user clicks manual toggle
                                       "Ongkir dihitung admin"
                                       mode: 'manual'
```

### Grand Total Calculation

```ts
const shippingCost = fulfillmentMethod === 'PICKUP' ? 0
  : shippingSelection?.mode === 'free' ? 0
  : shippingSelection?.mode === 'manual' ? 0 // display only, stored as null
  : selectedRate?.price ?? 0

const grandTotal = subtotal + shippingCost
```

## Invoice

For **manual shipping** orders (`shipping_courier = 'manual'`), invoice download is **blocked** in the API route until `shipping_cost IS NOT NULL`:

```ts
if (order.shipping_courier === 'manual' && order.shipping_cost == null) {
  return NextResponse.json(
    { error: 'Biaya pengiriman belum dihitung oleh admin. Silakan hubungi admin untuk invoice.' },
    { status: 422 }
  )
}
```

For **free shipping** orders (`shipping_courier = 'free'`), invoice shows `Shipping Cost: Rp 0` as usual.

For **pickup** and **Biteship** orders — behavior unchanged.

### UI Feedback
When invoice blocked, order detail page shows message instead of download button:
> "Invoice tersedia setelah admin menghitung biaya pengiriman."

## Order Detail & List Display

### `/portal/orders/[id]`

Shipping section gates on `shipping_courier != null`:

| `shipping_courier` | Display |
|---|---|
| `'pickup'` | "Ambil Sendiri" — no cost line |
| `'free'` | "Pengiriman Gratis" — cost `Rp 0` |
| `'manual'` | "Pengiriman Manual" — cost `—` (null, admin to fill) |
| `'jne'` etc. | `{courier} — {service}`, ETD, cost |

Grand total: `total_amount + (shipping_cost ?? 0)`. Manual orders show subtotal only until admin updates cost in agr-ops.

### `/portal/orders` (list)

Unchanged — single grand-total column. Manual/free/pickup = just subtotal until cost updated.

## Telegram Notification

Template updated per `shipping_courier` — all 4 states handled explicitly:

| `shipping_courier` | Telegram Line | Total |
|---|---|---|
| `'pickup'` | `📦 Ambil Sendiri` | `Subtotal + 0` |
| `'free'` | `🚚 Pengiriman: Gratis` | `Subtotal + 0` |
| `'manual'` | `🚚 Pengiriman: Manual (admin)` | `Subtotal` (cost not yet set) |
| `'jne'` etc. | `🚚 Ongkir: Rp Y (JNE REG)` | `Subtotal + Y` |

**Key fix:** Manual orders must show shipping line even when `shipping_cost = null`. The Telegram template checks `shippingCourier` sentinel value **before** checking `shippingCost`, ensuring the shipping method is always visible.

```
📦 Order #...
👤 Client: ...
📝 Items: ...
💰 Subtotal: Rp X
🚚 Pengiriman: [Gratis / JNE REG / Manual (admin) / Ambil Sendiri]
💵 Grand Total: Rp X+Y
```

## Edge Cases

| Case | Handling |
|---|---|
| Biteship rates empty for normal client | Show manual toggle as fallback. |
| Manual selected, admin later adds cost in agr-ops | `shipping_cost` updated via agr-ops dashboard. Client sees updated total on refresh. |
| `has_free_shipping` toggled mid-session | Rates recalc on next load. |
| Free shipping client — manual not available | Free shipping clients **bypass the entire SHIPPING sub-state machine**. `loadShippingContext` returns `{ freeShipping: true }` immediately — no Biteship call, no manual toggle, no courier picker. They always see "Pengiriman Gratis" and proceed directly. |

## Testing Plan

1. **Free shipping E2E** — seed client with `has_free_shipping=true`, assert no Biteship API call, order shows `shipping_courier='free'`, cost=0, Telegram says "Gratis"
2. **Manual toggle E2E** — normal client, click manual toggle, assert order shows `shipping_courier='manual'`, cost=null, Telegram says "Manual (admin)"
3. **Biteship regression** — existing E2E tests still pass
4. **Order detail rendering** — seed orders with all 4 courier states, assert correct display
5. **Pickup regression** — existing pickup E2E still passes

## Files to Modify

| File | Action | Notes |
|---|---|---|
| `lib/shipping.ts` | modify | `loadShippingContext` checks `clients.has_free_shipping` |
| `lib/schemas/order.ts` | modify | `shippingSelectionSchema` → discriminated union |
| `app/portal/order/_actions/getShippingRates.ts` | modify | Return `free_shipping` vs `rates` |
| `app/portal/order/_actions/createOrder.ts` | modify | Branch on `shippingSelection.mode` |
| `app/portal/order/review/page.tsx` | modify | Handle free/manual states, add manual toggle |
| `app/portal/orders/[id]/page.tsx` | modify | Handle `'free'` and `'manual'` in shipping section; show invoice blocked message |
| `app/api/invoice/[id]/route.ts` | modify | Block download for manual orders with `shipping_cost = null` |
| `lib/invoice/document.tsx` | modify | Show "Rp 0" for free shipping; no change for manual (blocked before reaching here) |
| `lib/telegram.ts` | modify | Template handles `'free'` and `'manual'` labels |
| `e2e/tests/shipping.spec.ts` | add tests | Free shipping + manual shipping scenarios |
| `e2e/helpers/seed.ts` | modify | Allow `has_free_shipping` override in seed helper |

## Out of Scope

- Admin UI for toggling `has_free_shipping` — lives in `agr-ops` only
- Admin UI for entering manual shipping cost — lives in `agr-ops` only
- Any changes to `orders` table schema — uses existing `shipping_courier` sentinel pattern
- Scheduled delivery, insurance, COD — not requested
