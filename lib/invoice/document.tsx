import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const AGROASTERY = {
  name: 'AGROASTERY',
  address1: 'Jalan Kemang Barat No.7i',
  address2: 'Jakarta Selatan',
  address3: 'DKI Jakarta, Indonesia',
  bankAccountName: 'MUHAMMAD ILHAM',
  bcaAccount: '0657237047',
  mandiriAccount: '1270009924133',
  logoUrl: 'https://agroastery.com/assets/agroastery-logo.svg',
}

export type InvoiceData = {
  orderNumber: string
  orderDate: Date
  recipientName: string
  addressLine: string
  postalCode: string
  items: Array<{
    productName: string
    unitPrice: number
    quantity: number
    subtotal: number
  }>
  subtotal: number
  shippingCost: number | null
  generatedAt: Date
}

function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#000' },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  logo: { width: 44, height: 44 },
  orderTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },

  // Info section (sender | recipient | order meta)
  infoSection: {
    flexDirection: 'row',
    borderTop: '1px solid #000',
    paddingTop: 10,
    marginBottom: 16,
  },
  infoCol: { flex: 1, paddingRight: 10 },
  infoHeading: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 3 },
  infoText: { fontSize: 9, lineHeight: 1.5 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { fontFamily: 'Helvetica-Bold', width: 55, fontSize: 9 },
  metaValue: { fontSize: 9 },

  // Table
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #ddd',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  thText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
  tdText: { fontSize: 9 },
  colNo: { width: 22 },
  colDesc: { flex: 1 },
  colQty: { width: 30, textAlign: 'center' },
  colPrice: { width: 72, textAlign: 'right' },
  colAmount: { width: 78, textAlign: 'right' },
  totalQtyRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottom: '1px solid #ddd',
  },
  totalQtyLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, width: 60 },
  totalQtyVal: { fontSize: 9, marginLeft: 6 },

  // Totals
  totalsSection: { alignItems: 'flex-end', marginTop: 4, marginBottom: 16 },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: { width: 110, textAlign: 'right', paddingRight: 10, fontSize: 9 },
  totalLabelBold: {
    width: 110,
    textAlign: 'right',
    paddingRight: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalVal: { width: 90, textAlign: 'right', fontSize: 9 },
  totalValBold: {
    width: 90,
    textAlign: 'right',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },

  // Payment
  paymentSection: { borderTop: '1px solid #ccc', paddingTop: 10, marginBottom: 16 },
  paymentText: { fontSize: 9, lineHeight: 1.7 },

  // Footer
  footer: { marginTop: 24, fontSize: 8, color: '#666' },
})

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const grandTotal = data.subtotal + (data.shippingCost ?? 0)
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Logo + ORDER title */}
        <View style={s.headerRow}>
          <Image style={s.logo} src={AGROASTERY.logoUrl} />
          <Text style={s.orderTitle}>ORDER</Text>
        </View>

        {/* Sender | Recipient | Order meta */}
        <View style={s.infoSection}>
          <View style={s.infoCol}>
            <Text style={s.infoHeading}>{AGROASTERY.name}</Text>
            <Text style={s.infoText}>{AGROASTERY.address1}</Text>
            <Text style={s.infoText}>{AGROASTERY.address2}</Text>
            <Text style={s.infoText}>{AGROASTERY.address3}</Text>
          </View>

          <View style={s.infoCol}>
            <Text style={s.infoHeading}>To:  {data.recipientName}</Text>
            <Text style={s.infoText}>{data.addressLine}</Text>
            <Text style={s.infoText}>{data.postalCode}</Text>
          </View>

          <View style={s.infoCol}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Order No.</Text>
              <Text style={s.metaValue}>{data.orderNumber}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{formatDate(data.orderDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Ref No.</Text>
              <Text style={s.metaValue}></Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={s.tableHeaderRow}>
          <Text style={[s.thText, s.colNo]}>NO</Text>
          <Text style={[s.thText, s.colDesc]}>DESCRIPTION</Text>
          <Text style={[s.thText, s.colQty]}>QTY</Text>
          <Text style={[s.thText, s.colPrice]}>PRICE</Text>
          <Text style={[s.thText, s.colAmount]}>AMOUNT</Text>
        </View>

        {data.items.map((item, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tdText, s.colNo]}>{i + 1}</Text>
            <Text style={[s.tdText, s.colDesc]}>{item.productName}</Text>
            <Text style={[s.tdText, s.colQty]}>{item.quantity}</Text>
            <Text style={[s.tdText, s.colPrice]}>{formatIDR(item.unitPrice)}</Text>
            <Text style={[s.tdText, s.colAmount]}>{formatIDR(item.subtotal)}</Text>
          </View>
        ))}

        <View style={s.totalQtyRow}>
          <Text style={s.totalQtyLabel}>Total Qty</Text>
          <Text style={s.totalQtyVal}>{totalQty}</Text>
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Sub Total</Text>
            <Text style={s.totalVal}>{formatIDR(data.subtotal)}</Text>
          </View>
          {data.shippingCost != null && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Shipping Cost</Text>
              <Text style={s.totalVal}>{formatIDR(data.shippingCost)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabelBold}>Grand Total</Text>
            <Text style={s.totalValBold}>{formatIDR(grandTotal)}</Text>
          </View>
        </View>

        {/* Payment info */}
        <View style={s.paymentSection}>
          <Text style={s.paymentText}>Payment via:</Text>
          <Text style={s.paymentText}>
            Account Name: {AGROASTERY.bankAccountName}
          </Text>
          <Text style={s.paymentText}>
            BCA Bank Account Number: {AGROASTERY.bcaAccount}
          </Text>
          <Text style={s.paymentText}>
            MANDIRI Bank Account Number: {AGROASTERY.mandiriAccount}
          </Text>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          Dicetak tanggal : {formatDateTime(data.generatedAt)}
        </Text>
      </Page>
    </Document>
  )
}
