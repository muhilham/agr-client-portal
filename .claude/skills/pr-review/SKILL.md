---
name: pr-review
description: >
  Perform a thorough PR review for the Agroastery codebase (agr-ops dashboard and
  client portal). Use this skill whenever the user asks to review code, review a PR,
  check a diff, audit a file, or says things like "review this", "check this code",
  "does this look right", or "anything wrong with this". Also trigger when new files
  are written by Claude Code and the user wants a second opinion. Reviews are full and
  strict — flag everything, suggest improvements, block pattern violations.
---

# PR Review — Agroastery Codebase

## Stack
- Next.js App Router (TypeScript)
- Supabase (PostgreSQL + RLS + Auth)
- Tailwind CSS
- Playwright (E2E tests)
- Cloudflare R2 (image storage)

---

## Step 1 — Gather the Changes

Before running any checklist items, get the full diff. Choose the right method:

### "Review all changes in this PR" or "review the PR"
```bash
# Get the list of changed files vs main branch
git diff --name-only main...HEAD

# Get the full diff of all changed files
git diff main...HEAD
```
If on a branch other than main, substitute the correct base branch.

### "Review this file" or specific file mentioned
```bash
cat <filepath>
# or
git diff main...HEAD -- <filepath>
```

### "Review what was just built" or no specific target
```bash
# Show the last N commits and their changed files
git log --oneline -10
git diff HEAD~1...HEAD
```

### After gathering the diff:
- List every changed file at the top of your review
- Note which files are new vs modified
- Run ALL checklist items only against the changed files
- If a changed file imports from or depends on an unchanged file, check that dependency too

---

## Review Checklist

Run every item. Flag every violation. Do not skip sections because the code "looks fine".

---

### 1. Supabase Client Usage

**Rule: Server-side reads on RLS-enabled tables MUST use `getSupabaseAdmin()` (service role key), not the anon client.**

Tables with RLS enabled: `clients`, `products`, `client_products`, `orders`, `order_items`, `notification_logs`

```
✗ WRONG — returns empty rows silently on RLS tables:
  const supabase = createClient()
  const { data } = await supabase.from('clients').select('*')

✓ CORRECT:
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('clients').select('*')
```

Exception: `requireEmployee()` uses `createClient()` for the auth/role check — this is correct and intentional.

Flag any file that:
- Uses `createClient()` to query `clients`, `orders`, `order_items`, `notification_logs`, or `client_products`
- Uses `getSupabaseAdmin()` in a client component (`'use client'`)

**Client portal exception:** The client portal uses the anon key + authenticated session by design.
Server actions in `app/portal/order/_actions/` use `createClient()` (server) — this is correct because
RLS INSERT policies are in place for `orders` and `order_items` (migration 005). Flag only if a portal
server action uses `createClient()` to SELECT from RLS tables without a session.

---

### 2. API Route Pattern

**Rule: All mutations must go through `/api/...` routes. Never use server actions for mutations.**

```
✗ WRONG:
  export async function createClient(formData: FormData) {
    'use server'
    ...
  }

✓ CORRECT:
  // app/api/dashboard/clients/route.ts
  export async function POST(req: Request) { ... }
```

Flag any `'use server'` function that performs a DB mutation.

Also verify every API route:
- Calls `getAuthorizedCaller()` or equivalent auth+role check at the top
- Returns `NextResponse.json(...)` — not raw `Response`
- Uses `getSupabaseAdmin()` for all DB mutations
- Handles the Postgres unique violation error code `23505` where relevant

---

### 3. Date Formatting

**Rule: NEVER use `toLocaleDateString()`, `toLocaleString()`, or `new Date().toLocaleString()` without explicit locale and timezone.**

These cause React hydration mismatches — server renders in one locale, browser in another.

```
✗ WRONG:
  new Date(row.created_at).toLocaleDateString()

✓ CORRECT:
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(row.created_at))
```

Flag any date formatting that does not explicitly specify `'id-ID'` locale and `'Asia/Jakarta'` timezone.

---

### 4. Price Trust — Never Trust Client-Submitted Prices

**Rule: Unit prices must ALWAYS be re-validated server-side against `client_products` or `products` tables. Never use prices submitted by the client.**

```
✗ WRONG:
  // Using price from request body directly
  const { productId, unitPrice, quantity } = await req.json()
  subtotal = unitPrice * quantity

✓ CORRECT:
  // Re-fetch price from DB using productId + clientId
  const { data: cp } = await supabase
    .from('client_products')
    .select('custom_price, products(base_price)')
    .eq('client_id', clientId)
    .eq('product_id', productId)
    .single()
  const unitPrice = cp.custom_price ?? cp.products.base_price
```

Flag any order creation route that uses `unitPrice` from the request body without re-validation.

---

### 5. Order Number Generation

**Rule: NEVER use `COUNT(*) + 1` for order number generation. Always use `supabase.rpc('generate_order_number')`.**

```
✗ WRONG — race condition:
  const { count } = await supabase.from('orders').select('*', { count: 'exact' })
  const orderNumber = `ORD-${today}-${count + 1}`

✓ CORRECT:
  const { data: orderNumber } = await supabase.rpc('generate_order_number')
```

---

### 6. Telegram Notification

**Rule: `sendOrderNotification` requires `orderId` field. Never call without it.**

```
✗ WRONG — missing orderId, causes TypeScript error and logging failure:
  await sendOrderNotification({
    orderNumber, clientName, items, totalAmount, createdAt
  })

✓ CORRECT:
  await sendOrderNotification({
    orderId: order.id,   // ← required
    orderNumber, clientName, items, totalAmount, createdAt
  })
```

Also verify:
- Called AFTER the order is committed to the database
- Wrapped in try/catch
- Never rethrows — order creation must not be blocked by notification failure

---

### 7. TypeScript Type Safety

Flag:
- `any` type used without a comment explaining why
- Non-null assertions (`!`) without a guard or comment
- Untyped API route request bodies — should use `z.parse()` or explicit type assertion with validation
- Missing return types on exported functions
- `as unknown as X` double casting
- Props interfaces defined inline on component function instead of as named type/interface

---

### 8. Component Architecture

**Rule: `'use client'` components must be isolated. Server components must not own interactive state.**

Flag:
- `onClick`, `useState`, `useEffect` in a file without `'use client'`
- A server component (`page.tsx`) rendering interactive elements directly instead of delegating to a `_components/` client component
- Client components importing from `@/lib/supabase/server` (server-only module)
- Missing `export const dynamic = 'force-dynamic'` on dashboard page server components that fetch live data

---

### 9. Migration Files

**Rule: Any SQL applied to Supabase via MCP must also be saved as a file in `supabase/migrations/` with naming convention `NNN_description.sql`.**

Flag if:
- A new table or function is described in code but no corresponding migration file exists
- Migration files are missing from the repo

---

### 10. Test Coverage

Flag missing Playwright tests for:
- Any new route that has user-interactive state (modals, toggles, form submissions)
- Any new `data-testid` attributes referenced in tests but not added to components
- Any new component that changes behavior based on data conditions (e.g., conditional rendering) with no test covering both branches

Suggest tests when:
- A new API route has no corresponding test
- A deactivate/activate toggle has no test for the confirmation flow

---

### 11. R2 Image Upload

Flag:
- Any component that constructs R2 URLs client-side instead of using the URL returned from the server
- Upload flows that don't follow the sequence: create record → upload image → patch `image_url`
- Missing `next.config.js` `remotePatterns` entry for new R2 hostnames

---

## Output Format

Structure your review as:

```
## PR Review

### 🔴 Blockers (must fix before merge)
- [file:line] Description of violation + correct pattern

### 🟡 Warnings (should fix)
- [file:line] Description of issue

### 🔵 Suggestions (optional improvements)
- [file:line] Suggestion

### ✅ Looks good
- List patterns that were followed correctly (brief)
```

If there are no blockers, say so explicitly. Never omit a section — write "None" if empty.

Be specific: always include the file name, the problematic line or pattern, and the correct alternative.
