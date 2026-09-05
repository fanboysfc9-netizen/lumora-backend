import './registerCoreAlias'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { getAllowedOrigins, isOriginAllowed } from './cors'

dotenv.config()
import chatRouter from './routes/chat.route'
import lumoraCoreRouter from './routes/lumora-core.route'
import adminRouter from './routes/admin.route'
import accountRouter from './routes/account.route'
import projectsRouter from './routes/projects.route'
import studyPlansRouter from './routes/study-plans.route'

// Fail fast if required env missing (do this before starting the server)
if (!process.env.GROQ_API_KEY) {
  console.error('FATAL: GROQ_API_KEY is not set. Set it in your environment or .env file.')
  process.exit(1)
}

const app = express()

const allowedOrigins = getAllowedOrigins()

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true)
      return
    }

    callback(new Error('CORS policy: origin not allowed'))
  },
  credentials: true
}))

app.use(express.json())

app.use('/api/chat', chatRouter)
app.use('/api/lumora-core', lumoraCoreRouter)
app.use('/api/admin', adminRouter)
app.use('/api/account', accountRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/study-plans', studyPlansRouter)

app.get('/', (_req, res) => res.json({ ok: true, service: 'Lumora Cognita Backend' }))
app.get('/health', (_req, res) => res.status(200).json({
  status: 'ok',
  service: 'Lumora Cognita Backend'
}))

const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || '0.0.0.0'

app.listen(Number(PORT), HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
