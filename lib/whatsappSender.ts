export interface WhatsAppResult {
  success: boolean
  message: string
  sentAt?: string
}

export function sendDemoConfirmationWhatsApp(
  phone: string,
  parentName: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): WhatsAppResult {
  const message = `Hi ${parentName},

Your chess demo is scheduled!
📅 ${demoDate} at ${demoTime}

Join here: ${meetLink}

See you soon! 🎯`

  console.log('[WHATSAPP SENT]', { to: phone, message })

  return { success: true, message, sentAt: new Date().toISOString() }
}

export function sendPaymentReminderWhatsApp(
  phone: string,
  parentName: string,
  amount: number
): WhatsAppResult {
  const message = `Hi ${parentName}, your payment of ₹${amount} is due. Please complete it at your earliest convenience.`

  console.log('[WHATSAPP SENT - PAYMENT REMINDER]', { to: phone, message })

  return { success: true, message, sentAt: new Date().toISOString() }
}

export function sendPaymentLinkWhatsApp(
  phone: string,
  studentName: string,
  paymentLink: string,
  amount: number,
  expiryDate: string
): WhatsAppResult {
  const message = `Hi Parent,\nPayment link for ${studentName}'s chess class: ₹${amount}\n💳 Pay here: ${paymentLink}\n⏰ Expires: ${expiryDate}\nSecure payment - 100% safe! 🔒`

  console.log('[WHATSAPP SENT]', { to: phone, type: 'payment_link' })

  return { success: true, message, sentAt: new Date().toISOString() }
}

export function sendReceiptWhatsApp(
  phone: string,
  studentName: string,
  amount: number,
  paymentId: string
): WhatsAppResult {
  const message = `Hi Parent,\n✅ Payment Received!\nStudent: ${studentName}\n\nAmount: ₹${amount.toLocaleString('en-IN')}\n\nReceipt ID: ${paymentId}\nYour enrollment is confirmed! 🎉\n\nFirst class starts immediately.\nLogin here to see your schedule.`

  console.log('[WHATSAPP SENT - RECEIPT]', { to: phone })

  return { success: true, message, sentAt: new Date().toISOString() }
}

export function sendOverdueReminderWhatsApp(
  phone: string,
  studentName: string,
  amountDue: number,
  daysOverdue: number
): WhatsAppResult {
  const message = `Hi Parent,\n⏰ Payment Reminder\nStudent: ${studentName}\nAmount Due: ₹${amountDue.toLocaleString('en-IN')}\nDays Overdue: ${daysOverdue}\n\nYour classes are on hold. Please pay to resume.\nClick your payment link to pay now.\n\nQuestions? Chat support@darklight.com`

  console.log('[WHATSAPP SENT - OVERDUE REMINDER]', { to: phone, amountDue })

  return { success: true, message, sentAt: new Date().toISOString() }
}
