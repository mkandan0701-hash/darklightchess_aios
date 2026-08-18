'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import BranchSwitcher from '@/components/BranchSwitcher'
import { branchName } from '@/lib/branches'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/students': 'Students',
  '/leads': 'Leads',
  '/payments': 'Payments',
  '/analytics': 'Analytics',
  '/communications': 'Communications',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const base = '/' + pathname.split('/')[1]
  return PAGE_TITLES[base] ?? 'Dashboard'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const title = getPageTitle(pathname)
  const { session } = useSession()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <div className="flex items-center gap-4">
        {session.role === 'superadmin' && <BranchSwitcher />}

        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-textDark">{session.name}</p>
          <p className="text-xs text-gray-500">
            {session.role === 'superadmin' ? 'Superadmin' : branchName(session.branch)}
          </p>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">{initials(session.name)}</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-primary font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
