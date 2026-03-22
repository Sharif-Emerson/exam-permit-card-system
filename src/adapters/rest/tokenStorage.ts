const tokenStorageKey = 'exam-permit-auth-token'

export function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(tokenStorageKey)
}

export function setStoredAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(tokenStorageKey, token)
}

export function clearStoredAuthToken() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(tokenStorageKey)
}