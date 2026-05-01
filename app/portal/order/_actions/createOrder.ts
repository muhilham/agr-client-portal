'use server'

import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createOrderInputSchema } from '@/lib/schemas/order'
import { loadShippingContext, findRateMatch } from '@/lib/shipping'
import { sendOrderNotification } from '@/lib/telegram'

export type CreateOrderResult =
  | { ok: true; id: string; order_number: string }
  | { ok: false; error: string }

export async function createOrder(input: unknown): Promise<CreateOrderResult> {
  const parsed = createOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Permintaan tidak valid' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthenticated')
  }

  const admin = getSupabaseAdmin()
  const { data: client } = await admin
    .from('clients')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!client) {
    throw new Error('Client not found')
  }

  const ctx = await loadShippingContext(client.id, parsed.data.items)

  if (!ctx.ok) {
    const messages: Record<string, string> = {
      NO_ADDRESS: 'Alamat pengiriman tidak ditemukan',
      INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
      ORIGIN_NOT_CONFIGURED: 'Pengiriman tidak tersedia, hubungi admin',
      RATES_UNAVAILABLE: 'Pengiriman tidak dapat dihitung',
    }
    return { ok: false, error: messages[ctx.error] ?? 'Terjadi kesalahan' }
  }

  const match = findRateMatch(
    ctx.rates,
    parsed.data.shippingSelection.courier_code,
    parsed.data.shippingSelection.service_code
  )

  if (!match) {
    return { ok: false, error: 'Kurir tidak lagi tersedia, silakan pilih ulang' }
  }

  const totalAmount = ctx.validatedItems.reduce((sum, i) => sum + i.subtotal, 0)

  let orderNumber: string
  try {
    const { data, error } = await supabase.rpc('generate_order_number')
    if (error) throw error
    if (typeof data !== 'string') throw new Error('generate_order_number returned non-string')
    orderNumber = data
  } catch (err) {
    console.error('[createOrder] Failed to generate order number:', err)
    return { ok: false, error: 'Terjadi kesalahan, silakan coba lagi' }
  }

  let order: { id: string; order_number: string }
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: client.id,
        fulfillment_status: 'PENDING',
        payment_status: 'UNPAID',
        notes: parsed.data.notes?.slice(0, 500) ?? null,
        total_amount: totalAmount,
        shipping_cost: match.price,
        shipping_courier: match.courier_code,
        shipping_service: match.courier_service_code,
        shipping_etd: match.duration,
      })
      .select('id, order_number')
      .single()

    if (error || !data) throw error ?? new Error('Failed to create order')
    order = data
  } catch (err) {
    console.error('[createOrder] Failed to insert order:', err)
    return { ok: false, error: 'Terjadi kesalahan, silakan coba lagi' }
  }

  try {
    const { error } = await supabase.from('order_items').insert(
      ctx.validatedItems.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.productName,
        unit_price: i.unitPrice,
        quantity: i.quantity,
        subtotal: i.subtotal,
      }))
    )
    if (error) throw error
  } catch (err) {
    console.error('[createOrder] Failed to insert order items:', err)
    return { ok: false, error: 'Terjadi kesalahan, silakan coba lagi' }
  }

  try {
    await sendOrderNotification({
      orderId: order.id,
      orderNumber: order.order_number,
      clientName: client.name,
      items: ctx.validatedItems.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      totalAmount,
      shippingCost: match.price,
      shippingCourier: match.courier_name,
      shippingService: match.courier_service_name,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('[Telegram] Notification failed:', err)
  }

  return { ok: true, id: order.id, order_number: order.order_number }
}
