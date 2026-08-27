# Lumora API

Run the backend API for Lumora Cognita.

Environment variables (.env):

- `GEMINI_API_KEY` — Google Gemini API key
 - `GEMINI_API_KEY` — Google Gemini API key
- `FIREBASE_PROJECT_ID` — Firebase project id (optional if using default credentials)
- `FIREBASE_CLIENT_EMAIL` — Firebase service account client email (optional)
- `FIREBASE_PRIVATE_KEY` — Firebase service account private key (optional; newlines must be escaped as `\\n`)
- `FRONTEND_URL` — production frontend origin for CORS, such as a Vercel deployment origin
- `ALLOWED_ORIGINS` — optional comma-separated list of additional trusted origins for CORS
- `SUPABASE_URL` — server-side Supabase project URL
- `SUPABASE_ANON_KEY` — server-side Supabase anon/publishable key used with the verified bearer token
- `PORT` — port to run the API (default 4000)

Dev commands:

```
cd apps/api
npm install
npm run dev
```

API endpoints:

- `POST /api/chat` — authenticated body: `{ message, conversationId? }` — sends message to Cognita
- `GET /api/chat/history?conversationId=...` — authenticated conversation history
- `GET /api/account` — authenticated account, subscription, entitlement, and usage state
- `GET /api/account/subscription` — authenticated subscription state
- `GET /api/account/entitlements` — authenticated effective entitlements
- `GET /api/account/usage` — authenticated current-period usage

Account and entitlement authority is stored in Supabase. The TypeScript API uses the verified Supabase bearer context; Firebase/in-memory persistence remains temporary for chat data only.
