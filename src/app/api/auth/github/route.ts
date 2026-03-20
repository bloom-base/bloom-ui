import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// Disable caching - each auth request must generate fresh OAuth state
export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'bloom_oauth_state'

function sanitizeReturnTo(value: string | null): string {
  if (!value) return '/explore'
  if (!value.startsWith('/')) return '/explore'
  if (value.startsWith('//')) return '/explore'
  return value
}

function getCookieDomain(appUrl: string): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN || undefined
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/callback`
  const scope = 'read:user user:email repo admin:public_key'

  if (!clientId) {
    return NextResponse.redirect(new URL('/?error=missing_github_client_id', appUrl))
  }

  // Get the redirect destination from query params
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('redirect'))

  // Generate CSRF token and bind it to state
  const csrf = randomBytes(24).toString('hex')
  const state = Buffer.from(JSON.stringify({ csrf, returnTo })).toString('base64url')

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`
  const response = NextResponse.redirect(githubAuthUrl)
  const secure = appUrl.startsWith('https://')
  const cookieDomain = getCookieDomain(appUrl)

  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: csrf,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })

  return response
}
