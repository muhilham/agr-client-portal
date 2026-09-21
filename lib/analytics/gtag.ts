'use client'

import { sendGAEvent } from '@next/third-parties/google'

/**
 * Single source of truth for GA4 event sending in the client portal.
 * Mirrors the pattern used in agroastery-web (lib/analytics/gtag.ts, PR #137).
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (params) {
    sendGAEvent(eventName, params)
  } else {
    sendGAEvent(eventName)
  }
}

/** Fired when a reorder from a WhatsApp stock reminder successfully prefills the cart. */
export function trackReorderFromReminder(payload: {
  orderId: string
  itemsAdded: number
  itemsUnavailable: number
}): void {
  trackEvent('reorder_from_reminder', {
    order_id: payload.orderId,
    items_added: payload.itemsAdded,
    items_unavailable: payload.itemsUnavailable,
  })
}
