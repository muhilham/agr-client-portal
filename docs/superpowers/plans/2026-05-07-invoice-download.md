# Invoice Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download Invoice" button to the order detail page that generates and downloads a PDF invoice matching the Agroastery ORDER format.

**Architecture:** API route at `GET /api/invoice/[id]` fetches order data from Supabase using the session-aware client (RLS enforced), then renders a PDF via `@react-pdf/renderer`. A `'use client'` button component triggers the fetch and initiates the browser file download. Agroastery branding (logo URL, address, bank accounts) is hardcoded in the PDF document component.

**Tech Stack:** `@react-pdf/renderer`, Next.js App Router API route, Supabase server client (anon key + session), Playwright E2E tests

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/invoice/document.tsx` | `InvoiceDocument` React-PDF component + `InvoiceData` type |
| Create | `app/api/invoice/[id]/route.tsx` | GET handler: auth, data fetch, PDF render, response |
| Create | `app/portal/orders/[id]/_components/DownloadInvoiceButton.tsx` | `'use client'` button: loading state, fetch, blob download |
| Modify | `app/portal/orders/[id]/page.tsx` | Import and render `DownloadInvoiceButton` in Actions section |
| Modify | `e2e/tests/portal.spec.ts` | Add `Invoice download (CP-06)` test group |
| Modify | `package.json` | Add `@react-pdf/renderer` dependency |

---

### Task 1: Install @react-pdf/renderer

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install @react-pdf/renderer
```

`@react-pdf/renderer` ships its own TypeScript types — no `@types/` package needed.

- [ ] **Step 2: Verify TypeScript resolves the types**

```bash
npx tsc --noEmit
```

Expected: exits 0, no errors about `@react-pdf/renderer`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(config): add @react-pdf/renderer dependency"
```

---

### Task 2: Write failing E2E tests

**Files:**
- Modify: `e2e/tests/portal.spec.ts`

- [ ] **Step 1: Add invoice download test group**

Open `e2e/tests/portal.spec.ts`. Append after the closing `})` of the `Order detail (CP-05b)` describe block:

```typescript
test.describe('Invoice download (CP-06)', () => {
  test('download invoice button visible on order detail page', async ({ page }) => {
    test.skip(!createdOrderId, 'No test order created — run full suite')

    await page.goto(`/portal/orders/${createdOrderId}`)

    const button = page.getByTestId('download-invoice-button')
    await expect(button).toBeVisible()
    await expect(button).toContainText('Download Invoice')
    await expect(button).toBeEnabled()
  })

  test('clicking download invoice button triggers PDF download', async ({ page }) => {
    test.skip(!createdOrderId, 'No test order created — run full suite')

    await page.goto(`/portal/orders/${createdOrderId}`)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('download-invoice-button').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^INV-.*\.pdf$/)
    expect(download.suggestedFilename()).toContain(createdOrderNumber)
  })

  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('invoice API returns 401 without session', async ({ request }) => {
      const response = await request.get(
        '/api/invoice/00000000-0000-0000-0000-000000000000'
      )
      expect(response.status()).toBe(401)
    })
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npm run test:e2e -- --grep "Invoice download"
```

Expected: First two tests SKIP (no order yet in isolation), third test FAILS with 404 (route doesn't exist yet). If running full suite, first two also FAIL (button not found).

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/portal.spec.ts
git commit -m "test(portal): add failing E2E tests for invoice download"
```

---

### Task 3: Create InvoiceDocument PDF component

**Files:**
- Create: `lib/invoice/document.tsx`

- [ ] **Step 1: Create the file**

Create `lib/invoice/document.tsx`:

```tsx
import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const AGROASTERY = {
  name: 'AGROASTERY',
  address1: 'Jalan Kemang Barat No.7i',
  address2: 'Jakarta Selatan',
  address3: 'DKI Jakarta, Indonesia',
  bankAccountName: 'MUHAMMAD ILHAM',
  bcaAccount: '0657237047',
  mandiriAccount: '1270009924133',
  logoUrl:
    'https://github.com/user-attachments/assets/79b22a6a-f341-40f6-ac74-27c6af123b7e',
}

export type InvoiceData = {
  orderNumber: string
  orderDate: Date
  recipientName: string
  addressLine: string
  postalCode: string
  items: Array<{
    productName: string
    unitPrice: number
    quantity: number
    subtotal: number
  }>
  subtotal: number
  shippingCost: number | null
  generatedAt: Date
}

function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#000' },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  logo: { width: 44, height: 44 },
  orderTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },

  // Info section (sender | recipient | order meta)
  infoSection: {
    flexDirection: 'row',
    borderTop: '1px solid #000',
    paddingTop: 10,
    marginBottom: 16,
  },
  infoCol: { flex: 1, paddingRight: 10 },
  infoHeading: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 3 },
  infoText: { fontSize: 9, lineHeight: 1.5 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { fontFamily: 'Helvetica-Bold', width: 55, fontSize: 9 },
  metaValue: { fontSize: 9 },

  // Table
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #ddd',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  thText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
  tdText: { fontSize: 9 },
  colNo: { width: 22 },
  colDesc: { flex: 1 },
  colQty: { width: 30, textAlign: 'center' },
  colPrice: { width: 72, textAlign: 'right' },
  colAmount: { width: 78, textAlign: 'right' },
  totalQtyRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottom: '1px solid #ddd',
  },
  totalQtyLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, width: 60 },
  totalQtyVal: { fontSize: 9, marginLeft: 6 },

  // Totals
  totalsSection: { alignItems: 'flex-end', marginTop: 4, marginBottom: 16 },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: { width: 110, textAlign: 'right', paddingRight: 10, fontSize: 9 },
  totalLabelBold: {
    width: 110,
    textAlign: 'right',
    paddingRight: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalVal: { width: 90, textAlign: 'right', fontSize: 9 },
  totalValBold: {
    width: 90,
    textAlign: 'right',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },

  // Payment
  paymentSection: { borderTop: '1px solid #ccc', paddingTop: 10, marginBottom: 16 },
  paymentText: { fontSize: 9, lineHeight: 1.7 },

  // Footer
  footer: { marginTop: 24, fontSize: 8, color: '#666' },
})

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const grandTotal = data.subtotal + (data.shippingCost ?? 0)
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Logo + ORDER title */}
        <View style={s.headerRow}>
          <Image style={s.logo} src={AGROASTERY.logoUrl} />
          <Text style={s.orderTitle}>ORDER</Text>
        </View>

        {/* Sender | Recipient | Order meta */}
        <View style={s.infoSection}>
          <View style={s.infoCol}>
            <Text style={s.infoHeading}>{AGROASTERY.name}</Text>
            <Text style={s.infoText}>{AGROASTERY.address1}</Text>
            <Text style={s.infoText}>{AGROASTERY.address2}</Text>
            <Text style={s.infoText}>{AGROASTERY.address3}</Text>
          </View>

          <View style={s.infoCol}>
            <Text style={s.infoHeading}>To:  {data.recipientName}</Text>
            <Text style={s.infoText}>{data.addressLine}</Text>
            <Text style={s.infoText}>{data.postalCode}</Text>
          </View>

          <View style={s.infoCol}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Order No.</Text>
              <Text style={s.metaValue}>{data.orderNumber}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{formatDate(data.orderDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Ref No.</Text>
              <Text style={s.metaValue}></Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={s.tableHeaderRow}>
          <Text style={[s.thText, s.colNo]}>NO</Text>
          <Text style={[s.thText, s.colDesc]}>DESCRIPTION</Text>
          <Text style={[s.thText, s.colQty]}>QTY</Text>
          <Text style={[s.thText, s.colPrice]}>PRICE</Text>
          <Text style={[s.thText, s.colAmount]}>AMOUNT</Text>
        </View>

        {data.items.map((item, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tdText, s.colNo]}>{i + 1}</Text>
            <Text style={[s.tdText, s.colDesc]}>{item.productName}</Text>
            <Text style={[s.tdText, s.colQty]}>{item.quantity}</Text>
            <Text style={[s.tdText, s.colPrice]}>{formatIDR(item.unitPrice)}</Text>
            <Text style={[s.tdText, s.colAmount]}>{formatIDR(item.subtotal)}</Text>
          </View>
        ))}

        <View style={s.totalQtyRow}>
          <Text style={s.totalQtyLabel}>Total Qty</Text>
          <Text style={s.totalQtyVal}>{totalQty}</Text>
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Sub Total</Text>
            <Text style={s.totalVal}>{formatIDR(data.subtotal)}</Text>
          </View>
          {data.shippingCost != null && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Shipping Cost</Text>
              <Text style={s.totalVal}>{formatIDR(data.shippingCost)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabelBold}>Grand Total</Text>
            <Text style={s.totalValBold}>{formatIDR(grandTotal)}</Text>
          </View>
        </View>

        {/* Payment info */}
        <View style={s.paymentSection}>
          <Text style={s.paymentText}>Payment via:</Text>
          <Text style={s.paymentText}>
            Account Name: {AGROASTERY.bankAccountName}
          </Text>
          <Text style={s.paymentText}>
            BCA Bank Account Number: {AGROASTERY.bcaAccount}
          </Text>
          <Text style={s.paymentText}>
            MANDIRI Bank Account Number: {AGROASTERY.mandiriAccount}
          </Text>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          Dicetak tanggal : {formatDateTime(data.generatedAt)}
        </Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/invoice/document.tsx
git commit -m "feat(portal): add InvoiceDocument PDF component"
```

---

### Task 4: Create API route

**Files:**
- Create: `app/api/invoice/[id]/route.tsx`

The file is `.tsx` because `renderToBuffer(<InvoiceDocument ... />)` uses JSX.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "app/api/invoice/[id]"
```

- [ ] **Step 2: Create the route file**

Create `app/api/invoice/[id]/route.tsx`:

```tsx
import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument, type InvoiceData } from '@/lib/invoice/document'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, shipping_cost, created_at, order_items (product_name, unit_price, quantity, subtotal)'
    )
    .eq('id', id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select(
      'name, addresses (recipient_name, address_line, postal_code, is_default)'
    )
    .eq('email', user.email)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  type AddressRow = {
    recipient_name: string
    address_line: string
    postal_code: string
    is_default: boolean
  }

  const addresses = client.addresses as AddressRow[]
  const address = addresses.find((a) => a.is_default) ?? addresses[0]

  if (!address) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 })
  }

  const data: InvoiceData = {
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at),
    recipientName: address.recipient_name,
    addressLine: address.address_line,
    postalCode: address.postal_code,
    items: (order.order_items as Array<{
      product_name: string
      unit_price: number
      quantity: number
      subtotal: number
    }>).map((item) => ({
      productName: item.product_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotal: order.total_amount,
    shippingCost: order.shipping_cost ?? null,
    generatedAt: new Date(),
  }

  const buffer = await renderToBuffer(<InvoiceDocument data={data} />)

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="INV-${order.order_number}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add "app/api/invoice"
git commit -m "feat(portal): add invoice PDF generation API route"
```

---

### Task 5: Create DownloadInvoiceButton component

**Files:**
- Create: `app/portal/orders/[id]/_components/DownloadInvoiceButton.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "app/portal/orders/[id]/_components"
```

- [ ] **Step 2: Create the component file**

Create `app/portal/orders/[id]/_components/DownloadInvoiceButton.tsx`:

```tsx
'use client'

import { useState } from 'react'

type Props = {
  orderId: string
  orderNumber: string
}

export function DownloadInvoiceButton({ orderId, orderNumber }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoice/${orderId}`)
      if (!res.ok) throw new Error(`Invoice generation failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `INV-${orderNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[DownloadInvoiceButton]', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      data-testid="download-invoice-button"
      className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
        font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
        min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Membuat Invoice...' : 'Download Invoice'}
    </button>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add "app/portal/orders/[id]/_components/DownloadInvoiceButton.tsx"
git commit -m "feat(portal): add DownloadInvoiceButton client component"
```

---

### Task 6: Wire button into order detail page

**Files:**
- Modify: `app/portal/orders/[id]/page.tsx`

The Actions section currently at lines 165–184 has two `<Link>` buttons. Add `DownloadInvoiceButton` between them.

- [ ] **Step 1: Add import**

At the top of `app/portal/orders/[id]/page.tsx`, after the existing imports, add:

```typescript
import { DownloadInvoiceButton } from './_components/DownloadInvoiceButton'
```

- [ ] **Step 2: Replace the Actions section**

Find this block:

```tsx
        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/portal"
            data-testid="new-order-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors text-center min-h-[44px] flex items-center justify-center"
          >
            Buat Pesanan Baru
          </Link>
          <Link
            href="/portal/orders"
            data-testid="back-to-orders-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            ← Riwayat Pesanan
          </Link>
        </div>
```

Replace with:

```tsx
        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/portal"
            data-testid="new-order-button"
            className="w-full py-3.5 rounded-lg bg-brand-crema text-brand-black font-semibold text-base
              hover:bg-brand-honey transition-colors text-center min-h-[44px] flex items-center justify-center"
          >
            Buat Pesanan Baru
          </Link>
          <DownloadInvoiceButton orderId={order.id} orderNumber={order.order_number} />
          <Link
            href="/portal/orders"
            data-testid="back-to-orders-button"
            className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
              font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
              min-h-[44px] flex items-center justify-center"
          >
            ← Riwayat Pesanan
          </Link>
        </div>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors or warnings about missing props/types.

- [ ] **Step 4: Commit**

```bash
git add "app/portal/orders/[id]/page.tsx"
git commit -m "feat(portal): add download invoice button to order detail page"
```

---

### Task 7: Run E2E tests and verify pass

- [ ] **Step 1: Start dev server (separate terminal)**

```bash
npm run dev
```

- [ ] **Step 2: Run invoice E2E tests in isolation**

```bash
npm run test:e2e -- --grep "Invoice download"
```

Expected:
- `download invoice button visible` — PASS
- `clicking download invoice button triggers PDF download` — PASS
- `invoice API returns 401 without session` — PASS

- [ ] **Step 3: Run full suite for regressions**

```bash
npm run test:e2e
```

Expected: All existing tests continue to pass. No regressions.

- [ ] **Step 4: Troubleshooting guide**

**Download test fails — button not found:**
Check `app/portal/orders/[id]/page.tsx` renders `<DownloadInvoiceButton>` and that `data-testid="download-invoice-button"` is present in the component.

**Download test fails — no download event:**
Open browser DevTools Network tab. Click the button manually. Check `/api/invoice/{id}` returns `200 application/pdf`. If it returns an error, check server logs for the specific failure (auth, missing address, render error).

**401 test fails — gets 404 instead:**
The route file doesn't exist at `app/api/invoice/[id]/route.tsx`. Verify the directory name uses literal brackets: `[id]`, not `id`.

**TypeScript errors about `@react-pdf/renderer` JSX:**
Ensure the API route file is named `route.tsx` (not `route.ts`) so the TypeScript compiler enables JSX transforms.

**`renderToBuffer` fails at runtime:**
Check if `@react-pdf/renderer` version is compatible with React 19. If not, try `npm install @react-pdf/renderer@^3.4.0` with a React peer-dep override in `package.json`:
```json
"overrides": {
  "@react-pdf/renderer": { "react": "$react" }
}
```
