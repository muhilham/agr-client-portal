# Pesan Ulang — Reorder from History Implementation Plan

> **For:** agr-client-portal issue #21
> **Delegate to:** subagent-driven-development skill

## Goal
Add "Pesan Ulang" (reorder) button on order detail and order list pages. Clicking prefills the catalog with quantities from that historical order, respecting current minQty/product availability, and flags discontinued items in a dismissible banner.

## Architecture
- Server-side: new API endpoint `/api/reorders/[orderId]` that fetches order items and returns them with current catalog availability flags
- Client-side: `CatalogView` accepts optional `reorderOrderId` prop; reads it on mount, fetches reorder data, pre-fills quantities; shows banner for unavailable items
- Navigation: `orders/[id]/page.tsx` adds "Pesan Ulang" link → `/portal?reorder=<orderId>`

## Files to Change
- `app/portal/page.tsx` — accept `?reorder=` search param, pass to CatalogView
- `app/portal/_components/CatalogView.tsx` — accept `reorderOrderId` prop, fetch reorder items on mount, prefill quantities
- `app/portal/orders/[id]/page.tsx` — add "Pesan Ulang" button
- `app/api/reorders/[orderId]/route.ts` — new endpoint
- `lib/orders/reorder.ts` — new lib function

---

## Task 1: New reorder API endpoint

**File:** `app/api/reorders/[orderId]/route.ts`

Fetches order items for a client-scoped order, joins with current catalog to mark availability.

```typescript
import { createClient } from '@/lib/supabase/server'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status !== 'active') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, fulfillment_method, shipping_address, client_id')
    .eq('id', orderId)
    .single()

  if (!order || order.client_id !== clientAccess.client.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_name, unit_price, quantity')
    .eq('order_id', orderId)

  return NextResponse.json({
    orderId,
    fulfillmentMethod: order.fulfillment_method,
    shippingAddress: order.shipping_address,
    items: orderItems ?? [],
  })
}
```

**File:** `lib/orders/reorder.ts` — type definitions and client util if needed.

---

## Task 2: Add "Pesan Ulang" button to order detail

**File:** `app/portal/orders/[id]/page.tsx`

Replace or add after the "Buat Pesanan Baru" button:

```tsx
<Link
  href={`/portal?reorder=${order.id}`}
  data-testid="reorder-button"
  className="w-full py-3.5 rounded-lg border border-brand-honey text-brand-honey
    font-semibold text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
    min-h-[44px] flex items-center justify-center"
>
  Pesan Ulang
</Link>
```

Also add to order list page (`app/portal/orders/page.tsx`) — each row gets a "Pesan Ulang" icon/link button.

---

## Task 3: CatalogView accepts reorderOrderId prop

**File:** `app/portal/_components/CatalogView.tsx`

Add `'use client'` top. Add prop:
```typescript
type Props = {
  client: Client
  catalog: CatalogProduct[]
  reorderOrderId?: string  // NEW
}
```

After mount, if `reorderOrderId` is set:
1. Fetch `/api/reorders/[reorderOrderId]`
2. For each returned item, find matching product in catalog (by `product_name` match — no product ID in order_items)
3. Set quantity for matched products that are still active and satisfy current `minQty`
4. Track unmatched items → show banner: "N produk tidak lagi tersedia"

```typescript
const [reorderUnavailableCount, setReorderUnavailableCount] = useState(0)

useEffect(() => {
  if (!reorderOrderId) return
  fetch(`/api/reorders/${reorderOrderId}`)
    .then(r => r.json())
    .then(data => {
      const catalogMap = new Map(catalog.map(p => [p.name.toLowerCase(), p]))
      const unavailable: string[] = []
      const newQuantities: Record<string, number> = {}
      for (const item of data.items) {
        const product = catalogMap.get(item.product_name.toLowerCase())
        if (product && item.quantity >= product.minQty) {
          newQuantities[product.id] = item.quantity
        } else {
          unavailable.push(item.product_name)
        }
      }
      setQuantities(newQuantities)
      setReorderUnavailableCount(unavailable.length)
    })
}, [reorderOrderId, catalog])
```

Add banner rendering in the JSX when `reorderUnavailableCount > 0`:
```tsx
{reorderUnavailableCount > 0 && (
  <div className="rounded-xl border border-brand-honey/50 bg-[rgba(245,235,201,0.06)] px-5 py-3 text-sm text-brand-parchment">
    {reorderUnavailableCount} produk tidak lagi tersedia dan tidak ditambahkan ke keranjang.
  </div>
)}
```

---

## Task 4: Portal page passes reorder param

**File:** `app/portal/page.tsx`

Read `searchParams.reorder` and pass to CatalogView:

```typescript
import { searchParamsType } from '@/types/next'

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ reorder?: string }> }) {
  const { reorder } = await searchParams
  // ... existing auth/catalog code ...
  return <CatalogView client={client} catalog={catalog} reorderOrderId={reorder} />
}
```

Add `reorderOrderId?: string` to Props type in CatalogView.

---

## Verification

1. Open order detail → click "Pesan Ulang" → should navigate to catalog with quantities prefilled
2. If some items from order no longer exist or are below minQty → banner shows count
3. Prices on review page reflect current catalog prices, not historical
4. Sticky cart appears immediately with prefilled items
5. Partial reorder (some items available, some not) → works correctly

## Risks

- Matching by `product_name` string is fragile if names change. Acceptable for v1 since product IDs aren't in order_items.
- No loading state for reorder fetch — quantities appear after mount. Acceptable for v1.
