function sanitizeReturnTo(returnTo?: string): string | undefined {
  if (!returnTo) return undefined
  if (!returnTo.startsWith('/')) return undefined
  if (returnTo.startsWith('//')) return undefined
  return returnTo
}

export function buildGitHubAuthPath(returnTo?: string): string {
  const safeReturnTo = sanitizeReturnTo(returnTo)
  if (!safeReturnTo) return '/api/auth/github'

  const params = new URLSearchParams({ redirect: safeReturnTo })
  return `/api/auth/github?${params.toString()}`
}

export function redirectToGitHubAuth(returnTo?: string): void {
  window.location.assign(buildGitHubAuthPath(returnTo))
}

export function buildLoginPath(returnTo?: string): string {
  const safeReturnTo = sanitizeReturnTo(returnTo)
  if (!safeReturnTo) return '/auth/login'

  const params = new URLSearchParams({ returnTo: safeReturnTo })
  return `/auth/login?${params.toString()}`
}

export function redirectToLogin(returnTo?: string): void {
  window.location.assign(buildLoginPath(returnTo))
}
