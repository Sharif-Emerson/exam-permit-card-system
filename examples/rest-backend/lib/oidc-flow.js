import { Issuer, generators } from 'openid-client'

const pendingLogins = new Map()

function pruneStaleLogins() {
  const ttlMs = 15 * 60 * 1000
  const now = Date.now()
  for (const [state, entry] of pendingLogins.entries()) {
    if (now - entry.createdAt > ttlMs) {
      pendingLogins.delete(state)
    }
  }
}

export function isOidcConfigured() {
  return Boolean(
    process.env.OIDC_ISSUER?.trim()
      && process.env.OIDC_CLIENT_ID?.trim()
      && process.env.OIDC_CLIENT_SECRET?.trim()
      && process.env.OIDC_REDIRECT_URI?.trim()
      && process.env.FRONTEND_ORIGIN?.trim(),
  )
}

async function getClient() {
  const issuer = await Issuer.discover(process.env.OIDC_ISSUER.trim())
  return new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID,
    client_secret: process.env.OIDC_CLIENT_SECRET,
    redirect_uris: [process.env.OIDC_REDIRECT_URI.trim()],
    response_types: ['code'],
  })
}

export async function beginOidcLogin() {
  pruneStaleLogins()
  const client = await getClient()
  const code_verifier = generators.codeVerifier()
  const code_challenge = generators.codeChallenge(code_verifier)
  const state = generators.state()

  pendingLogins.set(state, {
    code_verifier,
    createdAt: Date.now(),
  })

  return client.authorizationUrl({
    scope: process.env.OIDC_SCOPE?.trim() || 'openid email profile',
    code_challenge,
    code_challenge_method: 'S256',
    state,
  })
}

export async function finishOidcLogin(callbackUrl) {
  pruneStaleLogins()
  const client = await getClient()
  const params = client.callbackParams(callbackUrl)
  const state = params.state
  const pending = pendingLogins.get(state)

  if (!pending) {
    throw new Error('Invalid or expired login state. Start sign-in again.')
  }

  pendingLogins.delete(state)

  const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI.trim(), params, {
    code_verifier: pending.code_verifier,
    state,
  })

  const claims = tokenSet.claims()
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase().trim() : ''

  if (!email) {
    throw new Error('The identity provider did not return an email. Check OIDC_SCOPE and IdP attribute mapping.')
  }

  return { email }
}
