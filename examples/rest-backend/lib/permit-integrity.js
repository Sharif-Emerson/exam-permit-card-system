import { createHmac, timingSafeEqual } from 'crypto'

function getSecret() {
  const raw = process.env.PERMIT_INTEGRITY_SECRET
  return typeof raw === 'string' && raw.trim().length >= 16 ? raw.trim() : ''
}

export function isPermitIntegrityEnabled() {
  return Boolean(getSecret())
}

/**
 * @param {{ permitToken: string, profileId: string, cleared: boolean, updatedAt: string }} permit
 */
export function signPermitPayload(permit) {
  const secret = getSecret()
  if (!secret) {
    return null
  }
  const clearedFlag = permit.cleared ? '1' : '0'
  const payload = [permit.permitToken, permit.profileId, clearedFlag, permit.updatedAt ?? ''].join('|')
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyPermitPayload(permit, providedSignature) {
  const expected = signPermitPayload(permit)
  if (!expected || typeof providedSignature !== 'string' || !/^[a-f0-9]{64}$/i.test(providedSignature)) {
    return false
  }
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(providedSignature, 'hex')
    if (a.length !== b.length) {
      return false
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
