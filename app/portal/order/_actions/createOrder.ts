'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveClientByEmail } from '@/lib/clients/active-client'
import { createOrderInputSchema } from '@/lib/schemas/order'
import {
  loadShippingContext,
  resolveDefaultAddress,
  findRateMatch,
  validateCartItems,
  getPickupLocation,
  PICKUP_COURIER_CODE,
  FREE_COURIER_CODE,
  MANUAL_COURIER_CODE,
  type ValidatedItem,
  type ShippingAddressSnapshot,
} from '@/lib/shipping'
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

  const client = await getActiveClientByEmail(user.email)
  if (!client) {
    return { ok: false, error: 'Akun Anda tidak aktif. Hubungi tim Agroastery.' }
  }

  let orderItems: ValidatedItem[]
  let dbShippingCost: number | null
  let dbShippingCourier: string | null
  let dbShippingService: string | null
  let dbShippingEtd: string | null
  let notifShippingCourier: string | undefined
  let notifShippingService: string | undefined
  let shippingAddress: ShippingAddressSnapshot | null = null

  if (parsed.data.fulfillmentMethod === 'PICKUP') {
    const itemsResult = await validateCartItems(client.id, parsed.data.items)
    if (!itemsResult.ok) {
      return { ok: false, error: 'Isi keranjang tidak valid, silakan kembali ke katalog' }
    }
    const location = await getPickupLocation()
    if (!location) {
      return { ok: false, error: 'Pengiriman tidak tersedia, hubungi admin' }
    }

    orderItems = itemsResult.validatedItems
    dbShippingCost = 0
    dbShippingCourier = PICKUP_COURIER_CODE
    dbShippingService = null
    dbShippingEtd = null
    notifShippingCourier = PICKUP_COURIER_CODE
    notifShippingService = undefined
  } else {
    // SHIPPING branch
    const shippingSelection = parsed.data.shippingSelection
    if (!shippingSelection) {
      return { ok: false, error: 'Metode pengiriman tidak dipilih' }
    }

    const SHIPPING_ERROR_MESSAGES: Record<string, string> = {
      NO_ADDRESS: 'Alamat pengiriman tidak ditemukan',
      INVALID_CART: 'Isi keranjang tidak valid, silakan kembali ke katalog',
      ORIGIN_NOT_CONFIGURED: 'Pengiriman tidak tersedia, hubungi admin',
      RATES_UNAVAILABLE: 'Pengiriman tidak dapat dihitung',
    }

    if (shippingSelection.mode === 'free') {
      const ctx = await loadShippingContext(client.id, parsed.data.items)
      if (!ctx.ok) {
        return { ok: false, error: SHIPPING_ERROR_MESSAGES[ctx.error] ?? 'Terjadi kesalahan' }
      }
      if (ctx.kind !== 'free_shipping') {
        return { ok: false, error: 'Tidak dapat menggunakan pengiriman gratis' }
      }

      const itemsResult = await validateCartItems(client.id, parsed.data.items)
      if (!itemsResult.ok) {
        return { ok: false, error: SHIPPING_ERROR_MESSAGES['INVALID_CART'] }
      }
      orderItems = itemsResult.validatedItems
      dbShippingCost = 0
      dbShippingCourier = FREE_COURIER_CODE
      dbShippingService = null
      dbShippingEtd = null
      notifShippingCourier = 'Gratis'
      notifShippingService = undefined
      shippingAddress = ctx.address

    } else if (shippingSelection.mode === 'manual') {
      const itemsResult = await validateCartItems(client.id, parsed.data.items)
      if (!itemsResult.ok) {
        return { ok: false, error: SHIPPING_ERROR_MESSAGES['INVALID_CART'] }
      }
      orderItems = itemsResult.validatedItems
      dbShippingCost = null
      dbShippingCourier = MANUAL_COURIER_CODE
      dbShippingService = null
      dbShippingEtd = null
      notifShippingCourier = 'Manual (admin)'
      notifShippingService = undefined
      shippingAddress = await resolveDefaultAddress(client.id)

    } else {
      // biteship (discriminated union guarantees this is the only remaining mode)
      if (shippingSelection.mode !== 'biteship') {
        return { ok: false, error: 'Metode pengiriman tidak valid' }
      }
      const ctx = await loadShippingContext(client.id, parsed.data.items)
      if (!ctx.ok) {
        return { ok: false, error: SHIPPING_ERROR_MESSAGES[ctx.error] ?? 'Terjadi kesalahan' }
      }
      if (ctx.kind !== 'rates') {
        return { ok: false, error: 'Tidak dapat menghitung ongkir' }
      }

      const match = findRateMatch(
        ctx.rates,
        shippingSelection.courier_code,
        shippingSelection.service_code
      )
      if (!match) {
        return { ok: false, error: 'Kurir tidak lagi tersedia, silakan pilih ulang' }
      }

      orderItems = ctx.validatedItems
      dbShippingCost = match.price
      dbShippingCourier = match.courier_code
      dbShippingService = match.courier_service_code
      dbShippingEtd = match.duration
      notifShippingCourier = match.courier_name
      notifShippingService = match.courier_service_name
      shippingAddress = ctx.address
    }
  }

  const totalAmount = orderItems.reduce((sum, i) => sum + i.subtotal, 0)

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
        shipping_cost: dbShippingCost,
        shipping_courier: dbShippingCourier,
        shipping_service: dbShippingService,
        shipping_etd: dbShippingEtd,
        shipping_address: shippingAddress,
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
      orderItems.map((i) => ({
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
      items: orderItems.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      totalAmount,
      shippingCost: dbShippingCost ?? undefined,
      shippingCourier: notifShippingCourier,
      shippingService: notifShippingService,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('[Telegram] Notification failed:', err)
  }

  return { ok: true, id: order.id, order_number: order.order_number }
}
