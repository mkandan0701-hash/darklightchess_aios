import { NextResponse } from 'next/server'
import { sendOverdueReminderEmail } from '@/lib/emailSender'
import { sendOverdueReminderWhatsApp } from '@/lib/whatsappSender'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as {
      paymentId?: string
      studentName?: string
      parentEmail?: string
      parentPhone?: string
      amountDue?: number
      dueDate?: string
    }

    const { paymentId, studentName, parentEmail, parentPhone, amountDue, dueDate } = body

    if (!paymentId || !studentName || !parentEmail || typeof amountDue !== 'number' || !dueDate) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Checked before sending anything, so an out-of-scope payment id can't trigger the
    // email/WhatsApp side effect on its way to the 404.
    await db.assertAccessible('payments', paymentId)

    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
    )

    await sendOverdueReminderEmail(parentEmail, studentName, amountDue, daysOverdue)

    if (parentPhone) {
      await sendOverdueReminderWhatsApp(parentPhone, studentName, amountDue, daysOverdue)
    }

    await db.markReminderSent(paymentId, { reminderSentAt: new Date().toISOString() })

    console.log('[REMINDER SENT MANUAL]', { paymentId, studentName, by: session.email })

    return NextResponse.json({ success: true, remindedAt: new Date().toISOString() })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[SEND REMINDER ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to send reminder' }, { status: 500 })
  }
})
