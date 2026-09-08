// Agroastery bank accounts and WhatsApp contact for manual transfer payments.
// When a real WhatsApp business number or payment coordinator is set, update here.

export const AGROASTERY_WA_NUMBER = process.env.NEXT_PUBLIC_AGROASTERY_WA ?? '628979092726'

export const BANK_ACCOUNTS = [
  { bank: 'Bank BCA', account: '0657237047', a_n: 'Muhammad Ilham' },
  { bank: 'Bank Mandiri', account: '1270009924133', a_n: 'Muhammad Ilham' },
] as const

export function formatIDR(amount: number): string {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function buildSayaSudahBayarMessage(opts: {
  orderNumber: string
  recipientName?: string
  grandTotal: number
}): string {
  const parts = [
    `Hi Agroastery, saya sudah transfer untuk pesanan ${opts.orderNumber}.`,
  ]
  if (opts.recipientName) {
    parts.push(`Atas nama ${opts.recipientName}.`)
  }
  parts.push(`Total ${formatIDR(opts.grandTotal)}.`)
  parts.push('Mohon dicek dan diproses. Terima kasih!')
  return encodeURIComponent(parts.join(' '))
}

export function getWhatsAppUrl(opts: {
  orderNumber: string
  recipientName?: string
  grandTotal: number
}): string {
  const text = buildSayaSudahBayarMessage(opts)
  return `https://wa.me/${AGROASTERY_WA_NUMBER}?text=${text}`
}
