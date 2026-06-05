let admin: any = null
let initialized = false

export function initFirebase() {
  // If we've already initialized in this process, return the existing firestore
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      initialized = true
      return admin.firestore()
    }
  } catch (e) {
    // ignore
  }
  if (initialized && admin) return admin.firestore()

  // lazy-load firebase-admin so the code doesn't crash when the package isn't installed
  try {
    // Use require to support both CJS and ESM environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    admin = require('firebase-admin')
  } catch (err) {
    console.warn('firebase-admin not installed; using in-memory fallback')
    return null
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY

  try {
    if (projectId && clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
      const serviceAccount = {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey
      } as any
      // If an app already exists, reuse it instead of initializing again
      if (!(admin.apps && admin.apps.length > 0)) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        })
      }
    } else {
      // fall back to default credentials (e.g., GCP environment)
      if (!(admin.apps && admin.apps.length > 0)) {
        admin.initializeApp()
      }
    }

    initialized = true
    return admin.firestore()
  } catch (err) {
    console.warn('Failed to initialize Firebase admin, falling back to in-memory store', err)
    return null
  }
}

export default initFirebase
