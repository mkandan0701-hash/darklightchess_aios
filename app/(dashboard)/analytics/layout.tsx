import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/session'
import { SESSION_COOKIE } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

/**
 * Analytics is superadmin-only. The parent (dashboard) layout only guarantees a valid
 * session exists, not a role — Sidebar hides the nav link, but that's client-side and doesn't
 * stop a branch admin from navigating to /analytics directly.
 */
export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value)
  if (session?.role !== 'superadmin') redirect('/')
  return <>{children}</>
}
