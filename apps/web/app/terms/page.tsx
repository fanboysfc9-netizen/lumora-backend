import Link from 'next/link'

export const metadata = {
  title: 'Terms & Conditions | Lumora Cognita',
  description: 'Preliminary terms for using Lumora Cognita.'
}

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link className="legal-back" href="/">Back to Lumora Cognita</Link>
        <p className="legal-kicker">Lumora Cognita</p>
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-lede">Preliminary terms for the current Lumora Cognita experience. This copy should be reviewed and replaced with finalized legal terms before public release.</p>
        <section className="legal-section">
          <h2>1. Using the service</h2>
          <p>Lumora Cognita provides an AI-assisted learning workspace. You are responsible for the way you use generated responses and for checking important information with appropriate sources.</p>
        </section>
        <section className="legal-section">
          <h2>2. Accounts and access</h2>
          <p>Keep your account credentials private and provide accurate information. We may suspend access when necessary to protect the service, its users, or the integrity of learning data.</p>
        </section>
        <section className="legal-section">
          <h2>3. Your content</h2>
          <p>You retain responsibility for messages, files, and other material you submit. Do not submit confidential information that you do not have permission to share.</p>
        </section>
        <section className="legal-section">
          <h2>4. Service limitations</h2>
          <p>AI responses can be incomplete or incorrect. The service is provided as a learning aid and is not a substitute for professional, legal, medical, or financial advice.</p>
        </section>
        <section className="legal-section">
          <h2>5. Changes and contact</h2>
          <p>These preliminary terms may change as the product and its policies develop. A finalized version should identify the applicable governing terms and a support contact before launch.</p>
        </section>
      </div>
    </main>
  )
}
