import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { studentId?: string }
    const { studentId } = body

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'Missing required field: studentId' }, { status: 400 })
    }

    await db.deleteStudent(studentId)

    console.log('[DELETE STUDENT]', { studentId, by: session.email })

    return NextResponse.json({ success: true, studentId })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[DELETE STUDENT ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 })
  }
})
