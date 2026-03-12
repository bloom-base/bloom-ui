'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import EvalDashboard from '@/components/EvalDashboard'
import {
  getProjectByPath,
  getProjectAnalytics,
  getTokenTimeseries,
  getCurrentUser,
  type Project,
  type ProjectAnalytics,
  type TokenTimeseries,
  type UserProfile,
} from '@/lib/api'

const RESERVED_PATHS = ['explore', 'new', 'auth', 'api', 'projects', 'settings', '_next', 'favicon.ico', 'profile', 'pricing', 'admin', 'analytics', 'u', 'terms', 'privacy']

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatCost(usd: number | null): string {
  if (usd == null) return '-'
  if (usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function AgentBar({ agent, cost, total }: { agent: string; cost: number; total: number }) {
  const pct = total > 0 ? (cost / total) * 100 : 0
  const colors: Record<string, string> = {
    coder: 'bg-gray-900',
    maintainer: 'bg-gray-600',
    reviewer: 'bg-gray-400',
    deployer: 'bg-gray-300',
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 shrink-0 capitalize">{agent}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors[agent] || 'bg-gray-500'}`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-600 w-16 text-right">{formatCost(cost)}</span>
    </div>
  )
}

function ToolRow({ name, count, maxCount }: { name: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-gray-500 w-28 shrink-0 truncate">{name}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-gray-400 transition-all duration-500"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-500 w-10 text-right">{count}</span>
    </div>
  )
}

function TokenChart({ timeseries }: { timeseries: TokenTimeseries }) {
  const dailyData = useMemo(() => {
    const dayMap = new Map<string, { tokens: number; cost: number }>()
    for (const hour of timeseries.data) {
      const day = hour.hour.slice(0, 10)
      const existing = dayMap.get(day) || { tokens: 0, cost: 0 }
      existing.tokens += hour.tokens_total
      existing.cost += hour.cost_usd
      dayMap.set(day, existing)
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
  }, [timeseries.data])

  if (dailyData.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No token usage data yet
      </div>
    )
  }

  const maxTokens = Math.max(...dailyData.map(([, d]) => d.tokens), 1)

  return (
    <div>
      <div className="flex items-end gap-[2px] h-32">
        {dailyData.map(([day, data]) => {
          const height = (data.tokens / maxTokens) * 100
          return (
            <div
              key={day}
              className="flex-1 group relative"
            >
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 shadow-lg">
                <p className="font-medium">{day}</p>
                <p className="text-gray-300">{data.tokens.toLocaleString()} tokens</p>
                <p className="text-gray-300">{formatCost(data.cost)}</p>
              </div>
              <div
                className="w-full bg-gray-900 rounded-t hover:bg-gray-700 transition-colors cursor-default"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-mono">
        <span>{dailyData[0]?.[0]?.slice(5)}</span>
        <span>{dailyData[dailyData.length - 1]?.[0]?.slice(5)}</span>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null)
  const [timeseries, setTimeseries] = useState<TokenTimeseries | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) {
      notFound()
    }
  }, [owner])

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) return

    Promise.all([
      getCurrentUser().catch(() => null),
      getProjectByPath(owner, repo).catch(() => null),
    ]).then(([user, proj]) => {
      setCurrentUser(user)
      setProject(proj)
      setLoading(false)
    })
  }, [owner, repo])

  useEffect(() => {
    if (!project) return
    Promise.all([
      getProjectAnalytics(project.id).catch(() => null),
      getTokenTimeseries(period, project.id).catch(() => null),
    ]).then(([a, ts]) => {
      setAnalytics(a)
      setTimeseries(ts)
    })
  }, [project, period])

  // Hooks must be called before any conditional returns (Rules of Hooks)
  const isOwner = currentUser ? currentUser.id === project?.owner_id : false

  const costByAgent = useMemo(() => {
    if (!timeseries?.data) return {}
    const costs: Record<string, number> = {}
    for (const hour of timeseries.data) {
      for (const seg of hour.segments) {
        if (seg.agent) {
          costs[seg.agent] = (costs[seg.agent] || 0) + seg.cost_usd
        }
      }
    }
    return costs
  }, [timeseries])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-100 rounded-xl w-1/3" />
            <div className="h-4 bg-gray-100 rounded-xl w-2/3" />
            <div className="grid grid-cols-4 gap-4 mt-8">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-50 rounded-xl" />)}
            </div>
            <div className="h-48 bg-gray-50 rounded-xl mt-8" />
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
          <Link href="/explore" className="text-gray-500 hover:text-gray-900 mt-2 block">
            Browse projects
          </Link>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
            <div className="text-gray-400 mb-2">Sign in to view analytics</div>
            <p className="text-sm text-gray-400">Analytics are available to authenticated users.</p>
            <Link href="/auth/login" className="inline-block mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalAgentCost = Object.values(costByAgent).reduce((a, b) => a + b, 0)

  const topTools = analytics?.tools?.top_tools || {}
  const sortedTools = Object.entries(topTools).sort(([, a], [, b]) => b - a).slice(0, 10)
  const maxToolCount = sortedTools.length > 0 ? sortedTools[0][1] : 0

  const turnsByAgent = analytics?.agents?.turns_by_agent || {}
  const sortedAgentTurns = Object.entries(turnsByAgent).sort(([, a], [, b]) => b - a)

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
            <p className="text-gray-500 mt-1">Task performance, costs, and agent activity</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === d
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Tasks"
              value={analytics.tasks.total.toString()}
              sub={`${analytics.tasks.completed} completed`}
            />
            <StatCard
              label="Success Rate"
              value={analytics.tasks.total > 0 ? `${Math.round(analytics.tasks.success_rate * 100)}%` : '-'}
              sub={analytics.tasks.failed > 0 ? `${analytics.tasks.failed} failed` : undefined}
            />
            <StatCard
              label="Total Cost"
              value={formatCost(analytics.cost.total_cost_usd)}
              sub={analytics.cost.avg_cost_per_task_usd != null ? `${formatCost(analytics.cost.avg_cost_per_task_usd)} avg/task` : undefined}
            />
            <StatCard
              label="Avg Duration"
              value={formatDuration(analytics.timing.avg_duration_seconds)}
              sub={analytics.timing.p95_duration_seconds ? `p95: ${formatDuration(analytics.timing.p95_duration_seconds)}` : undefined}
            />
          </div>
        )}

        {/* Token usage chart */}
        {timeseries && (
          <div className="border border-gray-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Token Usage</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{timeseries.total_tokens.toLocaleString()} total tokens</span>
                <span>{formatCost(timeseries.total_cost_usd)} total cost</span>
              </div>
            </div>
            <TokenChart timeseries={timeseries} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Cost by agent */}
          {analytics && (
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Cost by Agent</h3>
              {Object.keys(costByAgent).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(costByAgent)
                    .sort(([, a], [, b]) => b - a)
                    .map(([agent, cost]) => (
                      <AgentBar
                        key={agent}
                        agent={agent}
                        cost={cost}
                        total={totalAgentCost}
                      />
                    ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No agent cost data yet</p>
              )}

              {/* Agent turns */}
              {sortedAgentTurns.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-3">Turns by Agent</p>
                  <div className="flex gap-4">
                    {sortedAgentTurns.map(([agent, turns]) => (
                      <div key={agent} className="text-center">
                        <p className="text-lg font-semibold text-gray-900">{turns}</p>
                        <p className="text-xs text-gray-400 capitalize">{agent}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top tools */}
          {sortedTools.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Top Tools</h3>
              <div className="space-y-2.5">
                {sortedTools.map(([name, count]) => (
                  <ToolRow key={name} name={name} count={count} maxCount={maxToolCount} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                {Object.values(topTools).reduce((a, b) => a + b, 0).toLocaleString()} total calls
              </p>
            </div>
          )}
        </div>

        {/* Models used */}
        {analytics?.models?.models_used && Object.keys(analytics.models.models_used).length > 0 && (
          <div className="border border-gray-200 rounded-xl p-6 mb-8">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Models Used</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(analytics.models.models_used)
                .sort(([, a], [, b]) => b - a)
                .map(([model, count]) => (
                  <span key={model} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-mono text-gray-600">
                    {model}
                    <span className="text-gray-400">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Agent Quality (existing eval dashboard) */}
        <div className="mb-8">
          <EvalDashboard projectId={project.id} />
        </div>

        {/* No data state */}
        {!analytics && !timeseries && (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 mb-2">No analytics data yet</p>
            <p className="text-sm text-gray-400">
              Analytics appear after tasks complete. Submit an idea to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
