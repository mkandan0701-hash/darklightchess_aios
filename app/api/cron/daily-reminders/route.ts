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

  // No user session — a cron trigger authenticates via CRON_SECRET above, not a branch scope.
  const db = AirtableClient.system()

  let payments
  let students
  try {
    ;[payments, students] = await Promise.all([
      db.getPayments(),
      db.getStudents(),
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
    const toMarkOverdue = payments.filter((payment) => {
      if (payment.status !== 'pending' || !payment.dueDate) return false

      const due = new Date(payment.dueDate)
      if (isNaN(due.getTime())) {
        console.warn(`[CRON WARN] Unparseable dueDate for payment ${payment.id}: "${payment.dueDate}"`)
        return false
      }
      return due.getUTCFullYear() * 12 + due.getUTCMonth() <= currentYM
    })

    // One batched write (10 rows per request) rather than one request per payment.
    if (toMarkOverdue.length > 0) {
      try {
        await db.markPaymentsOverdue(toMarkOverdue.map((p) => p.id))
        for (const payment of toMarkOverdue) payment.status = 'overdue'
        newlyMarkedOverdue = toMarkOverdue.length
      } catch (err) {
        console.error('[CRON ERROR] Failed to mark payments overdue:', err)
      }
    }
  }

  const overduePayments = payments.filter((p) => p.status === 'overdue')

  let emailsSent = 0
  let successCount = 0
  let failureCount = 0
  const remindedPaymentIds: string[] = []

  for (const payment of overduePayments) {
    // NOTE: payment.studentId comes from Airtable's student_id field, which predates the
    // `branch` column and may not reliably match a student record — see claude.md §9 and
    // scripts/backfill-branch.js. A payment that fails this join is skipped, not guessed.
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
      remindedPaymentIds.push(payment.id)

      console.log(`[REMINDER SENT] { studentId: '${student.id}', studentName: '${student.name}' }`)
      successCount++
    } catch (err) {
      console.error(`[CRON ERROR] Failed for student ${student.name}:`, err)
      failureCount++
    }
  }

  // Stamped in one batched write after the loop — this ran once per overdue payment per day
  // and was the single largest consumer of the Airtable monthly request quota.
  if (remindedPaymentIds.length > 0) {
    try {
      await db.markRemindersSent(remindedPaymentIds, { reminderSentAt: timestamp })
    } catch (err) {
      console.error('[CRON ERROR] Failed to record reminder_sent_at:', err)
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
