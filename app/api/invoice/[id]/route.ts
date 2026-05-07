import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type InvoiceData } from '@/lib/invoice/document'
import { renderInvoicePDF } from '@/lib/invoice/render'

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

  const addresses = (client.addresses as AddressRow[] | null) ?? []
  const address = addresses.find((a) => a.is_default) ?? addresses[0]

  if (!address) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 })
  }

  const items = (order.order_items as Array<{
    product_name: string
    unit_price: number
    quantity: number
    subtotal: number
  }> | null) ?? []

  if (items.length === 0) {
    return NextResponse.json({ error: 'No items' }, { status: 422 })
  }

  const data: InvoiceData = {
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at),
    recipientName: address.recipient_name,
    addressLine: address.address_line,
    postalCode: address.postal_code,
    items: items.map((item) => ({
      productName: item.product_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotal: order.total_amount,
    shippingCost: order.shipping_cost ?? null,
    generatedAt: new Date(),
  }

  const buffer = await renderInvoicePDF(data)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="INV-${order.order_number}.pdf"`,
    },
  })
}
