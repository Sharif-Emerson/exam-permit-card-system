import { spawn } from 'node:child_process'
import path from 'node:path'

const mode = process.argv[2] ?? 'dev'
const projectRoot = process.cwd()
const viteBinary = path.resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

const args = mode === 'build'
  ? ['build']
  : mode === 'preview'
    ? ['preview']
    : ['--host']

const child = spawn(process.execPath, [viteBinary, ...args], {
  cwd: projectRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VITE_BACKEND_PROVIDER: 'rest',
    ...(process.env.VITE_API_BASE_URL ? { VITE_API_BASE_URL: process.env.VITE_API_BASE_URL } : {}),
    ...(process.env.VITE_DEV_PROXY_TARGET ? { VITE_DEV_PROXY_TARGET: process.env.VITE_DEV_PROXY_TARGET } : {}),
  },
})

child.stdout?.on('data', (chunk) => {
  process.stdout.write(chunk)
})

child.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk)
})

child.on('error', (error) => {
  console.error(`Vite failed to start: ${error.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})