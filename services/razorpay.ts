export interface RazorpayInvoice {
  invoiceId: string
  paymentLink: string
  expiresAt: string
  amount: number
  currency: string
}

interface RazorpayInvoiceResponse {
  id: string
  short_url: string
  expire_by: number
  description?: string
}

export async function createRazorpayInvoice(
  studentId: string,
  studentName: string,
  parentEmail: string,
  amount: number,
  currency: string,
  parentPhone?: string
): Promise<RazorpayInvoice> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials missing')
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const invoiceData = {
    customer: {
      name: studentName,
      email: parentEmail,
      ...(parentPhone ? { contact: parentPhone } : {}),
    },
    line_items: [
      {
        name: 'Chess Classes - Darklight Academy',
        description: `Classes for ${studentName}`,
        amount: amount * 100,
        currency,
        quantity: 1,
      },
    ],
    type: 'invoice',
    currency,
    expire_by: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    sms_notify: 0,
    email_notify: 1,
    notes: {
      studentId,
      studentName,
      source: 'Darklight Chess Academy',
    },
  }

  try {
    const response = await fetch('https://api.razorpay.com/v1/invoices', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    })

    const invoice = await response.json() as RazorpayInvoiceResponse & { description?: string }

    if (!response.ok) {
      console.error('[RAZORPAY ERROR]', invoice)
      throw new Error(`Razorpay API error: ${invoice.description ?? 'Unknown error'}`)
    }

    const invoiceId = invoice.id
    const paymentLink = invoice.short_url
    const expiresAt = new Date(invoice.expire_by * 1000).toISOString()

    console.log('[RAZORPAY INVOICE CREATED]', { invoiceId, paymentLink, amount, studentId })

    return {
      invoiceId,
      paymentLink,
      expiresAt,
      amount,
      currency,
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Razorpay API error')) {
      throw err
    }
    console.error('[RAZORPAY ERROR]', err)
    throw new Error('Failed to create Razorpay invoice')
  }
}
