import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()
import chatRouter from './routes/chat.route'

// Fail fast if required env missing (do this before starting the server)
if (!process.env.GROQ_API_KEY) {
  console.error('FATAL: GROQ_API_KEY is not set. Set it in your environment or .env file.')
  process.exit(1)
}

const app = express()
// allow all origins for simplicity; adjust in production if you want to restrict
app.use(cors({ origin: '*' }))
app.use(express.json())

app.use('/api/chat', chatRouter)

app.get('/', (_req, res) => res.json({ ok: true, service: 'lumora-api' }))
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Lumora API listening on ${PORT}`)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})
