import { NextRequest, NextResponse } from 'next/server'
import { ClickUpClient } from '@/lib/clickup'
import { sendOverdueReminderEmail } from '@/lib/emailSender'
import { sendOverdueReminderWhatsApp } from '@/lib/whatsappSender'

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
      ClickUpClient.getPayments(),
      ClickUpClient.getStudents(),
    ])
  } catch (err) {
    console.error('[CRON ERROR] ClickUp query failed:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overdue students' },
      { status: 500 }
    )
  }

  const overduePayments = payments.filter((p) => p.status === 'overdue')

  let emailsSent = 0
  let whatsappSent = 0
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
      sendOverdueReminderEmail(student.email, student.name, payment.amountDue, daysOverdue)
      emailsSent++

      sendOverdueReminderWhatsApp(student.phone, student.name, payment.amountDue, daysOverdue)
      whatsappSent++

      await ClickUpClient.markReminderSent(payment.id, { reminderSentAt: timestamp })

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
    `[CRON COMPLETED] { totalProcessed: ${totalProcessed}, emailsSent: ${emailsSent}, whatsappSent: ${whatsappSent}, duration: ${duration}ms }`
  )

  return NextResponse.json({
    success: true,
    remindersProcessed: totalProcessed,
    emailsSent,
    whatsappSent,
    successCount,
    failureCount,
    timestamp,
  })
}
