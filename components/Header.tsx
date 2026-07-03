'use client'

import { usePathname } from 'next/navigation'

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

export default function Header() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-textDark">Manikandan</p>
          <p className="text-xs text-gray-500">Founder</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-sm">MK</span>
        </div>
      </div>
    </header>
  )
}
