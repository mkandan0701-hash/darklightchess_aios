import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

// Deliberately not superadmin-gated, unlike update-batch/update-online: pausing a student for a
// month is routine branch admin work. assertInScope inside setStudentPaused still confines it to
// the caller's own branch, and a cross-branch id comes back as a 404 like everywhere else.
export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { studentId?: string; paused?: boolean }
    const { studentId, paused } = body

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'Missing required field: studentId' }, { status: 400 })
    }
    if (typeof paused !== 'boolean') {
      return NextResponse.json({ success: false, error: 'paused must be a boolean' }, { status: 400 })
    }

    await db.setStudentPaused(studentId, paused)

    console.log('[SET STUDENT PAUSED]', { studentId, paused, by: session.email })

    return NextResponse.json({ success: true, studentId, paused })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[SET STUDENT PAUSED ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to update pause status' }, { status: 500 })
  }
})
