import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { studentId?: string; paymentId?: string }
    const { studentId, paymentId } = body

    if (!studentId && !paymentId) {
      return NextResponse.json({ error: 'Missing required field: studentId or paymentId' }, { status: 400 })
    }

    // `paymentId` present (Payments page) → the reliable direct path, and `studentId` there
    // may legitimately be blank (legacy rows with no reliable join) — the sync to
    // Student.payment_status is best-effort and simply skipped when absent. Otherwise
    // (Students page) → find the student's paid Payment record and revert it.
    if (paymentId) {
      await db.markPaymentUnpaid(paymentId, { studentId })
    } else if (studentId) {
      await db.markStudentUnpaid(studentId)
    }

    console.log('[MARK UNPAID]', { studentId, by: session.email })

    return NextResponse.json({ success: true, studentId })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[MARK UNPAID ERROR]', err)
    return NextResponse.json({ error: 'Failed to mark student as unpaid' }, { status: 500 })
  }
})
