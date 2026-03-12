'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, getAdminDashboard, type UserProfile, type AdminDashboard } from '@/lib/api'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser.is_admin) {
          router.push('/')
          return
        }
        setUser(currentUser)
        const data = await getAdminDashboard()
        setDashboard(data)
      } catch {
        setError('Failed to load admin dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100 rounded-lg w-64 mb-8" />
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-50 rounded-xl" />
            ))}
          </div>
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

  const { subscribers, revenue, churn, recent_events } = dashboard

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Billing, revenue, and platform metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/observability"
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            Observability
          </Link>
          <Link
            href="/analytics"
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            Agent Analytics
          </Link>
        </div>
      </div>

      {/* Revenue + Subscriber cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total MRR" value={`$${revenue.total_mrr_usd.toFixed(0)}`} />
        <MetricCard label="Pro Subscribers" value={String(revenue.pro_subscribers)} />
        <MetricCard label="Sponsorship MRR" value={`$${revenue.sponsorship_mrr_usd.toFixed(0)}`} />
        <MetricCard label="Total Users" value={String(subscribers.total)} />
      </div>

      {/* Subscriber breakdown + Churn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Subscribers by Tier</h2>
          <div className="space-y-3">
            <TierRow label="Free" count={subscribers.free} total={subscribers.total} />
            <TierRow label="Pro" count={subscribers.pro} total={subscribers.total} />
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Churn (30 days)</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Churned</span>
              <span className={`text-lg font-semibold ${churn.churned_last_30_days > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {churn.churned_last_30_days}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Failed payments</span>
              <span className={`text-lg font-semibold ${churn.users_with_failed_payments > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {churn.users_with_failed_payments}
              </span>
            </div>
            {churn.recent_churns.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Recent churns</p>
                {churn.recent_churns.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span className="font-mono text-gray-700">{c.username}</span>
                    <span className="text-gray-400">
                      {c.churned_at ? new Date(c.churned_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue detail */}
      <div className="border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Revenue Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Pro MRR</p>
            <p className="text-lg font-semibold text-gray-900">${revenue.pro_mrr_usd.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sponsorship MRR</p>
            <p className="text-lg font-semibold text-gray-900">${revenue.sponsorship_mrr_usd.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Sponsorship (all-time)</p>
            <p className="text-lg font-semibold text-gray-900">${revenue.total_sponsorship_revenue_usd.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Pro Subscribers</p>
            <p className="text-lg font-semibold text-gray-900">{revenue.pro_subscribers}</p>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Webhook Event Log</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recent_events.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No events yet</div>
          ) : (
            recent_events.map(event => (
              <div key={event.id} className="px-5 py-3 flex items-start gap-3">
                <EventBadge type={event.event_type} hasError={!!event.error} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {event.summary || event.event_type}
                    </span>
                    {event.username && (
                      <span className="text-xs font-mono text-gray-400">{event.username}</span>
                    )}
                  </div>
                  {event.error && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{event.error}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap font-mono">
                  {formatTimeAgo(event.processed_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function TierRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-mono text-gray-900">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EventBadge({ type, hasError }: { type: string; hasError: boolean }) {
  if (hasError) {
    return <span className="mt-0.5 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
  }
  if (type.includes('failed')) {
    return <span className="mt-0.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
  }
  if (type.includes('deleted') || type.includes('canceled')) {
    return <span className="mt-0.5 w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
  }
  return <span className="mt-0.5 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
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
