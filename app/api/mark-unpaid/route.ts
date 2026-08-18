import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { studentId?: string }
    const { studentId } = body

    if (!studentId) {
      return NextResponse.json({ error: 'Missing required field: studentId' }, { status: 400 })
    }

    await db.markStudentUnpaid(studentId)

    console.log('[MARK UNPAID]', { studentId, by: session.email })

    return NextResponse.json({ success: true, studentId })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[MARK UNPAID ERROR]', err)
    return NextResponse.json({ error: 'Failed to mark student as unpaid' }, { status: 500 })
  }
})
