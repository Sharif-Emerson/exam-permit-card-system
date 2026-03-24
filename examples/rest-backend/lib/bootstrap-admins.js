const defaultBootstrapAdmins = Object.freeze([
  {
    id: 'admin-1',
    email: 'admin@example.com',
    phone_number: '+256700100001',
    password: 'Permit@2026',
    role: 'admin',
    admin_scope: 'super-admin',
    name: 'Administrator',
    campus_id: 'main-campus',
    campus_name: 'Main Campus',
  },
  {
    id: 'admin-2',
    email: 'registrar@example.com',
    phone_number: '+256700100002',
    password: 'Permit@2026',
    role: 'admin',
    admin_scope: 'registrar',
    name: 'Registrar Office',
    campus_id: 'main-campus',
    campus_name: 'Main Campus',
  },
  {
    id: 'admin-3',
    email: 'finance@example.com',
    phone_number: '+256700100003',
    password: 'Permit@2026',
    role: 'admin',
    admin_scope: 'finance',
    name: 'Finance Office',
    campus_id: 'main-campus',
    campus_name: 'Main Campus',
  },
  {
    id: 'admin-4',
    email: 'operations@example.com',
    phone_number: '+256700100004',
    password: 'Permit@2026',
    role: 'admin',
    admin_scope: 'operations',
    name: 'Operations Office',
    campus_id: 'main-campus',
    campus_name: 'Main Campus',
  },
])

function readEnv(name) {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePhoneNumber(value) {
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return ''
  }

  const normalized = rawValue.replace(/[^\d+]/g, '')

  if (normalized.startsWith('+')) {
    return `+${normalized.slice(1).replace(/\D/g, '')}`
  }

  return normalized.replace(/\D/g, '')
}

function normalizeAdminScope(value) {
  return value === 'registrar' || value === 'finance' || value === 'operations' || value === 'super-admin'
    ? value
    : 'super-admin'
}

function getCustomBootstrapAdmins() {
  const email = readEnv('BOOTSTRAP_ADMIN_EMAIL').toLowerCase()
  const password = readEnv('BOOTSTRAP_ADMIN_PASSWORD')
  const name = readEnv('BOOTSTRAP_ADMIN_NAME')
  const phoneNumber = normalizePhoneNumber(readEnv('BOOTSTRAP_ADMIN_PHONE'))
  const scope = normalizeAdminScope(readEnv('BOOTSTRAP_ADMIN_SCOPE'))
  const hasCustomBootstrapConfig = Boolean(email || password || name || phoneNumber || readEnv('BOOTSTRAP_ADMIN_SCOPE'))

  if (!hasCustomBootstrapConfig) {
    return null
  }

  if (!email || !password) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must both be set when configuring a real bootstrap admin.')
  }

  return [
    {
      id: 'admin-1',
      email,
      phone_number: phoneNumber || null,
      password,
      role: 'admin',
      admin_scope: scope,
      name: name || 'System Administrator',
      campus_id: 'main-campus',
      campus_name: 'Main Campus',
    },
  ]
}

export function getBootstrapAdmins() {
  return getCustomBootstrapAdmins() ?? defaultBootstrapAdmins
}

export function getBootstrapProfiles() {
  return getBootstrapAdmins().map((admin) => ({
    id: admin.id,
    email: admin.email,
    phone_number: admin.phone_number,
    role: 'admin',
    name: admin.name,
    campus_id: admin.campus_id,
    campus_name: admin.campus_name,
    student_id: null,
    course: null,
    exam_date: null,
    exam_time: null,
    venue: null,
    seat_number: null,
    instructions: null,
    profile_image: null,
    total_fees: 0,
    amount_paid: 0,
    student_category: 'local',
    program: null,
    college: null,
    department: null,
    semester: null,
    course_units: [],
    exams: [],
  }))
}

export function isUsingCustomBootstrapAdmin() {
  return getBootstrapAdmins().length === 1 && getBootstrapAdmins()[0].email !== defaultBootstrapAdmins[0].email
}