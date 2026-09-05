import './globals.css'
import React from 'react'

export const metadata = {
  title: 'Lumora Cognita',
  description: 'Adaptive AI learning tutor'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="site-main">{children}</main>
      </body>
    </html>
  )
}
