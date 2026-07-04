import nodemailer from 'nodemailer'

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

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return transporter
}

export class GmailClient {
  static isConfigured(): boolean {
    return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  }

  static async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      console.log('[Gmail Mock] Would send email to', params.to, '- Subject:', params.subject)
      return { success: true, messageId: `mock-${Date.now()}` }
    }

    try {
      const info = await getTransporter().sendMail({
        from: `"Darklight Chess Academy" <${process.env.GMAIL_USER}>`,
        to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
        subject: params.subject,
        text: params.body,
      })
      return { success: true, messageId: info.messageId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Gmail Error]', { to: params.to, subject: params.subject, error: message })
      return { success: false, error: message }
    }
  }
}
