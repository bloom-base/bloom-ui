import Link from 'next/link'
import { timeAgo } from '@/lib/utils'

interface ProjectCardProps {
  org: string
  name: string
  description: string
  inProgress: number
  queued: number
  completed?: number
  lastActivityAt?: string | null
  stars?: number
  language?: string
  updatedAt?: string
  href: string
  flagship?: boolean
}

export function ProjectCard({
  org,
  name,
  description,
  inProgress,
  queued,
  completed,
  lastActivityAt,
  stars,
  language,
  updatedAt,
  href,
  flagship,
}: ProjectCardProps) {
  const isActive = inProgress > 0

  return (
    <Link
      href={href}
      className="group block p-5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-md hover:shadow-gray-100 dark:hover:shadow-zinc-900 transition-all duration-150"
    >
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 dark:text-zinc-500">{org}</span>
          {flagship && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800">
              Flagship
            </span>
          )}
        </div>
        <div className="font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-gray-700 dark:group-hover:text-zinc-300 transition-colors mt-1">{name}</div>
      </div>

      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4 line-clamp-2 leading-relaxed">{description}</p>

      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isActive ? 'bg-green-500 shadow-sm shadow-green-200 dark:shadow-green-900' : 'bg-gray-300 dark:bg-zinc-600'
            }`}
          />
          <span className="text-gray-600 dark:text-zinc-400">
            {inProgress > 0 ? `${inProgress} in progress` : 'Idle'}
          </span>
        </span>
        {queued > 0 && (
          <span className="text-gray-400 dark:text-zinc-500">&middot; {queued} queued</span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500 mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
        {completed !== undefined && completed > 0 && (
          <span>{completed} shipped</span>
        )}
        {language && <span>{language}</span>}
        {stars !== undefined && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {stars.toLocaleString()}
          </span>
        )}
        {lastActivityAt && (
          <span className="ml-auto">{timeAgo(lastActivityAt)}</span>
        )}
        {!lastActivityAt && updatedAt && (
          <span className="ml-auto">{updatedAt}</span>
        )}
      </div>
    </Link>
  )
}
