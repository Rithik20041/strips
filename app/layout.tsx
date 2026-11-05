import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'STRIPS — Classical Planning & Action Model Learning',
  description: 'An interactive deep-dive into STRIPS-based classical planning: states, operators, search, and learning action models from observations.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="scanline">{children}</body>
    </html>
  )
}
