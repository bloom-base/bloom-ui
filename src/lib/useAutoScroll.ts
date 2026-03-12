import { useRef, useCallback, useEffect } from 'react'

/**
 * Smart auto-scroll hook that stops scrolling when the user scrolls up.
 * Only auto-scrolls when the user is near the bottom of the container.
 */
export function useAutoScroll(deps: unknown[]) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const userHasScrolledUp = useRef(false)

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    userHasScrolledUp.current = distanceFromBottom > 100
  }, [])

  useEffect(() => {
    if (!userHasScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { messagesEndRef, scrollContainerRef, handleScroll }
}
