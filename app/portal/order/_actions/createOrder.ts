'use server'

import { createClient } from '@/lib/supabase/server'
import { getCatalogForClient } from '@/lib/catalog'
import { sendOrderNotification } from '@/lib/telegram'

type OrderItem = {
  productId: string
  quantity: number
}

type CreateOrderPayload = {
  items: OrderItem[]
  notes?: string
}

type CreatedOrder = {
  id: string
  order_number: string
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreatedOrder> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) throw new Error('Unauthenticated')

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (clientErr || !client) throw new Error('Client not found')

  // Re-validate prices server-side — never trust client
  const catalog = await getCatalogForClient(client.id)
  const catalogMap = new Map(catalog.map((p) => [p.id, p]))

  const validatedItems = payload.items.map((item) => {
    const product = catalogMap.get(item.productId)
    if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`)
    if (item.quantity < product.minQty) {
      throw new Error(`Jumlah minimum untuk ${product.name} adalah ${product.minQty}`)
    }
    return {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      unitPrice: product.effectivePrice,
      quantity: item.quantity,
      subtotal: product.effectivePrice * item.quantity,
    }
  })

  const totalAmount = validatedItems.reduce((sum, i) => sum + i.subtotal, 0)

  // Generate order number via DB function
  const { data: orderNumberData, error: orderNumberErr } = await supabase.rpc(
    'generate_order_number'
  )
  if (orderNumberErr) throw orderNumberErr

  const orderNumber = orderNumberData as string

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      client_id: client.id,
      status: 'PENDING',
      notes: payload.notes ?? null,
      total_amount: totalAmount,
    })
    .select('id, order_number')
    .single()

  if (orderErr || !order) throw orderErr ?? new Error('Failed to create order')

  // Insert order items
  const { error: itemsErr } = await supabase.from('order_items').insert(
    validatedItems.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.productName,
      unit_price: i.unitPrice,
      quantity: i.quantity,
      subtotal: i.subtotal,
    }))
  )

  if (itemsErr) throw itemsErr

  // Send Telegram notification (non-blocking)
  try {
    await sendOrderNotification({
      orderId: order.id,
      orderNumber: order.order_number,
      clientName: client.name,
      items: validatedItems.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      totalAmount,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('[Telegram] Notification failed:', err)
  }

  return order
}
