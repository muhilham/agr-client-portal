import { createClient } from '@/lib/supabase/server'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status !== 'active') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch the order — scoped to this client
  const { data: order } = await supabase
    .from('orders')
    .select('id, fulfillment_method, shipping_address, client_id')
    .eq('id', orderId)
    .single()

  if (!order || order.client_id !== clientAccess.client.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch order items — #90: product_id + variant snapshot let the portal
  // re-cart the exact size chips; pre-migration rows carry nulls and fall
  // back to product-level matching client-side.
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_id, product_name, unit_price, quantity, variant_id, variant_label')
    .eq('order_id', orderId)

  return NextResponse.json({
    orderId,
    fulfillmentMethod: order.fulfillment_method,
    shippingAddress: order.shipping_address,
    items: orderItems ?? [],
  })
}
