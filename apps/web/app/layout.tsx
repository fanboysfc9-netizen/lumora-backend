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
        <div className="site">
          <header className="site-header">
            <div className="brand-wrap">
              <div className="brand-strap">
                <span className="typewriter">Lumora Cognita — Thinking Into The Future</span>
              </div>
              <div className="brand-type muted">Adaptive AI learning tutor</div>
            </div>
            <div className="site-credit">Developed by Lumora Technologies</div>
          </header>

          <main className="site-main">{children}</main>

          <footer className="site-footer">© {new Date().getFullYear()} Lumora Technologies</footer>
        </div>
      </body>
    </html>
  )
}
