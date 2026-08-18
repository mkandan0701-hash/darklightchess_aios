import { NextResponse } from 'next/server'
import { GmailClient } from '@/lib/gmail'
import { withAuth } from '@/lib/auth/withAuth'

// NOTE: `to` is a free-form address with no Airtable record to scope it against, so any
// signed-in branch admin can currently email an arbitrary address. Flagged in claude.md as a
// residual risk — a follow-up should require the recipient to come from the caller's branch.
export const POST = withAuth(async (request) => {
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

    const result = await GmailClient.sendEmail({
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
})
