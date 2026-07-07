import { NextRequest, NextResponse } from 'next/server'
import { createGoogleMeetLink } from '@/lib/googleMeet'
import { sendDemoConfirmationToParent, sendDemoConfirmationToCoach } from '@/lib/emailSender'
import { sendDemoConfirmationWhatsApp } from '@/lib/whatsappSender'
import { AirtableClient } from '@/lib/airtableClient'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    leadId,
    parentEmail,
    parentName,
    parentPhone,
    coachId,
    coachEmail,
    coachName,
    selectedDate,
    selectedTime,
  } = body as Record<string, string>

  // Required field check
  const required = { leadId, parentEmail, parentName, parentPhone, coachId, coachEmail, coachName, selectedDate, selectedTime }
  for (const [key, val] of Object.entries(required)) {
    if (!val || typeof val !== 'string' || val.trim() === '') {
      return NextResponse.json({ error: `Missing required field: ${key}` }, { status: 400 })
    }
  }

  if (!EMAIL_REGEX.test(parentEmail)) {
    return NextResponse.json({ error: 'Invalid parentEmail format' }, { status: 400 })
  }

  if (!EMAIL_REGEX.test(coachEmail)) {
    return NextResponse.json({ error: 'Invalid coachEmail format' }, { status: 400 })
  }

  if (!parentPhone.startsWith('+')) {
    return NextResponse.json({ error: 'parentPhone must be in international format starting with +' }, { status: 400 })
  }

  if (!TIME_REGEX.test(selectedTime)) {
    return NextResponse.json({ error: 'selectedTime must be in HH:MM format (00:00–23:59)' }, { status: 400 })
  }

  const demoDate = new Date(selectedDate)
  if (isNaN(demoDate.getTime())) {
    return NextResponse.json({ error: 'selectedDate is not a valid date' }, { status: 400 })
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (demoDate < today) {
    return NextResponse.json({ error: 'selectedDate must be a future date' }, { status: 400 })
  }

  try {
    // 1. Create Google Meet event
    const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const { meetLink, eventId } = await createGoogleMeetLink(
      `Chess Demo Class - ${parentName}`,
      startDateTime,
      30
    )

    // 2. Send confirmation emails
    await sendDemoConfirmationToParent(parentEmail, parentName, coachName, meetLink, selectedDate, selectedTime)
    await sendDemoConfirmationToCoach(coachEmail, coachName, parentName, parentPhone, meetLink, selectedDate, selectedTime)

    // 3. Send WhatsApp to parent
    await sendDemoConfirmationWhatsApp(parentPhone, parentName, meetLink, selectedDate, selectedTime)

    // 4. Update lead status
    await AirtableClient.updateLeadStatus(leadId, 'Demo Scheduled', {
      demoDate: selectedDate,
      demoTime: selectedTime,
      meetLink,
    })

    const confirmedAt = new Date().toISOString()
    console.log('[DEMO SCHEDULED]', { leadId, meetLink, eventId })

    return NextResponse.json({
      success: true,
      leadId,
      meetLink,
      eventId,
      confirmedAt,
    })
  } catch (err) {
    console.error('[DEMO ERROR]', err)
    return NextResponse.json({ error: 'Failed to schedule demo' }, { status: 500 })
  }
}
