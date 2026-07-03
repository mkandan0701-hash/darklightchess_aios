interface ReceiptData {
  paymentId: string
  studentName: string
  amount: number
  currency: string
  paymentMethod: string
  paidAt: string | Date
  coachName: string
}

export function formatReceiptEmail(data: ReceiptData): string {
  const { paymentId, studentName, amount, paymentMethod, paidAt, coachName } = data

  if (!paymentId || !studentName || !amount || !paymentMethod || !paidAt || !coachName) {
    throw new Error('Missing required receipt fields')
  }

  const formattedDate = new Date(paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' })
  const formattedAmount = amount.toLocaleString('en-IN')

  console.log('[RECEIPT GENERATED]', { paymentId, studentName })

  return `🎓 DARKLIGHT CHESS ACADEMY - RECEIPT
✅ Payment Confirmed!
Receipt ID: ${paymentId}

Date: ${formattedDate}
Student: ${studentName}

Coach: ${coachName}

Amount Paid: ₹${formattedAmount}

Payment Method: ${paymentMethod}
Status: ENROLLMENT CONFIRMED ✅
Your chess classes are now active!

Your first class starts immediately.
Login to view your schedule and materials.
Questions? Contact: support@darklight.com
Thank you for enrolling!

Darklight Chess Academy Team`
}
