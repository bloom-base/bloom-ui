'use client'

import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'
import { ProjectCard } from '@/components/ProjectCard'
import { getCurrentUser, getPublicProjects, type UserProfile, type PublicProject } from '@/lib/api'

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getPublicProjects()
      setProjects(data.items)
      setFetchError(false)
    } catch {
      // On initial load, show error state; on refresh, keep existing data
      if (projects.length === 0) setFetchError(true)
    }
  }, [])

  useEffect(() => {
    getCurrentUser()
      .then((profile) => {
        setUser(profile)
        setAuthChecked(true)
      })
      .catch(() => {
        setUser(null)
        setAuthChecked(true)
      })

    fetchProjects().finally(() => setLoading(false))

    // Poll for project updates every 30s
    intervalRef.current = setInterval(fetchProjects, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchProjects])

  const getOrg = (githubRepo: string) => githubRepo.split('/')[0] || 'bloom-base'

  const totalInProgress = projects.reduce((sum, p) => sum + p.in_progress, 0)
  const totalQueued = projects.reduce((sum, p) => sum + p.queued, 0)
  const totalCompleted = projects.reduce((sum, p) => sum + p.completed, 0)

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-24 sm:pt-32 pb-20 sm:pb-24 px-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-50/50 via-white to-white dark:from-violet-950/20 dark:via-gray-950 dark:to-gray-950 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-violet-100/30 via-violet-200/20 to-violet-100/30 dark:from-violet-900/10 dark:via-violet-800/5 dark:to-violet-900/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-sm text-gray-600 dark:text-gray-400 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {loading ? (
              <span>Loading...</span>
            ) : totalInProgress > 0 ? (
              <span>{totalInProgress} {totalInProgress === 1 ? 'agent' : 'agents'} building now</span>
            ) : (
              <span>{totalCompleted} ideas shipped</span>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-gray-900 dark:text-white mb-6 leading-[1.08]">
            Software that
            <br />
            grows&nbsp;itself.
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
            Contribute ideas to living open source projects. AI agents implement them, create PRs, and ship features&mdash;while you watch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/explore"
              className="px-6 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-center"
            >
              Explore projects
            </Link>
            <a
              href="https://github.com/bloom-base"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      {!loading && projects.length > 0 && (
        <section className="py-8 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 text-center">
              <div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{projects.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Live projects</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{totalInProgress}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Building now</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{totalQueued}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ideas queued</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{totalCompleted}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ideas shipped</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Live Projects */}
      <section className="py-16 sm:py-20 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-10">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Live projects</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Open source projects growing in real time</p>
            </div>
            <Link
              href="/explore"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              View all &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 animate-pulse"
                />
              ))}
            </div>
          ) : fetchError ? (
            <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <p className="text-gray-500 dark:text-gray-400 mb-3">Could not load projects right now.</p>
              <button
                onClick={() => { setFetchError(false); setLoading(true); fetchProjects().finally(() => setLoading(false)) }}
                className="text-sm text-gray-900 dark:text-white underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-400"
              >
                Try again
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              No projects yet. Check back soon.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.slice(0, 6).map((project) => (
                <ProjectCard
                  key={project.id}
                  org={getOrg(project.github_repo)}
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
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-4">
            How it works
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-16 max-w-lg mx-auto">
            No code required. Share ideas and watch AI agents ship them.
          </p>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            <div className="relative">
              <div className="text-xs font-mono text-gray-400 dark:text-gray-500 mb-3">01</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Pick a project</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                Browse living open source projects. Each has its own vision, task queue, and AI agents.
              </p>
            </div>
            <div className="relative">
              <div className="text-xs font-mono text-gray-400 dark:text-gray-500 mb-3">02</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Share an idea</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                Chat with the project&apos;s AI maintainer. Describe features, fixes, or improvements.
              </p>
            </div>
            <div className="relative">
              <div className="text-xs font-mono text-gray-400 dark:text-gray-500 mb-3">03</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Watch it grow</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                The agent implements your idea, creates PRs, and ships code. The project evolves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For developers */}
      <section className="py-16 sm:py-20 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-4">
            For developers
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-12 max-w-lg mx-auto">
            Already have an Anthropic API key? Bring it to Bloom and get priority access.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Bring your own key</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Add your Anthropic API key. Agents use it directly&mdash;no markup. Available on any plan.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Priority queue</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                BYOK tasks jump ahead in the queue. Your ideas get built first.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Shared knowledge</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Every session makes the next one smarter. Agents learn from the project&apos;s history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
            Ready to contribute?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-lg">
            Pick a project and share your first idea. No code required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/explore"
              className="inline-block px-8 py-3.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Explore projects
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-8 py-3.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
