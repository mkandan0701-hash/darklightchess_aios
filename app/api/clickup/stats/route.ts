import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import type { DashboardStats } from '@/lib/types'

// The online/offline revenue split is superadmin-only; strip it for everyone else.
function withoutModeSplit<T extends DashboardStats>(s: T): T {
  const {
    monthlyRevenueOnline: _a,
    monthlyRevenueOffline: _b,
    activeStudentsOnline: _c,
    activeStudentsOffline: _d,
    ...rest
  } = s
  return rest as T
}

// Returns DashboardStatsResponse — for a superadmin in all-branches mode it also carries a
// `byBranch` breakdown; for a branch admin the totals are their branch only.
export const GET = withAuth(async (_request, { db, session }) => {
  try {
    const stats = await db.getStats()
    if (session.role !== 'superadmin') {
      const safe = withoutModeSplit(stats)
      if (safe.byBranch) safe.byBranch = safe.byBranch.map(withoutModeSplit)
      return NextResponse.json({ success: true, data: safe })
    }
    return NextResponse.json({ success: true, data: stats })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
})
