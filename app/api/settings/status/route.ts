import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      clickup: !!(process.env.CLICKUP_API_KEY && process.env.CLICKUP_LIST_STUDENTS),
      razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      mailchimp: !!(process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_SERVER_PREFIX),
      twilio: !!(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM
      ),
    },
  })
}
