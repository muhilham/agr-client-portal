import { createClient } from '@/lib/supabase/server'
import { PICKUP_COURIER_CODE } from '@/lib/shipping'

type NotificationItem = {
  name: string
  quantity: number
  unitPrice: number
}

type OrderNotificationPayload = {
  orderId: string
  orderNumber: string
  clientName: string
  items: NotificationItem[]
  totalAmount: number
  shippingCost?: number
  shippingCourier?: string
  shippingService?: string
  createdAt: Date
}

function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatWIB(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendOrderNotification(payload: OrderNotificationPayload): Promise<void> {
  try {
    const { orderId, orderNumber, clientName, items, totalAmount, shippingCost, shippingCourier, shippingService, createdAt } = payload

    const itemLines = items
      .map((i) => `  • ${escapeHtml(i.name)} × ${i.quantity} @ ${formatIDR(i.unitPrice)}`)
      .join('\n')

    const lines = [
      `🛒 <b>Pesanan Baru — ${escapeHtml(orderNumber)}</b>`,
      ``,
      `👤 <b>Klien:</b> ${escapeHtml(clientName)}`,
      `📅 <b>Waktu:</b> ${formatWIB(createdAt)} WIB`,
      ``,
      `<b>Item:</b>`,
      itemLines,
      ``,
      `💰 <b>Subtotal: ${formatIDR(totalAmount)}</b>`,
    ]

    if (shippingCost != null) {
      if (shippingCourier === PICKUP_COURIER_CODE) {
        lines.push(`📦 <b>Ambil Sendiri</b>`)
      } else {
        lines.push(`🚚 <b>Ongkir: ${formatIDR(shippingCost)}</b> ${shippingCourier && shippingService ? `(${escapeHtml(shippingCourier)} — ${escapeHtml(shippingService)})` : ''}`)
      }
      lines.push(``)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount + shippingCost)}</b>`)
    } else {
      lines.push(``)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount)}</b>`)
    }

    const message = lines.join('\n')

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const groupId = process.env.TELEGRAM_ORDER_GROUP_ID
    const supabase = await createClient()

    if (!botToken || !groupId) {
      console.warn('[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ORDER_GROUP_ID')
      try {
        await supabase.from('notification_logs').insert({
          order_id: orderId,
          order_number: orderNumber,
          channel: 'telegram',
          status: 'failed',
          error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ORDER_GROUP_ID',
        })
      } catch (logErr) {
        console.error('[Telegram] Failed to log missing config:', logErr)
      }
      return
    }

    let status: 'sent' | 'failed' = 'sent'
    let error: string | null = null

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: groupId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      )

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Telegram API error ${res.status}: ${body}`)
      }
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
      console.error('[Telegram] Notification failed:', err)
    } finally {
      try {
        await supabase.from('notification_logs').insert({
          order_id: orderId,
          order_number: orderNumber,
          channel: 'telegram',
          status,
          error,
        })
      } catch (logErr) {
        console.error('[Telegram] Failed to log notification:', logErr)
      }
    }
  } catch (err) {
    console.error('[Telegram] Unexpected error in sendOrderNotification:', err)
  }
}
