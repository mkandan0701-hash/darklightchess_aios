import { GmailClient } from './gmail'

interface EmailResult {
  success: boolean
  error?: string
}

async function dispatch(to: string, toName: string | undefined, subject: string, body: string): Promise<EmailResult> {
  const result = await GmailClient.sendEmail({ to, toName, subject, body })
  if (!result.success) {
    console.error('[EMAIL FAILED]', { to, subject, error: result.error })
    return { success: false, error: result.error }
  }
  return { success: true }
}

export async function sendEmailToCoach(
  coach: { name: string; email: string },
  lead: { name: string }
): Promise<EmailResult> {
  const subject = `New Lead Assigned: ${lead.name}`
  const body = `Hi ${coach.name},\n\nA new student lead has been assigned to you: ${lead.name}.\n\nPlease reach out to schedule a demo class.\n\nDarklight Chess Academy`
  return dispatch(coach.email, coach.name, subject, body)
}

export async function sendEmailToParent(
  email: string,
  name: string,
  coach: { name: string }
): Promise<EmailResult> {
  const subject = `You've been matched with a coach!`
  const body = `Hi ${name},\n\nYour chess coach ${coach.name} will be reaching out shortly to schedule your demo class.\n\nDarklight Chess Academy`
  return dispatch(email, name, subject, body)
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<EmailResult> {
  const subject = `Welcome to Darklight Chess Academy!`
  const body = `Hi ${name},\n\nThanks for your interest in Darklight Chess Academy! We've received your details and a coach will be assigned shortly.\n\nDarklight Chess Academy`
  return dispatch(email, name, subject, body)
}

export async function sendDemoConfirmationToParent(
  parentEmail: string,
  parentName: string,
  coachName: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): Promise<EmailResult> {
  const subject = `Demo Class Confirmed - ${demoDate} at ${demoTime}`
  const body = `Hi ${parentName},\n\nYour chess demo class with ${coachName} is confirmed!\n\n📅 Date: ${demoDate}\n🕐 Time: ${demoTime}\n📹 Join here: ${meetLink}\n\nSee you soon!\n\nDarklight Chess Academy`
  return dispatch(parentEmail, parentName, subject, body)
}

export async function sendDemoConfirmationToCoach(
  coachEmail: string,
  coachName: string,
  parentName: string,
  parentPhone: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): Promise<EmailResult> {
  const subject = `Demo Class Scheduled - ${parentName}`
  const body = `Hi ${coachName},\n\nA demo class has been scheduled:\n\nParent: ${parentName}\nPhone: ${parentPhone}\n📅 Date: ${demoDate}\n🕐 Time: ${demoTime}\n📹 Join here: ${meetLink}\n\nDarklight Chess Academy`
  return dispatch(coachEmail, coachName, subject, body)
}

export async function sendPaymentLinkEmail(
  parentEmail: string,
  studentName: string,
  paymentLink: string,
  amount: number,
  expiryDate: string,
  coachName: string
): Promise<EmailResult> {
  const subject = `Payment Link for ${studentName}'s Chess Classes`
  const body = `Hi,\n\nPayment link for ${studentName}'s chess classes with ${coachName}:\n\n💳 Amount: ₹${amount.toLocaleString('en-IN')}\n🔗 Pay here: ${paymentLink}\n⏰ Expires: ${expiryDate}\n\nSecure payment - 100% safe.\n\nDarklight Chess Academy`
  return dispatch(parentEmail, undefined, subject, body)
}

export async function sendReceiptEmail(
  parentEmail: string,
  studentName: string,
  receiptHtml: string,
  coachName: string
): Promise<EmailResult> {
  const subject = `Payment Receipt - ${studentName}`
  return dispatch(parentEmail, undefined, subject, receiptHtml)
}

export async function sendOverdueReminderEmail(
  parentEmail: string,
  studentName: string,
  amountDue: number,
  daysOverdue: number
): Promise<EmailResult> {
  const subject = `Payment Reminder - ${studentName}`
  const body = `Hi,\n\nThis is a reminder that a payment of ₹${amountDue.toLocaleString('en-IN')} for ${studentName}'s chess classes is ${daysOverdue} day(s) overdue.\n\nClasses are on hold until payment is completed. Please pay at your earliest convenience.\n\nQuestions? Contact support@darklight.com\n\nDarklight Chess Academy`
  return dispatch(parentEmail, undefined, subject, body)
}
