'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getCurrentUser, type UserProfile } from '@/lib/api'
import { redirectToLogin } from '@/lib/auth'
import { NotificationBell } from './NotificationBell'

export function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ username: string; avatar_url?: string } | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  useEffect(() => {
    getCurrentUser()
      .then((profile) => {
        setUserProfile(profile)
        setUser({
          username: profile.username,
          avatar_url: profile.avatar_url || undefined,
        })
      })
      .catch(() => {
        setUser(null)
        setUserProfile(null)
      })

    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSignOut = () => {
    fetch('/api/auth/logout', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        setUser(null)
        setUserProfile(null)
        window.location.href = '/'
      })
  }

  return (
    <nav
      aria-label="Main navigation"
      className={`h-14 sticky top-0 z-50 transition-all duration-150 ${
        scrolled || mobileOpen
          ? 'bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        <Link href="/" className="hover:opacity-70 transition-opacity">
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">bloom</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            href="/explore"
            className={`text-sm transition-colors ${isActive('/explore') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            Explore
          </Link>
          <Link
            href="/pricing"
            className={`text-sm transition-colors ${isActive('/pricing') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            Pricing
          </Link>
          <a
            href="https://github.com/bloom-base"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            GitHub
          </a>

          {userProfile?.is_admin && (
            <Link
              href="/admin"
              className={`text-sm transition-colors ${isActive('/admin') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
            >
              Admin
            </Link>
          )}

          {(userProfile?.subscription_tier === 'pro' || userProfile?.subscription_tier === 'enterprise') && (
            <Link
              href="/new"
              className={`text-sm transition-colors ${isActive('/new') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
            >
              New Project
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link
                href="/profile"
                className={`flex items-center gap-2 text-sm transition-colors ${isActive('/profile') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                {(user.avatar_url || userProfile?.avatar_url) ? (
                  <img
                    src={user.avatar_url || userProfile?.avatar_url || ''}
                    alt=""
                    width={22}
                    height={22}
                    className="rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <span className="w-[22px] h-[22px] rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300">
                    {user.username[0]?.toUpperCase()}
                  </span>
                )}
                {user.username}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => redirectToLogin()}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Sign in
              </button>
              <Link
                href="/auth/register"
                className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                Get started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          {user && <NotificationBell />}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-6 py-4 space-y-3" role="navigation" aria-label="Mobile navigation">
          <Link
            href="/explore"
            onClick={() => setMobileOpen(false)}
            className={`block text-sm py-1 ${isActive('/explore') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            Explore
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className={`block text-sm py-1 ${isActive('/pricing') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            Pricing
          </Link>
          <a
            href="https://github.com/bloom-base"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 py-1"
          >
            GitHub
          </a>
          {userProfile?.is_admin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={`block text-sm py-1 ${isActive('/admin') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
            >
              Admin
            </Link>
          )}
          {(userProfile?.subscription_tier === 'pro' || userProfile?.subscription_tier === 'enterprise') && (
            <Link
              href="/new"
              onClick={() => setMobileOpen(false)}
              className={`block text-sm py-1 ${isActive('/new') ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
            >
              New Project
            </Link>
          )}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center py-1">
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    {(user.avatar_url || userProfile?.avatar_url) ? (
                      <img
                        src={user.avatar_url || userProfile?.avatar_url || ''}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-600 dark:text-gray-300">
                        {user.username[0]?.toUpperCase()}
                      </span>
                    )}
                    {user.username}
                  </Link>
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false)
                    handleSignOut()
                  }}
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setMobileOpen(false)
                    redirectToLogin()
                  }}
                  className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 py-1"
                >
                  Sign in
                </button>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm px-4 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-center"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
