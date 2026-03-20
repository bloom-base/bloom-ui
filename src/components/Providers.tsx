'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/api'
import { UserEventContext, useUserEventStream } from '@/lib/useUserEvents'

export function Providers({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    getCurrentUser()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
  }, [])

  const { subscribe, connected } = useUserEventStream(isAuthenticated)

  return (
    <UserEventContext.Provider value={{ subscribe, connected }}>
      {children}
    </UserEventContext.Provider>
  )
}
