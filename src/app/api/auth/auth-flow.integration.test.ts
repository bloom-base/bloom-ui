/**
 * Integration test for the full GitHub OAuth flow.
 * Hits real running services (frontend on :3000, backend on :8000).
 * Requires: ./dev.sh running + GITHUB_TEST_PAT in backend/.env
 *
 * Regression: user clicks "Sign in with GitHub", OAuth completes,
 * but ends up at /explore not signed in (cookie not set or not recognized).
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const FRONTEND = 'http://localhost:3000'
const BACKEND = 'http://localhost:8000'

function getGitHubPAT(): string {
  const envPath = path.resolve(process.cwd(), '../backend/.env')
  const content = fs.readFileSync(envPath, 'utf-8')
  const match = content.match(/^GITHUB_TEST_PAT=(.+)$/m)
  if (!match) throw new Error('GITHUB_TEST_PAT not found in backend/.env')
  return match[1].trim()
}

function parseCookies(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const name = value.split('=')[0]
      const val = value.split('=').slice(1).join('=').split(';')[0]
      cookies[name] = val
    }
  })
  // getSetCookie gives us each Set-Cookie header individually
  const setCookies = response.headers.getSetCookie?.() ?? []
  for (const cookie of setCookies) {
    const name = cookie.split('=')[0]
    const val = cookie.split('=').slice(1).join('=').split(';')[0]
    cookies[name] = val
  }
  return cookies
}

describe('GitHub OAuth flow (integration)', () => {
  it('Step 1: /api/auth/github redirects to GitHub and sets CSRF cookie', async () => {
    const res = await fetch(`${FRONTEND}/api/auth/github?redirect=/explore`, {
      redirect: 'manual',
    })

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('https://github.com/login/oauth/authorize')
    expect(location).toContain('client_id=')
    expect(location).toContain('redirect_uri=')

    const cookies = parseCookies(res)
    expect(cookies['bloom_oauth_state']).toBeDefined()
    expect(cookies['bloom_oauth_state'].length).toBeGreaterThan(10)
  })

  it('Step 2: backend /auth/github accepts real GitHub token and returns JWT + user', async () => {
    const pat = getGitHubPAT()

    // First get the GitHub user info to pass to the backend
    const ghRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
    })
    expect(ghRes.ok).toBe(true)
    const ghUser = await ghRes.json()

    // Now call the backend auth endpoint (same as callback route does)
    const authRes = await fetch(`${BACKEND}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_id: String(ghUser.id),
        github_username: ghUser.login,
        email: ghUser.email,
        avatar_url: ghUser.avatar_url,
        access_token: pat,
      }),
    })

    expect(authRes.ok).toBe(true)
    const authData = await authRes.json()
    expect(authData.access_token).toBeDefined()
    expect(authData.access_token.length).toBeGreaterThan(10)
    expect(authData.user).toBeDefined()
    expect(authData.user.github_username).toBe(ghUser.login)
  })

  it('Step 3: bloom_session cookie authenticates requests to backend /auth/users/me', async () => {
    const pat = getGitHubPAT()

    // Get GitHub user info
    const ghRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
    })
    const ghUser = await ghRes.json()

    // Get JWT from backend
    const authRes = await fetch(`${BACKEND}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_id: String(ghUser.id),
        github_username: ghUser.login,
        email: ghUser.email,
        avatar_url: ghUser.avatar_url,
        access_token: pat,
      }),
    })
    const authData = await authRes.json()
    const jwt = authData.access_token

    // Use JWT as bloom_session cookie to call /auth/users/me
    const meRes = await fetch(`${BACKEND}/auth/users/me`, {
      headers: { Cookie: `bloom_session=${jwt}` },
    })

    expect(meRes.ok).toBe(true)
    const me = await meRes.json()
    expect(me.github_username).toBe(ghUser.login)
    expect(me.id).toBeDefined()
  })

  it('Step 4: frontend set-session route sets bloom_session cookie', async () => {
    const pat = getGitHubPAT()

    // Get JWT from backend (reuse flow from above)
    const ghRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
    })
    const ghUser = await ghRes.json()

    const authRes = await fetch(`${BACKEND}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_id: String(ghUser.id),
        github_username: ghUser.login,
        email: ghUser.email,
        avatar_url: ghUser.avatar_url,
        access_token: pat,
      }),
    })
    const authData = await authRes.json()
    const jwt = authData.access_token

    // Call the frontend's set-session route (used by email login)
    const sessionRes = await fetch(`${FRONTEND}/api/auth/set-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: jwt }),
      redirect: 'manual',
    })

    expect(sessionRes.ok).toBe(true)
    const cookies = parseCookies(sessionRes)
    expect(cookies['bloom_session']).toBeDefined()
    expect(cookies['bloom_session']).toBe(jwt)
  })

  it('Step 5: full round-trip — set cookie via frontend, then query backend with it', async () => {
    const pat = getGitHubPAT()

    // Get JWT
    const ghRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
    })
    const ghUser = await ghRes.json()

    const authRes = await fetch(`${BACKEND}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_id: String(ghUser.id),
        github_username: ghUser.login,
        email: ghUser.email,
        avatar_url: ghUser.avatar_url,
        access_token: pat,
      }),
    })
    const authData = await authRes.json()
    const jwt = authData.access_token

    // Set cookie via frontend
    const sessionRes = await fetch(`${FRONTEND}/api/auth/set-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: jwt }),
    })
    const cookies = parseCookies(sessionRes)
    const sessionCookie = cookies['bloom_session']
    expect(sessionCookie).toBeDefined()

    // Use that cookie to authenticate against backend
    const meRes = await fetch(`${BACKEND}/auth/users/me`, {
      headers: { Cookie: `bloom_session=${sessionCookie}` },
    })
    expect(meRes.ok).toBe(true)
    const me = await meRes.json()
    expect(me.github_username).toBe(ghUser.login)
  })

  it('middleware allows /auth/login even with stale bloom_session cookie (regression)', { timeout: 15000 }, async () => {
    const res = await fetch(`${FRONTEND}/auth/login`, {
      headers: { Cookie: 'bloom_session=totally_invalid_stale_token' },
      redirect: 'manual',
    })

    // Should NOT redirect to / (that was the bug). Should serve the login page (200).
    expect(res.status).toBe(200)
  })
})
