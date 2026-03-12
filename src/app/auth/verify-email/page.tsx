'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { verifyEmail } from '@/lib/api'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }

    verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Verification failed.')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-xl font-semibold text-gray-900">bloom</Link>

        <div className="mt-8">
          {status === 'loading' && (
            <p className="text-sm text-gray-500">Verifying your email...</p>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Email verified</h2>
              <p className="mt-2 text-sm text-gray-500">{message}</p>
              <Link
                href="/explore"
                className="inline-block mt-6 py-2 px-6 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Continue to Bloom
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Verification failed</h2>
              <p className="mt-2 text-sm text-gray-500">{message}</p>
              <Link
                href="/auth/login"
                className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
