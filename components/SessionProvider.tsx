'use client'

import { createContext, useContext } from 'react'
import type { Scope, Session } from '@/lib/auth/types'
import type { Branch } from '@/lib/branches'

export interface SessionContextValue {
  session: Session
  scope: Scope
  branches: Branch[]
  /** The branch the superadmin is currently viewing, or 'all'. Always 'all' → null for admins. */
  activeBranch: string | null
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  value,
  children,
}: {
  value: SessionContextValue
  children: React.ReactNode
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside the dashboard layout')
  return ctx
}

/** True when the caller is a superadmin looking at every branch at once. */
export function useIsAllBranches(): boolean {
  return useSession().scope.branches === 'all'
}
