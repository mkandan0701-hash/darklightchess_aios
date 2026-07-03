interface SendEmailParams {
  to: string
  toName?: string
  subject: string
  body: string
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class MailchimpClient {
  static isConfigured(): boolean {
    return !!(process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_SERVER_PREFIX)
  }

  static async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      console.log('[Mailchimp Mock] Would send email to', params.to, '- Subject:', params.subject)
      return { success: true, messageId: `mock-${Date.now()}` }
    }

    const server = process.env.MAILCHIMP_SERVER_PREFIX
    const res = await fetch(
      `https://${server}.api.mailchimp.com/3.0/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            from_email: 'noreply@darklight-chess.in',
            from_name: 'Darklight Chess Academy',
            subject: params.subject,
            text: params.body,
            to: [
              {
                email: params.to,
                name: params.toName ?? params.to,
                type: 'to',
              },
            ],
          },
        }),
      }
    )

    const data = await res.json() as Array<{ _id?: string; status?: string }>
    return { success: true, messageId: data[0]?._id }
  }
}
