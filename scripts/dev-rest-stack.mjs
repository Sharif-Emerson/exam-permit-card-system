import { spawn } from 'node:child_process'
import path from 'node:path'

const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const projectRoot = process.cwd()
const backendRoot = path.resolve(projectRoot, 'examples', 'rest-backend')
const children = []
let isShuttingDown = false

function startChild(label, command, args, options) {
  let child

  try {
    child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown spawn failure'
    throw new Error(`[${label}] failed to start: ${message}`)
  }

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

const backendCommand = isWindows ? (process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe') : npmCommand
const backendArgs = isWindows
  ? ['/d', '/s', '/c', `${npmCommand} run dev`]
  : ['run', 'dev']

try {
  children.push(
    startChild('backend', backendCommand, backendArgs, {
      cwd: backendRoot,
      env: process.env,
    }),
  )

  children.push(
    startChild('frontend', process.execPath, [path.resolve(projectRoot, 'scripts', 'run-vite-rest.mjs'), 'dev'], {
      cwd: projectRoot,
      env: process.env,
    }),
  )
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup failure'
  console.error(message)
  shutdown()
  process.exit(1)
}

function shutdown(signal = 'SIGTERM') {
  isShuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      shutdown(signal ?? 'SIGTERM')
    }

    process.exit(code ?? 0)
  })
}