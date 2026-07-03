import { NextRequest, NextResponse } from 'next/server'
import { formatReceiptEmail } from '@/lib/receiptGenerator'
import { sendReceiptEmail } from '@/lib/emailSender'
import { sendReceiptWhatsApp } from '@/lib/whatsappSender'
import { ClickUpClient } from '@/lib/clickup'
import { RazorpayClient } from '@/lib/razorpay'

interface RazorpayPaymentNotes {
  studentId?: string
  studentName?: string
  parentPhone?: string
  coachName?: string
}

interface RazorpayPaymentEntity {
  id: string
  amount: number
  currency: string
  status: string
  email: string
  method: string
  notes: RazorpayPaymentNotes
  created_at: number
}

interface RazorpayWebhook {
  event: string
  payload: {
    payment: {
      entity: RazorpayPaymentEntity
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    if (!RazorpayClient.verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const body = JSON.parse(rawBody) as RazorpayWebhook

    if (!body?.payload?.payment?.entity) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload: missing payment entity' },
        { status: 400 }
      )
    }

    const paymentEntity = body.payload.payment.entity
    const paymentId = paymentEntity.id
    const studentId = paymentEntity.notes?.studentId
    const studentName = paymentEntity.notes?.studentName ?? 'Student'
    const parentEmail = paymentEntity.email
    const parentPhone = paymentEntity.notes?.parentPhone ?? ''
    const coachName = paymentEntity.notes?.coachName ?? 'Coach'
    const amount = paymentEntity.amount / 100
    const paidAt = new Date(paymentEntity.created_at * 1000)

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'Missing paymentId in webhook payload' },
        { status: 400 }
      )
    }
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Missing studentId in payment notes' },
        { status: 400 }
      )
    }
    if (!parentEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing parent email in payment payload' },
        { status: 400 }
      )
    }

    const receiptText = formatReceiptEmail({
      paymentId,
      studentName,
      amount,
      currency: paymentEntity.currency ?? 'INR',
      paymentMethod: paymentEntity.method,
      paidAt,
      coachName,
    })

    sendReceiptEmail(parentEmail, studentName, receiptText, coachName)

    sendReceiptWhatsApp(parentPhone, studentName, amount, paymentId)

    const enrollmentDate = new Date().toISOString()
    await ClickUpClient.enrollStudent(studentId, {
      status: 'Active',
      paymentId,
      paidAt: paidAt.toISOString(),
      enrollmentDate,
    })

    console.log('[PAYMENT PROCESSED]', { studentId, paymentId, amount, email: parentEmail })

    return NextResponse.json({
      success: true,
      paymentId,
      studentId,
      receiptSent: true,
      enrollmentUpdated: true,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    const paymentId = 'unknown'
    console.error('[PAYMENT WEBHOOK ERROR]', { error, paymentId })
    return NextResponse.json(
      { success: false, error: 'Internal server error processing payment webhook' },
      { status: 500 }
    )
  }
}
