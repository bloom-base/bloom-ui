import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-100 dark:border-zinc-800 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-gray-400 dark:text-zinc-500">
          &copy; {new Date().getFullYear()} Bloom
        </span>
        <div className="flex items-center gap-4">
          <Link href="/explore" className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            Explore
          </Link>
          <Link href="/pricing" className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            Pricing
          </Link>
          <a
            href="https://github.com/bloom-base"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            GitHub
          </a>
          <Link href="/terms" className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
}
