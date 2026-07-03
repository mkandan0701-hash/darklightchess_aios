export interface RazorpayInvoice {
  invoiceId: string
  paymentLink: string
  expiresAt: string
  amount: number
  currency: string
}

export function createRazorpayInvoice(
  studentId: string,
  studentName: string,
  parentEmail: string,
  amountInPaise: number,
  currency: string
): RazorpayInvoice {
  const randomStr = Math.random().toString(36).substring(2, 10)
  const invoiceId = `INV_${randomStr}`
  const paymentLink = `https://rzp.io/i/${randomStr}`
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  console.log('[RAZORPAY INVOICE]', { invoiceId, studentId, studentName, parentEmail, amount: amountInPaise })
  return { invoiceId, paymentLink, expiresAt, amount: amountInPaise, currency }
}
