import { NextRequest, NextResponse } from 'next/server'
import { MailchimpClient } from '@/lib/mailchimp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      to: string
      toName?: string
      subject: string
      message: string
    }

    if (!body.to || !body.subject || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, message' },
        { status: 400 }
      )
    }

    const result = await MailchimpClient.sendEmail({
      to: body.to,
      toName: body.toName,
      subject: body.subject,
      body: body.message,
    })

    return NextResponse.json({ success: result.success, messageId: result.messageId })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
