'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  createGitHubRepo,
  createProject,
  createProCheckout,
  getCurrentUser,
  getGitHubRepos,
  getGitHubUser,
  getProjects,
  type Project,
  type UserProfile,
} from '@/lib/api'
import { redirectToLogin, redirectToGitHubAuth } from '@/lib/auth'
import VisionWriter from '@/components/VisionWriter'

interface Repo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  updated_at: string
}

interface RepoWithStatus extends Repo {
  connectedProjectId?: string
  connectedProjectName?: string
}

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState<'select' | 'create-repo' | 'vision'>('select')
  const [repos, setRepos] = useState<RepoWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRepo, setSelectedRepo] = useState<RepoWithStatus | null>(null)
  const [vision, setVision] = useState('')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [existingProjects, setExistingProjects] = useState<Project[]>([])

  // New repo creation state
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoDescription, setNewRepoDescription] = useState('')
  const [newRepoPrivate, setNewRepoPrivate] = useState(true)
  const [creatingRepo, setCreatingRepo] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [projectPublic, setProjectPublic] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showVisionWriter, setShowVisionWriter] = useState(false)

  useEffect(() => {
    // Load user profile, existing projects, repos, and GitHub username in parallel
    Promise.all([
      getCurrentUser(),
      getProjects().catch(() => ({ items: [] })),
      fetchReposFromGitHub(),
      fetchGitHubUser(),
    ]).then(([userProfile, projectsRes, githubRepos, username]) => {
      const projects = projectsRes.items
      setUser(userProfile)
      setExistingProjects(projects)
      setGithubUsername(username)

      // Check if user is Pro - if not, show upgrade gate
      if (userProfile && userProfile.subscription_tier === 'free') {
        setUser(userProfile)
        setLoading(false)
        return
      }

      // Cross-reference repos with existing projects
      const reposWithStatus = githubRepos.map((repo) => {
        const connectedProject = projects.find(
          (p) => p.github_repo.toLowerCase() === repo.full_name.toLowerCase()
        )
        return {
          ...repo,
          connectedProjectId: connectedProject?.id,
          connectedProjectName: connectedProject?.name,
        }
      })

      setRepos(reposWithStatus)
      setLoading(false)
    }).catch(() => {
      redirectToLogin('/new')
    })
  }, [router])

  async function fetchGitHubUser(): Promise<string | null> {
    try {
      const data = await getGitHubUser()
      return data.login
    } catch {
      return null
    }
  }

  async function fetchReposFromGitHub(): Promise<Repo[]> {
    try {
      return await getGitHubRepos()
    } catch (err) {
      console.error('Fetch error:', err)
      toast.error('Failed to load repositories')
      return []
    }
  }

  async function createNewRepo(): Promise<Repo | null> {
    if (!newRepoName.trim()) return null

    setCreatingRepo(true)

    try {
      const repo = await createGitHubRepo({
        name: newRepoName.trim(),
        description: newRepoDescription.trim() || undefined,
        private: newRepoPrivate,
        auto_init: true, // Create with README so it's not empty
      })
      return repo
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create repository')
      return null
    } finally {
      setCreatingRepo(false)
    }
  }

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectRepo = (repo: RepoWithStatus) => {
    // Don't allow selecting repos that are already connected
    if (repo.connectedProjectId) return

    setSelectedRepo(repo)
    setStep('vision')
  }

  const handleCreateAndSelect = async () => {
    if (creatingRepo) return
    const repo = await createNewRepo()
    if (repo) {
      // Add the new repo to the list and select it
      const repoWithStatus: RepoWithStatus = { ...repo }
      setRepos((prev) => [repoWithStatus, ...prev])
      setSelectedRepo(repoWithStatus)
      setStep('vision')
    }
  }

  const handleCreate = async () => {
    if (!selectedRepo || creating) return

    setCreating(true)

    try {
      const project = await createProject({
        name: selectedRepo.name,
        description: selectedRepo.description || '',
        github_repo: selectedRepo.full_name,
        vision,
        is_public: projectPublic,
      })
      if (!project.github_app_connected) {
        window.location.href = 'https://github.com/apps/bloom-base/installations/new'
        return
      }
      router.push(`/${project.github_repo}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project')
      setCreating(false)
    }
  }

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    try {
      const { checkout_url } = await createProCheckout({
        success_url: `${window.location.origin}/new`,
        cancel_url: `${window.location.origin}/new`,
      })
      window.location.href = checkout_url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Checkout failed')
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your repositories...</p>
        </div>
      </div>
    )
  }

  // Free user upgrade gate
  if (user && user.subscription_tier === 'free') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Pro required
        </h1>
        <p className="text-gray-500 mb-8">
          Creating projects requires a Pro subscription. Upgrade to connect your repos and build with AI agents.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {checkoutLoading ? 'Redirecting to Stripe...' : 'Upgrade to Pro \u2014 $19/mo'}
          </button>
          <Link
            href="/pricing"
            className="block text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Compare plans &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // Pro user without GitHub linked
  if (user && !user.has_github) {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Link your GitHub
        </h1>
        <p className="text-gray-500 mb-8">
          Connect your GitHub account to access your repositories and create projects.
        </p>
        <button
          onClick={() => redirectToGitHubAuth('/new')}
          className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Connect GitHub
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Progress indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'select' || step === 'create-repo'
              ? 'bg-accent text-white'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          1
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'vision'
              ? 'bg-accent text-white'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          2
        </div>
      </div>

      {step === 'select' && (
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Select a repository
          </h1>
          <p className="text-gray-500 mb-6">
            Choose a repository you want to evolve with AI.
          </p>

          {/* Create new repo button */}
          <button
            onClick={() => setStep('create-repo')}
            className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 text-left transition-colors hover:border-accent hover:bg-accent/5 mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Create new repository</p>
                <p className="text-sm text-gray-500">Start fresh with a new GitHub repo</p>
              </div>
            </div>
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400">or select existing</span>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 mb-4 focus:outline-none focus:border-gray-400"
          />

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredRepos.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No repositories found</p>
            ) : (
              filteredRepos.map((repo) => {
                const isConnected = !!repo.connectedProjectId

                return (
                  <button
                    key={repo.id}
                    onClick={() => handleSelectRepo(repo)}
                    disabled={isConnected}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      isConnected
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-white border-gray-200 hover:border-gray-300 card-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-medium truncate ${
                              isConnected ? 'text-gray-500' : 'text-gray-900'
                            }`}
                          >
                            {repo.name}
                          </span>
                          {repo.private && (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                              Private
                            </span>
                          )}
                          {isConnected && (
                            <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                              Already used in {repo.connectedProjectName}
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p
                            className={`text-sm mt-1 line-clamp-1 ${
                              isConnected ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {repo.language && <span>{repo.language}</span>}
                          <span>{repo.stargazers_count} stars</span>
                        </div>
                      </div>
                      {!isConnected && (
                        <svg
                          className="w-5 h-5 text-gray-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {step === 'create-repo' && (
        <div>
          <button
            onClick={() => setStep('select')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Create new repository
          </h1>
          <p className="text-gray-500 mb-6">
            We&apos;ll create this repo on GitHub and set it up for Bloom.
          </p>

          <div className="space-y-4">
            {/* Repository name */}
            <div>
              <label htmlFor="repo-name" className="block text-sm font-medium text-gray-700 mb-1">
                Repository name
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{githubUsername}/</span>
                <input
                  type="text"
                  id="repo-name"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
                  placeholder="my-project"
                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="repo-desc" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="repo-desc"
                value={newRepoDescription}
                onChange={(e) => setNewRepoDescription(e.target.value)}
                placeholder="A short description of your project"
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
              />
            </div>

            {/* Visibility toggle */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Visibility</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {newRepoPrivate
                      ? 'Only you can see this repository.'
                      : 'Anyone can see this repository.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewRepoPrivate(!newRepoPrivate)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    newRepoPrivate ? 'bg-accent' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      newRepoPrivate ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    newRepoPrivate
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-green-50 text-green-600'
                  }`}
                >
                  {newRepoPrivate ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Private
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Public
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setStep('select')}
              className="px-6 py-3 rounded-md text-gray-500 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAndSelect}
              disabled={creatingRepo || !newRepoName.trim()}
              className="flex-1 px-6 py-3 rounded-md bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingRepo ? 'Creating...' : 'Create Repository'}
            </button>
          </div>
        </div>
      )}

      {step === 'vision' && selectedRepo && (
        <div>
          <button
            onClick={() => setStep('select')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Define your vision
          </h1>
          <p className="text-gray-500 mb-6">
            What do you want <span className="text-gray-900">{selectedRepo.name}</span> to become?
            The AI uses this to evaluate ideas and prioritize work.
          </p>

          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedRepo.full_name}</p>
                <p className="text-sm text-gray-500">{selectedRepo.description || 'No description'}</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={vision}
              onChange={(e) => setVision(e.target.value.slice(0, 5000))}
              placeholder={`What do you want ${selectedRepo.name} to become?`}
              rows={4}
              className="w-full px-4 py-3 pb-10 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-gray-400"
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
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              Be specific about what matters. This guides how the AI evaluates contributions.
            </p>
            <span className={`text-xs tabular-nums ${vision.length > 4500 ? 'text-amber-500' : 'text-gray-300'}`}>
              {vision.length}/5000
            </span>
          </div>

          {showVisionWriter && (
            <div className="mt-3">
              <VisionWriter
                projectName={selectedRepo.name}
                description={selectedRepo.description || ''}
                repoName={selectedRepo.full_name}
                onUseVision={(v) => {
                  setVision(v)
                  setShowVisionWriter(false)
                }}
                onClose={() => setShowVisionWriter(false)}
              />
            </div>
          )}

          {/* Project visibility toggle */}
          <div className="border border-gray-200 rounded-lg p-4 mt-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Project visibility</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {projectPublic
                    ? 'Anyone can discover and contribute ideas to this project.'
                    : 'Only you and invited members can see this project.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProjectPublic(!projectPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  projectPublic ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    projectPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                  projectPublic
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {projectPublic ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Public on Bloom
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

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setStep('select')}
              className="px-6 py-3 rounded-md text-gray-500 hover:text-gray-900"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 px-6 py-3 rounded-md bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
