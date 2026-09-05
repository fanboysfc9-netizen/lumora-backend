import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="legal-page not-found-page">
      <div className="legal-shell">
        <p className="legal-kicker">Lumora Cognita</p>
        <h1>Page not found</h1>
        <p className="legal-lede">That address does not point to a workspace in Lumora Cognita.</p>
        <Link className="primary-button" href="/">Return to workspace</Link>
      </div>
    </main>
  )
}
