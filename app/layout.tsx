import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Darklight Chess Academy Dashboard',
  description: 'Branch operations dashboard for Darklight Chess Academy',
}

// Chrome-free on purpose: the sidebar/header live in app/(dashboard)/layout.tsx so that
// /login can render without them.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
