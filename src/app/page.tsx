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
        {/* Gradient background — violet tint fading to canvas; adapts in dark mode */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent-subtle/50 via-canvas to-canvas pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-accent/10 via-accent/15 to-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-line bg-surface/80 text-sm text-ink-secondary mb-8">
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

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-ink mb-6 leading-[1.08]">
            Software that
            <br />
            grows&nbsp;itself.
          </h1>
          <p className="text-lg text-ink-secondary mb-8 max-w-md mx-auto leading-relaxed">
            Contribute ideas to living open source projects. AI agents implement them, create PRs, and ship features&mdash;while you watch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/explore"
              className="px-6 py-3 rounded-lg bg-ink text-canvas font-medium hover:bg-ink/90 transition-colors text-center"
            >
              Explore projects
            </Link>
            <a
              href="https://github.com/bloom-base"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-lg border border-line text-ink-secondary font-medium hover:border-line hover:bg-canvas-subtle transition-colors text-center"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      {!loading && projects.length > 0 && (
        <section className="py-8 px-6 border-t border-line-subtle bg-canvas-subtle/50">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 text-center">
              <div>
                <div className="text-2xl font-semibold text-ink tabular-nums">{projects.length}</div>
                <div className="text-sm text-ink-secondary mt-0.5">Live projects</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-ink tabular-nums">{totalInProgress}</div>
                <div className="text-sm text-ink-secondary mt-0.5">Building now</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-ink tabular-nums">{totalQueued}</div>
                <div className="text-sm text-ink-secondary mt-0.5">Ideas queued</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-ink tabular-nums">{totalCompleted}</div>
                <div className="text-sm text-ink-secondary mt-0.5">Ideas shipped</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Live Projects */}
      <section className="py-16 sm:py-20 px-6 border-t border-line-subtle">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-10">
            <div>
              <h2 className="text-2xl font-semibold text-ink mb-1">Live projects</h2>
              <p className="text-sm text-ink-secondary">Open source projects growing in real time</p>
            </div>
            <Link
              href="/explore"
              className="text-sm text-ink-secondary hover:text-ink transition-colors"
            >
              View all &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl border border-line-subtle bg-canvas-subtle animate-pulse"
                />
              ))}
            </div>
          ) : fetchError ? (
            <div className="text-center py-16 border border-dashed border-line rounded-xl">
              <p className="text-ink-secondary mb-3">Could not load projects right now.</p>
              <button
                onClick={() => { setFetchError(false); setLoading(true); fetchProjects().finally(() => setLoading(false)) }}
                className="text-sm text-ink underline underline-offset-2 hover:text-ink-secondary"
              >
                Try again
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 text-ink-secondary border border-dashed border-line rounded-xl">
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
      <section className="py-16 sm:py-20 px-6 border-t border-line-subtle">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-ink text-center mb-4">
            How it works
          </h2>
          <p className="text-ink-secondary text-center mb-16 max-w-lg mx-auto">
            No code required. Share ideas and watch AI agents ship them.
          </p>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            <div className="relative">
              <div className="text-xs font-mono text-ink-tertiary mb-3">01</div>
              <h3 className="font-semibold text-ink mb-2">Pick a project</h3>
              <p className="text-ink-secondary text-sm leading-relaxed">
                Browse living open source projects. Each has its own vision, task queue, and AI agents.
              </p>
            </div>
            <div className="relative">
              <div className="text-xs font-mono text-ink-tertiary mb-3">02</div>
              <h3 className="font-semibold text-ink mb-2">Share an idea</h3>
              <p className="text-ink-secondary text-sm leading-relaxed">
                Chat with the project&apos;s AI maintainer. Describe features, fixes, or improvements.
              </p>
            </div>
            <div className="relative">
              <div className="text-xs font-mono text-ink-tertiary mb-3">03</div>
              <h3 className="font-semibold text-ink mb-2">Watch it grow</h3>
              <p className="text-ink-secondary text-sm leading-relaxed">
                The agent implements your idea, creates PRs, and ships code. The project evolves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For developers */}
      <section className="py-16 sm:py-20 px-6 border-t border-line-subtle">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-ink text-center mb-4">
            For developers
          </h2>
          <p className="text-ink-secondary text-center mb-12 max-w-lg mx-auto">
            Already have an Anthropic API key? Bring it to Bloom and get priority access.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-line bg-surface">
              <div className="w-8 h-8 rounded-lg bg-canvas-muted flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-ink-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ink mb-1">Bring your own key</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Add your Anthropic API key. Agents use it directly&mdash;no markup. Available on any plan.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-line bg-surface">
              <div className="w-8 h-8 rounded-lg bg-canvas-muted flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-ink-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ink mb-1">Priority queue</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                BYOK tasks jump ahead in the queue. Your ideas get built first.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-line bg-surface">
              <div className="w-8 h-8 rounded-lg bg-canvas-muted flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-ink-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ink mb-1">Shared knowledge</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Every session makes the next one smarter. Agents learn from the project&apos;s history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 px-6 border-t border-line-subtle">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-semibold text-ink mb-4">
            Ready to contribute?
          </h2>
          <p className="text-ink-secondary mb-8 text-lg">
            Pick a project and share your first idea. No code required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/explore"
              className="inline-block px-8 py-3.5 rounded-lg bg-ink text-canvas font-medium hover:bg-ink/90 transition-colors"
            >
              Explore projects
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-8 py-3.5 rounded-lg border border-line text-ink-secondary font-medium hover:border-line hover:bg-canvas-subtle transition-colors"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
