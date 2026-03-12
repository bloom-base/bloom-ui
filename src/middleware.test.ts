import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

function makeRequest(url: string, cookies?: Record<string, string>) {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'))
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value)
    }
  }
  return req
}

describe('middleware', () => {
  it('allows unauthenticated users to access /auth/login', () => {
    const response = middleware(makeRequest('/auth/login'))
    // Should not redirect — NextResponse.next() returns undefined or a pass-through
    expect(response.headers.get('location')).toBeNull()
  })

  it('allows users with stale session cookie to access /auth/login (regression: stale cookie redirect loop)', () => {
    // Bug: middleware checked cookie existence to redirect /auth/login -> /
    // but a stale/invalid cookie would cause a redirect loop where the user
    // could never reach the login page.
    // Fix: middleware no longer redirects authenticated users away from auth pages.
    const response = middleware(makeRequest('/auth/login', { bloom_session: 'stale_token' }))
    const location = response.headers.get('location')
    // Must NOT redirect to homepage — user needs to reach the login page
    expect(location).toBeNull()
  })

  it('redirects unauthenticated users from /profile to /auth/login', () => {
    const response = middleware(makeRequest('/profile'))
    const location = response.headers.get('location')
    expect(location).toContain('/auth/login')
    expect(location).toContain('returnTo=%2Fprofile')
  })

  it('allows authenticated users to access /profile', () => {
    const response = middleware(makeRequest('/profile', { bloom_session: 'valid_token' }))
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects unauthenticated users from /new to /auth/login', () => {
    const response = middleware(makeRequest('/new'))
    const location = response.headers.get('location')
    expect(location).toContain('/auth/login')
  })

  it('allows unauthenticated users to access /explore', () => {
    const response = middleware(makeRequest('/explore'))
    expect(response.headers.get('location')).toBeNull()
  })
})
