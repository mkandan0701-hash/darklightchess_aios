import { NextResponse } from 'next/server'
import { formatReceiptEmail } from '@/lib/receiptGenerator'
import { sendReceiptEmail } from '@/lib/emailSender'
import { sendReceiptWhatsApp } from '@/lib/whatsappSender'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as {
      studentId?: string
      paymentId?: string
      studentName?: string
      parentEmail?: string
      parentPhone?: string
      amount?: number
      coachName?: string
    }

    const { studentId, paymentId, studentName, parentEmail, parentPhone, amount, coachName } = body

    if (!studentName || (!studentId && !paymentId)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'A positive amount is required to record the payment' }, { status: 400 })
    }

    const paidAt = new Date()
    // Throws ScopeError → 404 if the record belongs to another branch. `paymentId` present
    // (Payments page, already has the real Payment record) → the reliable direct path, and
    // `studentId` there may legitimately be blank (legacy rows with no reliable join) — the
    // sync to Student.payment_status is best-effort and simply skipped when absent. Otherwise
    // (Students page) → find-or-create the Payment record for this student, which does need it.
    if (paymentId) {
      await db.markPaymentPaid(paymentId, { amountPaid: amount, paidDate: paidAt.toISOString(), studentId })
    } else if (studentId) {
      await db.markStudentPaidManually(studentId, { paidAt: paidAt.toISOString(), amount, studentName })
    }

    let receiptSent = false
    if (parentEmail && typeof amount === 'number') {
      const receiptText = formatReceiptEmail({
        paymentId: `manual-${Date.now()}`,
        studentName,
        amount,
        currency: 'INR',
        paymentMethod: 'manual',
        paidAt,
        coachName: coachName ?? 'Coach',
      })
      await sendReceiptEmail(parentEmail, studentName, receiptText, coachName ?? 'Coach')
      if (parentPhone) {
        await sendReceiptWhatsApp(parentPhone, studentName, amount, `manual-${Date.now()}`)
      }
      receiptSent = true
    }

    console.log('[MARK PAID MANUAL]', { studentId, studentName, by: session.email })

    return NextResponse.json({
      success: true,
      studentId,
      receiptSent,
      paidAt: paidAt.toISOString(),
    })
  } catch (err) {
    // Re-thrown so withAuth's catch turns it into a 404 — a cross-branch record id must not
    // surface as a generic 500 here, which would leak that the record exists but is denied.
    if (err instanceof ScopeError) throw err
    console.error('[MARK PAID ERROR]', err)
    return NextResponse.json({ error: 'Failed to mark student as paid' }, { status: 500 })
  }
})
