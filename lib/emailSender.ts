export function sendEmailToCoach(
  coach: { name: string; email: string },
  lead: { name: string }
): { success: boolean } {
  console.log("[EMAIL SENT TO COACH]", coach.name);
  return { success: true };
}

export function sendEmailToParent(
  email: string,
  name: string,
  coach: { name: string }
): { success: boolean } {
  console.log("[EMAIL SENT TO PARENT]", email);
  return { success: true };
}

export function sendWelcomeEmail(
  email: string,
  name: string
): { success: boolean } {
  console.log("[WELCOME EMAIL SENT]", email);
  return { success: true };
}

export function sendDemoConfirmationToParent(
  parentEmail: string,
  parentName: string,
  coachName: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): { success: boolean } {
  console.log("[EMAIL SENT TO PARENT - DEMO CONFIRMATION]", parentEmail);
  return { success: true };
}

export function sendDemoConfirmationToCoach(
  coachEmail: string,
  coachName: string,
  parentName: string,
  parentPhone: string,
  meetLink: string,
  demoDate: string,
  demoTime: string
): { success: boolean } {
  console.log("[EMAIL SENT TO COACH - DEMO CONFIRMATION]", coachEmail);
  return { success: true };
}

export function sendPaymentLinkEmail(
  parentEmail: string,
  studentName: string,
  paymentLink: string,
  amount: number,
  expiryDate: string,
  coachName: string
): { success: boolean } {
  console.log('[EMAIL SENT - PAYMENT LINK]', parentEmail);
  return { success: true };
}

export function sendReceiptEmail(
  parentEmail: string,
  studentName: string,
  receiptHtml: string,
  coachName: string
): { success: boolean } {
  console.log('[EMAIL SENT - RECEIPT]', { to: parentEmail });
  return { success: true };
}

export function sendOverdueReminderEmail(
  parentEmail: string,
  studentName: string,
  amountDue: number,
  daysOverdue: number
): { success: boolean } {
  console.log('[EMAIL SENT - OVERDUE REMINDER]', { to: parentEmail, amountDue, daysOverdue });
  return { success: true };
}
