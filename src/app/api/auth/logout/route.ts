import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'bloom_session'
const OAUTH_STATE_COOKIE = 'bloom_oauth_state'

function getCookieDomain(appUrl: string): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN || undefined
}

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const secure = appUrl.startsWith('https://')
  const cookieDomain = getCookieDomain(appUrl)
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value

  if (sessionToken) {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
      })
    } catch {
      // Best-effort revocation only; continue with cookie clearing.
    }
  }

  const response = NextResponse.json({ ok: true })

  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })

  return response
}
