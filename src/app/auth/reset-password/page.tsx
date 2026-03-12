'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { resetPassword } from '@/lib/api'
import { validatePassword, isPasswordStrong } from '@/lib/utils'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="text-xl font-semibold text-gray-900">bloom</Link>
          <div className="mt-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Invalid reset link</h2>
            <p className="mt-2 text-sm text-gray-500">This password reset link is invalid or has expired.</p>
            <Link
              href="/auth/forgot-password"
              className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const pwErr = validatePassword(password)
    if (pwErr) {
      setError(pwErr)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="text-xl font-semibold text-gray-900">bloom</Link>
          <div className="mt-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Password reset</h2>
            <p className="mt-2 text-sm text-gray-500">Your password has been updated successfully.</p>
            <Link
              href="/auth/login"
              className="inline-block mt-6 py-2 px-6 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-semibold text-gray-900">bloom</Link>
          <p className="mt-2 text-sm text-gray-500">Choose a new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                password && !isPasswordStrong(password) ? 'border-red-300' :
                isPasswordStrong(password) ? 'border-green-300' :
                'border-gray-200'
              }`}
              placeholder="8+ chars, uppercase, lowercase, number"
            />
            {password && !isPasswordStrong(password) && (
              <p className="text-xs text-red-500 mt-1">
                {validatePassword(password)}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                confirmPassword && confirmPassword !== password ? 'border-red-300' :
                confirmPassword && confirmPassword === password && isPasswordStrong(password) ? 'border-green-300' :
                'border-gray-200'
              }`}
              placeholder="Confirm your password"
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
