'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getCurrentUser,
  getObservabilityDashboard,
  type UserProfile,
  type ObservabilityDashboard,
} from '@/lib/api'

export default function ObservabilityPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [dashboard, setDashboard] = useState<ObservabilityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser.is_admin) {
          router.push('/')
          return
        }
        setUser(currentUser)
        const data = await getObservabilityDashboard(days)
        setDashboard(data)
      } catch {
        setError('Failed to load observability dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, days])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100 rounded-lg w-72 mb-8" />
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-50 rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-gray-50 rounded-xl mb-6" />
          <div className="h-64 bg-gray-50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !user || !dashboard) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-red-600">{error || 'Access denied'}</p>
      </div>
    )
  }

  const { queue_health, throughput, duration_stats, agent_efficiency, recent_failures, task_totals } = dashboard

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Observability</h1>
          <p className="text-sm text-gray-500 mt-1">Queue health, throughput, SLO metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => { setDays(Number(e.target.value)); setLoading(true) }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 bg-white"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <Link
            href="/admin"
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            Billing
          </Link>
        </div>
      </div>

      {/* Queue health cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Queue Depth"
          value={String(queue_health.accepted + queue_health.proposed)}
          sub={`${queue_health.accepted} accepted, ${queue_health.proposed} proposed`}
        />
        <MetricCard
          label="In Progress"
          value={String(queue_health.in_progress)}
          sub={queue_health.paused > 0 ? `${queue_health.paused} paused` : 'none paused'}
        />
        <MetricCard
          label="Queue Lag"
          value={queue_health.oldest_accepted_age_seconds ? formatDuration(queue_health.oldest_accepted_age_seconds) : 'None'}
          sub="oldest accepted task"
          warning={queue_health.oldest_accepted_age_seconds !== null && queue_health.oldest_accepted_age_seconds > 3600}
        />
        <MetricCard
          label="Success Rate"
          value={`${(task_totals.success_rate * 100).toFixed(1)}%`}
          sub={`${task_totals.completed} of ${task_totals.total} tasks`}
        />
      </div>

      {/* Stuck tasks alert */}
      {queue_health.stuck_tasks.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-8">
          <h3 className="text-sm font-medium text-amber-800 mb-2">
            Stuck Tasks ({queue_health.stuck_tasks.length})
          </h3>
          <div className="space-y-2">
            {queue_health.stuck_tasks.map(task => (
              <div key={task.task_id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-amber-900">{task.title}</span>
                  <span className="text-amber-600 ml-2">in {task.project_name}</span>
                </div>
                <span className="font-mono text-amber-700">
                  {task.age_seconds ? formatDuration(task.age_seconds) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Throughput chart */}
      <div className="border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          Daily Throughput
        </h2>
        <ThroughputChart data={throughput} />
      </div>

      {/* Duration stats + Agent efficiency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Task Duration
          </h2>
          {duration_stats.total_completed > 0 ? (
            <div className="space-y-3">
              <StatRow label="Avg" value={formatDuration(duration_stats.avg_seconds!)} />
              <StatRow label="p50" value={formatDuration(duration_stats.p50_seconds!)} />
              <StatRow label="p75" value={formatDuration(duration_stats.p75_seconds!)} />
              <StatRow label="p95" value={formatDuration(duration_stats.p95_seconds!)} warning={duration_stats.p95_seconds! > 1800} />
              <StatRow label="Max" value={formatDuration(duration_stats.max_seconds!)} />
              <div className="pt-3 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Under 5 min</span>
                  <span className="font-mono">{duration_stats.under_5min}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>5–15 min</span>
                  <span className="font-mono">{duration_stats.under_15min - duration_stats.under_5min}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>15–30 min</span>
                  <span className="font-mono">{duration_stats.under_30min - duration_stats.under_15min}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Over 30 min</span>
                  <span className={`font-mono ${duration_stats.over_30min > 0 ? 'text-amber-600' : ''}`}>
                    {duration_stats.over_30min}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No completed tasks yet</p>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Agent Efficiency
          </h2>
          {agent_efficiency.total_evaluated > 0 ? (
            <div className="space-y-3">
              <StatRow label="Avg Quality" value={`${agent_efficiency.avg_quality_score}/100`} />
              <ScoreBar label="Completion" value={agent_efficiency.avg_completion_score!} />
              <ScoreBar label="Efficiency" value={agent_efficiency.avg_efficiency_score!} />
              <ScoreBar label="Cost" value={agent_efficiency.avg_cost_score!} />
              <ScoreBar label="Reliability" value={agent_efficiency.avg_reliability_score!} />
              <div className="pt-3 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Avg turns/task</span>
                  <span className="font-mono">{agent_efficiency.avg_turns}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Avg cost/task</span>
                  <span className="font-mono">${agent_efficiency.avg_cost_usd?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tool error rate</span>
                  <span className={`font-mono ${(agent_efficiency.avg_tool_error_rate ?? 0) > 0.1 ? 'text-amber-600' : ''}`}>
                    {((agent_efficiency.avg_tool_error_rate ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total cost</span>
                  <span className="font-mono">${agent_efficiency.total_cost_usd.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No evaluated tasks yet</p>
          )}
        </div>
      </div>

      {/* Task status breakdown */}
      <div className="border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          Task Status (All Time)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="Total" value={task_totals.total} />
          <MiniStat label="Completed" value={task_totals.completed} color="text-green-700" />
          <MiniStat label="In Progress" value={task_totals.in_progress} color="text-blue-700" />
          <MiniStat label="Accepted" value={task_totals.accepted} color="text-gray-700" />
          <MiniStat label="Proposed" value={task_totals.proposed} color="text-gray-500" />
          <MiniStat label="Paused" value={task_totals.paused} color="text-amber-600" />
          <MiniStat label="Rejected" value={task_totals.rejected} color="text-red-600" />
          <MiniStat label="Cancelled" value={task_totals.cancelled} color="text-gray-400" />
        </div>
      </div>

      {/* Recent failures */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Recent Failures
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recent_failures.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No failures</div>
          ) : (
            recent_failures.map(f => (
              <div key={f.task_id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 truncate">{f.title}</span>
                  <span className="text-xs text-gray-400 font-mono">{f.project_name}</span>
                  {f.retry_count > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono">
                      {f.retry_count}x retry
                    </span>
                  )}
                </div>
                <p className="text-xs text-red-500 truncate ml-4">{f.error_message}</p>
                <div className="flex gap-4 text-xs text-gray-400 mt-1 ml-4">
                  {f.started_at && <span>Started: {formatTimeAgo(f.started_at)}</span>}
                  {f.failed_at && <span>Failed: {formatTimeAgo(f.failed_at)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Components
// =============================================================================

function MetricCard({ label, value, sub, warning }: {
  label: string
  value: string
  sub?: string
  warning?: boolean
}) {
  return (
    <div className={`border rounded-xl p-4 ${warning ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${warning ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-mono font-semibold ${warning ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono text-gray-900">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-semibold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function ThroughputChart({ data }: { data: ObservabilityDashboard['throughput'] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400">No data</p>

  const maxVal = Math.max(1, ...data.map(d => d.completed + d.failed))

  // Show at most 30 bars
  const displayData = data.length > 30 ? data.slice(-30) : data

  return (
    <div>
      <div className="flex items-end gap-px h-32">
        {displayData.map(d => {
          const completedH = (d.completed / maxVal) * 100
          const failedH = (d.failed / maxVal) * 100
          const totalH = completedH + failedH
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col justify-end group relative"
              title={`${d.date}\n${d.completed} completed, ${d.failed} failed, ${d.proposed} proposed`}
            >
              <div className="w-full rounded-t" style={{ height: `${Math.max(totalH, totalH > 0 ? 2 : 0)}%` }}>
                {failedH > 0 && (
                  <div className="w-full bg-red-400 rounded-t" style={{ height: `${(failedH / (totalH || 1)) * 100}%` }} />
                )}
                <div className="w-full bg-gray-900 rounded-t" style={{ height: `${(completedH / (totalH || 1)) * 100}%`, minHeight: completedH > 0 ? '2px' : 0 }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
        <span>{displayData[0]?.date.slice(5)}</span>
        <span>{displayData[displayData.length - 1]?.date.slice(5)}</span>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gray-900" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-400" />
          <span>Failed</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatTimeAgo(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
