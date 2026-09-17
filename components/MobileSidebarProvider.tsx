'use client'

import { createContext, useContext, useState } from 'react'

export interface MobileSidebarContextValue {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null)

/**
 * The dashboard sidebar is a fixed off-canvas panel below the `md` breakpoint. This just holds
 * whether it's open — Header's hamburger button toggles it, Sidebar reads it to slide in/out.
 */
export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const value: MobileSidebarContextValue = {
    isOpen,
    toggle: () => setIsOpen((v) => !v),
    close: () => setIsOpen(false),
  }
  return <MobileSidebarContext.Provider value={value}>{children}</MobileSidebarContext.Provider>
}

export function useMobileSidebar(): MobileSidebarContextValue {
  const ctx = useContext(MobileSidebarContext)
  if (!ctx) throw new Error('useMobileSidebar must be used inside the dashboard layout')
  return ctx
}
