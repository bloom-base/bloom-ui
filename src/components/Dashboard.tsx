'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getDashboard, type DashboardData, type UserProfile } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { ProjectCard } from './ProjectCard'

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: 'Shipped', className: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400' },
  in_progress: { label: 'Building', className: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400' },
  accepted: { label: 'Accepted', className: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400' },
  proposed: { label: 'Proposed', className: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400' },
  paused: { label: 'Paused', className: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400' },
  incomplete: { label: 'Incomplete', className: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400' },
  rejected: { label: 'Rejected', className: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' },
}

const activityConfig: Record<string, { icon: string; verb: string; color: string }> = {
  shipped: { icon: '\u2713', verb: 'Shipped', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950' },
  building: { icon: '\u2699', verb: 'Building', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950' },
  pr_created: { icon: '\u2192', verb: 'PR created', color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950' },
  idea_proposed: { icon: '+', verb: 'Idea', color: 'text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800' },
}

interface DashboardProps {
  user: UserProfile
}

export function Dashboard({ user }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const isPro = user.subscription_tier === 'pro' || user.subscription_tier === 'enterprise'

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100 dark:bg-zinc-800 rounded-lg w-64 mb-2" />
          <div className="h-5 bg-gray-50 dark:bg-zinc-900 rounded w-48 mb-10" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-50 dark:bg-zinc-900 rounded-xl" />
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-gray-50 dark:bg-zinc-900 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const hasProjects = data.projects.length > 0
  const hasContributions = data.contributions.length > 0
  const hasActivity = data.activity.length > 0
  const hasFeatured = data.featured_projects.length > 0
  const isNewUser = !hasProjects && !hasContributions

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Welcome header */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
          Welcome{isNewUser ? '' : ' back'}{user.handle ? `, ${user.handle}` : ''}
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">
          {hasProjects
            ? `${data.stats.total_projects} project${data.stats.total_projects !== 1 ? 's' : ''}, ${data.stats.total_in_progress} task${data.stats.total_in_progress !== 1 ? 's' : ''} in progress`
            : 'Explore projects and contribute your first idea'}
        </p>
      </div>

      {/* Quick-start guide for new users */}
      {isNewUser && (
        <section className="mb-12">
          <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gradient-to-br from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-1">Get started</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">Three steps to your first contribution.</p>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 text-sm font-bold shrink-0">1</div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-zinc-100">Pick a project</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Browse the projects below and find one that interests you.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 text-sm font-bold shrink-0">2</div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-zinc-100">Chat with the agent</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    The AI maintainer knows the project inside out. Ask questions or share ideas.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 text-sm font-bold shrink-0">3</div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-zinc-100">Watch it ship</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    The agent builds your idea, creates a PR, and ships it. No code required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats row — only for returning users with projects */}
      {(hasProjects || hasContributions) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{data.stats.total_projects}</div>
            <div className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Projects</div>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{data.stats.total_in_progress}</div>
            <div className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">In progress</div>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{data.stats.total_ideas}</div>
            <div className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Total ideas</div>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{data.stats.total_shipped}</div>
            <div className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Shipped</div>
          </div>
        </div>
      )}

      {/* Featured public projects for new users */}
      {isNewUser && hasFeatured && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Projects to explore</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Living open source projects you can contribute to right now.</p>
            </div>
            <Link
              href="/explore"
              className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.featured_projects.map((project) => (
              <ProjectCard
                key={project.id}
                org={project.github_repo.split('/')[0] || 'bloom-base'}
                name={project.name}
                description={project.description}
                inProgress={project.in_progress}
                queued={project.queued}
                completed={project.completed}
                lastActivityAt={project.last_activity_at}
                href={`/${project.github_repo}`}
                flagship={project.github_repo.startsWith('bloom-base/')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Projects section — only for users who have projects */}
      {hasProjects && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Your projects</h2>
            <div className="flex items-center gap-3">
              {isPro && (
                <Link
                  href="/new"
                  className="text-sm px-3.5 py-1.5 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  New project
                </Link>
              )}
              <Link
                href="/explore"
                className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
              >
                Explore &rarr;
              </Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.projects.map((project) => (
              <ProjectCard
                key={project.id}
                org={project.github_repo.split('/')[0] || 'bloom-base'}
                name={project.name}
                description={project.description}
                inProgress={project.in_progress}
                queued={project.queued}
                completed={project.completed}
                lastActivityAt={project.last_activity_at}
                href={`/${project.github_repo}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Two-column: Contributions + Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent contributions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">Your contributions</h2>
          {hasContributions ? (
            <div className="space-y-2">
              {data.contributions.map((c) => {
                const config = statusConfig[c.status] || statusConfig.proposed
                return (
                  <Link
                    key={c.id}
                    href={`/${c.project_github_repo}`}
                    className="block p-3 rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50/50 dark:hover:bg-zinc-900/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{c.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-gray-400 dark:text-zinc-500">{c.project_name}</span>
                          <span className="text-xs text-gray-300 dark:text-zinc-600">&middot;</span>
                          <span className="text-xs text-gray-400 dark:text-zinc-500">{timeAgo(c.created_at)}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${config.className}`}>
                        {config.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">No contributions yet</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Chat with a project&apos;s agent to submit your first idea.
              </p>
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">Recent activity</h2>
          {hasActivity ? (
            <div className="space-y-1">
              {data.activity.map((event, i) => {
                const config = activityConfig[event.type] || activityConfig.idea_proposed
                return (
                  <div
                    key={`${event.type}-${event.title}-${i}`}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${config.color}`}>
                      {config.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 dark:text-zinc-100 font-medium truncate block">
                        {config.verb}: {event.title}
                      </span>
                      <Link
                        href={`/${event.project_github_repo}`}
                        className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        {event.project_name}
                      </Link>
                    </div>
                    {event.github_pr_url && (
                      <a
                        href={event.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        PR
                      </a>
                    )}
                    <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0 font-mono">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">No activity yet</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Activity from your projects will appear here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Upgrade CTA for free users at the bottom */}
      {!isPro && (
        <section className="mt-12 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Create your own projects</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                Upgrade to Pro to connect repos, create private projects, and get higher agent turn limits.
              </p>
            </div>
            <Link
              href="/pricing"
              className="px-5 py-2.5 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors shrink-0 text-center"
            >
              View plans
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
