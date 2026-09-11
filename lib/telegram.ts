import { createClient } from '@/lib/supabase/server'
import { PICKUP_COURIER_CODE, FREE_COURIER_CODE, MANUAL_COURIER_CODE } from '@/lib/shipping'

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

// In-memory dedupe: max 1 alert per alertType per hour (per Next.js worker)
// Railway workers are single-threaded, so module-level Map is safe.
const alertDedupe = new Map<string, number>()
const ALERT_TTL_MS = 60 * 60 * 1000 // 1 hour

export type AlertType = 'order_create_failed' | 'telegram_notification_failed' | 'biteship_rates_failed'

function shouldSendAlert(alertType: AlertType): boolean {
  const now = Date.now()
  const lastSent = alertDedupe.get(alertType)
  if (lastSent && now - lastSent < ALERT_TTL_MS) {
    return false
  }
  alertDedupe.set(alertType, now)
  return true
}

export async function sendTelegramAlert(alertType: AlertType, detail: string): Promise<void> {
  if (!shouldSendAlert(alertType)) return

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const alertChatId = process.env.TELEGRAM_ALERT_CHAT_ID

  if (!botToken || !alertChatId) {
    console.warn('[Alert] TELEGRAM_BOT_TOKEN or TELEGRAM_ALERT_CHAT_ID not set — alert dropped')
    return
  }

  const alertEmoji: Record<AlertType, string> = {
    order_create_failed: '🚨',
    telegram_notification_failed: '⚠️',
    biteship_rates_failed: '📡',
  }
  const emoji = alertEmoji[alertType]
  const lines = [
    `${emoji} <b>Agroastery Alert</b>`,
    ``,
    `<b>Type:</b> ${alertType.replace(/_/g, ' ')}`,
    `<b>Time:</b> ${formatWIB(new Date())} WIB`,
    ``,
    `<b>Detail:</b> ${detail}`,
  ]

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: alertChatId, text: lines.join('\n'), parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      console.error(`[Alert] Telegram API error ${res.status} when sending alert: ${alertType}`)
    }
  } catch (err) {
    console.error(`[Alert] Failed to send alert ${alertType}:`, err)
  }
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

    // Shipping line — always show method, conditionally show cost
    if (shippingCourier === PICKUP_COURIER_CODE) {
      lines.push(`📦 <b>Ambil Sendiri</b>`)
    } else if (shippingCourier === FREE_COURIER_CODE) {
      lines.push(`🚚 <b>Pengiriman: Gratis</b>`)
    } else if (shippingCourier === MANUAL_COURIER_CODE) {
      lines.push(`🚚 <b>Pengiriman: Manual (admin)</b>`)
    } else if (shippingCourier && shippingCost != null) {
      lines.push(`🚚 <b>Ongkir: ${formatIDR(shippingCost)}</b> ${shippingService ? `(${escapeHtml(shippingCourier)} — ${escapeHtml(shippingService)})` : `(${escapeHtml(shippingCourier)})`}`)
    }

    // Total line
    lines.push(``)
    if (shippingCourier === PICKUP_COURIER_CODE || shippingCourier === FREE_COURIER_CODE) {
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount)}</b>`)
    } else if (shippingCourier === MANUAL_COURIER_CODE) {
      lines.push(`💰 <b>Subtotal: ${formatIDR(totalAmount)}</b>`)
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount)}</b> (ongkir belum dihitung)`)
    } else if (shippingCost != null) {
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount + shippingCost)}</b>`)
    } else {
      lines.push(`💰 <b>Total: ${formatIDR(totalAmount)}</b>`)
    }

    const message = lines.join('\n')

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const groupId = process.env.TELEGRAM_ORDER_GROUP_ID
    const threadId = process.env.TELEGRAM_PRODUCTION_THREAD_ID
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
            ...(threadId ? { message_thread_id: threadId } : {}),
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
