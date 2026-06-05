const path = require('path')
const fs = require('fs')
const express = require('express')

const base = path.resolve(__dirname, '..') // apps/api
const compiledRoutesDir = path.join(base, 'dist', 'apps', 'api', 'src', 'routes')
const indexFile = path.join(base, 'dist', 'apps', 'api', 'src', 'index.js')

console.log('Compiled routes dir:', compiledRoutesDir)

function safeRequire(file) {
  const full = path.resolve(file)
  if (!fs.existsSync(full)) {
    console.error('Missing file', full)
    return null
  }
  try {
    const mod = require(full)
    return mod && mod.__esModule && mod.default ? mod.default : mod
  } catch (e) {
    console.error('Require failed for', full, e && e.stack ? e.stack : e)
    return null
  }
}

const chatPath = path.join(compiledRoutesDir, 'chat.route.js')
const lumoraPath = path.join(compiledRoutesDir, 'lumora-core.route.js')

const chat = safeRequire(chatPath)
const lumora = safeRequire(lumoraPath)

console.log('\nEXPORT CHECK')
console.log('chat export:', chat ? 'FOUND' : 'MISSING')
console.log('lumora-core export:', lumora ? 'FOUND' : 'MISSING')

function listRouterRoutes(router) {
  if (!router) return []
  const routes = []
  const stack = router.stack || []
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase())
      routes.push({ path: layer.route.path, methods })
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      for (const inner of layer.handle.stack) {
        if (inner.route) {
          const methods = Object.keys(inner.route.methods || {}).map(m => m.toUpperCase())
          routes.push({ path: inner.route.path, methods })
        }
      }
    }
  }
  return routes
}

console.log('\nROUTER CONTENTS')
console.log('chat routes ->', listRouterRoutes(chat))
console.log('lumora-core routes ->', listRouterRoutes(lumora))

console.log('\nSIMULATED APP MOUNT')
const app = express()
if (chat) app.use('/api/chat', chat)
if (lumora) app.use('/api/lumora-core', lumora)

function listAppRoutes(a) {
  const out = []
  const stack = (a._router && a._router.stack) || []
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase())
      out.push({ path: layer.route.path, methods })
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const mountRegex = layer.regexp && layer.regexp.toString()
      for (const inner of layer.handle.stack) {
        if (inner.route) {
          const methods = Object.keys(inner.route.methods || {}).map(m => m.toUpperCase())
          out.push({ mount: mountRegex, path: inner.route.path, methods })
        }
      }
    }
  }
  return out
}

console.log('APP routes ->', listAppRoutes(app))

console.log('\nINDEX.JS MOUNT ORDER CHECK')
if (fs.existsSync(indexFile)) {
  const text = fs.readFileSync(indexFile, 'utf8')
  const uses = text.split('\n').filter(l => l.includes('app.use(')).map(l => l.trim())
  console.log('app.use() lines:')
  uses.forEach(l => console.log('  ', l))
  const posUseCore = text.indexOf("app.use('/api/lumora-core'")
  const posListen = text.indexOf('app.listen(')
  console.log('\nposUseCore:', posUseCore, 'posListen:', posListen)
  console.log('Mount before listen:', posUseCore >= 0 && posListen >= 0 && posUseCore < posListen)
} else {
  console.error('index.js not found at', indexFile)
}

console.log('\nDIAGNOSTIC COMPLETE')
