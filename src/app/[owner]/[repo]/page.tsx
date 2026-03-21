'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter, notFound } from 'next/navigation'
import { toast } from 'sonner'
import { getProjectByPath, getProjectLedger, listConversations, deleteConversation, getQueueStatus, streamTaskEvents, cancelTask, sendTaskGuidance, getProjectAnalytics, getCurrentUser, getTaskProgress, getTaskPRs, getTaskPRFiles, getActiveSponsor, getProjectSponsors, getDeployStatus, getProjectContributors, forkProject, getDeployments, getFollowStatus, followProject, unfollowProject, getTaskCost, getTaskEval, type Project, type LedgerTask, type Conversation, type QueueStatus, type TaskStreamEvent, type TaskPR, type PRFileChange, type ProjectAnalytics, type UserProfile, type Sponsorship, type ProjectContributor, type DeploymentHistoryItem, type FollowStatus, type TaskCost, type TaskEvalResponse } from '@/lib/api'
import SearchPanel from '@/components/SearchPanel'
import EvalDashboard from '@/components/EvalDashboard'
import AgentWorkspace from '@/components/AgentWorkspace'
import DiffViewer from '@/components/DiffViewer'
import { redirectToLogin } from '@/lib/auth'

const RESERVED_PATHS = ['explore', 'new', 'auth', 'api', 'projects', 'settings', '_next', 'favicon.ico', 'profile', 'pricing', 'admin', 'analytics', 'u', 'terms', 'privacy', 'notifications']

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  proposed: { label: 'Proposed', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  accepted: { label: 'Queued', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  in_progress: { label: 'Working', color: 'bg-gray-100 text-gray-900', dot: 'bg-gray-900 animate-pulse' },
  paused: { label: 'Paused', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  completed: { label: 'Done', color: 'bg-gray-100 text-gray-600', dot: 'bg-green-500' },
  incomplete: { label: 'Incomplete', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  rejected: { label: 'Rejected', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' },
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<LedgerTask[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [activeSponsor, setActiveSponsor] = useState<Sponsorship | null>(null)
  const [topContributors, setTopContributors] = useState<Sponsorship[]>([])
  const [ideaContributors, setIdeaContributors] = useState<ProjectContributor[]>([])
  const [deployments, setDeployments] = useState<DeploymentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) {
      notFound()
    }
  }, [owner])

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user)
        setIsLoggedIn(true)
      })
      .catch(() => {
        setCurrentUser(null)
        setIsLoggedIn(false)
      })
  }, [])

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) return

    setLoadError(null)
    getProjectByPath(owner, repo)
      .then(async (p) => {
        setProject(p)
        const [tRes, c, q, a, sponsor, sponsorsRes, contribs, deploysRes, follow] = await Promise.all([
          getProjectLedger(p.id).catch(() => ({ items: [], total: 0, limit: 50, offset: 0 })),
          listConversations(p.id).then(r => r.items).catch(() => []),
          getQueueStatus().catch(() => null),
          getProjectAnalytics(p.id).catch(() => null),
          getActiveSponsor(p.id).catch(() => null),
          getProjectSponsors(p.id, true).catch(() => ({ items: [] })),
          getProjectContributors(p.id).catch(() => []),
          getDeployments(p.id).catch(() => ({ items: [] })),
          getFollowStatus(p.id).catch(() => null),
        ])
        setTasks(tRes.items)
        setConversations(c)
        setQueueStatus(q)
        setAnalytics(a)
        setActiveSponsor(sponsor)
        setTopContributors(sponsorsRes.items)
        setIdeaContributors(contribs)
        setDeployments(deploysRes.items)
        if (follow) setFollowStatus(follow)
      })
      .catch((err) => {
        console.error('Failed to load project:', err)
        setLoadError(err instanceof Error ? err.message : 'Failed to load project')
      })
      .finally(() => setLoading(false))
  }, [owner, repo])

  useEffect(() => {
    if (!project) return
    const shouldPoll = queueStatus?.current_task || (queueStatus?.total_pending && queueStatus.total_pending > 0)
    if (!shouldPoll) return

    const interval = setInterval(async () => {
      try {
        const [tRes, q, a] = await Promise.all([
          getProjectLedger(project.id),
          getQueueStatus(),
          getProjectAnalytics(project.id).catch(() => null),
        ])
        setTasks(tRes.items)
        setQueueStatus(q)
        if (a) setAnalytics(a)
      } catch (e) {
        console.error(e)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [project, queueStatus?.current_task, queueStatus?.total_pending])

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="animate-pulse">
            <div className="h-4 w-24 bg-gray-100 rounded mb-3" />
            <div className="h-8 w-56 bg-gray-100 rounded-lg mb-2" />
            <div className="h-5 w-80 bg-gray-100 rounded mb-8" />
            <div className="h-20 bg-gray-50 rounded-xl mb-6" />
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="h-16 bg-gray-50 rounded-xl" />
                <div className="h-16 bg-gray-50 rounded-xl" />
              </div>
              <div className="space-y-3">
                <div className="h-16 bg-gray-50 rounded-xl" />
                <div className="h-16 bg-gray-50 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    const isNetworkError = loadError && !loadError.toLowerCase().includes('not found') && !loadError.toLowerCase().includes('404')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-medium mb-1">Project not found</p>
          {isNetworkError ? (
            <>
              <p className="text-gray-500 text-sm mb-1">Unable to load project data.</p>
              <p className="text-gray-400 text-xs mb-6 font-mono">{loadError}</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm mb-6">This project doesn&apos;t exist or has been removed.</p>
          )}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
            >
              Retry
            </button>
            <Link href="/explore" className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2">
              Browse projects
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const activeTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'paused')
  const queuedTasks = tasks.filter((t) => t.status === 'accepted' || t.status === 'proposed')
  const completedTasks = tasks
    .filter((t) => t.status === 'completed' || t.status === 'incomplete' || t.status === 'rejected' || t.status === 'cancelled')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const basePath = `/${owner}/${repo}`

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-gray-400 mb-2">{owner}</div>
              <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-gray-500 mt-1.5 leading-relaxed">{project.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DeployButton project={project} />
              {project.deploy_status === 'deployed' && project.deployed_url && (
                <>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      showPreview
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    title={showPreview ? 'Close preview' : 'Preview deployed app'}
                  >
                    {showPreview ? 'Close preview' : 'Preview'}
                  </button>
                  <a
                    href={project.deployed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
                    title="Open in new tab"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                </>
              )}
              <a
                href={`https://github.com/${project.github_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="View on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              {currentUser && project.owner_id === currentUser.id && (
                <Link
                  href={`${basePath}/settings`}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* Primary CTA */}
          <div className="mt-6 flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href={`${basePath}/chat`}
                className="inline-flex px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Contribute idea
              </Link>
            ) : (
              <button
                onClick={() => redirectToLogin(`${basePath}/chat`)}
                className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Contribute idea
              </button>
            )}
            <Link
              href={`${basePath}/sponsor`}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Sponsor
            </Link>
            <Link
              href={`${basePath}/council`}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Governance
            </Link>
            {/* Fork button: public projects, logged-in Pro users who don't own it */}
            {project.is_public && currentUser && project.owner_id !== currentUser.id && currentUser.subscription_tier === 'pro' && (
              <button
                onClick={async () => {
                  try {
                    const forked = await forkProject(project.id)
                    toast.success('Project forked successfully')
                    router.push(`/${forked.github_repo}`)
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to fork project')
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Fork
              </button>
            )}
            {/* Follow button: public projects, not the owner */}
            {project.is_public && followStatus && currentUser && project.owner_id !== currentUser.id && (
              <button
                onClick={async () => {
                  setFollowLoading(true)
                  try {
                    const result = followStatus.following
                      ? await unfollowProject(project.id)
                      : await followProject(project.id)
                    setFollowStatus(result)
                    toast.success(result.following ? 'Following project' : 'Unfollowed project')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to update follow status')
                  } finally {
                    setFollowLoading(false)
                  }
                }}
                disabled={followLoading}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                  followStatus.following
                    ? 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill={followStatus.following ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {followStatus.following ? 'Following' : 'Follow'}
                {followStatus.follower_count > 0 && (
                  <span className="text-xs text-gray-400">{followStatus.follower_count}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && project.deployed_url && (
          <PreviewPanel url={project.deployed_url} onClose={() => setShowPreview(false)} />
        )}

        {/* Vision + Stats row */}
        {(project.vision || (analytics && (analytics.tasks.total > 0 || analytics.cost.total_cost_usd > 0)) || topContributors.length > 0) && (
          <div className="flex flex-col lg:flex-row gap-4 mb-10">
            {project.vision && (
              <div className="flex-1 p-5 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Vision</p>
                <p className="text-sm text-gray-700 leading-relaxed">{project.vision}</p>
              </div>
            )}

            {topContributors.length > 0 && (
              <div className="p-5 rounded-xl bg-gray-50 border border-gray-100 shrink-0">
                <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">Top Contributors</p>
                <div className="flex items-center gap-4">
                  {topContributors.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center gap-2" title={`${s.display_name || `@${s.sponsor_username}`} - $${s.total_contributed_usd}`}>
                      {s.sponsor_avatar_url ? (
                        <Image src={s.sponsor_avatar_url} alt={s.sponsor_username} width={28} height={28} className="rounded-full" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                          {s.sponsor_username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="text-xs">
                        <div className="font-medium text-gray-900 truncate max-w-[80px]">
                          {s.display_name || `@${s.sponsor_username}`}
                        </div>
                        <div className="text-gray-500">${s.total_contributed_usd.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics && (analytics.tasks.total > 0 || analytics.cost.total_cost_usd > 0) && (
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 min-w-[100px]">
                  <p className="text-xs text-gray-400">Tasks</p>
                  <p className="text-lg font-semibold text-gray-900">{analytics.tasks.total}</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 min-w-[100px]">
                  <p className="text-xs text-gray-400">Last Task</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analytics.cost.last_task_cost_usd != null ? `$${analytics.cost.last_task_cost_usd.toFixed(2)}` : '-'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 min-w-[100px]">
                  <p className="text-xs text-gray-400">Avg Time</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analytics.timing.avg_duration_seconds && analytics.timing.avg_duration_seconds > 0
                      ? analytics.timing.avg_duration_seconds < 60
                        ? `${Math.round(analytics.timing.avg_duration_seconds)}s`
                        : `${Math.round(analytics.timing.avg_duration_seconds / 60)}m`
                      : '-'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 min-w-[100px]">
                  <p className="text-xs text-gray-400">Total Cost</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${analytics.cost.total_cost_usd.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent Workspace */}
        {queueStatus && (
          <AgentWorkspace
            queueStatus={queueStatus}
            projectId={project?.id}
            projectQueuedCount={queuedTasks.length}
            pausedTask={null}
            activeSponsor={activeSponsor}
            onTaskStateChanged={() => {
              if (project) {
                getProjectLedger(project.id).then(r => setTasks(r.items))
                getQueueStatus().then(setQueueStatus)
              }
            }}
          />
        )}


        {/* Active Work — show first, prominently */}
        {activeTasks.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
                <h2 className="text-sm font-medium text-gray-900">In Progress</h2>
              </div>
              {activeTasks.length > 1 && (
                <span className="text-xs text-gray-400 tabular-nums">
                  {activeTasks.length} parallel tasks
                </span>
              )}
            </div>
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskCard key={task.id} task={task} basePath={basePath} />
              ))}
            </div>
          </section>
        )}

        {/* Idea Contributors */}
        {ideaContributors.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-900">Contributors</h2>
              <span className="text-xs text-gray-400">{ideaContributors.length} people</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {ideaContributors.map((c) => (
                <Link
                  key={c.username}
                  href={`/u/${c.username}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {c.avatar_url ? (
                    <Image src={c.avatar_url} alt={c.username} width={24} height={24} className="rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                      {c.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="text-xs">
                    <span className="font-medium text-gray-900">{c.display_name || c.username}</span>
                    <span className="text-gray-400 ml-1.5">
                      {c.shipped > 0 ? `${c.shipped} shipped` : `${c.ideas} idea${c.ideas !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Two Column: Queue + Completed */}
        <div className="grid lg:grid-cols-2 gap-10 mb-10">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-900">Queue</h2>
              <span className="text-xs text-gray-400">{queuedTasks.length} pending</span>
            </div>
            {queuedTasks.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-gray-200 text-center">
                <p className="text-gray-500 text-sm mb-2">No ideas in queue</p>
                {isLoggedIn ? (
                  <Link href={`${basePath}/chat`} className="text-xs text-gray-900 underline underline-offset-4 hover:text-gray-600">
                    Contribute an idea
                  </Link>
                ) : (
                  <button onClick={() => redirectToLogin(`${basePath}/chat`)} className="text-xs text-gray-900 underline underline-offset-4 hover:text-gray-600">
                    Sign in to contribute
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {queuedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} basePath={basePath} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-900">Completed</h2>
              <span className="text-xs text-gray-400">{completedTasks.length} done</span>
            </div>
            {completedTasks.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-gray-200 text-center">
                <p className="text-gray-500 text-sm">No completed tasks yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(showAllCompleted ? completedTasks : completedTasks.slice(0, 5)).map((task) => (
                  <TaskCard key={task.id} task={task} basePath={basePath} />
                ))}
                {completedTasks.length > 5 && (
                  <button
                    onClick={() => setShowAllCompleted(!showAllCompleted)}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 text-center py-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {showAllCompleted ? 'Show less' : `+${completedTasks.length - 5} more`}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Deployment History */}
        {deployments.length > 0 ? (
          <section className="mb-10">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Deployments</h2>
            <div className="space-y-2">
              {deployments.slice(0, 5).map((d) => {
                const statusColors: Record<string, string> = {
                  deployed: 'bg-green-500',
                  deploying: 'bg-gray-900 animate-pulse',
                  failed: 'bg-red-400',
                  pending: 'bg-gray-400',
                  promoted: 'bg-green-500',
                  testing: 'bg-amber-400',
                }
                const dateStr = d.deployed_at
                  ? new Date(d.deployed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[d.status] || 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 font-medium capitalize">{d.status}</span>
                        <span className="text-xs text-gray-400 font-mono">{d.commit_sha.slice(0, 7)}</span>
                      </div>
                      <div className="text-xs text-gray-500">{dateStr}</div>
                    </div>
                    {d.public_url && d.status === 'deployed' && (
                      <a
                        href={d.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2"
                      >
                        View
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ) : currentUser?.id === project.owner_id ? (
          <section className="mb-10">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Deployments</h2>
            <p className="text-sm text-gray-400">No deployments yet. Use the chat to ask the Maintainer to deploy your project.</p>
          </section>
        ) : null}

        {/* Recent Conversations */}
        {conversations.length > 0 && (
          <section className="max-w-full overflow-hidden">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Recent Conversations</h2>
            <div className="space-y-2">
              {conversations.slice(0, 5).map((conv) => (
                <div key={conv.id} className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`${basePath}/chat/${conv.id}`}
                    className="flex-1 min-w-0 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {conv.preview ? (
                          <p className="text-sm text-gray-700 truncate">{conv.preview}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No preview</p>
                        )}
                        <span className="text-xs text-gray-400">{new Date(conv.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md ml-3 ${
                        conv.outcome === 'task_created' ? 'bg-gray-100 text-gray-700' :
                        conv.outcome === 'ongoing' ? 'bg-gray-100 text-gray-600' :
                        conv.outcome === 'rejected' ? 'bg-gray-100 text-gray-500' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {conv.outcome === 'task_created' ? 'Task created' :
                         conv.outcome === 'ongoing' ? 'Ongoing' :
                         conv.outcome === 'rejected' ? 'Rejected' : conv.outcome}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={async () => {
                      if (confirm('Delete this conversation?')) {
                        try {
                          await deleteConversation(conv.id)
                          setConversations((prev) => prev.filter((c) => c.id !== conv.id))
                          toast('Conversation deleted')
                        } catch {
                          toast.error('Failed to delete conversation')
                        }
                      }
                    }}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-gray-100 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Project Search */}
        {isLoggedIn && project && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-medium text-gray-900">Search</h2>
              <span className="text-xs text-gray-400">code, knowledge, conversations</span>
            </div>
            <SearchPanel projectId={project.id} />
          </section>
        )}

        {/* Agent Quality Eval Dashboard */}
        {project && (
          <section className="mb-10">
            <EvalDashboard projectId={project.id} />
          </section>
        )}
      </div>
    </div>
  )
}


function TaskCard({ task, basePath }: { task: LedgerTask; basePath: string }) {
  const status = statusConfig[task.status] || statusConfig.proposed
  const [expanded, setExpanded] = useState(false)
  const [progress, setProgress] = useState<TaskStreamEvent[]>([])
  const [prChain, setPrChain] = useState<TaskPR[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set())
  const [diffPR, setDiffPR] = useState<number | null>(null)
  const [diffFiles, setDiffFiles] = useState<PRFileChange[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [taskCost, setTaskCost] = useState<TaskCost | null>(null)
  const [taskEval, setTaskEval] = useState<TaskEvalResponse | null>(null)

  const isMultiStage = task.current_stage > 0
  const canExpand = task.status === 'completed' || task.status === 'incomplete' || task.status === 'rejected' || task.status === 'cancelled' || isMultiStage

  const handleExpand = async () => {
    if (!canExpand) return
    const newExpanded = !expanded
    setExpanded(newExpanded)

    if (newExpanded && progress.length === 0 && prChain.length === 0) {
      setLoading(true)
      try {
        const isTerminal = task.status === 'completed' || task.status === 'incomplete' || task.status === 'rejected' || task.status === 'cancelled'
        const [data, prs, cost, evalRes] = await Promise.all([
          isTerminal ? getTaskProgress(task.id) : Promise.resolve([]),
          isMultiStage ? getTaskPRs(task.id).catch(() => []) : Promise.resolve([]),
          isTerminal ? getTaskCost(task.id).catch(() => null) : Promise.resolve(null),
          isTerminal ? getTaskEval(task.id).catch(() => null) : Promise.resolve(null),
        ])
        setProgress(data)
        setPrChain(prs)
        if (cost) setTaskCost(cost)
        if (evalRes) setTaskEval(evalRes)
      } catch (e) {
        console.error('Failed to load progress:', e)
      } finally {
        setLoading(false)
      }
    }
  }

  const loadDiff = async (prNumber: number) => {
    if (diffPR === prNumber) {
      setDiffPR(null)
      return
    }
    setDiffPR(prNumber)
    setDiffLoading(true)
    try {
      const files = await getTaskPRFiles(task.id, prNumber)
      setDiffFiles(files)
    } catch (e) {
      console.error('Failed to load diff:', e)
      setDiffFiles([])
    } finally {
      setDiffLoading(false)
    }
  }

  const hasToolResult = (toolName: string, fromIndex: number) => {
    for (let j = fromIndex + 1; j < progress.length; j++) {
      if (progress[j].type === 'tool_result' && progress[j].tool === toolName) {
        return true
      }
    }
    return false
  }

  const formatEvent = (event: TaskStreamEvent, index: number): { icon: string; text: string; color: string; hidden?: boolean } => {
    switch (event.type) {
      case 'turn_start':
        return { icon: '', text: `Turn ${event.turn}`, color: 'text-gray-400' }
      case 'agent_text':
        return { icon: '', text: event.text || '', color: 'text-gray-700' }
      case 'tool_call': {
        const toolName = event.tool || ''
        let args = ''
        if (event.input) {
          const input = event.input as Record<string, unknown>
          if (input.command) args = `: ${String(input.command).slice(0, 60)}${String(input.command).length > 60 ? '...' : ''}`
          else if (input.path) args = `: ${input.path}`
          else if (input.query) args = `: ${input.query}`
          else if (input.title) args = `: ${input.title}`
        }
        const completed = hasToolResult(toolName, index)
        return {
          icon: completed ? '\u2713' : '\u2022',
          text: `${toolName}${args}`,
          color: completed ? 'text-gray-600' : 'text-gray-500',
        }
      }
      case 'tool_result':
        return { icon: '', text: '', color: '', hidden: true }
      default:
        return { icon: '\u2022', text: '', color: 'text-gray-500' }
    }
  }

  const content = (
    <div
      className={`p-3.5 rounded-xl bg-white border border-gray-200 ${canExpand || task.conversation_id ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''}`}
      onClick={canExpand ? handleExpand : undefined}
      onKeyDown={canExpand ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpand() } } : undefined}
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : undefined}
      aria-expanded={canExpand ? expanded : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
            {isMultiStage && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-500 shrink-0">
                {task.current_stage + 1} stages
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-500 line-clamp-1 flex-1">{task.description}</p>
            {task.started_at && task.completed_at && (
              <span className="text-[10px] text-gray-400 shrink-0">
                {(() => {
                  const s = Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000)
                  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`
                })()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.github_pr_url && !isMultiStage && (() => {
            const prNum = parseInt(task.github_pr_url.split('/').pop() || '0')
            return (
              <span className="flex items-center gap-1.5">
                <a href={task.github_pr_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900" onClick={(e) => e.stopPropagation()}>
                  PR
                </a>
                {prNum > 0 && (task.status === 'completed' || task.status === 'incomplete') && (
                  <button
                    className={`text-[10px] px-1.5 py-0.5 rounded ${diffPR === prNum ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
                    onClick={(e) => { e.stopPropagation(); loadDiff(prNum) }}
                  >
                    Diff
                  </button>
                )}
              </span>
            )
          })()}
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${status.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          {canExpand && (
            <span className="text-gray-400 text-xs">{expanded ? '\u25bc' : '\u25b6'}</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {loading ? (
            <div className="text-xs text-gray-400">Loading agent work...</div>
          ) : (
            <>
              {/* PR Chain Timeline */}
              {prChain.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">PR Chain</p>
                  <div className="space-y-0">
                    {prChain.map((pr, i) => (
                      <div key={pr.pr_number} className="flex items-stretch gap-0">
                        {/* Timeline connector */}
                        <div className="flex flex-col items-center w-5 shrink-0">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            pr.status === 'merged' ? 'bg-green-500' :
                            pr.status === 'open' ? 'bg-gray-900 animate-pulse' :
                            'bg-gray-300'
                          }`} />
                          {i < prChain.length - 1 && (
                            <div className="w-px flex-1 bg-gray-200 my-0.5" />
                          )}
                        </div>
                        {/* PR info */}
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={pr.pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-gray-900 hover:underline underline-offset-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              #{pr.pr_number}
                            </a>
                            <span className="text-xs text-gray-500 truncate">
                              {pr.stage_title || `Stage ${pr.stage_number}`}
                            </span>
                            <span className={`text-[10px] px-1 py-px rounded ${
                              pr.status === 'merged' ? 'bg-green-50 text-green-700' :
                              pr.status === 'open' ? 'bg-gray-100 text-gray-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {pr.status}
                            </span>
                            {pr.is_final && (
                              <span className="text-[10px] text-gray-400">final</span>
                            )}
                            <button
                              className={`text-[10px] px-1.5 py-0.5 rounded ${diffPR === pr.pr_number ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
                              onClick={(e) => { e.stopPropagation(); loadDiff(pr.pr_number) }}
                            >
                              Diff
                            </button>
                          </div>
                          {pr.done_summary && (
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{pr.done_summary}</p>
                          )}
                          {diffPR === pr.pr_number && (
                            <DiffViewer files={diffFiles} loading={diffLoading} onClose={() => setDiffPR(null)} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost & Quality */}
              {(taskCost || taskEval?.eval) && (
                <div className="flex flex-wrap gap-3 mb-3">
                  {taskCost && taskCost.total_cost_usd > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                      <span className="text-[10px] text-gray-400">Cost</span>
                      <span className="text-xs font-medium text-gray-700">${taskCost.total_cost_usd.toFixed(3)}</span>
                    </div>
                  )}
                  {taskCost && (taskCost.total_input_tokens > 0 || taskCost.total_output_tokens > 0) && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                      <span className="text-[10px] text-gray-400">Tokens</span>
                      <span className="text-xs font-medium text-gray-700">
                        {((taskCost.total_input_tokens + taskCost.total_output_tokens) / 1000).toFixed(1)}k
                      </span>
                    </div>
                  )}
                  {taskEval?.eval && (
                    <>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                        <span className="text-[10px] text-gray-400">Quality</span>
                        <span className={`text-xs font-medium ${
                          taskEval.eval.quality_score >= 80 ? 'text-green-700' :
                          taskEval.eval.quality_score >= 60 ? 'text-gray-700' :
                          'text-amber-700'
                        }`}>
                          {taskEval.eval.quality_score}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                        <span className="text-[10px] text-gray-400">Turns</span>
                        <span className="text-xs font-medium text-gray-700">{taskEval.eval.total_turns}</span>
                      </div>
                      {taskEval.eval.model_used && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                          <span className="text-[10px] text-gray-400">Model</span>
                          <span className="text-xs font-mono text-gray-600">
                            {taskEval.eval.model_used.replace(/^claude-/, '').replace(/-\d{8}$/, '')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Agent work log */}
              {progress.length === 0 && prChain.length === 0 ? (
                <div className="text-xs text-gray-400">No progress data available</div>
              ) : progress.length > 0 && (
                <div className="max-h-60 overflow-y-auto font-mono text-xs space-y-1">
                  {progress.map((event, i) => {
                    const formatted = formatEvent(event, i)
                    if (!formatted.text || formatted.hidden) return null

                    let displayText = ''
                    if (event.type === 'tool_call' && event.tool) {
                      for (let j = i + 1; j < progress.length; j++) {
                        if (progress[j].type === 'tool_result' && progress[j].tool === event.tool) {
                          displayText = progress[j].result || ''
                          break
                        }
                      }
                    }
                    const hasOutput = displayText.length > 0
                    const isExpandable = event.type === 'tool_call' && displayText.length > 80
                    const isResultExpanded = expandedResults.has(i)

                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${isExpandable ? 'cursor-pointer' : ''}`}
                        onClick={isExpandable ? (e) => {
                          e.stopPropagation()
                          setExpandedResults(prev => {
                            const next = new Set(prev)
                            if (next.has(i)) next.delete(i)
                            else next.add(i)
                            return next
                          })
                        } : undefined}
                      >
                        <span className={`${formatted.color} w-4 shrink-0`}>{formatted.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className={formatted.color}>{formatted.text}</span>
                          {hasOutput && (
                            <div className={`mt-1 text-gray-500 ${isResultExpanded ? '' : 'line-clamp-2'} whitespace-pre-wrap break-all`}>
                              {displayText}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {/* Inline diff for single-PR tasks */}
          {diffPR !== null && !isMultiStage && (
            <DiffViewer files={diffFiles} loading={diffLoading} onClose={() => setDiffPR(null)} />
          )}
          {task.conversation_id && (
            <Link
              href={`${basePath}/chat/${task.conversation_id}`}
              className="block mt-2 text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              View original conversation
            </Link>
          )}
        </div>
      )}
    </div>
  )

  if (!canExpand && task.conversation_id) {
    return (
      <Link href={`${basePath}/chat/${task.conversation_id}`}>
        {content}
      </Link>
    )
  }

  return content
}

function PreviewPanel({ url, onClose }: { url: string; onClose: () => void }) {
  const [iframeError, setIframeError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isFullHeight, setIsFullHeight] = useState(false)

  return (
    <div className="mb-10 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-400 truncate max-w-[300px]">{url}</span>
          {isLoading && (
            <svg className="w-3.5 h-3.5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsFullHeight(!isFullHeight)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title={isFullHeight ? 'Collapse' : 'Expand'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullHeight ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Open in new tab"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Close preview"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Iframe */}
      {iframeError ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <p className="text-sm text-gray-500 mb-2">Preview unavailable</p>
          <p className="text-xs text-gray-400 mb-4">This app may block iframe embedding.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Open in new tab
          </a>
        </div>
      ) : (
        <iframe
          src={url}
          className={`w-full border-0 transition-all duration-200 ${isFullHeight ? 'h-[80vh]' : 'h-[400px]'}`}
          onLoad={() => setIsLoading(false)}
          onError={() => { setIframeError(true); setIsLoading(false) }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="App preview"
        />
      )}
    </div>
  )
}

function DeployButton({ project }: { project: Project }) {
  const [status, setStatus] = useState(project.deploy_status)
  const [url, setUrl] = useState(project.deployed_url)
  const [error, setError] = useState(project.deploy_error)

  useEffect(() => {
    setStatus(project.deploy_status)
    setUrl(project.deployed_url)
    setError(project.deploy_error)
  }, [project.deploy_status, project.deployed_url, project.deploy_error])

  useEffect(() => {
    if (status !== 'deploying' && status !== 'pending') return

    const interval = setInterval(async () => {
      try {
        const data = await getDeployStatus(project.id)
        if (data.deploy_status !== status || data.deployed_url !== url) {
          setStatus(data.deploy_status)
          setUrl(data.deployed_url)
          setError(data.deploy_error)
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [status, url, project.id])

  if (status === 'deploying' || status === 'pending') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Deploying...
      </span>
    )
  }

  if (status === 'deployed') {
    return null
  }

  if (status === 'failed') {
    return (
      <span
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-sm font-medium cursor-default"
        title={error || 'Deployment failed'}
      >
        Deploy failed
      </span>
    )
  }

  return null
}
