import { spawn } from 'node:child_process'
import path from 'node:path'

const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const projectRoot = process.cwd()
const backendRoot = path.resolve(projectRoot, 'examples', 'rest-backend')
const children = []
let isShuttingDown = false

const backendPort = 4012
const frontendPort = 4173
const proxyTarget = `http://127.0.0.1:${backendPort}`
const relativeDbPath = path.join('data', 'e2e.sqlite')

function startChild(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk)
  })

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk)
  })

  child.on('error', (error) => {
    if (isShuttingDown) {
      return
    }

    isShuttingDown = true
    console.error(`[${label}] failed to start: ${error.message}`)
    shutdown()
    process.exit(1)
  })

  return child
}

function shutdown(signal = 'SIGTERM') {
  isShuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
}

const backendCommand = isWindows ? (process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe') : npmCommand
const backendResetArgs = isWindows
  ? ['/d', '/s', '/c', `${npmCommand} run reset-data`]
  : ['run', 'reset-data']
const backendStartArgs = isWindows
  ? ['/d', '/s', '/c', `${npmCommand} run start`]
  : ['run', 'start']

try {
  children.push(
    startChild('backend-reset', backendCommand, backendResetArgs, {
      cwd: backendRoot,
      env: {
        ...process.env,
        APP_DB_PATH: relativeDbPath,
      },
    }),
  )

  children[0].on('exit', (code) => {
    if (code !== 0) {
      shutdown('SIGTERM')
      process.exit(code ?? 1)
      return
    }

    children.push(
      startChild('backend', backendCommand, backendStartArgs, {
        cwd: backendRoot,
        env: {
          ...process.env,
          PORT: String(backendPort),
          APP_DB_PATH: relativeDbPath,
        },
      }),
    )

    children.push(
      startChild('frontend', process.execPath, [path.resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
        cwd: projectRoot,
        env: {
          ...process.env,
          VITE_BACKEND_PROVIDER: 'rest',
          VITE_API_BASE_URL: proxyTarget,
          VITE_DEV_PROXY_TARGET: proxyTarget,
        },
      }),
    )
  })
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup failure'
  console.error(message)
  shutdown()
  process.exit(1)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
