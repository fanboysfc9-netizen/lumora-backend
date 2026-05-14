# Lumora API

Run the backend API for Lumora Cognita.

Environment variables (.env):

- `GEMINI_API_KEY` — Google Gemini API key
 - `GEMINI_API_KEY` — Google Gemini API key
- `FIREBASE_PROJECT_ID` — Firebase project id (optional if using default credentials)
- `FIREBASE_CLIENT_EMAIL` — Firebase service account client email (optional)
- `FIREBASE_PRIVATE_KEY` — Firebase service account private key (optional; newlines must be escaped as `\\n`)
- `PORT` — port to run the API (default 4000)

Dev commands:

```
cd apps/api
npm install
npm run dev
```

API endpoints:

- `POST /api/chat` — body: `{ userId, message, conversationId? }` — sends message to Cognita
- `GET /api/chat/history?userId=...&conversationId=...` — fetch conversation history
