import crypto from 'crypto'

const RAZORPAY_BASE = 'https://api.razorpay.com/v1'

interface RazorpayPayment {
  id: string
  entity: string
  amount: number
  currency: string
  status: string
  order_id: string | null
  description: string | null
  email: string
  contact: string
  created_at: number
}

function getAuth(): string {
  const key = process.env.RAZORPAY_KEY_ID ?? ''
  const secret = process.env.RAZORPAY_KEY_SECRET ?? ''
  return Buffer.from(`${key}:${secret}`).toString('base64')
}

export class RazorpayClient {
  static isConfigured(): boolean {
    return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  }

  static async getPayments(count = 20): Promise<RazorpayPayment[]> {
    if (!this.isConfigured()) return []
    const res = await fetch(`${RAZORPAY_BASE}/payments?count=${count}`, {
      headers: {
        Authorization: `Basic ${getAuth()}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json() as { items?: RazorpayPayment[] }
    return data.items ?? []
  }

  static verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret || !signature) return false
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    } catch {
      return false
    }
  }
}
