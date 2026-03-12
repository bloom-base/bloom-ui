'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  getCurrentUser,
  getPlatformAnalytics,
  getModelComparison,
  getTokenTimeseries,
  type PlatformAnalytics,
  type ModelComparison,
  type TokenTimeseries,
} from '@/lib/api'

// Dynamic import to avoid SSR issues with ECharts
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

const SEGMENT_COLORS = [
  '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#6366f1', '#84cc16',
]

function TokenUsageChart({ timeseries }: { timeseries: TokenTimeseries }) {
  const { hours, segmentIds, segmentColorMap, seriesData, titleMap } = useMemo(() => {
    const allSegmentIds = new Set<string>()
    timeseries.data.forEach((h) => h.segments.forEach((s) => allSegmentIds.add(s.id)))

    const segIds = Array.from(allSegmentIds)
    const colorMap = new Map<string, string>()
    segIds.forEach((id, i) => colorMap.set(id, SEGMENT_COLORS[i % SEGMENT_COLORS.length]))

    // Build title map for tooltip
    const titleMap = new Map<string, string>()
    timeseries.data.forEach((h) => h.segments.forEach((s) => {
      if (!titleMap.has(s.id)) titleMap.set(s.id, s.title)
    }))

    // Build series data: one array per segment
    const data: Record<string, number[]> = {}
    segIds.forEach((id) => { data[id] = [] })

    const hrs: string[] = []
    timeseries.data.forEach((h) => {
      hrs.push(h.hour)
      const segMap = new Map(h.segments.map((s) => [s.id, s.tokens_total]))
      segIds.forEach((id) => {
        data[id].push(segMap.get(id) || 0)
      })
    })

    return {
      hours: hrs,
      segmentIds: segIds,
      segmentColorMap: colorMap,
      seriesData: data,
      titleMap,
    }
  }, [timeseries])

  // Default zoom: last 7 days (168 hours) or all if less
  const defaultZoomStart = hours.length <= 168 ? 0 : ((hours.length - 168) / hours.length) * 100

  const option = useMemo(() => ({
    animation: false,
    grid: {
      top: 10,
      right: 20,
      bottom: 80,
      left: 60,
    },
    xAxis: {
      type: 'category' as const,
      data: hours.map((h) => {
        const d = new Date(h)
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true })
      }),
      axisLabel: {
        fontSize: 11,
        color: '#6b7280',
        hideOverlap: true,
      },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        fontSize: 11,
        color: '#6b7280',
        formatter: (value: number) =>
          value >= 1000000 ? `${(value / 1000000).toFixed(1)}M`
          : value >= 1000 ? `${(value / 1000).toFixed(0)}k`
          : value.toString(),
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' as const } },
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any[]) => {
        if (!params.length) return ''
        const headerDate = params[0]?.name || ''
        const dataIndex = params[0]?.dataIndex ?? 0
        const hourData = timeseries.data[dataIndex]
        let html = `<div style="font-weight:600;margin-bottom:6px">${headerDate}</div>`
        let total = 0
        let totalCost = 0
        params.forEach((p: any) => {
          if (p.value > 0) {
            const seg = hourData?.segments.find((s: any) => s.id === p.seriesName)
            const title = seg?.title || titleMap.get(p.seriesName) || p.seriesName
            const costStr = seg ? ` · $${seg.cost_usd.toFixed(4)}` : ''
            if (seg) totalCost += seg.cost_usd
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="width:10px;height:10px;border-radius:2px;background:${p.color};flex-shrink:0"></span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px">${title}</span>
              <span style="color:#9ca3af;font-size:11px">${p.value.toLocaleString()}${costStr}</span>
            </div>`
            total += p.value
          }
        })
        if (total > 0) {
          html += `<div style="border-top:1px solid #e5e7eb;margin-top:4px;padding-top:4px;color:#6b7280">
            Total: ${total.toLocaleString()} tokens · $${totalCost.toFixed(4)}
          </div>`
        }
        return html
      },
    },
    dataZoom: [
      {
        type: 'slider' as const,
        start: defaultZoomStart,
        end: 100,
        height: 28,
        bottom: 10,
        borderColor: '#d4d4d8',
        fillerColor: 'rgba(139, 92, 246, 0.15)',
        handleStyle: { color: '#8b5cf6', borderColor: '#8b5cf6' },
        moveHandleStyle: { color: '#8b5cf6' },
        selectedDataBackground: {
          lineStyle: { color: '#8b5cf6' },
          areaStyle: { color: 'rgba(139, 92, 246, 0.3)' },
        },
        dataBackground: {
          lineStyle: { color: '#d4d4d8' },
          areaStyle: { color: '#f4f4f5' },
        },
        textStyle: { color: '#6b7280', fontSize: 11 },
      },
    ],
    series: segmentIds.map((id) => ({
      name: id,
      type: 'bar' as const,
      stack: 'tokens',
      data: seriesData[id],
      itemStyle: { color: segmentColorMap.get(id) || '#8b5cf6' },
      emphasis: { itemStyle: { opacity: 0.85 } },
      barMaxWidth: 20,
    })),
  }), [hours, segmentIds, seriesData, segmentColorMap, defaultZoomStart, timeseries, titleMap])

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium text-gray-900">Token Usage Over Time</h2>
        <div className="text-sm text-gray-500">
          {timeseries.total_tokens.toLocaleString()} tokens · ${timeseries.total_cost_usd.toFixed(2)}
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 380 }}
        notMerge={true}
      />
      <p className="text-xs text-gray-400 mt-1 text-center">
        Drag slider to pan · Drag edges to zoom · Colors represent different tasks
      </p>
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [platform, setPlatform] = useState<PlatformAnalytics | null>(null)
  const [models, setModels] = useState<ModelComparison | null>(null)
  const [timeseries, setTimeseries] = useState<TokenTimeseries | null>(null)
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user.is_admin) {
          router.push('/')
          return
        }
        setAuthed(true)
      })
      .catch(() => {
        router.push('/')
      })
  }, [router])

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    setError(null)

    Promise.all([
      getPlatformAnalytics(days),
      getModelComparison(days),
      getTokenTimeseries(days),
    ])
      .then(([platformData, modelData, timeseriesData]) => {
        setPlatform(platformData)
        setModels(modelData)
        setTimeseries(timeseriesData)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load analytics')
      })
      .finally(() => setLoading(false))
  }, [days, authed])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Platform Analytics</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {platform && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Tasks" value={platform.tasks.total.toString()} />
            <StatCard
              label="Success Rate"
              value={formatPercent(platform.tasks.success_rate)}
              color={platform.tasks.success_rate >= 0.9 ? 'green' : platform.tasks.success_rate >= 0.7 ? 'yellow' : 'red'}
            />
            <StatCard label="Total Cost" value={formatCurrency(platform.cost.total_cost_usd)} />
            <StatCard label="Avg Cost/Task" value={formatCurrency(platform.cost.avg_cost_per_task_usd)} />
          </div>

          {/* Task Stats */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Task Breakdown</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed</span>
                  <span className="font-medium text-green-600">{platform.tasks.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rejected</span>
                  <span className="font-medium text-gray-600">{platform.tasks.rejected}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Failed</span>
                  <span className="font-medium text-red-600">{platform.tasks.failed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">In Progress</span>
                  <span className="font-medium text-blue-600">{platform.tasks.in_progress}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Timing</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Average Duration</span>
                  <span className="font-medium">{formatDuration(platform.timing.avg_duration_seconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Median (p50)</span>
                  <span className="font-medium">{formatDuration(platform.timing.p50_duration_seconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">p95</span>
                  <span className="font-medium">{formatDuration(platform.timing.p95_duration_seconds)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Token Usage Over Time Chart */}
          {timeseries && timeseries.data.length > 0 && (
            <TokenUsageChart timeseries={timeseries} />
          )}

          {/* Cost Breakdown */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Cost by Model</h2>
              {Object.keys(platform.cost.cost_by_model).length === 0 ? (
                <p className="text-gray-400 text-sm">No data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(platform.cost.cost_by_model)
                    .sort(([, a], [, b]) => b - a)
                    .map(([model, cost]) => (
                      <div key={model} className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm truncate mr-2">
                          {model.replace('claude-', '').replace('-20240307', '').replace('-20241022', '')}
                        </span>
                        <span className="font-medium">{formatCurrency(cost)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Cost by Agent</h2>
              {Object.keys(platform.cost.cost_by_agent).length === 0 ? (
                <p className="text-gray-400 text-sm">No data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(platform.cost.cost_by_agent)
                    .sort(([, a], [, b]) => b - a)
                    .map(([agent, cost]) => (
                      <div key={agent} className="flex justify-between items-center">
                        <span className="text-gray-500 capitalize">{agent}</span>
                        <span className="font-medium">{formatCurrency(cost)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Model Comparison */}
      {models && models.models.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Model Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Model</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Turns</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Avg Tokens</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Cost/Turn</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {models.models.map((m) => (
                  <tr key={m.model} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 px-2 text-gray-700">
                      {m.model.replace('claude-', '').replace('-20240307', '').replace('-20241022', '')}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-600">{m.total_turns}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{Math.round(m.avg_tokens_per_turn)}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(m.cost_per_turn_usd)}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatCurrency(m.total_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {models.recommendation && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
              {models.recommendation}
            </div>
          )}
        </div>
      )}

      {/* Period Info */}
      {platform && (
        <p className="text-sm text-gray-400 text-center">
          Data from {new Date(platform.period.start).toLocaleDateString()} to{' '}
          {new Date(platform.period.end).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'default',
}: {
  label: string
  value: string
  color?: 'default' | 'green' | 'yellow' | 'red'
}) {
  const colorClasses = {
    default: 'text-gray-900',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colorClasses[color]}`}>{value}</p>
    </div>
  )
}
