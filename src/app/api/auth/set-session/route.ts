import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SESSION_COOKIE = 'bloom_session'

function getCookieDomain(): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN || undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token } = body

    if (!access_token || typeof access_token !== 'string') {
      return NextResponse.json({ error: 'Missing access_token' }, { status: 400 })
    }

    const secure = process.env.NODE_ENV === 'production'
    const domain = getCookieDomain()

    const response = NextResponse.json({ ok: true })

    response.cookies.set({
      name: SESSION_COOKIE,
      value: access_token,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      ...(domain ? { domain } : {}),
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
