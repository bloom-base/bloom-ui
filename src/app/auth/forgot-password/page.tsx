'use client'

import Link from 'next/link'
import { useState } from 'react'
import { forgotPassword } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-semibold text-gray-900">bloom</Link>
          <p className="mt-2 text-sm text-gray-500">
            {sent ? 'Check your email' : 'Reset your password'}
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              If an account exists with <span className="font-medium">{email}</span>, we sent a password reset link.
            </p>
            <Link
              href="/auth/login"
              className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && (
                <p className="text-sm text-red-600" role="alert">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              <Link
                href="/auth/login"
                className="text-gray-900 font-medium hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
