import { NextResponse } from 'next/server'
import { createRazorpayInvoice } from '@/services/razorpay'
import { sendPaymentLinkEmail } from '@/lib/emailSender'
import { sendPaymentLinkWhatsApp } from '@/lib/whatsappSender'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db }) => {
  try {
    const body = await req.json() as {
      studentId?: string
      studentName?: string
      parentEmail?: string
      parentPhone?: string
      amount?: number
      currency?: string
      coachName?: string
    }

    const { studentId, studentName, parentEmail, parentPhone, amount, currency, coachName } = body

    if (!studentId || !studentName || !parentEmail || !parentPhone || !coachName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof amount !== 'number' || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: 'Amount must be between 1 and 100000 (rupees)' }, { status: 400 })
    }
    if (!parentEmail.includes('@')) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    if (!parentPhone.startsWith('+')) {
      return NextResponse.json({ error: 'Phone must start with + (e.g. +919876543210)' }, { status: 400 })
    }

    // Checked before creating a Razorpay invoice, so an out-of-scope student id can't
    // generate a live payment link on its way to the 404.
    await db.assertAccessible('students', studentId)

    const resolvedCurrency = currency ?? 'INR'

    const invoice = await createRazorpayInvoice(studentId, studentName, parentEmail, amount, resolvedCurrency, parentPhone)
    const { invoiceId, paymentLink, expiresAt } = invoice

    await sendPaymentLinkEmail(parentEmail, studentName, paymentLink, amount, expiresAt, coachName)
    await sendPaymentLinkWhatsApp(parentPhone, studentName, paymentLink, amount, expiresAt)
    await db.updateStudentPaymentLink(studentId, paymentLink, invoiceId)

    console.log('[PAYMENT LINK GENERATED]', { studentId, invoiceId, paymentLink })

    return NextResponse.json({
      success: true,
      studentId,
      invoiceId,
      paymentLink,
      amount,
      currency: resolvedCurrency,
      expiresAt,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[PAYMENT LINK ERROR]', err)
    return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 })
  }
})
