'use client'

import { useState } from 'react'

type Props = {
  orderId: string
  orderNumber: string
}

export function DownloadInvoiceButton({ orderId, orderNumber }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoice/${orderId}`)
      if (!res.ok) throw new Error(`Invoice generation failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `INV-${orderNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[DownloadInvoiceButton]', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      data-testid="download-invoice-button"
      className="w-full py-3.5 rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-crema
        font-medium text-base text-center hover:bg-[rgba(245,235,201,0.06)] transition-colors
        min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Membuat Invoice...' : 'Download Invoice'}
    </button>
  )
}
