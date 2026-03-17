'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ProjectCard } from '@/components/ProjectCard'
import { getPublicProjects, getCurrentUser, type PublicProject, type UserProfile } from '@/lib/api'

type FilterMode = 'all' | 'active' | 'idle'
type SortMode = 'recent' | 'shipped' | 'newest'

export default function ExplorePage() {
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('recent')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      getPublicProjects(),
      getCurrentUser().catch(() => null),
    ])
      .then(([res, user]) => {
        setProjects(res.items)
        setCurrentUser(user)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const isPro = currentUser?.subscription_tier === 'pro' || currentUser?.subscription_tier === 'enterprise'

  // Apply search first, then compute filter counts from search results
  const searchFiltered = projects.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.github_repo.toLowerCase().includes(q)
    }
    return true
  })

  const activeCount = searchFiltered.filter((p) => p.in_progress > 0).length
  const idleCount = searchFiltered.filter((p) => p.in_progress === 0).length

  const filteredProjects = searchFiltered.filter((p) => {
    if (filter === 'active' && p.in_progress === 0) return false
    if (filter === 'idle' && p.in_progress > 0) return false
    return true
  }).sort((a, b) => {
    if (sort === 'shipped') return (b.completed ?? 0) - (a.completed ?? 0)
    if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    // 'recent' — most recently active first, null last
    const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0
    const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0
    return bTime - aTime
  })

  const getOrg = (githubRepo: string) => githubRepo.split('/')[0] || 'unknown'

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="mb-12">
            <div className="h-9 w-56 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-3" />
            <div className="h-5 w-80 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400">Failed to load projects</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              Promise.all([
                getPublicProjects(),
                getCurrentUser().catch(() => null),
              ])
                .then(([res, user]) => {
                  setProjects(res.items)
                  setCurrentUser(user)
                })
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false))
            }}
            className="mt-4 text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Explore projects
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Living open source projects you can contribute ideas to.
            </p>
          </div>
          {isPro && (
            <Link
              href="/new"
              className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-white transition-colors"
            >
              New Project
            </Link>
          )}
        </div>

        {/* Search + Filters */}
        {projects.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              aria-label="Search projects by name or description"
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent w-full sm:w-56"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit" role="group" aria-label="Filter projects by activity">
            <button
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              All ({searchFiltered.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              aria-pressed={filter === 'active'}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                filter === 'active'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('idle')}
              aria-pressed={filter === 'idle'}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                filter === 'idle'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
              Idle ({idleCount})
            </button>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sort projects"
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent sm:ml-auto"
          >
            <option value="recent">Recently active</option>
            <option value="shipped">Most shipped</option>
            <option value="newest">Newest first</option>
          </select>
          </div>
        )}

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            {projects.length === 0 ? (
              <>
                <p className="text-gray-500 dark:text-gray-400">No public projects yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Check back soon for our flagship open source projects.
                </p>
              </>
            ) : search.trim() && searchFiltered.length === 0 ? (
              <>
                <p className="text-gray-500 dark:text-gray-400">No projects match &ldquo;{search}&rdquo;</p>
                <button
                  onClick={() => setSearch('')}
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-2 underline underline-offset-2"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 dark:text-gray-400">No {filter === 'active' ? 'active' : 'idle'} projects{search.trim() ? ` matching "${search}"` : ''}</p>
                <button
                  onClick={() => setFilter('all')}
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-2 underline underline-offset-2"
                >
                  Show all projects
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
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
    </div>
  )
}
