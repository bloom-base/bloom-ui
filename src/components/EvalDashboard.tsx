'use client'

import { useEffect, useState } from 'react'
import { getProjectEvals, ProjectEvalSummary } from '@/lib/api'

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const pct = Math.round(score * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-600 w-10 text-right">{pct}%</span>
    </div>
  )
}

function QualityBadge({ score }: { score: number }) {
  let bg = 'bg-zinc-100 text-zinc-600'
  if (score >= 80) bg = 'bg-emerald-50 text-emerald-700'
  else if (score >= 60) bg = 'bg-amber-50 text-amber-700'
  else if (score >= 40) bg = 'bg-orange-50 text-orange-700'
  else bg = 'bg-red-50 text-red-700'

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${bg}`}>
      {score}
    </span>
  )
}

export default function EvalDashboard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectEvalSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getProjectEvals(projectId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return (
      <div className="border border-zinc-200 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-zinc-100 rounded w-32 mb-4" />
        <div className="h-20 bg-zinc-50 rounded" />
      </div>
    )
  }

  if (!data || data.task_count === 0) {
    return (
      <div className="border border-zinc-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-zinc-900 mb-2">Agent Quality</h3>
        <p className="text-xs text-zinc-500">No evaluations yet. Scores appear when tasks complete.</p>
      </div>
    )
  }

  return (
    <div className="border border-zinc-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-900">Agent Quality</h3>
        <div className="flex items-center gap-2">
          {data.trend !== null && (
            <span className={`text-xs ${data.trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {data.trend >= 0 ? '+' : ''}{data.trend}
            </span>
          )}
          {data.avg_quality_score !== null && <QualityBadge score={Math.round(data.avg_quality_score)} />}
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {data.avg_completion !== null && (
          <ScoreBar label="Completion" score={data.avg_completion} color="#10b981" />
        )}
        {data.avg_efficiency !== null && (
          <ScoreBar label="Efficiency" score={data.avg_efficiency} color="#3b82f6" />
        )}
        {data.avg_cost !== null && (
          <ScoreBar label="Cost" score={data.avg_cost} color="#8b5cf6" />
        )}
        {data.avg_reliability !== null && (
          <ScoreBar label="Reliability" score={data.avg_reliability} color="#f59e0b" />
        )}
      </div>

      <p className="text-xs text-zinc-400">{data.task_count} tasks evaluated</p>

      {data.recent_evals.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-xs text-zinc-500 mb-2">Recent</p>
          <div className="space-y-1">
            {data.recent_evals.slice(0, 5).map((ev) => (
              <div key={ev.task_id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 truncate max-w-[140px]">{ev.model_used || 'unknown'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-mono">{ev.total_turns} turns</span>
                  <span className="text-zinc-400 font-mono">${(Number(ev.total_cost_usd) || 0).toFixed(2)}</span>
                  <QualityBadge score={ev.quality_score} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
