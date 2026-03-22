import fs from 'node:fs/promises'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/node'
import {
  createSession,
  getConfiguredDbPath,
  getPermitByToken,
  getProfileById,
  getSessionUser,
  getUploadsDir,
  getUserByEmail,
  getUserByStudentId,
  insertActivityLog,
  listActivityLogs,
  listProfiles,
  revokeSession,
  updateStudentAccount,
  updateProfileFinancials,
  verifyPassword,
} from './lib/database.js'

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
})

const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? '12')
const uploadsDir = getUploadsDir()
const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null

app.use(cors({
  origin(origin, callback) {
    if (!origin || !corsAllowedOrigins || corsAllowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin is not allowed by CORS.'))
  },
}))
app.use(express.json({ limit: '256kb' }))

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function isValidEmailAddress(value) {
  return typeof value === 'string' && value.length <= 254 && emailPattern.test(value)
}

function isValidProfileImage(value) {
  return typeof value === 'string'
    && value.length <= 300_000
    && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value))
}

function isValidCurrencyAmount(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1_000_000
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseNumber(value) {
  if (value == null || value === '') {
    return undefined
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(numericValue) ? numericValue : undefined
}

function mapRowsToFinancialImports(rows) {
  const [headerRow, ...dataRows] = rows

  if (!headerRow) {
    return []
  }

  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(String(cell ?? '')))

  return dataRows
    .map((row, index) => {
      const normalizedRow = normalizedHeaders.reduce((result, header, columnIndex) => {
        if (header) {
          result[header] = row[columnIndex] ?? ''
        }

        return result
      }, {})

      return {
        rowNumber: index + 2,
        studentId: normalizedRow.studentid ? String(normalizedRow.studentid).trim() : undefined,
        email: normalizedRow.email ? String(normalizedRow.email).trim() : undefined,
        userId: normalizedRow.id ? String(normalizedRow.id).trim() : normalizedRow.userid ? String(normalizedRow.userid).trim() : undefined,
        amountPaid: parseNumber(normalizedRow.amountpaid ?? normalizedRow.paid ?? normalizedRow.amount),
        totalFees: parseNumber(normalizedRow.totalfees ?? normalizedRow.fees ?? normalizedRow.total),
      }
    })
    .filter((row) => (row.studentId || row.email || row.userId) && (typeof row.amountPaid === 'number' || typeof row.totalFees === 'number'))
}

async function parseSpreadsheetRows(buffer, originalName) {
  const normalizedName = String(originalName ?? '').trim().toLowerCase()

  if (normalizedName.endsWith('.csv')) {
    const result = Papa.parse(buffer.toString('utf8'), {
      skipEmptyLines: true,
    })

    if (result.errors.length > 0) {
      throw new Error(result.errors[0]?.message || 'Unable to parse the uploaded CSV file.')
    }

    const rows = mapRowsToFinancialImports(result.data)

    if (rows.length > 500) {
      throw new Error('Spreadsheet import is limited to 500 rows per upload.')
    }

    return rows
  }

  if (normalizedName.endsWith('.xlsx')) {
    const rows = mapRowsToFinancialImports(await readXlsxFile(buffer))

    if (rows.length > 500) {
      throw new Error('Spreadsheet import is limited to 500 rows per upload.')
    }

    return rows
  }

  if (normalizedName.endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Save the file as .xlsx or .csv and try again.')
  }

  throw new Error('Unsupported file type. Upload a .xlsx or .csv file.')
}

function authenticate(request, response, next) {
  const authorization = request.header('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Missing bearer token.' })
    return
  }

  const token = authorization.slice('Bearer '.length)
  const user = getSessionUser(token)

  if (!user) {
    response.status(401).json({ message: 'Invalid or expired token.' })
    return
  }

  request.userId = user.id
  request.userRole = user.role
  request.user = user
  request.accessToken = token
  next()
}

function requireAdmin(request, response, next) {
  if (request.userRole !== 'admin') {
    response.status(403).json({ message: 'Administrator access is required.' })
    return
  }

  next()
}

function canAccessProfile(profile, request) {
  if (request.userRole === 'admin') {
    return true
  }

  return request.userId === profile.id
}

function resolveImportPreview(rows) {
  return rows.map((row) => {
    const matchedProfile = listProfiles('student').find((profile) => {
      return (row.userId && profile.id === row.userId)
        || (row.email && profile.email.toLowerCase() === row.email.toLowerCase())
        || (row.studentId && profile.student_id?.toLowerCase() === row.studentId.toLowerCase())
    })

    return {
      ...row,
      studentName: matchedProfile?.name,
      studentRecordId: matchedProfile?.id,
      status: matchedProfile ? 'ready' : 'skipped',
      reason: matchedProfile ? null : 'No matching student was found.',
    }
  })
}

app.get('/health', (_request, response) => {
  response.json({ ok: true, database: getConfiguredDbPath() })
})

app.get('/permits/:token', (request, response) => {
  const permit = getPermitByToken(request.params.token)

  if (!permit) {
    response.status(404).json({ message: 'Permit not found.' })
    return
  }

  response.json(permit)
})

app.post('/auth/login', (request, response) => {
  const identifier = typeof request.body?.identifier === 'string' ? request.body.identifier.trim() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''

  if (!identifier || password.length < 8 || password.length > 128) {
    response.status(400).json({ message: 'Email or registration number and password are required.' })
    return
  }

  const isEmail = isValidEmailAddress(identifier.toLowerCase())
  const user = isEmail
    ? getUserByEmail(identifier.toLowerCase())
    : getUserByStudentId(identifier)

  if (!user || !verifyPassword(password, user.password_hash)) {
    response.status(401).json({ message: 'Invalid login credentials.' })
    return
  }

  response.json({
    token: createSession(user.id, sessionTtlHours),
    expiresInHours: sessionTtlHours,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  })
})

app.post('/auth/logout', authenticate, (request, response) => {
  revokeSession(request.accessToken)
  response.status(204).send()
})

app.get('/auth/me', authenticate, (request, response) => {
  response.json({ user: request.user })
})

app.get('/profiles/:id', authenticate, (request, response) => {
  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  if (!canAccessProfile(profile, request)) {
    response.status(403).json({ message: 'You can only access your own profile.' })
    return
  }

  response.json(profile)
})

app.get('/profiles', authenticate, requireAdmin, (request, response) => {
  const { role } = request.query
  const result = typeof role === 'string'
    ? listProfiles(role)
    : listProfiles(undefined)
  response.json({ data: result })
})

app.patch('/profiles/:id/account', authenticate, (request, response) => {
  if (request.userId !== request.params.id) {
    response.status(403).json({ message: 'You can only update your own account.' })
    return
  }

  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  const name = typeof request.body.name === 'string' ? request.body.name.trim() : undefined
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : undefined
  const password = typeof request.body.password === 'string' ? request.body.password : undefined
  const profileImage = typeof request.body.profileImage === 'string'
    ? request.body.profileImage
    : request.body.profileImage === null
      ? null
      : undefined

  if (!name || name.length < 2 || name.length > 120) {
    response.status(400).json({ message: 'Name must be between 2 and 120 characters long.' })
    return
  }

  if (!isValidEmailAddress(email)) {
    response.status(400).json({ message: 'A valid email address is required.' })
    return
  }

  if (typeof password === 'string' && password.trim() && (password.trim().length < 8 || password.trim().length > 128)) {
    response.status(400).json({ message: 'Password must be between 8 and 128 characters long.' })
    return
  }

  if (typeof profileImage === 'string' && !isValidProfileImage(profileImage)) {
    response.status(400).json({ message: 'Profile image must be a valid image URL or data URL under 300 KB.' })
    return
  }

  try {
    const updatedProfile = updateStudentAccount(request.params.id, {
      name,
      email,
      password,
      profileImage,
    })

    if (!updatedProfile) {
      response.status(404).json({ message: 'Profile not found.' })
      return
    }

    response.json(updatedProfile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update account details.'
    const nextMessage = /unique/i.test(message)
      ? 'That email address is already in use.'
      : message

    response.status(400).json({ message: nextMessage })
  }
})

app.patch('/profiles/:id/financials', authenticate, requireAdmin, (request, response) => {
  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  const amountPaid = typeof request.body.amountPaid === 'number' ? request.body.amountPaid : undefined
  const totalFees = typeof request.body.totalFees === 'number' ? request.body.totalFees : undefined

  if (typeof amountPaid === 'undefined' && typeof totalFees === 'undefined') {
    response.status(400).json({ message: 'Provide amountPaid or totalFees to update financials.' })
    return
  }

  if ((typeof amountPaid !== 'undefined' && !isValidCurrencyAmount(amountPaid)) || (typeof totalFees !== 'undefined' && !isValidCurrencyAmount(totalFees))) {
    response.status(400).json({ message: 'Financial values must be valid non-negative amounts.' })
    return
  }

  const updatedProfile = updateProfileFinancials(
    request.params.id,
    amountPaid,
    totalFees,
  )

  if (!updatedProfile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.params.id,
    action: 'update_student_financials',
    details: {
      amountPaid: request.body.amountPaid,
      totalFees: request.body.totalFees,
    },
  })

  response.json(updatedProfile)
})

app.post('/admin-activity-logs', authenticate, requireAdmin, (request, response) => {
  insertActivityLog({
    adminId: request.body.admin_id ?? request.userId,
    targetProfileId: request.body.target_profile_id,
    action: request.body.action,
    details: request.body.details ?? {},
  })
  response.status(201).json({ ok: true })
})

app.post('/permit-activity', authenticate, (request, response) => {
  const { studentId, action } = request.body ?? {}

  if (request.userRole !== 'student') {
    response.status(403).json({ message: 'Only student accounts can record permit activity.' })
    return
  }

  if (studentId !== request.userId) {
    response.status(403).json({ message: 'You can only record activity for your own permit.' })
    return
  }

  if (action !== 'print_permit' && action !== 'download_permit') {
    response.status(400).json({ message: 'Unsupported permit activity.' })
    return
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action,
    details: {
      source: 'student-portal',
    },
  })

  response.status(201).json({ ok: true })
})

app.get('/admin-activity-logs', authenticate, requireAdmin, (_request, response) => {
  response.json({ data: listActivityLogs() })
})

app.post('/imports/financials/preview', authenticate, requireAdmin, upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file was uploaded.' })
    return
  }

  try {
    const rows = await parseSpreadsheetRows(request.file.buffer, request.file.originalname)
    response.json({ data: resolveImportPreview(rows) })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to parse the uploaded spreadsheet.' })
  }
})

app.post('/imports/financials/apply', authenticate, requireAdmin, upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file was uploaded.' })
    return
  }

  let rows

  try {
    rows = await parseSpreadsheetRows(request.file.buffer, request.file.originalname)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to parse the uploaded spreadsheet.' })
    return
  }

  const previewRows = resolveImportPreview(rows)
  const skippedRows = []
  let updatedCount = 0

  for (const row of previewRows) {
    if (row.status !== 'ready' || !row.studentRecordId) {
      skippedRows.push({ rowNumber: row.rowNumber, reason: row.reason ?? 'No matching student was found.' })
      continue
    }

    updateProfileFinancials(row.studentRecordId, row.amountPaid, row.totalFees)
    insertActivityLog({
      adminId: request.userId,
      targetProfileId: row.studentRecordId,
      action: 'bulk_import_student_financials',
      details: {
        rowNumber: row.rowNumber,
        amountPaid: row.amountPaid,
        totalFees: row.totalFees,
      },
    })

    updatedCount += 1
  }

  await fs.writeFile(path.join(uploadsDir, `${Date.now()}-${request.file.originalname}`), request.file.buffer)

  response.json({ updatedCount, skippedRows })
})

const port = Number(process.env.PORT ?? 4000)

app.use((error, _request, response) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({ message: 'Uploaded file is too large. Use a file under 2 MB.' })
      return
    }

    response.status(400).json({ message: error.message })
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ message: 'Invalid JSON body.' })
    return
  }

  console.error(error)
  response.status(500).json({ message: 'Internal server error.' })
})

app.listen(port, () => {
  console.log(`REST backend starter listening on http://localhost:${port}`)
})