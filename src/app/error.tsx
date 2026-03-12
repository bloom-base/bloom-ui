'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm font-mono text-gray-400 mb-3">Error</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-500 mb-8 max-w-md">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
