import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const backendRoot = path.resolve(__dirname, '..')

function parseResponseText(text) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForServer(url, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Keep retrying until the backend is ready.
    }

    await delay(250)
  }

  throw new Error(`Server did not become ready at ${url}`)
}

export async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options)
  const text = await response.text()
  const body = parseResponseText(text)

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${pathname} failed with ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }

  return body
}

export async function requestRaw(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options)
  const text = await response.text()

  return {
    status: response.status,
    body: parseResponseText(text),
    headers: response.headers,
  }
}

export async function cleanDbArtifacts(relativeDbPath) {
  const dbPath = path.join(backendRoot, relativeDbPath)
  await fs.rm(dbPath, { force: true })
  await fs.rm(`${dbPath}-shm`, { force: true })
  await fs.rm(`${dbPath}-wal`, { force: true })
}

export async function runReset(relativeDbPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/reset-data.js'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DISABLE_ENV_FILE_LOADING: '1',
        APP_DB_PATH: relativeDbPath,
      },
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      reject(new Error(`reset-data exited with code ${code ?? -1}`))
    })
    child.on('error', reject)
  })
}

export async function startIsolatedServer({ dbFile, port, extraEnv = {} }) {
  await cleanDbArtifacts(dbFile)
  await runReset(dbFile)

  const server = spawn(process.execPath, ['server.js'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DISABLE_ENV_FILE_LOADING: '1',
      PORT: String(port),
      APP_DB_PATH: dbFile,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  server.stdout.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr.on('data', (chunk) => process.stderr.write(chunk))

  const baseUrl = `http://127.0.0.1:${port}`
  await waitForServer(`${baseUrl}/health`)

  return {
    baseUrl,
    async stop() {
      await new Promise((resolve) => {
        server.once('exit', () => resolve(undefined))
        server.kill('SIGTERM')
      })
    },
  }
}