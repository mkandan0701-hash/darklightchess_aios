import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { attendanceId?: string }
    const { attendanceId } = body

    if (!attendanceId) {
      return NextResponse.json({ success: false, error: 'Missing required field: attendanceId' }, { status: 400 })
    }

    await db.deleteAttendance(attendanceId)

    console.log('[DELETE ATTENDANCE]', { attendanceId, by: session.email })

    return NextResponse.json({ success: true, attendanceId })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[DELETE ATTENDANCE ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete attendance record' }, { status: 500 })
  }
}, { roles: ['superadmin'] })
