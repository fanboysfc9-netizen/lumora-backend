# Lumora Web

Next.js frontend for Lumora Cognita.

Dev commands:

```
cd apps/web
npm install
npm run dev
```

The frontend must be built with `NEXT_PUBLIC_API_URL` set to your backend chat endpoint (for example: `https://your-backend.example.com/api/chat`).
Set this variable at build time (for example in `.env.production`) so the static export will include the correct API URL.

Important: a production build that contains a `localhost` API URL will bake that URL into the static files and break the deployed site (the browser will attempt to call `http://localhost:4000` on end-user devices). To prevent this, a prebuild check is included.

Example `.env.production`:

```
NEXT_PUBLIC_API_URL=https://your-backend-url/api/chat
```

Build/Deploy steps (guaranteed-safe):

1. Set `NEXT_PUBLIC_API_URL` in your CI or environment to the live backend URL.
2. Run (from `apps/web`):

```bash
npm ci
npm run build
```

The build will fail early if `NEXT_PUBLIC_API_URL` is missing or set to `localhost` while building for production.
