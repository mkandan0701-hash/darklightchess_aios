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

const MOCK_RAZORPAY_PAYMENTS: RazorpayPayment[] = [
  {
    id: 'pay_QxR1234567',
    entity: 'payment',
    amount: 500000,
    currency: 'INR',
    status: 'captured',
    order_id: 'order_QxR001',
    description: 'June fee - Arjun Sharma',
    email: 'arjun.sharma@gmail.com',
    contact: '+919876543210',
    created_at: 1748823600,
  },
  {
    id: 'pay_QxR7654321',
    entity: 'payment',
    amount: 800000,
    currency: 'INR',
    status: 'captured',
    order_id: 'order_QxR002',
    description: 'June fee - Rohan Patel',
    email: 'rohan.patel@gmail.com',
    contact: '+919876543212',
    created_at: 1748737200,
  },
  {
    id: 'pay_QxR1122334',
    entity: 'payment',
    amount: 650000,
    currency: 'INR',
    status: 'captured',
    order_id: 'order_QxR003',
    description: 'June fee - Karthik Rajan',
    email: 'karthik.r@gmail.com',
    contact: '+919876543214',
    created_at: 1749254400,
  },
  {
    id: 'pay_QxR5566778',
    entity: 'payment',
    amount: 500000,
    currency: 'INR',
    status: 'captured',
    order_id: 'order_QxR004',
    description: 'May fee - Arjun Sharma',
    email: 'arjun.sharma@gmail.com',
    contact: '+919876543210',
    created_at: 1746145200,
  },
  {
    id: 'pay_QxR9988776',
    entity: 'payment',
    amount: 650000,
    currency: 'INR',
    status: 'failed',
    order_id: 'order_QxR005',
    description: 'June fee - Priya Nair',
    email: 'priya.nair@gmail.com',
    contact: '+919876543211',
    created_at: 1748995200,
  },
]

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
    if (!this.isConfigured()) return MOCK_RAZORPAY_PAYMENTS
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
