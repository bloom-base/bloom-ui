'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const returnTo = searchParams.get('returnTo') || '/explore'
    // Legacy route kept for backward compatibility.
    // Session is now handled with secure HTTP-only cookies.
    router.replace(returnTo)
  }, [searchParams, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Completing sign in...</p>
      </div>
    </div>
  )
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <AuthCompleteContent />
    </Suspense>
  )
}
