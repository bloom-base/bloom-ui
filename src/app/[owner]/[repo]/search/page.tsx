'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import SearchPanel from '@/components/SearchPanel'
import { getProjectByPath, getCurrentUser, type Project, type UserProfile } from '@/lib/api'

const RESERVED_PATHS = ['explore', 'new', 'auth', 'api', 'projects', 'settings', '_next', 'favicon.ico', 'profile', 'pricing', 'admin', 'analytics', 'u', 'terms', 'privacy']

export default function SearchPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-100 rounded-xl w-1/3" />
            <div className="h-4 bg-gray-100 rounded-xl w-2/3" />
            <div className="h-64 bg-gray-50 rounded-xl mt-8" />
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
            <div className="text-gray-400 mb-2">Sign in to search</div>
            <p className="text-sm text-gray-400">
              Search is available to authenticated users.
            </p>
            <Link href="/auth/login" className="inline-block mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Search</h1>
          <p className="text-gray-500 mt-1">
            Search across code, knowledge, and conversation history
          </p>
        </div>
        <SearchPanel projectId={project.id} fullPage />
      </div>
    </div>
  )
}
