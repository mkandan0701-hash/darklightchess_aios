'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'

/** Rendered only for a superadmin — see Header.tsx. Admins have no branch to switch. */
export default function BranchSwitcher() {
  const router = useRouter()
  const { branches, activeBranch } = useSession()
  const [pending, setPending] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const branch = e.target.value
    setPending(true)
    try {
      await fetch('/api/auth/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      })
      // The dashboard layout re-derives the scope from the cookie on next render and keys
      // the page subtree on it, which re-runs every page's data fetch.
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <select
      value={activeBranch ?? 'all'}
      onChange={handleChange}
      disabled={pending}
      aria-label="Active branch"
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-textDark disabled:opacity-60"
    >
      <option value="all">All Branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  )
}
