# Portal Order Status Split — Design Spec

**Date:** 2026-04-30
**Scope:** Align `agr-client-portal` with the `b2b_order_status_split` migration already applied to the shared Supabase project (`norfpranqmepooyyxozx`, migration version `20260425163110`).

---

## Problem

The shared `orders` table has been split:

| Old | New |
|-----|-----|
| `status TEXT` (PENDING / CONFIRMED / SHIPPED / DELIVERED / PAID) | `fulfillment_status TEXT` (PENDING / CONFIRMED / SHIPPED / DELIVERED / CANCELLED) **+** `payment_status TEXT` (UNPAID / PAID) |

The migration was authored and applied from `agr-ops`. The client portal still references the dropped `status` column in four places, so the orders list page, order detail page, and the order-creation server action are broken in production.

---

## Solution

Read-only alignment. The portal does not mutate fulfillment or payment status (admin-only per the agr-ops spec). Changes:

1. Replace the dropped column references in all SELECT queries with the two new columns.
2. Update the order-insert path to write `fulfillment_status` + `payment_status` instead of `status`.
3. Replace the single `StatusBadge` component with two narrow components — `FulfillmentBadge` and `PaymentBadge` — each owning its own colour and Indonesian-label maps.
4. Render both badges side-by-side wherever a status was previously shown.

The portal does not gain any UI to advance fulfillment or mark payment. That stays in `agr-ops`.

---

## Components

### Delete

- `components/StatusBadge.tsx`

### Create

**`components/FulfillmentBadge.tsx`**

Props: `{ status: string }`.

Style map covers `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`. The label is the raw status string in English uppercase — no translation map. Unknown values fall back to the default zinc style and render the raw uppercase value.

`data-testid="fulfillment-badge"`.

**`components/PaymentBadge.tsx`**

Props: `{ status: string }`.

Style map covers `UNPAID` (zinc) and `PAID` (emerald). The label is the raw status string. Same fallback behaviour as `FulfillmentBadge`.

`data-testid="payment-badge"`.

---

## Page Edits

### `app/portal/orders/page.tsx` (list)

- Line 25 — change select string `id, order_number, status, total_amount, created_at` to `id, order_number, fulfillment_status, payment_status, total_amount, created_at`.
- Lines 100 and 109 — both call sites render `<StatusBadge status={order.status} />` (one in the mobile card layout, one in the desktop table). Replace each with the two new badges wrapped in a flex container:
  ```tsx
  <div className="flex gap-1.5">
    <FulfillmentBadge status={order.fulfillment_status} />
    <PaymentBadge status={order.payment_status} />
  </div>
  ```
- Update the import line to point at the two new components.

### `app/portal/orders/[id]/page.tsx` (detail)

- Line 23 — change `status` to `fulfillment_status, payment_status` in the select string.
- Line 70 — replace `<StatusBadge status={order.status} />` with the same two-badge flex container shown above.
- Update the import line.

### `app/portal/order/_actions/createOrder.ts` (insert)

- Line 79 — replace `status: 'PENDING'` with `fulfillment_status: 'PENDING', payment_status: 'UNPAID'`.

The DB columns both have defaults (`'PENDING'` and `'UNPAID'`), so the explicit insert is for clarity, not correctness. Q3 selected explicit (option A).

---

## Data Flow + Error Handling

**Read path:** unchanged at the transport layer. The portal still uses the anon client with the authenticated session; RLS on `orders` continues to scope rows to the signed-in client by email. The query selects two columns instead of one.

**Write path:** the server action in `createOrder.ts` runs as the authenticated user via `createClient()` (server-side). The RLS INSERT policy added in migration 005 still applies; only the column names in the insert change. Server-side price re-validation and `generate_order_number()` RPC usage are untouched.

**Unknown status values:** both badges render unknown values through the fallback (default style + raw uppercase value). This avoids crashes if the agr-ops side later adds new states without coordinating a portal release.

**Backwards compatibility:** none required. The old `status` column was dropped by migration 014 and no rows reference it. If a select unexpectedly returns null for either new column (both are NOT NULL with defaults, so this should not happen), the badge falls through to the default style.

---

## Testing

### Update

- `e2e/tests/portal.spec.ts` — lines 292–293 currently assert on a single `status-badge` test id and the Indonesian label `Menunggu`. Replace with four assertions: `fulfillment-badge` is visible and contains `PENDING`; `payment-badge` is visible and contains `UNPAID`.
- The doc comment near line 13 mentions "status badge" — change to "fulfillment + payment badges".

### Add

None. The existing detail-page test exercises both new badges through the swapped test ids. The existing order-creation tests already cover the insert path; the new column names get exercised by the seeded test data.

### Manual verification after deploy

1. `/portal/orders` — each row shows both badges.
2. `/portal/orders/[id]` — header shows both badges.
3. Submit a new order — confirm via SQL that the row has `fulfillment_status = 'PENDING'` and `payment_status = 'UNPAID'`.

---

## Out of Scope

- Any UI for advancing fulfillment status (admin-only, lives in `agr-ops`).
- Any UI for marking payment (admin-only).
- Webhook-driven payment status updates.
- Telegram notification message changes — `lib/telegram.ts` does not currently include order status text, so no change is required there.
- The unrelated migration `006_auto_create_auth_user_on_client.sql` flagged in the prior review.
