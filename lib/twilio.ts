interface SendWhatsAppParams {
  to: string
  body: string
}

interface SendWhatsAppResult {
  success: boolean
  sid?: string
  error?: string
}

export class TwilioClient {
  static isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
    )
  }

  static async sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
    if (!this.isConfigured()) {
      console.log('[Twilio Mock] Would send WhatsApp to', params.to, '- Body:', params.body)
      return { success: true, sid: `mock-${Date.now()}` }
    }

    const sid = process.env.TWILIO_ACCOUNT_SID!
    const token = process.env.TWILIO_AUTH_TOKEN!
    const auth = Buffer.from(`${sid}:${token}`).toString('base64')

    const formBody = new URLSearchParams({
      From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      To: `whatsapp:${params.to}`,
      Body: params.body,
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      }
    )

    const data = await res.json() as { sid?: string; error_code?: number; message?: string }
    if (data.error_code) {
      return { success: false, error: data.message }
    }
    return { success: true, sid: data.sid }
  }
}
