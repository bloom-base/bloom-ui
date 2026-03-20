'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPublicLive, type PlatformLive, type LiveTask } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

/**
 * LivePulse — platform activity widget for the homepage.
 * Shows active tasks being built and recently completed work.
 * Fetches once on mount — no polling.
 */
export function LivePulse() {
  const [data, setData] = useState<PlatformLive | null>(null)

  useEffect(() => {
    getPublicLive()
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg bg-gray-50 animate-pulse" />
        ))}
      </div>
    )
  }

  const hasActivity = data.active_tasks.length > 0 || data.recent_completions.length > 0

  if (!hasActivity) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No active tasks right now. Projects are idle.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Active tasks — currently building */}
      {data.active_tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          type="building"
        />
      ))}

      {/* Recently completed */}
      {data.recent_completions.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          type="shipped"
        />
      ))}
    </div>
  )
}

function TaskRow({ task, type }: { task: LiveTask; type: 'building' | 'shipped' }) {
  const isBuilding = type === 'building'
  const timestamp = isBuilding ? task.started_at : task.completed_at

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      {/* Status indicator */}
      <div className="shrink-0">
        {isBuilding ? (
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-20 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-600 text-xs font-bold">
            &#x2713;
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {isBuilding ? 'Building' : 'Shipped'}
          </span>
        </div>
        <span className="text-sm text-gray-900 font-medium truncate block">
          {task.title}
        </span>
      </div>

      {/* Project link */}
      <Link
        href={`/${task.project_repo}`}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
      >
        {task.project_name}
      </Link>

      {/* PR link */}
      {task.pr_url && (
        <a
          href={task.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        >
          PR
        </a>
      )}

      {/* Time */}
      {timestamp && (
        <span className="text-xs text-gray-400 shrink-0 font-mono">
          {timeAgo(timestamp)}
        </span>
      )}
    </div>
  )
}
