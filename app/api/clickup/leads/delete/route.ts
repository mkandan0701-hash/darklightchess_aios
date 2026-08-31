import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { leadId?: string }
    const { leadId } = body

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Missing required field: leadId' }, { status: 400 })
    }

    await db.deleteLead(leadId)

    console.log('[DELETE LEAD]', { leadId, by: session.email })

    return NextResponse.json({ success: true, leadId })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[DELETE LEAD ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
  }
}, { roles: ['superadmin'] })
