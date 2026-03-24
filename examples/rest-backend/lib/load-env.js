import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')

function parseEnvFile(content) {
  const entries = []

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    entries.push([key, value])
  }

  return entries
}

if (process.env.DISABLE_ENV_FILE_LOADING !== '1') {
  for (const fileName of ['.env', '.env.local']) {
    const envFilePath = path.join(backendRoot, fileName)

    if (!fs.existsSync(envFilePath)) {
      continue
    }
    const fileContent = fs.readFileSync(envFilePath, 'utf8')

    for (const [key, value] of parseEnvFile(fileContent)) {
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}