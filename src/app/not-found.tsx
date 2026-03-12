import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm font-mono text-gray-400 mb-3">404</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/explore"
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-gray-300 transition-colors"
          >
            Explore projects
          </Link>
        </div>
      </div>
    </div>
  )
}
