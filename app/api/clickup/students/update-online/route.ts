import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { studentId?: string; online?: boolean }
    const { studentId, online } = body

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'Missing required field: studentId' }, { status: 400 })
    }
    if (typeof online !== 'boolean') {
      return NextResponse.json({ success: false, error: 'online must be a boolean' }, { status: 400 })
    }

    await db.updateStudentOnline(studentId, online)

    console.log('[UPDATE STUDENT ONLINE]', { studentId, online, by: session.email })

    return NextResponse.json({ success: true, studentId, online })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[UPDATE STUDENT ONLINE ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to update online status' }, { status: 500 })
  }
}, { roles: ['superadmin'] })
