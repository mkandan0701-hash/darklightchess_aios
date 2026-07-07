import { NextRequest, NextResponse } from 'next/server'
import { AirtableClient } from '@/lib/airtableClient'
import { sendOverdueReminderEmail } from '@/lib/emailSender'
import { sendOverdueReminderWhatsApp } from '@/lib/whatsappSender'

export async function POST(req: NextRequest) {
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

    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
    )

    await sendOverdueReminderEmail(parentEmail, studentName, amountDue, daysOverdue)

    if (parentPhone) {
      await sendOverdueReminderWhatsApp(parentPhone, studentName, amountDue, daysOverdue)
    }

    await AirtableClient.markReminderSent(paymentId, { reminderSentAt: new Date().toISOString() })

    console.log('[REMINDER SENT MANUAL]', { paymentId, studentName })

    return NextResponse.json({ success: true, remindedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[SEND REMINDER ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to send reminder' }, { status: 500 })
  }
}
