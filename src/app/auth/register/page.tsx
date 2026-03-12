'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, Suspense } from 'react'
import { registerWithEmail, checkUsernameAvailable } from '@/lib/api'
import { redirectToGitHubAuth } from '@/lib/auth'
import { validatePassword, isPasswordStrong } from '@/lib/utils'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/explore'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameError, setUsernameError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const checkUsername = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameStatus('idle')
      setUsernameError('')
      return
    }
    setUsernameStatus('checking')
    try {
      const res = await checkUsernameAvailable(value)
      if (res.available) {
        setUsernameStatus('available')
        setUsernameError('')
      } else {
        setUsernameStatus(res.error?.includes('reserved') || res.error?.includes('can only') ? 'invalid' : 'taken')
        setUsernameError(res.error || 'Username unavailable.')
      }
    } catch {
      setUsernameStatus('idle')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const pwErr = validatePassword(password)
    if (pwErr) {
      setError(pwErr)
      return
    }

    if (username && usernameStatus !== 'available') {
      setError('Please choose an available username.')
      return
    }

    setLoading(true)

    try {
      const res = await registerWithEmail({
        email,
        password,
        display_name: displayName || undefined,
        username: username || undefined,
      })
      // Set session cookie
      const cookieRes = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: res.access_token }),
      })
      if (!cookieRes.ok) throw new Error('Failed to set session')
      router.push(returnTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-semibold text-gray-900">bloom</Link>
          <p className="mt-2 text-sm text-gray-500">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                  setUsername(v)
                  setUsernameStatus('idle')
                  setUsernameError('')
                }}
                onBlur={() => { if (username) checkUsername(username) }}
                autoComplete="username"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                  usernameStatus === 'available' ? 'border-green-300' :
                  usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-red-300' :
                  'border-gray-200'
                }`}
                placeholder="your-username"
                maxLength={30}
              />
              {usernameStatus === 'checking' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" role="status">checking...</span>
              )}
              {usernameStatus === 'available' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600" role="status">available</span>
              )}
            </div>
            {usernameError && (
              <p className="text-xs text-red-500 mt-1">{usernameError}</p>
            )}
            {!username && (
              <p className="text-xs text-gray-400 mt-1">Auto-generated from email if left blank.</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby="password-hint"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                password && !isPasswordStrong(password) ? 'border-red-300' :
                isPasswordStrong(password) ? 'border-green-300' :
                'border-gray-200'
              }`}
              placeholder="8+ chars, uppercase, lowercase, number"
            />
            {password && !isPasswordStrong(password) && (
              <p id="password-hint" className="text-xs text-red-500 mt-1">
                {validatePassword(password)}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || (!!username && usernameStatus !== 'available' && usernameStatus !== 'idle')}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-gray-400">or</span>
          </div>
        </div>

        <button
          onClick={() => redirectToGitHubAuth(returnTo)}
          className="w-full py-2 px-4 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link
            href={`/auth/login${returnTo !== '/explore' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="text-gray-900 font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-gray-400">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-gray-600">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-600">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RegisterForm />
    </Suspense>
  )
}
