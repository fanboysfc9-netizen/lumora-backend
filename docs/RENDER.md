Render staging deployment — quick guide

1. Add these repository secrets in GitHub (Settings → Secrets → Actions):
   - `RENDER_API_KEY` — Render API key with deploy permissions.
   - `RENDER_SERVICE_ID` — the Render Service ID for your staging service.

2. How to trigger deployment
   - Push to the `staging` branch (the workflow will run and the `deploy-render` job will trigger a manual deploy on Render).
   - Or run the workflow manually via "Actions → CI → Run workflow" (workflow_dispatch).

3. Render service environment
   - In the Render dashboard for the staging service, set the runtime env vars required by the app (important):
     - `GROQ_API_KEY` — your Groq API key
     - Any other production secrets (Firebase credentials, etc.)

4. Notes
   - The CI job builds and runs unit tests only. The `deploy-render` job uses Render's HTTP API to create a deploy; Render will perform the actual build in its environment.
   - Keep the `GROQ_API_KEY` and other sensitive keys only in Render's service settings (not in the repo).

5. Troubleshooting
   - If the Render deploy step fails, check the `deploy-render` job logs (HTTP response printed). You can inspect the returned JSON for errors.
   - If you prefer Render to auto-deploy on push, connect the GitHub repo in the Render dashboard and create a staging branch trigger there instead of using the API trigger in CI.
