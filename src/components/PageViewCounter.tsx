'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'bloom_page_views'

export function PageViewCounter() {
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const count = stored ? parseInt(stored, 10) : 0
      const next = isNaN(count) ? 1 : count + 1
      localStorage.setItem(STORAGE_KEY, String(next))
      setViews(next)
    } catch {
      // localStorage unavailable (e.g. private browsing restrictions)
    }
  }, [])

  if (views === null) return null

  return (
    <span className="text-xs text-ink-tertiary" title="Your page visits">
      {views.toLocaleString()} {views === 1 ? 'visit' : 'visits'}
    </span>
  )
}
