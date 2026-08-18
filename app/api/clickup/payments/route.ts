import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

export const GET = withAuth(async (_request, { db }) => {
  try {
    const payments = await db.getPayments()
    return NextResponse.json({ success: true, data: payments })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
})
