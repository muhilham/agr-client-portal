import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Agroastery — Client Portal',
  description: 'Platform pemesanan produk Agroastery',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} antialiased bg-brand-black text-brand-crema min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
