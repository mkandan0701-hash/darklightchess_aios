import { NextRequest, NextResponse } from 'next/server'
import { TwilioClient } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      to: string
      message: string
    }

    if (!body.to || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, message' },
        { status: 400 }
      )
    }

    const result = await TwilioClient.sendWhatsApp({
      to: body.to,
      body: body.message,
    })

    return NextResponse.json({ success: result.success, sid: result.sid })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to send WhatsApp message' },
      { status: 500 }
    )
  }
}
