import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/profile', '/new']

// Routes that require auth AND are project-scoped (settings pages)
const PROTECTED_SUFFIXES = ['/settings']

// Routes only accessible when NOT authenticated (auth pages)
const AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has('bloom_session')

  // Skip redirecting authenticated users away from auth pages.
  // The session cookie may be stale/invalid — we can't validate it in middleware
  // without a backend call. Let the auth pages render; they'll redirect client-side
  // if the user is actually logged in.

  // Redirect unauthenticated users from protected routes to login
  if (!hasSession) {
    // Check exact protected routes
    if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check protected suffixes (e.g. /owner/repo/settings)
    if (PROTECTED_SUFFIXES.some(suffix => pathname.endsWith(suffix))) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except static files, API routes, and _next
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
