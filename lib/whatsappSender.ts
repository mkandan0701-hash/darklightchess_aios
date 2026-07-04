import { TwilioClient } from './twilio'

export interface WhatsAppResult {
  success: boolean
  message: string
  sentAt?: string
  error?: string
}

async function dispatch(phone: string, message: string): Promise<WhatsAppResult> {
  const result = await TwilioClient.sendWhatsApp({ to: phone, body: message })
  if (!result.success) {
    console.error('[WHATSAPP FAILED]', { to: phone, error: result.error })
    return { success: false, message, error: result.error }
  }
  return { success: true, message, sentAt: new Date().toISOString() }
}

export async function sendWelcomeWhatsApp(
  phone: string,
  name: string
): Promise<WhatsAppResult> {
  const message = `Hi ${name},

Thanks for your interest in Darklight Chess Academy! We've received your details and a coach will be in touch shortly to schedule your demo class. ♟️

Darklight Chess Academy`

  return dispatch(phone, message)
}

export async function sendDemoConfirmationWhatsApp(
  phone: string,
  parentName: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): Promise<WhatsAppResult> {
  const message = `Hi ${parentName},

Your chess demo is scheduled!
📅 ${demoDate} at ${demoTime}

Join here: ${meetLink}

See you soon! 🎯`

  return dispatch(phone, message)
}

export async function sendPaymentReminderWhatsApp(
  phone: string,
  parentName: string,
  amount: number
): Promise<WhatsAppResult> {
  const message = `Hi ${parentName}, your payment of ₹${amount} is due. Please complete it at your earliest convenience.`

  return dispatch(phone, message)
}

export async function sendPaymentLinkWhatsApp(
  phone: string,
  studentName: string,
  paymentLink: string,
  amount: number,
  expiryDate: string
): Promise<WhatsAppResult> {
  const message = `Hi Parent,\nPayment link for ${studentName}'s chess class: ₹${amount}\n💳 Pay here: ${paymentLink}\n⏰ Expires: ${expiryDate}\nSecure payment - 100% safe! 🔒`

  return dispatch(phone, message)
}

export async function sendReceiptWhatsApp(
  phone: string,
  studentName: string,
  amount: number,
  paymentId: string
): Promise<WhatsAppResult> {
  const message = `Hi Parent,\n✅ Payment Received!\nStudent: ${studentName}\n\nAmount: ₹${amount.toLocaleString('en-IN')}\n\nReceipt ID: ${paymentId}\nYour enrollment is confirmed! 🎉\n\nFirst class starts immediately.\nLogin here to see your schedule.`

  return dispatch(phone, message)
}

export async function sendOverdueReminderWhatsApp(
  phone: string,
  studentName: string,
  amountDue: number,
  daysOverdue: number
): Promise<WhatsAppResult> {
  const message = `Hi Parent,\n⏰ Payment Reminder\nStudent: ${studentName}\nAmount Due: ₹${amountDue.toLocaleString('en-IN')}\nDays Overdue: ${daysOverdue}\n\nYour classes are on hold. Please pay to resume.\nClick your payment link to pay now.\n\nQuestions? Chat support@darklight.com`

  return dispatch(phone, message)
}
