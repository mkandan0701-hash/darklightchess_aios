import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { SessionProvider } from '@/components/SessionProvider'
import { verifySession } from '@/lib/auth/session'
import { scopeForSession } from '@/lib/auth/rbac'
import { ALL_BRANCHES, BRANCH_COOKIE, SESSION_COOKIE } from '@/lib/auth/cookies'
import { getBranches } from '@/lib/branches'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = cookies()

  // Belt and braces behind middleware.ts. If the matcher ever misses this path, the pages
  // behind it still refuse to render.
  const session = verifySession(jar.get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login')

  const requestedBranch = jar.get(BRANCH_COOKIE)?.value ?? null
  const scope = scopeForSession(session, requestedBranch)
  const activeBranch = scope.branches === ALL_BRANCHES ? ALL_BRANCHES : scope.branches[0]

  return (
    <SessionProvider value={{ session, scope, branches: getBranches(), activeBranch }}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-col flex-1 ml-60 min-h-screen">
          <Header />
          {/*
            Keying on the active branch remounts the page subtree when a superadmin switches
            branches, which re-runs the useEffect fetches every page relies on.
          */}
          <main key={activeBranch} className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
