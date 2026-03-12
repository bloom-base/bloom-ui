import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoScroll } from './useAutoScroll'

describe('useAutoScroll', () => {
  it('returns refs and handleScroll', () => {
    const { result } = renderHook(() => useAutoScroll([]))
    expect(result.current.messagesEndRef).toBeDefined()
    expect(result.current.scrollContainerRef).toBeDefined()
    expect(typeof result.current.handleScroll).toBe('function')
  })

  it('auto-scrolls on dependency change when near bottom', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      ({ deps }) => useAutoScroll(deps),
      { initialProps: { deps: [0] } }
    )

    // Simulate the messagesEndRef being attached to a DOM element
    Object.defineProperty(result.current.messagesEndRef, 'current', {
      writable: true,
      value: { scrollIntoView },
    })

    // Re-render with new deps - should trigger scroll since userHasScrolledUp is false
    rerender({ deps: [1] })
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('does not auto-scroll when user has scrolled up', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      ({ deps }) => useAutoScroll(deps),
      { initialProps: { deps: [0] } }
    )

    Object.defineProperty(result.current.messagesEndRef, 'current', {
      writable: true,
      value: { scrollIntoView },
    })

    // Simulate the scroll container being far from bottom
    Object.defineProperty(result.current.scrollContainerRef, 'current', {
      writable: true,
      value: {
        scrollHeight: 1000,
        scrollTop: 0,
        clientHeight: 400,
      },
    })

    // Fire handleScroll to mark user as scrolled up
    act(() => {
      result.current.handleScroll()
    })

    // Clear previous calls
    scrollIntoView.mockClear()

    // Re-render with new deps - should NOT scroll
    rerender({ deps: [1] })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('resumes auto-scroll when user scrolls back to bottom', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      ({ deps }) => useAutoScroll(deps),
      { initialProps: { deps: [0] } }
    )

    Object.defineProperty(result.current.messagesEndRef, 'current', {
      writable: true,
      value: { scrollIntoView },
    })

    const container = {
      scrollHeight: 1000,
      scrollTop: 0,
      clientHeight: 400,
    }

    Object.defineProperty(result.current.scrollContainerRef, 'current', {
      writable: true,
      value: container,
    })

    // Scroll up
    act(() => {
      result.current.handleScroll()
    })

    // Now scroll back to bottom (within 100px threshold)
    container.scrollTop = 550 // 1000 - 550 - 400 = 50 < 100
    act(() => {
      result.current.handleScroll()
    })

    scrollIntoView.mockClear()

    // Should auto-scroll again
    rerender({ deps: [1] })
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })
})
