'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { streamUserEvents, type UserEvent } from '@/lib/api'

type UserEventListener = (event: UserEvent) => void

interface UserEventContextValue {
  /** Subscribe to events matching a type. Returns unsubscribe function. */
  subscribe: (type: string, listener: UserEventListener) => () => void
  connected: boolean
}

export const UserEventContext = createContext<UserEventContextValue | null>(null)

/**
 * Hook to listen for specific user event types.
 * Must be used within a UserEventProvider.
 */
export function useUserEvent(type: string, listener: UserEventListener) {
  const ctx = useContext(UserEventContext)
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe(type, (event) => listenerRef.current(event))
  }, [ctx, type])
}

/**
 * Returns { subscribe, connected } for building the provider.
 * Call this in your provider component.
 */
export function useUserEventStream(isAuthenticated: boolean) {
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef(new Map<string, Set<UserEventListener>>())
  const abortRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    streamUserEvents(
      (event) => {
        if (event.type === 'connected') {
          setConnected(true)
          return
        }
        const listeners = listenersRef.current.get(event.type)
        if (listeners) {
          listeners.forEach((listener) => {
            listener(event)
          })
        }
      },
      abortRef.current.signal,
      () => {
        setConnected(false)
        // Reconnect after 5s
        reconnectTimeoutRef.current = setTimeout(connect, 5000)
      }
    )
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    connect()

    return () => {
      abortRef.current?.abort()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [isAuthenticated, connect])

  const subscribe = useCallback((type: string, listener: UserEventListener): (() => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set())
    }
    listenersRef.current.get(type)!.add(listener)

    return () => {
      listenersRef.current.get(type)?.delete(listener)
    }
  }, [])

  return { subscribe, connected }
}
