'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { getProjectByPath, updateProject, deleteProject, getCurrentUser, getProjectMembers, inviteProjectMember, removeProjectMember, type Project, type ProjectMember, type UserProfile } from '@/lib/api'
import VisionWriter from '@/components/VisionWriter'

// Reserved paths that should NOT be treated as owner/repo
const RESERVED_PATHS = ['explore', 'new', 'auth', 'api', 'projects', 'settings', '_next', 'favicon.ico', 'profile', 'pricing', 'admin', 'analytics', 'u', 'terms', 'privacy']

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [vision, setVision] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [maxParallelTasks, setMaxParallelTasks] = useState<string>('')
  const [autoImprove, setAutoImprove] = useState(false)

  // Members state
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteLoading, setInviteLoading] = useState(false)

  // Vision writer state
  const [showVisionWriter, setShowVisionWriter] = useState(false)

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Check for reserved paths
  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) {
      notFound()
    }
  }, [owner])

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) return

    Promise.all([
      getProjectByPath(owner, repo),
      getCurrentUser().catch(() => null),
    ])
      .then(async ([p, currentUser]) => {
        if (!currentUser || currentUser.id !== p.owner_id) {
          router.push(`/${owner}/${repo}`)
          return
        }
        setProject(p)
        setName(p.name)
        setDescription(p.description)
        setVision(p.vision)
        setIsPublic(p.is_public)
        setMaxParallelTasks(p.max_parallel_tasks?.toString() || '')
        setAutoImprove(p.auto_improve ?? false)
        const m = await getProjectMembers(p.id).catch(() => [])
        setMembers(m)
      })
      .catch((err) => {
        console.error(err)
        setError(err.message || 'Failed to load project')
      })
      .finally(() => setLoading(false))
  }, [owner, repo, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return

    setSaving(true)
    setError(null)

    try {
      const updated = await updateProject(project.id, {
        name,
        description,
        vision,
        is_public: isPublic,
        max_parallel_tasks: maxParallelTasks ? parseInt(maxParallelTasks) : null,
        auto_improve: autoImprove,
      })
      setProject(updated)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-100 rounded mb-8" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/explore" className="text-accent hover:text-accent-hover text-sm">
            Browse projects
          </Link>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Project not found</p>
          <Link href="/explore" className="text-accent hover:text-accent-hover text-sm">
            Browse projects
          </Link>
        </div>
      </div>
    )
  }

  const basePath = `/${owner}/${repo}`

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Project Settings</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="A short description of the project"
            />
          </div>

          {/* Vision */}
          <div>
            <label htmlFor="vision" className="block text-sm font-medium text-gray-700 mb-1">
              Vision
            </label>
            <div className="relative">
              <textarea
                id="vision"
                value={vision}
                onChange={(e) => setVision(e.target.value.slice(0, 5000))}
                rows={4}
                className="w-full px-3 py-2 pb-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                placeholder={`What do you want ${project.name} to become?`}
              />
              {!showVisionWriter && (
                <div className="absolute bottom-0 right-0 p-3">
                  <button
                    type="button"
                    onClick={() => setShowVisionWriter(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Plan
                  </button>
                </div>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                The vision helps the AI decide which ideas to accept or reject.
              </p>
              <span className={`text-xs tabular-nums ${vision.length > 4500 ? 'text-amber-500' : 'text-gray-300'}`}>
                {vision.length}/5000
              </span>
            </div>

            {showVisionWriter && (
              <div className="mt-3">
                <VisionWriter
                  projectName={project.name}
                  description={project.description}
                  repoName={project.github_repo}
                  onUseVision={(v) => {
                    setVision(v)
                    setShowVisionWriter(false)
                  }}
                  onClose={() => setShowVisionWriter(false)}
                />
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Visibility</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {isPublic
                    ? 'Anyone can view this project and contribute ideas.'
                    : 'Only you can view this project.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublic ? 'bg-accent' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                  isPublic
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isPublic ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Public
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Private
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Parallel Tasks */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900">Parallel Tasks</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">
              How many tasks can run simultaneously on this project. Agents coordinate to avoid conflicting edits.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={maxParallelTasks}
                onChange={(e) => setMaxParallelTasks(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="3"
                min="1"
                max="10"
              />
              <span className="text-xs text-gray-400">
                {maxParallelTasks ? `${maxParallelTasks} concurrent tasks` : 'Using platform default (3)'}
              </span>
            </div>
          </div>

          {/* Self-Improvement */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Self-Improvement</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {autoImprove
                    ? 'The AI will periodically scan the codebase and propose improvements — tests, docs, code quality.'
                    : 'Enable to let the AI automatically find and fix improvement opportunities.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoImprove(!autoImprove)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoImprove ? 'bg-accent' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoImprove ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {autoImprove && (
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-violet-50 text-violet-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Active
                </span>
                <span className="text-xs text-gray-400">Scans every 30 minutes</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Link
              href={basePath}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Team Members */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Team Members</h2>

          {/* Invite form */}
          <div className="flex items-end gap-2 mb-4">
            <div className="flex-1">
              <label htmlFor="invite-username" className="block text-xs text-gray-500 mb-1">
                GitHub username
              </label>
              <input
                id="invite-username"
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="username"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              disabled={inviteLoading || !inviteUsername.trim()}
              onClick={async () => {
                if (!project || !inviteUsername.trim()) return
                setInviteLoading(true)
                try {
                  const member = await inviteProjectMember(project.id, inviteUsername.trim(), inviteRole)
                  setMembers((prev) => [...prev, member])
                  setInviteUsername('')
                  toast.success('Member invited')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to invite')
                } finally {
                  setInviteLoading(false)
                }
              }}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {inviteLoading ? 'Inviting...' : 'Invite'}
            </button>
          </div>
          {/* Members list */}
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No team members yet. Invite collaborators by GitHub username.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">@{m.github_username}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      m.role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!project) return
                      try {
                        await removeProjectMember(project.id, m.user_id)
                        setMembers((prev) => prev.filter((pm) => pm.id !== m.id))
                        toast('Member removed')
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to remove member')
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GitHub Repo Info */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Repository</h2>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <a
              href={`https://github.com/${project.github_repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-700 hover:text-accent"
            >
              {project.github_repo}
            </a>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Repository cannot be changed after creation.
          </p>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pt-8 border-t border-red-200">
          <h2 className="text-sm font-medium text-red-600 mb-4">Danger Zone</h2>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Delete this project</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently remove this project and all its data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete project
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-red-300 bg-red-50">
              <p className="text-sm text-gray-900 mb-3">
                This will permanently delete <span className="font-medium">{project.name}</span> and all tasks,
                conversations, knowledge, sponsorships, and evaluations associated with it.
              </p>
              <p className="text-sm text-gray-600 mb-3">
                Type <span className="font-mono font-medium text-red-600">{project.name}</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={project.name}
                className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (deleteConfirmInput !== project.name) return
                    setDeleting(true)
                    try {
                      await deleteProject(project.id)
                      toast.success('Project deleted')
                      router.push('/profile')
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to delete project')
                      setDeleting(false)
                    }
                  }}
                  disabled={deleting || deleteConfirmInput !== project.name}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Permanently delete project'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmInput('')
                  }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
