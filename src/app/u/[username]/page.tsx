'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPublicProfile, type PublicProfile, type Contribution } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

function statusBadge(status: Contribution['status']) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'Shipped', className: 'bg-green-50 text-green-700' },
    in_progress: { label: 'Building', className: 'bg-blue-50 text-blue-700' },
    accepted: { label: 'Accepted', className: 'bg-violet-50 text-violet-700' },
    proposed: { label: 'Proposed', className: 'bg-gray-100 text-gray-600' },
    paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700' },
    incomplete: { label: 'Incomplete', className: 'bg-amber-50 text-amber-700' },
    rejected: { label: 'Rejected', className: 'bg-red-50 text-red-600' },
    cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-600' },
  }
  const c = config[status] || { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

const CONTRIBUTIONS_PER_PAGE = 20

export default function PublicProfilePage() {
  const params = useParams()
  const username = params.username as string
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [visibleCount, setVisibleCount] = useState(CONTRIBUTIONS_PER_PAGE)

  useEffect(() => {
    if (!username) return
    getPublicProfile(username)
      .then(setProfile)
      .catch((err: Error) => {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setNotFound(true)
        }
      })
      .finally(() => setLoading(false))
  }, [username])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full" />
            <div>
              <div className="h-6 bg-gray-100 rounded-lg w-40 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-24" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-16 bg-gray-50 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm font-mono text-gray-400 mb-3">404</p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">User not found</h1>
          <p className="text-gray-500 mb-8">
            No user with the username &ldquo;{username}&rdquo; exists.
          </p>
          <Link
            href="/explore"
            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Explore projects
          </Link>
        </div>
      </div>
    )
  }

  const shipped = profile.contributions.filter((c) => c.status === 'completed').length
  const active = profile.contributions.filter((c) => c.status === 'in_progress' || c.status === 'accepted').length

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.username}
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-2xl font-semibold text-gray-400">
              {profile.username[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm font-mono text-gray-400">@{profile.username}</p>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-gray-600 mb-6 leading-relaxed">{profile.bio}</p>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-6 mb-8 pb-8 border-b border-gray-100">
        <div>
          <div className="text-lg font-semibold text-gray-900">{profile.contributions.length}</div>
          <div className="text-xs text-gray-500">Ideas</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{shipped}</div>
          <div className="text-xs text-gray-500">Shipped</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{active}</div>
          <div className="text-xs text-gray-500">Active</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {profile.github_username && (
            <a
              href={`https://github.com/${profile.github_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {profile.github_username}
            </a>
          )}
          <span className="text-xs text-gray-400">
            Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Public Projects */}
      {profile.projects.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects</h2>
          <div className="space-y-2">
            {profile.projects.map((project) => (
              <Link
                key={project.id}
                href={`/${project.github_repo}`}
                className="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-gray-900">{project.name}</h3>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{project.github_repo}</p>
                {project.description && (
                  <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Contributions */}
      {profile.contributions.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500">No public contributions yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Ideas contributed to public projects will appear here.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contributions</h2>
          <div className="space-y-2">
            {profile.contributions.slice(0, visibleCount).map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-gray-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{c.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Link
                        href={`/${c.project_github_repo}`}
                        className="text-xs font-mono text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {c.project_name}
                      </Link>
                      <span className="text-xs text-gray-300">&middot;</span>
                      <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </div>
                  {statusBadge(c.status)}
                </div>
                {c.github_pr_url && (
                  <a
                    href={c.github_pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                    </svg>
                    View PR
                  </a>
                )}
              </div>
            ))}
          </div>
          {profile.contributions.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((v) => v + CONTRIBUTIONS_PER_PAGE)}
              className="mt-4 w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
            >
              Show more ({profile.contributions.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
