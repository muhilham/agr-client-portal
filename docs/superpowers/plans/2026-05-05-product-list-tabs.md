# Product List Tab Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the catalog page into "Produk Saya" (client-assigned) and "Produk Lainnya" (global-only) tabs so B2B clients find their regular products immediately.

**Architecture:** Add `isClientAssigned: boolean` to `CatalogProduct` (set during the existing Map merge in `getCatalogForClient`). `CatalogView` gains tab state and renders a tab bar when both product types exist; if only one type exists, tabs are hidden and the flat grid is shown as before.

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, Playwright E2E

---

## File Map

| File | Change |
|------|--------|
| `lib/catalog.ts` | Add `isClientAssigned: boolean` to `CatalogProduct`; set flag in both loops of `getCatalogForClient` |
| `app/portal/_components/CatalogView.tsx` | Add tab state, tab bar UI, filtered product list |
| `e2e/global-setup.ts` | Add a global-only product (sku `E2E-GLOBAL-001`) so both tabs have content during tests |
| `e2e/tests/portal.spec.ts` | Add `test.describe('Product list tabs')` with tab behavior tests |

---

## Task 1: Extend CatalogProduct type and getCatalogForClient

**Files:**
- Modify: `lib/catalog.ts`

- [ ] **Step 1: Add `isClientAssigned` to `CatalogProduct` type**

In `lib/catalog.ts`, update the exported type (lines 3–14):

```ts
export type CatalogProduct = {
  id: string
  name: string
  description: string | null
  unit: string
  sku: string | null
  imageUrl: string | null
  effectivePrice: number
  minQty: number
  isGlobal: boolean
  isClientAssigned: boolean
  shipWeightGrams: number
}
```

- [ ] **Step 2: Set flag in global products loop**

In `getCatalogForClient`, update the `catalog.set` call inside the `for (const p of globalProducts ?? [])` loop (around line 60):

```ts
catalog.set(p.id, {
  id: p.id,
  name: p.name,
  description: p.description,
  unit: p.unit,
  sku: p.sku,
  imageUrl: p.image_url,
  effectivePrice: Number(p.base_price),
  minQty: 1,
  isGlobal: true,
  isClientAssigned: false,
  shipWeightGrams: Number(p.ship_weight_grams),
})
```

- [ ] **Step 3: Set flag in client_products loop**

In `getCatalogForClient`, update the `catalog.set` call inside the `for (const cp of clientProducts ?? [])` loop (around line 78). **Ensure the `const p = cp.products` destructuring is present** so `p` is defined:

```ts
for (const cp of clientProducts ?? []) {
  const p = cp.products
  if (!p || !p.is_active) continue

  catalog.set(p.id, {
    id: p.id,
    name: p.name,
    description: p.description,
    unit: p.unit,
    sku: p.sku,
    imageUrl: p.image_url,
    effectivePrice: cp.custom_price != null ? Number(cp.custom_price) : Number(p.base_price),
    minQty: cp.min_qty ?? 1,
    isGlobal: p.is_global,
    isClientAssigned: true,
    shipWeightGrams: Number(p.ship_weight_grams),
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles (Task 1)**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see errors about missing `isClientAssigned`, you missed a `catalog.set` call — there are exactly two in `getCatalogForClient`.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.ts
git commit -m "feat(portal): add isClientAssigned flag to CatalogProduct"
```

---

## Task 2: Add global-only E2E test product to global-setup

**Files:**
- Modify: `e2e/global-setup.ts`

**Context:** The current setup creates one product (`is_global: false`) and assigns it to the test client. With only client-assigned products, the tab logic hides tabs entirely (correct behavior, but untestable). We need at least one `is_global: true` product that is NOT in `client_products` for the test client.

- [ ] **Step 0: Verify Supabase client uses service role key**

Confirm `e2e/global-setup.ts` initializes the Supabase client with `SUPABASE_SERVICE_ROLE_KEY` (not the anon key). The existing setup should already show:

```ts
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})
```

This is required because the setup inserts directly into the `products` table, which may have RLS enabled.

- [ ] **Step 1: Exclude global test product from the existing product query**

Update the existing product lookup (around line 104) so it never selects `E2E-GLOBAL-001` as the product to assign to the test client. Change:

```ts
const { data: existingProducts } = await supabase
  .from('products')
  .select('id')
  .eq('is_active', true)
  .limit(1)
```

To:

```ts
const { data: existingProducts } = await supabase
  .from('products')
  .select('id')
  .eq('is_active', true)
  .neq('sku', 'E2E-GLOBAL-001')
  .limit(1)
```

This prevents a race condition where the global product gets assigned to the test client, leaving zero assigned products after the cleanup step below.

- [ ] **Step 2: Add global product seed block after the existing client product assignment**

In `e2e/global-setup.ts`, append this block immediately after the `if (assignErr && ...)` block (after line 147), before the stale orders cleanup section:

```ts
// ── 3b. Ensure a global-only product exists (not assigned to test client) ──

const { data: existingGlobalProduct } = await supabase
  .from('products')
  .select('id')
  .eq('sku', 'E2E-GLOBAL-001')
  .eq('is_active', true)
  .maybeSingle()

let globalProductId: string | null = null

if (!existingGlobalProduct) {
  const { data: newGlobalProduct, error: globalProductErr } = await supabase
    .from('products')
    .insert({
      name: 'E2E Global Product',
      description: 'Global product for tab E2E testing',
      unit: 'kg',
      sku: 'E2E-GLOBAL-001',
      base_price: 50000,
      ship_weight_grams: 1000,
      is_active: true,
      is_global: true,
    })
    .select('id')
    .single()
  if (globalProductErr) throw new Error(`Failed to insert global product: ${globalProductErr.message}`)
  globalProductId = newGlobalProduct!.id
  console.log('[setup] Created E2E global product (E2E-GLOBAL-001)')
} else {
  globalProductId = existingGlobalProduct.id
  console.log('[setup] E2E global product already exists')
}

// Ensure the global product is NEVER assigned to the test client
// (otherwise both tabs won't render because all products would be "assigned")
if (globalProductId) {
  const { error: deleteErr } = await supabase
    .from('client_products')
    .delete()
    .eq('client_id', clientId)
    .eq('product_id', globalProductId)
  if (deleteErr && !deleteErr.message.includes('no rows')) {
    console.warn(`[setup] Warning removing global product assignment: ${deleteErr.message}`)
  }
}
```

- [ ] **Step 4: Verify setup runs without errors**

```bash
npx playwright test --project=setup 2>&1 | tail -20
```

Expected: `[setup] E2E global product already exists` or `[setup] Created E2E global product` in output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "test(portal): seed global-only product for tab E2E tests"
```

---

## Task 3: Write failing E2E tests for tab behavior

**Files:**
- Modify: `e2e/tests/portal.spec.ts`

- [ ] **Step 0: Verify `getFirstProductId` helper exists (no-op if already present)**

The `'cart persists when switching tabs'` test below calls `getFirstProductId(page)`. This helper is **already defined** in `e2e/tests/portal.spec.ts` (lines 44–49). This step is a verification only — no action is needed unless the helper has been removed.

If it is somehow missing, add it at the top of the file with the other helpers:

```ts
async function getFirstProductId(page: Page): Promise<string> {
  const card = page.locator('[data-testid^="product-card-"]').first()
  await card.waitFor()
  const testId = await card.getAttribute('data-testid')
  return testId!.replace('product-card-', '')
}
```

- [ ] **Step 1: Add tab test describe block**

In `e2e/tests/portal.spec.ts`, add this new describe block after the closing `})` of `test.describe('Portal catalog (CP-02)')` (after line 143):

```ts
test.describe('Product list tabs (CP-02b)', () => {
  test('shows Produk Saya and Produk Lainnya tabs when both types exist', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.getByTestId('tab-mine')).toBeVisible()
    await expect(page.getByTestId('tab-other')).toBeVisible()
  })

  test('Produk Saya tab is active by default', async ({ page }) => {
    await page.goto('/portal')
    const tab = page.getByTestId('tab-mine')
    await expect(tab).toHaveAttribute('aria-selected', 'true')
  })

  test('Produk Lainnya tab shows global products', async ({ page }) => {
    await page.goto('/portal')
    await page.getByTestId('tab-other').click()
    await expect(page.getByText('E2E Global Product')).toBeVisible()
  })

  test('cart persists when switching tabs', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()

    await page.getByTestId('tab-other').click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()

    await page.getByTestId('tab-mine').click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()
  })

  test('switching back to Produk Saya shows client products again', async ({ page }) => {
    await page.goto('/portal')

    await page.getByTestId('tab-other').click()
    await page.getByTestId('tab-mine').click()

    const tab = page.getByTestId('tab-mine')
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npx playwright test --grep "Product list tabs" 2>&1 | tail -30
```

Expected: all 5 tests FAIL with `getByTestId('tab-mine') ... not found` — tabs don't exist yet.

- [ ] **Step 3: Commit failing tests**

```bash
git add e2e/tests/portal.spec.ts
git commit -m "test(portal): add failing E2E tests for product list tabs"
```

---

## Task 4: Implement tab UI in CatalogView

**Files:**
- Modify: `app/portal/_components/CatalogView.tsx`

- [ ] **Step 0: Verify `'use client'` directive**

Confirm the top of `app/portal/_components/CatalogView.tsx` already contains:

```ts
'use client'
```

If it is missing, add it before any imports. This file uses `useState` and event handlers, which require the client component directive.

- [ ] **Step 1: Add tab state and derived lists**

In `CatalogView.tsx`, add the following immediately after the existing `const [quantities, setQuantities] = useState<Record<string, number>>({})` line:

```ts
const [tab, setTab] = useState<'mine' | 'other'>('mine')

const myProducts = catalog.filter((p) => p.isClientAssigned)
const otherProducts = catalog.filter((p) => !p.isClientAssigned)
const showTabs = myProducts.length > 0 && otherProducts.length > 0
const displayedProducts = showTabs ? (tab === 'mine' ? myProducts : otherProducts) : catalog
```

- [ ] **Step 2: Replace the non-empty catalog branch in the JSX**

Find this exact block (the non-empty branch of the `catalog.length === 0` ternary):

```tsx
            <>
              <h2 className="text-brand-parchment text-sm uppercase tracking-widest">
                Katalog Produk
              </h2>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                data-testid="product-grid"
              >
                {catalog.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantities[product.id] ?? 0}
                    onQuantityChange={handleQuantityChange}
                  />
                ))}
              </div>
            </>
```

Replace it with:

```tsx
<>
  {showTabs && (
    <div role="tablist" className="flex border-b border-[rgba(245,235,201,0.2)]">
      <button
        role="tab"
        data-testid="tab-mine"
        aria-selected={tab === 'mine'}
        onClick={() => setTab('mine')}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
          tab === 'mine'
            ? 'border-brand-crema text-brand-crema'
            : 'border-transparent text-brand-parchment opacity-60'
        }`}
      >
        Produk Saya
      </button>
      <button
        role="tab"
        data-testid="tab-other"
        aria-selected={tab === 'other'}
        onClick={() => setTab('other')}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
          tab === 'other'
            ? 'border-brand-crema text-brand-crema'
            : 'border-transparent text-brand-parchment opacity-60'
        }`}
      >
        Produk Lainnya
      </button>
    </div>
  )}
  {!showTabs && (
    <h2 className="text-brand-parchment text-sm uppercase tracking-widest">
      Katalog Produk
    </h2>
  )}
  <div
    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
    data-testid="product-grid"
  >
    {displayedProducts.map((product) => (
      <ProductCard
        key={product.id}
        product={product}
        quantity={quantities[product.id] ?? 0}
        onQuantityChange={handleQuantityChange}
      />
    ))}
  </div>
</>
```

- [ ] **Step 3: Verify TypeScript compiles (Task 4)**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/portal`. Verify:
- "Produk Saya" tab is active by default
- Client-assigned products visible
- Clicking "Produk Lainnya" shows global products
- Cart quantities survive tab switch (add a product, switch tabs, come back — qty still set)
- "Katalog Produk" heading absent when tabs are shown

Stop dev server (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add app/portal/_components/CatalogView.tsx
git commit -m "feat(portal): add Produk Saya / Produk Lainnya tabs to catalog"
```

---

## Task 5: Run full E2E suite and confirm

- [ ] **Step 1: Run the new tab tests**

```bash
npx playwright test --grep "Product list tabs" 2>&1 | tail -30
```

Expected: all 5 tests PASS.

- [ ] **Step 2: Run the full portal E2E suite**

```bash
npx playwright test e2e/tests/portal.spec.ts 2>&1 | tail -40
```

Expected: all existing tests still PASS. The existing "catalog loads" test still finds `product-grid` and `product-card-*` because "Produk Saya" is the default tab and the test client's assigned product is in that tab.

- [ ] **Step 3: Fix any failures, then commit final state**

If any test fails, fix the issue and re-run before committing.

```bash
git add -A
git commit -m "fix(portal): address E2E test failures after tab implementation"
```

Only run this step if there were failures to fix.
