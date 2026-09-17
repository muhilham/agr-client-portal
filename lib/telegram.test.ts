import { describe, it, expect } from 'vitest'
import { buildOrderNotificationMessage, type OrderNotificationPayload } from './telegram'
import { PICKUP_COURIER_CODE, FREE_COURIER_CODE, MANUAL_COURIER_CODE } from './shipping'

function basePayload(overrides: Partial<OrderNotificationPayload> = {}): OrderNotificationPayload {
  return {
    orderId: '11111111-1111-1111-1111-111111111111',
    orderNumber: 'ORD-20260917-001',
    clientName: 'Ganang Bortin Satinto',
    companyName: 'Kertas Kerja',
    items: [{ name: 'Full Robusta - Kertas Kerja', quantity: 5, unitPrice: 150000 }],
    totalAmount: 750000,
    createdAt: new Date('2026-09-17T08:00:00+07:00'),
    ...overrides,
  }
}

describe('buildOrderNotificationMessage — client line (cafe name)', () => {
  it('shows cafe name first with person name in parentheses', () => {
    const msg = buildOrderNotificationMessage(basePayload())
    expect(msg).toContain('👤 <b>Klien:</b> Kertas Kerja (Ganang Bortin Satinto)')
  })

  it('trims whitespace from company name', () => {
    const msg = buildOrderNotificationMessage(basePayload({ companyName: '  Kertas Kerja  ' }))
    expect(msg).toContain('Klien:</b> Kertas Kerja (Ganang')
  })

  it('falls back to person name when companyName is undefined', () => {
    const msg = buildOrderNotificationMessage(basePayload({ companyName: undefined }))
    expect(msg).toContain('👤 <b>Klien:</b> Ganang Bortin Satinto')
    expect(msg).not.toContain('(')
  })

  it('falls back to person name when companyName is empty or whitespace', () => {
    const msg = buildOrderNotificationMessage(basePayload({ companyName: '   ' }))
    expect(msg).toContain('👤 <b>Klien:</b> Ganang Bortin Satinto')
  })

  it("falls back to person name when companyName is '-' placeholder", () => {
    const msg = buildOrderNotificationMessage(basePayload({ companyName: '-' }))
    expect(msg).toContain('👤 <b>Klien:</b> Ganang Bortin Satinto')
    expect(msg).not.toContain('(-)')
  })

  it('falls back to person name when companyName equals clientName (e.g. Yoga/Yoga)', () => {
    const msg = buildOrderNotificationMessage(
      basePayload({ clientName: 'Yoga', companyName: 'Yoga' })
    )
    expect(msg).toContain('👤 <b>Klien:</b> Yoga')
    expect(msg).not.toContain('Yoga (Yoga)')
  })

  it('escapes HTML in both cafe and person name', () => {
    const msg = buildOrderNotificationMessage(
      basePayload({ clientName: 'A&B <admin>', companyName: 'Kopi & Co' })
    )
    expect(msg).toContain('Klien:</b> Kopi &amp; Co (A&amp;B &lt;admin&gt;)')
  })
})

describe('buildOrderNotificationMessage — regression guards', () => {
  it('includes order number in header', () => {
    const msg = buildOrderNotificationMessage(basePayload())
    expect(msg).toContain('Pesanan Baru — ORD-20260917-001')
  })

  it('formats items with quantity and unit price', () => {
    const msg = buildOrderNotificationMessage(basePayload())
    expect(msg).toContain('• Full Robusta - Kertas Kerja × 5 @ Rp 150.000')
  })

  it('shows computed total for paid courier with cost', () => {
    const msg = buildOrderNotificationMessage(
      basePayload({ shippingCourier: 'jne', shippingService: 'Regular', shippingCost: 45000 })
    )
    expect(msg).toContain('Ongkir: Rp 45.000</b> (jne — Regular)')
    expect(msg).toContain('Total: Rp 795.000')
  })

  it('shows manual-shipping note when courier is MANUAL', () => {
    const msg = buildOrderNotificationMessage(
      basePayload({ shippingCourier: MANUAL_COURIER_CODE })
    )
    expect(msg).toContain('Pengiriman: Manual (admin)')
    expect(msg).toContain('(ongkir belum dihitung)')
  })

  it('shows Ambil Sendiri for PICKUP and total without shipping', () => {
    const msg = buildOrderNotificationMessage(
      basePayload({ shippingCourier: PICKUP_COURIER_CODE, shippingCost: 0 })
    )
    expect(msg).toContain('Ambil Sendiri')
    expect(msg).toContain('Total: Rp 750.000')
  })

  it('shows Gratis for FREE courier', () => {
    const msg = buildOrderNotificationMessage(
      basePayload({ shippingCourier: FREE_COURIER_CODE, shippingCost: 0 })
    )
    expect(msg).toContain('Pengiriman: Gratis')
  })

  it('omits courier-code shipping line when courier is null (legacy orders)', () => {
    const msg = buildOrderNotificationMessage(basePayload({ shippingCourier: undefined }))
    expect(msg).not.toContain('Ongkir')
    expect(msg).toContain('Total: Rp 750.000')
  })
})
