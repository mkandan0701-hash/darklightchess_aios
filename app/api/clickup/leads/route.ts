import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { branchForNewRecord } from '@/lib/auth/rbac'
import { validateAndCreateLead } from '@/lib/leadService'

export const GET = withAuth(async (_request, { db }) => {
  try {
    const leads = await db.getLeads()
    return NextResponse.json({ success: true, data: leads })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, { db, scope, session }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const result = await validateAndCreateLead(db, body, branchForNewRecord(scope, session))
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, data: result.lead })
})
