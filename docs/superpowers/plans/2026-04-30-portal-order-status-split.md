# Portal Order Status Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `agr-client-portal` with the `b2b_order_status_split` migration (already applied to the shared Supabase project) by replacing the dropped `orders.status` column references with `fulfillment_status` + `payment_status`, and rendering both as separate badges.

**Architecture:** Read-only alignment. Drop the single `StatusBadge` component, add `FulfillmentBadge` and `PaymentBadge`. Update three portal files (orders list, order detail, createOrder action) and one Playwright test. No new API routes — admin owns all status mutations from agr-ops.

**Tech Stack:** Next.js 16 (App Router), React 19, TailwindCSS 4, Supabase SSR, Playwright E2E.

**Pre-requisites:**
- Migration `b2b_order_status_split` (version `20260425163110`) is already applied. No DB work in this plan.
- `.env.local` and `.env.e2e` already point at the shared Supabase project (`norfpranqmepooyyxozx`).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Delete | `components/StatusBadge.tsx` | Old single-status badge |
| Create | `components/FulfillmentBadge.tsx` | Fulfillment badge — colour map, raw English label |
| Create | `components/PaymentBadge.tsx` | Payment badge — colour map, raw English label |
| Modify | `app/portal/orders/page.tsx` | Select two columns, render both badges in mobile + desktop variants |
| Modify | `app/portal/orders/[id]/page.tsx` | Select two columns, render both badges in detail header |
| Modify | `app/portal/order/_actions/createOrder.ts` | Insert `fulfillment_status` + `payment_status` instead of `status` |
| Modify | `e2e/tests/portal.spec.ts` | Replace `status-badge` assertion with `fulfillment-badge` + `payment-badge` |

---

### Task 1: Update the failing E2E assertion

This task drives the rest. It mutates the test to expect the new behaviour first; subsequent tasks make it pass.

**Files:**
- Modify: `e2e/tests/portal.spec.ts` (lines 292-293, plus the doc comment near line 13)

- [ ] **Step 1: Update the doc comment**

Open `e2e/tests/portal.spec.ts`. Find the doc comment near line 13 that mentions "status badge". Change it to read "fulfillment + payment badges". The exact phrasing in the file is:

```
 *   □ Click order row → detail page shows items and status badge
```

Replace with:

```
 *   □ Click order row → detail page shows items, fulfillment badge, and payment badge
```

- [ ] **Step 2: Update the test assertions**

Find lines 292-293:

```ts
    await expect(page.getByTestId('status-badge')).toBeVisible()
    await expect(page.getByTestId('status-badge')).toContainText('Menunggu')
```

Replace with:

```ts
    await expect(page.getByTestId('fulfillment-badge')).toBeVisible()
    await expect(page.getByTestId('fulfillment-badge')).toContainText('PENDING')
    await expect(page.getByTestId('payment-badge')).toBeVisible()
    await expect(page.getByTestId('payment-badge')).toContainText('UNPAID')
```

- [ ] **Step 3: Confirm the test fails as expected**

Run:

```bash
npm run test:e2e -- e2e/tests/portal.spec.ts --reporter=list
```

Expected: at least one failure on the assertion that `getByTestId('fulfillment-badge')` is visible — the badge does not yet exist.

If the suite cannot run locally because `.env.e2e` is missing, skip this step and rely on the post-implementation run in Task 8.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/portal.spec.ts
git commit -m "test(portal): expect split fulfillment and payment badges in detail E2E"
```

---

### Task 2: Create FulfillmentBadge component

**Files:**
- Create: `components/FulfillmentBadge.tsx`

- [ ] **Step 1: Write the component**

Create `components/FulfillmentBadge.tsx` with the following content:

```tsx
const STYLES: Record<string, string> = {
  PENDING:   'bg-zinc-700 text-zinc-200',
  CONFIRMED: 'bg-blue-900 text-blue-200',
  SHIPPED:   'bg-amber-900 text-amber-200',
  DELIVERED: 'bg-emerald-900 text-emerald-200',
  CANCELLED: 'bg-red-900 text-red-200',
}

export function FulfillmentBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${STYLES[status] ?? 'bg-zinc-700 text-zinc-200'}`}
      data-testid="fulfillment-badge"
    >
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Confirm it compiles**

Run:

```bash
npm run build
```

Expected: build passes. The component is unused at this point but that does not fail the build.

- [ ] **Step 3: Commit**

```bash
git add components/FulfillmentBadge.tsx
git commit -m "feat(portal): add FulfillmentBadge component"
```

---

### Task 3: Create PaymentBadge component

**Files:**
- Create: `components/PaymentBadge.tsx`

- [ ] **Step 1: Write the component**

Create `components/PaymentBadge.tsx` with the following content:

```tsx
const STYLES: Record<string, string> = {
  UNPAID: 'bg-zinc-700 text-zinc-200',
  PAID:   'bg-emerald-700 text-emerald-100',
}

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${STYLES[status] ?? 'bg-zinc-700 text-zinc-200'}`}
      data-testid="payment-badge"
    >
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Confirm it compiles**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add components/PaymentBadge.tsx
git commit -m "feat(portal): add PaymentBadge component"
```

---

### Task 4: Update orders list page

**Files:**
- Modify: `app/portal/orders/page.tsx`

- [ ] **Step 1: Update the import**

Find the line that imports `StatusBadge` (the import path will be `@/components/StatusBadge` or similar). Replace that single import with two imports:

```tsx
import { FulfillmentBadge } from '@/components/FulfillmentBadge'
import { PaymentBadge } from '@/components/PaymentBadge'
```

- [ ] **Step 2: Update the SELECT query (line 25)**

Find:

```ts
.select('id, order_number, status, total_amount, created_at')
```

Replace with:

```ts
.select('id, order_number, fulfillment_status, payment_status, total_amount, created_at')
```

- [ ] **Step 3: Update the first badge call site (line 100, mobile card layout)**

Find:

```tsx
<StatusBadge status={order.status} />
```

Replace with:

```tsx
<div className="flex gap-1.5">
  <FulfillmentBadge status={order.fulfillment_status} />
  <PaymentBadge status={order.payment_status} />
</div>
```

- [ ] **Step 4: Update the second badge call site (line 109, desktop table)**

Same find-and-replace as Step 3 for the second occurrence.

- [ ] **Step 5: Confirm the page type-checks**

Run:

```bash
npm run build
```

Expected: build passes. If TypeScript complains that `fulfillment_status` or `payment_status` is missing from the inferred row type, double-check the SELECT string in Step 2.

- [ ] **Step 6: Commit**

```bash
git add app/portal/orders/page.tsx
git commit -m "feat(portal): render fulfillment and payment badges in orders list"
```

---

### Task 5: Update order detail page

**Files:**
- Modify: `app/portal/orders/[id]/page.tsx`

- [ ] **Step 1: Update the import**

Same import swap as Task 4 Step 1 — replace `StatusBadge` import with the two new badge imports.

- [ ] **Step 2: Update the SELECT query (line 23)**

Find:

```ts
id, order_number, status, total_amount, notes, created_at, updated_at,
```

Replace `status` with `fulfillment_status, payment_status`:

```ts
id, order_number, fulfillment_status, payment_status, total_amount, notes, created_at, updated_at,
```

- [ ] **Step 3: Update the badge call site (line 70)**

Find:

```tsx
<StatusBadge status={order.status} />
```

Replace with:

```tsx
<div className="flex gap-1.5">
  <FulfillmentBadge status={order.fulfillment_status} />
  <PaymentBadge status={order.payment_status} />
</div>
```

- [ ] **Step 4: Confirm the page type-checks**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add app/portal/orders/[id]/page.tsx
git commit -m "feat(portal): render fulfillment and payment badges on order detail"
```

---

### Task 6: Update createOrder server action

**Files:**
- Modify: `app/portal/order/_actions/createOrder.ts`

- [ ] **Step 1: Update the insert payload (line 79)**

Find:

```ts
status: 'PENDING',
```

Replace with:

```ts
fulfillment_status: 'PENDING',
payment_status: 'UNPAID',
```

- [ ] **Step 2: Confirm it compiles**

Run:

```bash
npm run build
```

Expected: build passes. If the Supabase generated types are stale and reject the new field names, regenerate types or add `as never` only as a last resort — prefer regenerating.

- [ ] **Step 3: Commit**

```bash
git add app/portal/order/_actions/createOrder.ts
git commit -m "feat(portal): insert fulfillment_status and payment_status on order creation"
```

---

### Task 7: Delete the old StatusBadge

**Files:**
- Delete: `components/StatusBadge.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run:

```bash
grep -rn "StatusBadge" app components e2e --include='*.ts' --include='*.tsx'
```

Expected: no matches. If there are any, fix them before deleting (likely a missed call site from Tasks 4 or 5).

- [ ] **Step 2: Delete the file**

```bash
rm components/StatusBadge.tsx
```

- [ ] **Step 3: Confirm the project still builds**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add -u components/StatusBadge.tsx
git commit -m "refactor(portal): remove legacy StatusBadge component"
```

---

### Task 8: Run E2E and manually verify

**Files:** none modified in this task — this is a verification gate.

- [ ] **Step 1: Run the portal E2E suite**

Run:

```bash
npm run test:e2e -- e2e/tests/portal.spec.ts --reporter=list
```

Expected: all tests pass, including the assertions on `fulfillment-badge` and `payment-badge` updated in Task 1.

If the test that previously read `Menunggu` now fails because the seeded order is in a different state, double-check that `seedOrder` (or however the test sets up the order) leaves `fulfillment_status` at `'PENDING'` and `payment_status` at `'UNPAID'`. The DB defaults handle this if the insert omits both fields.

- [ ] **Step 2: Start the dev server and visually verify**

Run:

```bash
npm run dev
```

Then visit `http://localhost:3000`, log in as a test client, and verify:

1. `/portal/orders` — every order row shows two badges side-by-side (fulfillment + payment) in both the mobile card layout and the desktop table.
2. `/portal/orders/[id]` — order detail header shows both badges.
3. Submit a new order through `/portal/order` — confirm it succeeds. Then via Supabase SQL editor (or the MCP), run:

```sql
SELECT id, order_number, fulfillment_status, payment_status
FROM orders
ORDER BY created_at DESC
LIMIT 1;
```

Expected: latest row has `fulfillment_status = 'PENDING'` and `payment_status = 'UNPAID'`.

- [ ] **Step 3: Fix any issues found**

If a test fails or visual issue appears, fix inline and re-run. Only proceed when everything is green.

- [ ] **Step 4: Final commit (only if fixes were made)**

```bash
git add -A
git commit -m "fix(portal): address issues found during status split verification"
```
