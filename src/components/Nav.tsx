'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getCurrentUser, type UserProfile } from '@/lib/api'
import { redirectToLogin } from '@/lib/auth'
import { NotificationBell } from './NotificationBell'
import { useTheme } from '@/contexts/ThemeContext'

function SunIcon() {
  return (
    <svg
      className="w-4 h-4 theme-toggle-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" strokeWidth={2} strokeLinecap="round" />
      <path
        strokeLinecap="round"
        strokeWidth={2}
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      className="w-4 h-4 theme-toggle-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
      />
    </svg>
  )
}

export function Nav() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
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

  // Shared nav link class helper
  const navLink = (href: string) =>
    `text-sm transition-colors ${
      isActive(href)
        ? 'text-ink font-medium'
        : 'text-ink-secondary hover:text-ink'
    }`

  return (
    <nav
      aria-label="Main navigation"
      className={`h-14 sticky top-0 z-50 transition-all duration-150 ${
        scrolled || mobileOpen
          ? 'bg-canvas/85 backdrop-blur-md border-b border-line'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        <Link href="/" className="hover:opacity-70 transition-opacity">
          <span className="text-lg font-semibold text-ink">bloom</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          <Link href="/explore" className={navLink('/explore')}>
            Explore
          </Link>
          <Link href="/pricing" className={navLink('/pricing')}>
            Pricing
          </Link>
          <a
            href="https://github.com/bloom-base"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-secondary hover:text-ink transition-colors"
          >
            GitHub
          </a>

          {userProfile?.is_admin && (
            <Link href="/admin" className={navLink('/admin')}>
              Admin
            </Link>
          )}

          {(userProfile?.subscription_tier === 'pro' || userProfile?.subscription_tier === 'enterprise') && (
            <Link href="/new" className={navLink('/new')}>
              New Project
            </Link>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link
                href="/profile"
                className={`flex items-center gap-2 text-sm transition-colors ${isActive('/profile') ? 'text-ink font-medium' : 'text-ink-secondary hover:text-ink'}`}
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
                  <span className="w-[22px] h-[22px] rounded-full bg-canvas-muted flex items-center justify-center text-[10px] font-medium text-ink-secondary">
                    {user.username[0]?.toUpperCase()}
                  </span>
                )}
                {user.username}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm text-ink-tertiary hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => redirectToLogin()}
                className="text-sm text-ink-secondary hover:text-ink transition-colors"
              >
                Sign in
              </button>
              <Link
                href="/auth/register"
                className="text-sm px-4 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Get started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-1">
          {user && <NotificationBell />}
          {/* Theme toggle (mobile) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-lg text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors"
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
        <div
          className="md:hidden bg-canvas/95 backdrop-blur-md border-b border-line px-6 py-4 space-y-3"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <Link
            href="/explore"
            onClick={() => setMobileOpen(false)}
            className={`block text-sm py-1 ${isActive('/explore') ? 'text-ink font-medium' : 'text-ink-secondary hover:text-ink'}`}
          >
            Explore
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className={`block text-sm py-1 ${isActive('/pricing') ? 'text-ink font-medium' : 'text-ink-secondary hover:text-ink'}`}
          >
            Pricing
          </Link>
          <a
            href="https://github.com/bloom-base"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-ink-secondary hover:text-ink py-1"
          >
            GitHub
          </a>
          {userProfile?.is_admin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={`block text-sm py-1 ${isActive('/admin') ? 'text-ink font-medium' : 'text-ink-secondary hover:text-ink'}`}
            >
              Admin
            </Link>
          )}
          {(userProfile?.subscription_tier === 'pro' || userProfile?.subscription_tier === 'enterprise') && (
            <Link
              href="/new"
              onClick={() => setMobileOpen(false)}
              className={`block text-sm py-1 ${isActive('/new') ? 'text-ink font-medium' : 'text-ink-secondary hover:text-ink'}`}
            >
              New Project
            </Link>
          )}
          <div className="pt-2 border-t border-line">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center py-1">
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink"
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
                      <span className="w-5 h-5 rounded-full bg-canvas-muted flex items-center justify-center text-[9px] font-medium text-ink-secondary">
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
                  className="text-sm text-ink-tertiary hover:text-ink"
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
                  className="block text-sm text-ink-secondary hover:text-ink py-1"
                >
                  Sign in
                </button>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm px-4 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors text-center"
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
