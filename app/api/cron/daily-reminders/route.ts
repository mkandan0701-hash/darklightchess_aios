import { NextRequest, NextResponse } from 'next/server'
import { AirtableClient } from '@/lib/airtableClient'
import { sendOverdueReminderEmail } from '@/lib/emailSender'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  console.log(`[CRON START] Running at ${timestamp}`)

  let payments
  let students
  try {
    ;[payments, students] = await Promise.all([
      AirtableClient.getPayments(),
      AirtableClient.getStudents(),
    ])
  } catch (err) {
    console.error('[CRON ERROR] Airtable query failed:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overdue students' },
      { status: 500 }
    )
  }

  const today = new Date()
  const currentYM = today.getUTCFullYear() * 12 + today.getUTCMonth()
  const dayOfMonth = today.getUTCDate()

  let newlyMarkedOverdue = 0

  if (dayOfMonth >= 8) {
    for (const payment of payments) {
      if (payment.status !== 'pending' || !payment.dueDate) continue

      const due = new Date(payment.dueDate)
      if (isNaN(due.getTime())) {
        console.warn(`[CRON WARN] Unparseable dueDate for payment ${payment.id}: "${payment.dueDate}"`)
        continue
      }
      const dueYM = due.getUTCFullYear() * 12 + due.getUTCMonth()

      if (dueYM <= currentYM) {
        try {
          await AirtableClient.markPaymentOverdue(payment.id)
          payment.status = 'overdue'
          newlyMarkedOverdue++
        } catch (err) {
          console.error(`[CRON ERROR] Failed to mark payment ${payment.id} overdue:`, err)
        }
      }
    }
  }

  const overduePayments = payments.filter((p) => p.status === 'overdue')

  let emailsSent = 0
  let successCount = 0
  let failureCount = 0

  for (const payment of overduePayments) {
    const student = students.find((s) => s.id === payment.studentId)
    if (!student) {
      console.error(`[CRON ERROR] Student not found for payment ${payment.id}`)
      failureCount++
      continue
    }

    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    )

    try {
      await sendOverdueReminderEmail(student.email, student.name, payment.amountDue, daysOverdue)
      emailsSent++

      await AirtableClient.markReminderSent(payment.id, { reminderSentAt: timestamp })

      console.log(`[REMINDER SENT] { studentId: '${student.id}', studentName: '${student.name}' }`)
      successCount++
    } catch (err) {
      console.error(`[CRON ERROR] Failed for student ${student.name}:`, err)
      failureCount++
    }
  }

  const totalProcessed = overduePayments.length
  const duration = Date.now() - startTime

  console.log(
    `[CRON COMPLETED] { totalProcessed: ${totalProcessed}, newlyMarkedOverdue: ${newlyMarkedOverdue}, emailsSent: ${emailsSent}, duration: ${duration}ms }`
  )

  return NextResponse.json({
    success: true,
    remindersProcessed: totalProcessed,
    newlyMarkedOverdue,
    emailsSent,
    successCount,
    failureCount,
    timestamp,
  })
}
