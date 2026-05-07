# Invoice Download Feature Design

**Date:** 2026-05-07  
**Status:** Approved

## Overview

Add a "Download Invoice" button to the order detail page (`/portal/orders/[id]`). Clicking it generates and downloads a PDF invoice matching the sample layout (INV-MELLY-060526.pdf). Agroastery branding data (logo, address, bank accounts) is hardcoded for now — future ops dashboard will manage it.

## Architecture

Three new files:

```
app/api/invoice/[id]/route.ts
  ← GET handler: auth check, data fetch, PDF render, return application/pdf

lib/invoice/document.tsx
  ← @react-pdf/renderer document component (InvoiceDocument)

app/portal/orders/[id]/_components/DownloadInvoiceButton.tsx
  ← 'use client' button with loading state, triggers fetch and download
```

### Request Flow

1. User clicks "Download Invoice" on `/portal/orders/[id]`
2. `DownloadInvoiceButton` sends `GET /api/invoice/{order-id}`
3. API route verifies Supabase session via `supabase.auth.getUser()`
4. Fetches order + items + client + default address in one Supabase query
5. Renders `InvoiceDocument` with `@react-pdf/renderer`
6. Returns PDF bytes as `application/pdf` response
7. Button receives blob → creates object URL → triggers `<a>` download as `INV-{order_number}.pdf`

## PDF Library

**`@react-pdf/renderer`** — server-side, purpose-built for structured documents, produces searchable PDF text, no browser dependency.

## Invoice Layout

Matches sample. Title: "ORDER" (not "Invoice").

```
[Agroastery Logo]                    ORDER

AGROASTERY              To: {recipient_name}    Order No. {order_number}
Jalan Kemang Barat No.7i    {address_line}      Date      {created_at WIB}
Jakarta Selatan             {postal_code}        Ref No.   (blank)
DKI Jakarta, Indonesia

┌────┬──────────────────────────┬─────┬───────────┬────────────┐
│ NO │ DESCRIPTION              │ QTY │ PRICE     │ AMOUNT     │
├────┼──────────────────────────┼─────┼───────────┼────────────┤
│  1 │ {product_name}           │  N  │ {price}   │ {subtotal} │
└────┴──────────────────────────┴─────┴───────────┴────────────┘

Total Qty  {sum}                         Sub Total  {total_amount}
                                         Shipping   {shipping_cost}  ← hidden if null
                                         Grand Total {total_amount + shipping_cost}

Payment via:
Account Name: MUHAMMAD ILHAM
BCA Bank Account Number: 0657237047
MANDIRI Bank Account Number: 1270009924133

Dicetak tanggal: {generated_at WIB}
```

**No SKU column.** No discount/tax/insurance rows (all 0 in this system).

### Logo

URL: `https://github.com/user-attachments/assets/79b22a6a-f341-40f6-ac74-27c6af123b7e`  
Fetched at render time by `@react-pdf/renderer`'s `Image` component.

### Hardcoded Agroastery Data

```typescript
const AGROASTERY = {
  name: 'AGROASTERY',
  address1: 'Jalan Kemang Barat No.7i',
  address2: 'Jakarta Selatan',
  address3: 'DKI Jakarta, Indonesia',
  bankAccountName: 'MUHAMMAD ILHAM',
  bcaAccount: '0657237047',
  mandiriAccount: '1270009924133',
  logoUrl: 'https://github.com/user-attachments/assets/79b22a6a-f341-40f6-ac74-27c6af123b7e',
}
```

## Data Fetching

Single Supabase query in the API route using the server client (anon key + RLS):

```typescript
const { data: order } = await supabase
  .from('orders')
  .select(`
    id, order_number, total_amount, shipping_cost, notes, created_at,
    order_items (product_name, unit_price, quantity, subtotal),
    clients!inner (
      name,
      addresses (recipient_name, address_line, postal_code, is_default)
    )
  `)
  .eq('id', id)
  .single()
```

After fetch: filter `clients.addresses` for `is_default === true`, fall back to `addresses[0]` if none marked default.

**Note:** If the three-table nested join (`orders → clients → addresses`) doesn't resolve cleanly via PostgREST, implementation falls back to two sequential queries:
1. Fetch order + order_items + `client_id`
2. Fetch `clients` + default `addresses` by `client_id`

## Security

- API route calls `supabase.auth.getUser()` — unauthenticated requests return 401
- RLS on `orders` table ensures clients only fetch their own orders — no explicit `client_id` filter needed
- Supabase server client uses anon key (not service role) so RLS applies

## Error Handling

| Scenario | Response |
|---|---|
| No session | 401 JSON |
| Order not found / RLS blocked | 404 JSON |
| PDF render failure | 500 JSON |
| Missing client address | 404 JSON ("Address not found") |

Button UI: shows loading spinner during fetch, re-enables on error, does not navigate away.

## Button Placement

Added to the Actions section at bottom of `/portal/orders/[id]/page.tsx`, between the two existing buttons ("Buat Pesanan Baru" and "← Riwayat Pesanan"). Styled to match existing secondary button (border variant).

## Out of Scope

- Ops dashboard for managing Agroastery branding data
- Invoice storage / sending via email or Telegram
- Discount, tax, insurance line items
- SKU column in items table
