import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoiceDocument, type InvoiceData } from './document'

export async function renderInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />)
}
