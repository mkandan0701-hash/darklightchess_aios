import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/session'
import { SESSION_COOKIE } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

/** Settings is superadmin-only — same reasoning as app/(dashboard)/analytics/layout.tsx. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = verifySession(cookies().get(SESSION_COOKIE)?.value)
  if (session?.role !== 'superadmin') redirect('/')
  return <>{children}</>
}
