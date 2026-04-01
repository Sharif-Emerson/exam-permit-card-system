/**
 * Hot backup of the SQLite database used by this backend (SQLite backup API).
 * Prefer running when the API server is stopped; WAL mode can still allow consistent backup in many cases.
 *
 * Usage: node scripts/backup-sqlite.js [destination-path]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import './../lib/load-env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(backendRoot, 'data')
const defaultDbPath = path.join(dataDir, 'app.sqlite')
const configuredDbPath = process.env.APP_DB_PATH?.trim()
const srcPath = configuredDbPath
  ? path.resolve(backendRoot, configuredDbPath)
  : defaultDbPath

const argDest = process.argv[2]
const destPath = argDest
  ? path.resolve(argDest)
  : path.join(path.dirname(srcPath), `app-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`)

if (!fs.existsSync(srcPath)) {
  console.error(`Source database not found: ${srcPath}`)
  process.exit(1)
}

const src = new Database(srcPath, { readonly: true })

try {
  await src.backup(destPath)
} finally {
  src.close()
}

console.log(`Backup complete:\n  from: ${srcPath}\n  to:   ${destPath}`)
