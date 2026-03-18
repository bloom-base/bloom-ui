'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { getCurrentUser, getProjects, getMyContributions, createProCheckout, createBillingPortal, getBillingInfo, getBillingInvoices, getApiKeyStatus, setApiKey, deleteApiKey, deleteAccount, setPassword, linkGitHub, resendVerification, setUsername, checkUsernameAvailable, updateNotificationSettings, updateProfile, type UserProfile, type Project, type BillingInfo, type Invoice, type ApiKeyStatus, type Contribution } from '@/lib/api'
import { redirectToGitHubAuth, redirectToLogin } from '@/lib/auth'
import { copyToClipboard } from '@/lib/clipboard'
import { validatePassword } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useTheme } from '@/contexts/ThemeContext'

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100 rounded-lg w-48 mb-3" />
          <div className="h-5 bg-gray-100 rounded w-32 mb-10" />
          <div className="space-y-4">
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-16 bg-gray-50 rounded-xl" />
          </div>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  )
}

function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [showUsernameInput, setShowUsernameInput] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [portalLoading, setPortalLoading] = useState(false)
  const [showRemoveKeyConfirm, setShowRemoveKeyConfirm] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success('Welcome to Pro! You can now create projects.')
      window.history.replaceState({}, '', '/profile')
    }
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      getCurrentUser(),
      getProjects(),
      getBillingInfo().catch(() => null),
      getApiKeyStatus().catch(() => null),
      getMyContributions().catch(() => ({ items: [], total: 0, limit: 50, offset: 0 })),
      getBillingInvoices().catch(() => []),
    ])
      .then(([userData, projectsRes, billingData, keyStatus, contribsRes, invoiceData]) => {
        setUser(userData)
        const myProjects = projectsRes.items.filter((p) => p.owner_id === userData.id)
        setProjects(myProjects)
        if (billingData) setBilling(billingData)
        if (keyStatus) setApiKeyStatus(keyStatus)
        setContributions(contribsRes.items)
        setInvoices(invoiceData)
      })
      .catch((err: Error) => {
        if (err.message.includes('Not authenticated')) {
          redirectToLogin('/profile')
          return
        }
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    try {
      const { checkout_url } = await createProCheckout({
        success_url: `${window.location.origin}/profile?upgraded=true`,
        cancel_url: `${window.location.origin}/profile`,
      })
      window.location.href = checkout_url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Checkout failed')
      setCheckoutLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const { portal_url } = await createBillingPortal({
        success_url: `${window.location.origin}/profile`,
        cancel_url: `${window.location.origin}/profile`,
      })
      window.location.href = portal_url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to open billing portal')
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100 rounded-lg w-48 mb-3" />
          <div className="h-5 bg-gray-100 rounded w-32 mb-10" />
          <div className="space-y-4">
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-16 bg-gray-50 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Failed to load profile{error ? `: ${error}` : ''}</p>
        <button
          onClick={() => {
            setError(null)
            setLoading(true)
            Promise.all([
              getCurrentUser(),
              getProjects(),
              getBillingInfo().catch(() => null),
              getApiKeyStatus().catch(() => null),
              getMyContributions().catch(() => ({ items: [], total: 0, limit: 50, offset: 0 })),
              getBillingInvoices().catch(() => []),
            ])
              .then(([userData, projectsRes, billingData, keyStatus, contribsRes, invoiceData]) => {
                setUser(userData)
                const myProjects = projectsRes.items.filter((p) => p.owner_id === userData.id)
                setProjects(myProjects)
                if (billingData) setBilling(billingData)
                if (keyStatus) setApiKeyStatus(keyStatus)
                setContributions(contribsRes.items)
                setInvoices(invoiceData)
              })
              .catch((err: Error) => {
                if (err.message.includes('Not authenticated')) {
                  redirectToLogin('/profile')
                  return
                }
                setError(err.message)
              })
              .finally(() => setLoading(false))
          }}
          className="mt-4 text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  const isPro = user.subscription_tier === 'pro' || user.subscription_tier === 'enterprise'

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">Profile</h1>
          <p className="text-gray-500">Your account details</p>
        </div>
        {user.handle && (
          <Link
            href={`/u/${user.handle}`}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            View public profile &rarr;
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {/* GitHub section */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            GitHub
          </label>
          {user.has_github ? (
            <p className="text-gray-900 mt-1">@{user.github_username}</p>
          ) : (
            <div className="mt-1">
              <p className="text-gray-400 text-sm">Not connected</p>
              <button
                onClick={() => redirectToGitHubAuth('/profile')}
                className="mt-2 text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Link GitHub account
              </button>
              <p className="text-xs text-gray-400 mt-1.5">
                Link GitHub to create projects and connect repos.
              </p>
            </div>
          )}
        </div>

        {/* Username section */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Username
          </label>
          {user.handle && !showUsernameInput ? (
            <div className="flex items-center justify-between mt-1">
              <p className="text-gray-900 font-mono">@{user.handle}</p>
              <button
                onClick={() => {
                  setShowUsernameInput(true)
                  setUsernameInput(user.handle || '')
                  setUsernameError(null)
                  setUsernameAvailable(null)
                }}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Change
              </button>
            </div>
          ) : !showUsernameInput ? (
            <div className="mt-1">
              <p className="text-gray-400 text-sm">No username set</p>
              <button
                onClick={() => {
                  setShowUsernameInput(true)
                  setUsernameInput('')
                  setUsernameError(null)
                  setUsernameAvailable(null)
                }}
                className="mt-2 text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors"
              >
                Set username
              </button>
              <p className="text-xs text-gray-400 mt-1.5">
                Choose a unique handle for your Bloom profile.
              </p>
            </div>
          ) : null}
          {showUsernameInput && (
            <div className="mt-2 space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    setUsernameInput(v)
                    setUsernameAvailable(null)
                    setUsernameError(null)
                  }}
                  onBlur={async () => {
                    if (usernameInput && usernameInput.length >= 3) {
                      setUsernameChecking(true)
                      try {
                        const res = await checkUsernameAvailable(usernameInput)
                        setUsernameAvailable(res.available)
                        if (!res.available) setUsernameError(res.error || 'Unavailable')
                      } catch {
                        // ignore
                      } finally {
                        setUsernameChecking(false)
                      }
                    }
                  }}
                  placeholder="your-username"
                  maxLength={30}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                    usernameAvailable === true ? 'border-green-300' :
                    usernameAvailable === false ? 'border-red-300' :
                    'border-gray-200'
                  }`}
                />
                {usernameChecking && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin block" />
                  </span>
                )}
                {!usernameChecking && usernameAvailable === true && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">available</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!usernameInput || usernameInput.length < 3) {
                      setUsernameError('Username must be at least 3 characters.')
                      return
                    }
                    setUsernameLoading(true)
                    setUsernameError(null)
                    try {
                      await setUsername(usernameInput)
                      toast.success('Username updated')
                      setShowUsernameInput(false)
                      setUser({ ...user, username: usernameInput, handle: usernameInput })
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to set username')
                    } finally {
                      setUsernameLoading(false)
                    }
                  }}
                  disabled={usernameLoading || !usernameInput.trim()}
                  className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {usernameLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowUsernameInput(false)
                    setUsernameInput('')
                    setUsernameError(null)
                  }}
                  className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {usernameError && <p className="text-sm text-red-600">{usernameError}</p>}
            </div>
          )}
        </div>

        {/* Display Name & Bio section */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Display Name & Bio
          </label>
          {!showProfileEdit ? (
            <div className="mt-1">
              <p className="text-gray-900">
                {user.display_name || <span className="text-gray-400">No display name set</span>}
              </p>
              {user.bio && (
                <p className="text-sm text-gray-500 mt-1">{user.bio}</p>
              )}
              <button
                onClick={() => {
                  setShowProfileEdit(true)
                  setDisplayNameInput(user.display_name || '')
                  setBioInput(user.bio || '')
                }}
                className="mt-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Display name</label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bio</label>
                <textarea
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="A short bio for your public profile"
                  maxLength={160}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                />
                <span className="text-xs text-gray-400">{bioInput.length}/160</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setProfileSaving(true)
                    try {
                      await updateProfile({
                        display_name: displayNameInput,
                        bio: bioInput,
                      })
                      toast.success('Profile updated')
                      setShowProfileEdit(false)
                      setUser({
                        ...user,
                        display_name: displayNameInput || null,
                        bio: bioInput || null,
                      })
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to update profile')
                    } finally {
                      setProfileSaving(false)
                    }
                  }}
                  disabled={profileSaving}
                  className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {profileSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowProfileEdit(false)
                    setDisplayNameInput('')
                    setBioInput('')
                  }}
                  className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Email section */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Email
          </label>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-gray-900">
              {user.email || <span className="text-gray-400">Not provided</span>}
            </p>
            {user.email && !user.email_verified && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                Unverified
              </span>
            )}
            {user.email && user.email_verified && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200">
                Verified
              </span>
            )}
          </div>
          {user.email && !user.email_verified && (
            <div className="mt-2">
              <button
                onClick={async () => {
                  try {
                    const res = await resendVerification()
                    toast.success(res.message)
                  } catch {
                    toast.error('Failed to send verification email.')
                  }
                }}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Resend verification email
              </button>
            </div>
          )}
        </div>

        {/* Password section */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Password
          </label>
          {user.has_password && !showPasswordInput ? (
            <div className="flex items-center justify-between mt-1">
              <p className="text-gray-500 text-sm">Password is set</p>
              <button
                onClick={() => setShowPasswordInput(true)}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Change
              </button>
            </div>
          ) : !showPasswordInput ? (
            <div className="mt-1">
              <p className="text-gray-400 text-sm">No password set</p>
              <button
                onClick={() => setShowPasswordInput(true)}
                className="mt-2 text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors"
              >
                Set password
              </button>
              <p className="text-xs text-gray-400 mt-1.5">
                Set a password to sign in without GitHub.
              </p>
            </div>
          ) : null}
          {showPasswordInput && (
            <div className="mt-2 space-y-2">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="8+ chars, uppercase, lowercase, number"
                minLength={8}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const pwErr = validatePassword(passwordInput)
                    if (pwErr) {
                      toast.error(pwErr)
                      return
                    }
                    setPasswordLoading(true)
                    try {
                      await setPassword(passwordInput)
                      toast.success('Password updated')
                      setPasswordInput('')
                      setShowPasswordInput(false)
                      setUser({ ...user, has_password: true })
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to set password')
                    } finally {
                      setPasswordLoading(false)
                    }
                  }}
                  disabled={passwordLoading || !passwordInput.trim()}
                  className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {passwordLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowPasswordInput(false)
                    setPasswordInput('')
                  }}
                  className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plan section - enhanced */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Plan
          </label>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded-md text-sm font-medium ${
                isPro ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1)}
              </span>
              {isPro && (
                <span className="text-sm text-gray-500">$19/mo</span>
              )}
            </div>
            {!isPro ? (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {checkoutLoading ? 'Redirecting...' : 'Upgrade to Pro'}
              </button>
            ) : (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {portalLoading ? 'Redirecting...' : 'Manage subscription'}
              </button>
            )}
          </div>
          {!isPro && (
            <p className="text-sm text-gray-500 mt-2">
              Upgrade to create private projects and connect your repos.{' '}
              <Link href="/pricing" className="text-gray-700 hover:text-gray-900 underline underline-offset-2">
                Compare plans
              </Link>
            </p>
          )}
        </div>

        {/* Agent turns */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Agent Turns
          </label>
          <div className="mt-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{isPro ? '100' : '50'} turns per task</span>
              <span className="text-gray-400">{isPro ? '200' : '75'} max extended</span>
            </div>
            {contributions.length > 0 && (
              <div className="flex items-center gap-4 mt-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-gray-600">
                    {contributions.filter(c => c.status === 'completed').length} shipped
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-600">
                    {contributions.filter(c => c.status === 'in_progress').length} building
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600">
                    {contributions.filter(c => c.status === 'incomplete').length} incomplete
                  </span>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">
              Each agent action (reading files, writing code, running commands) counts as a turn.
              {!isPro && (
                <> <Link href="/pricing" className="text-gray-500 hover:text-gray-900 underline underline-offset-2">Upgrade to Pro</Link> for 100 turns per task.</>
              )}
            </p>
          </div>
        </div>

        {/* Compute Budget */}
        {billing && (
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
            <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              Compute Budget
            </label>
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">
                  ${billing.current_usage_usd.toFixed(2)} used
                </span>
                <span className="text-gray-400">
                  ${billing.compute_budget_usd.toFixed(2)} budget
                </span>
              </div>
              {/* Usage bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    billing.budget_warning === 'exceeded'
                      ? 'bg-red-500'
                      : billing.budget_warning === 'approaching'
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(billing.budget_usage_pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {billing.budget_usage_pct.toFixed(0)}% used
                </span>
                {billing.budget_warning === 'exceeded' && (
                  <span className="text-xs font-medium text-red-600">
                    Budget exceeded — tasks paused
                  </span>
                )}
                {billing.budget_warning === 'approaching' && (
                  <span className="text-xs font-medium text-amber-600">
                    Approaching budget limit
                  </span>
                )}
                {!billing.budget_warning && billing.budget_remaining_usd > 0 && (
                  <span className="text-xs text-gray-400">
                    ${billing.budget_remaining_usd.toFixed(2)} remaining
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice History */}
        {invoices.length > 0 && (
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
            <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              Invoice History
            </label>
            <div className="mt-3 space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="text-sm text-gray-700">
                      {new Date(inv.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' - '}
                      {new Date(inv.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      {inv.ai_cost_usd > 0 && <span>AI: ${inv.ai_cost_usd.toFixed(2)}</span>}
                      {inv.compute_cost_usd > 0 && <span>Compute: ${inv.compute_cost_usd.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">${inv.total_usd.toFixed(2)}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      inv.status === 'paid' ? 'bg-green-50 text-green-700' :
                      inv.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Key (BYOK) */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Claude API Key
          </label>
          <p className="text-sm text-gray-500 mt-1.5 mb-3">
            Connect your own Anthropic API key for priority task processing.
          </p>
          {apiKeyStatus?.has_key && !showApiKeyInput ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-gray-600">{apiKeyStatus.key_preview}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={() => setShowRemoveKeyConfirm(true)}
                  disabled={apiKeyLoading}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              {!showApiKeyInput && !apiKeyStatus?.has_key && (
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  Add API Key
                </button>
              )}
              {showApiKeyInput && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setApiKeyLoading(true)
                        try {
                          const result = await setApiKey(apiKeyInput)
                          setApiKeyStatus(result)
                          setApiKeyInput('')
                          setShowApiKeyInput(false)
                          toast.success('API key saved')
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed to save key')
                        } finally {
                          setApiKeyLoading(false)
                        }
                      }}
                      disabled={apiKeyLoading || !apiKeyInput.trim()}
                      className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {apiKeyLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setShowApiKeyInput(false)
                        setApiKeyInput('')
                      }}
                      className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Notifications
          </label>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-sm text-gray-900">Email notifications</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Get notified when your ideas are picked up, PRs are created, and tasks ship.
              </p>
            </div>
            <button
              onClick={async () => {
                const previousValue = user.email_notifications
                const newValue = !previousValue
                setUser({ ...user, email_notifications: newValue })
                try {
                  await updateNotificationSettings(newValue)
                } catch {
                  setUser({ ...user, email_notifications: previousValue })
                  toast.error('Failed to update notification settings')
                }
              }}
              role="switch"
              aria-checked={user.email_notifications}
              aria-label="Toggle email notifications"
              className={`relative w-11 h-6 rounded-full transition-colors ${
                user.email_notifications ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  user.email_notifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="p-5 rounded-xl bg-canvas-subtle border border-line">
          <label className="text-xs font-mono text-ink-tertiary uppercase tracking-wider">
            Appearance
          </label>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-sm text-ink">Dark mode</p>
              <p className="text-xs text-ink-secondary mt-0.5">
                Switch between light and dark themes.
              </p>
            </div>
            <button
              onClick={toggleTheme}
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Toggle dark mode"
              className={`relative w-11 h-6 rounded-full transition-colors ${
                theme === 'dark' ? 'bg-accent' : 'bg-canvas-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-canvas-subtle border border-line">
          <label className="text-xs font-mono text-ink-tertiary uppercase tracking-wider">
            User ID
          </label>
          <button
            onClick={() => copyToClipboard(user.id, 'User ID copied')}
            className="text-sm text-gray-500 mt-1 font-mono hover:text-gray-900 transition-colors cursor-pointer"
            title="Click to copy"
          >
            {user.id}
          </button>
        </div>
      </div>

      {/* My Projects */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Projects</h2>
          {isPro && (
            <Link
              href="/new"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              New project &rarr;
            </Link>
          )}
        </div>
        {projects.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-500">No projects yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {!isPro
                ? 'Explore public projects to contribute ideas'
                : 'Create your first project to get started'}
            </p>
            {!isPro && (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="mt-4 text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {checkoutLoading ? 'Redirecting...' : 'Upgrade to create projects'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/${project.github_repo}`}
                className="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{project.github_repo}</p>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {!project.is_public && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                      Private
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* My Contributions */}
      {contributions.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Contributions</h2>
          <div className="space-y-2">
            {contributions.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-gray-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{c.title}</h3>
                    <Link
                      href={`/${c.project_github_repo}`}
                      className="text-xs font-mono text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {c.project_name}
                    </Link>
                    {c.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-medium ${
                    c.status === 'completed' ? 'bg-green-50 text-green-700' :
                    c.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                    c.status === 'accepted' ? 'bg-violet-50 text-violet-700' :
                    c.status === 'proposed' ? 'bg-gray-100 text-gray-600' :
                    c.status === 'paused' || c.status === 'incomplete' ? 'bg-amber-50 text-amber-700' :
                    c.status === 'rejected' || c.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {c.status === 'in_progress' ? 'Building' :
                     c.status === 'completed' ? 'Shipped' :
                     c.status === 'incomplete' ? 'Incomplete' :
                     c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
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
        </div>
      )}

      {/* Sign out */}
      <div className="mt-10 pt-8 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-10 pt-8 border-t border-red-100">
        <h3 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-500 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
          {projects.length > 0 && (
            <span className="block mt-1 text-red-500">
              This will also delete {projects.length} project{projects.length !== 1 ? 's' : ''} you own and all their data.
            </span>
          )}
        </p>
        <button
          onClick={() => setShowDeleteAccountConfirm(true)}
          className="px-4 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete account
        </button>
      </div>

      <ConfirmDialog
        open={showRemoveKeyConfirm}
        title="Remove API key?"
        description="Your Anthropic API key will be deleted. Tasks will use Bloom's shared capacity instead of your key."
        confirmLabel="Remove key"
        destructive
        onConfirm={async () => {
          setShowRemoveKeyConfirm(false)
          setApiKeyLoading(true)
          try {
            const result = await deleteApiKey()
            setApiKeyStatus(result)
            toast.success('API key removed')
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to remove key')
          } finally {
            setApiKeyLoading(false)
          }
        }}
        onCancel={() => setShowRemoveKeyConfirm(false)}
      />

      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign out?"
        description="You'll need to sign in again to access your projects."
        confirmLabel="Sign out"
        onConfirm={() => {
          setShowSignOutConfirm(false)
          fetch('/api/auth/logout', { method: 'POST' })
            .catch(() => {})
            .finally(() => {
              router.push('/')
            })
        }}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {/* Delete account confirmation — custom dialog with text input */}
      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete your account?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete your account, all your projects, conversations, and data. Any active subscriptions and sponsorships will be cancelled. This action <strong>cannot be undone</strong>.
            </p>
            <label className="block text-sm text-gray-700 mb-2">
              Type <span className="font-mono font-semibold text-red-600">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteAccountConfirm(false)
                  setDeleteConfirmInput('')
                }}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleteAccountLoading(true)
                  try {
                    await deleteAccount()
                    router.push('/')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to delete account')
                  } finally {
                    setDeleteAccountLoading(false)
                  }
                }}
                disabled={deleteConfirmInput !== 'DELETE' || deleteAccountLoading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteAccountLoading ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
