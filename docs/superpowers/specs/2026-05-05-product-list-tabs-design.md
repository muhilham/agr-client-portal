# Product List: Client-Assigned vs Global Tab Split

**Date:** 2026-05-05  
**Status:** Approved

## Goal

Help B2B clients find their regularly-ordered (client-assigned) products faster. Global products remain accessible but are secondary.

## Approach

Two mutually exclusive tabs on the catalog page:

| Tab | Label | Content |
|-----|-------|---------|
| Default | **Produk Saya** | Products from `client_products` table (`isClientAssigned: true`) |
| Secondary | **Produk Lainnya** | Pure global products not in `client_products` (`isClientAssigned: false`) |

No product appears in both tabs. Cart state persists across tab switches.

## Data Model

### `CatalogProduct` type (`lib/catalog.ts`)

Add one field:

```ts
isClientAssigned: boolean
```

- `true` — product came from the `client_products` table (custom price, custom min_qty, or exclusive non-global)
- `false` — product is global-only, not in `client_products` for this client

### `getCatalogForClient` logic

No new queries. Track provenance during the existing Map merge:

- Global products loop → `isClientAssigned: false`
- `client_products` loop → `isClientAssigned: true` (overwrites global entry if same product)

A global product with a `client_products` entry (e.g. custom pricing) → `isClientAssigned: true` → appears only in "Produk Saya".

## Component Changes

### `CatalogView.tsx`

**New state:**
```ts
const [tab, setTab] = useState<'mine' | 'other'>('mine')
```

**Tab visibility rules:**
- Both tabs visible only when `catalog` contains both `isClientAssigned: true` AND `isClientAssigned: false` products
- If all products are client-assigned → no tabs, flat grid (no "Produk Lainnya" to show)
- If no products are client-assigned → no tabs, flat grid (current behavior)

**Filtered views:**
```ts
const myProducts   = catalog.filter(p => p.isClientAssigned)
const otherProducts = catalog.filter(p => !p.isClientAssigned)
const displayedProducts = tab === 'mine' ? myProducts : otherProducts
```

**Tab bar UI:**
- Underline-style tabs matching existing brand tokens (`brand-crema`, `brand-parchment`)
- Active tab: full opacity, `border-bottom: 2px solid brand-crema`
- Inactive tab: 60% opacity, no underline
- Tab switching does not reset cart quantities

### `ProductCard.tsx`

No changes.

### `StickyCart.tsx`

No changes. Cart derives from `quantities` state in `CatalogView` — tab switching does not clear it.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No assigned products | Tabs hidden, flat grid of all global products |
| No global products | Tabs hidden, flat grid of all client-assigned products |
| Product in both global + client_products | Counted as `isClientAssigned: true`, appears only in "Produk Saya" |
| Cart item added in one tab, user switches tab | Quantity preserved; StickyCart still shows the item |
| Empty catalog (no products at all) | Existing empty state UI unchanged |

## Files Changed

| File | Change |
|------|--------|
| `lib/catalog.ts` | Add `isClientAssigned: boolean` to `CatalogProduct` type; set flag in `getCatalogForClient` |
| `app/portal/_components/CatalogView.tsx` | Add tab state, tab bar UI, filtered product list |

No DB migrations. No new server actions. No changes to `ProductCard`, `StickyCart`, or any order flow.
