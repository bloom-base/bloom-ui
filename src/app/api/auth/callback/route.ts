import { NextRequest, NextResponse } from 'next/server'

// Disable caching - each auth callback must be processed fresh
export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'bloom_oauth_state'
const SESSION_COOKIE = 'bloom_session'

function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/explore'
  if (!value.startsWith('/')) return '/explore'
  if (value.startsWith('//')) return '/explore'
  return value
}

function getCookieDomain(appUrl: string): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN || undefined
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

  // Use configured app URL to avoid Docker internal hostname issues
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const secure = appUrl.startsWith('https://')
  const cookieDomain = getCookieDomain(appUrl)

  // Decode and verify OAuth state
  let returnTo = '/explore'
  const expectedCsrf = request.cookies.get(OAUTH_STATE_COOKIE)?.value
  if (!state || !expectedCsrf) {
    return NextResponse.redirect(new URL('/?error=invalid_oauth_state', appUrl))
  }

  let decodedState: { csrf?: string; returnTo?: string } = {}
  try {
    decodedState = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    return NextResponse.redirect(new URL('/?error=invalid_oauth_state', appUrl))
  }

  if (!decodedState.csrf || decodedState.csrf !== expectedCsrf) {
    return NextResponse.redirect(new URL('/?error=invalid_oauth_state', appUrl))
  }
  returnTo = sanitizeReturnTo(decodedState.returnTo)

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', appUrl))
  }

  try {
    // Exchange code for access token - MUST NOT be cached
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
      cache: 'no-store', // Prevent caching
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub token error:', tokenData.error, tokenData.error_description)
      return NextResponse.redirect(new URL(`/?error=${tokenData.error}`, appUrl))
    }

    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData)
      return NextResponse.redirect(new URL('/?error=no_token', appUrl))
    }

    // Get user info from GitHub - MUST NOT be cached
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store', // Prevent caching
    })

    if (!userResponse.ok) {
      console.error('GitHub user fetch failed:', userResponse.status)
      return NextResponse.redirect(new URL('/?error=github_user_failed', appUrl))
    }

    const userData = await userResponse.json()

    if (!userData.id || !userData.login) {
      console.error('Invalid GitHub user data:', userData)
      return NextResponse.redirect(new URL('/?error=invalid_user', appUrl))
    }

    // Send to our backend to create/update user and get JWT
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const backendResponse = await fetch(`${apiUrl}/auth/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        github_id: String(userData.id),
        github_username: userData.login,
        email: userData.email,
        avatar_url: userData.avatar_url,
        access_token: tokenData.access_token,
      }),
      cache: 'no-store', // Prevent caching
    })

    if (!backendResponse.ok) {
      console.error('Backend auth failed:', backendResponse.status)
      return NextResponse.redirect(new URL('/?error=backend_auth_failed', appUrl))
    }

    const authData = await backendResponse.json()

    if (!authData.access_token || !authData.user) {
      console.error('Invalid backend auth response:', authData)
      return NextResponse.redirect(new URL('/?error=invalid_auth_response', appUrl))
    }

    // Set session cookie (HTTP-only) and redirect directly to destination.
    const redirectUrl = new URL(returnTo, appUrl)
    const response = NextResponse.redirect(redirectUrl)

    response.cookies.set({
      name: SESSION_COOKIE,
      value: authData.access_token,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
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
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', appUrl))
  }
}
