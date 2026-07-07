import { NextRequest, NextResponse } from 'next/server'
import { formatReceiptEmail } from '@/lib/receiptGenerator'
import { sendReceiptEmail } from '@/lib/emailSender'
import { sendReceiptWhatsApp } from '@/lib/whatsappSender'
import { AirtableClient } from '@/lib/airtableClient'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      studentId?: string
      studentName?: string
      parentEmail?: string
      parentPhone?: string
      amount?: number
      coachName?: string
    }

    const { studentId, studentName, parentEmail, parentPhone, amount, coachName } = body

    if (!studentId || !studentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const paidAt = new Date()
    await AirtableClient.markStudentPaidManually(studentId, { paidAt: paidAt.toISOString() })

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

    console.log('[MARK PAID MANUAL]', { studentId, studentName })

    return NextResponse.json({
      success: true,
      studentId,
      receiptSent,
      paidAt: paidAt.toISOString(),
    })
  } catch (err) {
    console.error('[MARK PAID ERROR]', err)
    return NextResponse.json({ error: 'Failed to mark student as paid' }, { status: 500 })
  }
}
