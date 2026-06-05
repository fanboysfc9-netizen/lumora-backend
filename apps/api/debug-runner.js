const path = require('path')
// Load .env from this package explicitly to avoid cwd issues
require('dotenv').config({ path: path.join(__dirname, '.env') })

console.log('DEBUG RUNNER: CWD=', process.cwd())
console.log('DEBUG RUNNER: NODE_ENV=', process.env.NODE_ENV || 'undefined')
console.log('DEBUG RUNNER: GROQ_API_KEY present=', !!process.env.GROQ_API_KEY)
try {
  require('./dist/apps/api/src/index.js')
  console.log('DEBUG RUNNER: require(./dist/apps/api/src/index.js) succeeded — server should be running (if it logs).')
} catch (err) {
  console.error('DEBUG RUNNER: require failed:')
  console.error(err && (err.stack || err.message || err))
  process.exit(1)
}
