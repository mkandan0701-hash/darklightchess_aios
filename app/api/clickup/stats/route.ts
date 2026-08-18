import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

// Returns DashboardStatsResponse — for a superadmin in all-branches mode it also carries a
// `byBranch` breakdown; for a branch admin the totals are their branch only.
export const GET = withAuth(async (_request, { db }) => {
  try {
    const stats = await db.getStats()
    return NextResponse.json({ success: true, data: stats })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
})
