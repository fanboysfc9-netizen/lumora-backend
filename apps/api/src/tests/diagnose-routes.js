// Diagnostic: inspect compiled routers and app route table without modifying source
const express = require('express')
const path = require('path')

function loadModule(p) {
  try {
    const m = require(p)
    return m && m.default ? m.default : m
  } catch (e) {
    console.error('Failed to load', p, e && e.message)
    return null
  }
}

function listRouterRoutes(router) {
  const out = []
  if (!router || !router.stack) return out
  for (const layer of router.stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase()
      out.push({ path: layer.route.path, methods })
    }
  }
  return out
}

function listAppRoutes(app) {
  const out = []
  const stack = app._router && app._router.stack ? app._router.stack : []
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase()
      out.push({ path: layer.route.path, methods })
    } else if (layer.name === 'router' && layer.regexp) {
      // Mounted router
      const mount = layer.regexp && layer.regexp.fast_slash ? '/' : (layer.regexp && layer.regexp.toString())
      out.push({ mount: mount, name: layer.name, keys: layer.keys ? layer.keys.map(k => k.name) : [] })
    }
  }
  return out
}

async function main() {
  const base = path.join(process.cwd(), 'dist', 'apps', 'api', 'src', 'routes')
  console.log('Diagnose base routes folder:', base)

  const chatPath = path.join(base, 'chat.route.js')
  const corePath = path.join(base, 'lumora-core.route.js')
  const adminPath = path.join(base, 'admin.route.js')

  const chat = loadModule(chatPath)
  const core = loadModule(corePath)
  const admin = loadModule(adminPath)

  console.log('\nEXPORT CHECK')
  console.log('chat export:', !!chat)
  console.log('lumora-core export:', !!core)
  console.log('admin export:', !!admin)

  console.log('\nROUTER STACKS')
  console.log('/api/chat ->', listRouterRoutes(chat))
  console.log('/api/lumora-core ->', listRouterRoutes(core))
  console.log('/api/admin ->', listRouterRoutes(admin))

  console.log('\nCOMPOSED APP ROUTES (mount simulation)')
  const app = express()
  if (chat) app.use('/api/chat', chat)
  if (core) app.use('/api/lumora-core', core)
  if (admin) app.use('/api/admin', admin)
  app.get('/', (_req, res) => res.send('ok'))
  app.get('/health', (_req, res) => res.send('ok'))

  const table = listAppRoutes(app)
  console.log('ROUTE TABLE')
  for (const r of table) console.log(r)

  // Also print detailed mounted router entries
  console.log('\nDETAILED MOUNTED ROUTERS:')
  const mounted = app._router.stack.filter(l => l && l.name === 'router')
  for (const m of mounted) {
    console.log('Layer regexp:', m.regexp && m.regexp.toString())
    const child = m.handle && m.handle.stack ? m.handle.stack : []
    for (const c of child) {
      if (c.route) {
        console.log('  route', Object.keys(c.route.methods).join(',').toUpperCase(), c.route.path)
      }
    }
  }
}

main().catch(e => { console.error('diagnose error', e); process.exit(2) })
