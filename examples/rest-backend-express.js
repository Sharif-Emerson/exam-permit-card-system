import express from 'express'

const app = express()
app.use(express.json())

const users = [
  { id: 'admin-1', email: 'admin@example.com', password: 'Permit@2026', role: 'admin', name: 'Administrator' },
  { id: 'admin-2', email: 'registrar@example.com', password: 'Permit@2026', role: 'admin', name: 'Registrar Office' },
]

const profiles = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Administrator',
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
  },
  {
    id: 'admin-2',
    email: 'registrar@example.com',
    role: 'admin',
    name: 'Registrar Office',
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
  },
]

const tokens = new Map()

function createToken(userId) {
  const token = `demo-token-${userId}`
  tokens.set(token, userId)
  return token
}

function authenticate(request, response, next) {
  const authorization = request.header('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Missing bearer token.' })
    return
  }

  const token = authorization.slice('Bearer '.length)
  const userId = tokens.get(token)

  if (!userId) {
    response.status(401).json({ message: 'Invalid token.' })
    return
  }

  request.userId = userId
  next()
}

app.post('/auth/login', (request, response) => {
  const { identifier, password } = request.body;
  // Accept login by email, phone, or registration number (student_id)
  const user = users.find((candidate) => {
    const profile = profiles.find((p) => p.id === candidate.id);
    return (
      (candidate.email === identifier ||
        (profile && profile.student_id === identifier) ||
        (profile && profile.phone === identifier)) &&
      candidate.password === password
    );
  });

  if (!user) {
    response.status(401).json({ message: 'Invalid login credentials.' });
    return;
  }

  response.json({
    token: createToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  });
});

app.post('/auth/logout', authenticate, (request, response) => {
  const authorization = request.header('Authorization')
  const token = authorization.slice('Bearer '.length)
  tokens.delete(token)
  response.status(204).send()
})

app.get('/auth/me', authenticate, (request, response) => {
  const user = users.find((candidate) => candidate.id === request.userId)
  response.json({ user })
})

app.get('/profiles/:id', authenticate, (request, response) => {
  const profile = profiles.find((candidate) => candidate.id === request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  response.json(profile)
})

app.get('/profiles', authenticate, (request, response) => {
  if (request.query.role === 'student') {
    response.json({ data: profiles.filter((profile) => profile.role === 'student') })
    return
  }

  response.json({ data: profiles })
})

app.patch('/profiles/:id/financials', authenticate, (request, response) => {
  const profile = profiles.find((candidate) => candidate.id === request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  if (typeof request.body.amountPaid === 'number') {
    profile.amount_paid = request.body.amountPaid
  }

  if (typeof request.body.totalFees === 'number') {
    profile.total_fees = request.body.totalFees
  }

  response.json(profile)
})

app.post('/admin-activity-logs', authenticate, (_request, response) => {
  response.status(201).json({ ok: true })
})

app.listen(4000, () => {
  console.log('REST backend example listening on http://localhost:4000')
})