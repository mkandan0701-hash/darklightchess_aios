import { NextRequest, NextResponse } from 'next/server'
import { findBestCoach, Coach } from '@/lib/coachMatcher'
import { sendWelcomeEmail, sendEmailToCoach } from '@/lib/emailSender'

interface Lead {
  name: string
  email: string
  phone: string
  source: string
  available_days: string[]
  available_time: string
  notes?: string
  leadId?: string
  status?: string
  timestamp?: string
}

const mockCoaches: Coach[] = [
  {
    id: "C1",
    name: "Manikandan",
    email: "manikandan@darklight.com",
    phone: "+919876543210",
    available_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    available_time_slots: ["9 AM - 12 PM", "12 PM - 3 PM", "3 PM - 6 PM", "6 PM - 9 PM"],
    current_students: 5,
    rating: 4.8
  }
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Lead

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name is required (minimum 2 characters)' },
        { status: 400 }
      )
    }

    if (!body.email || !EMAIL_REGEX.test(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    if (!body.phone || !body.phone.startsWith('+')) {
      return NextResponse.json(
        { success: false, error: 'Phone must be in international format (e.g. +919876543210)' },
        { status: 400 }
      )
    }

    if (!body.source || !body.source.trim()) {
      return NextResponse.json(
        { success: false, error: 'Source is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.available_days) || body.available_days.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one available day is required' },
        { status: 400 }
      )
    }

    if (!body.available_time || !body.available_time.trim()) {
      return NextResponse.json(
        { success: false, error: 'Available time is required' },
        { status: 400 }
      )
    }

    const timestamp = new Date().toISOString()
    const leadId = `LEAD_${Date.now()}`

    const leadData: Lead = {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      source: body.source.trim(),
      available_days: body.available_days,
      available_time: body.available_time.trim(),
      notes: body.notes?.trim(),
      leadId,
      status: 'new',
      timestamp,
    }

    console.log('[LEAD RECEIVED]', { leadData, timestamp })

    const bestCoach = findBestCoach(leadData, mockCoaches)

    if (bestCoach) {
      await sendWelcomeEmail(leadData.email, leadData.name)
      await sendEmailToCoach(bestCoach, leadData)
      console.log("[COACH ASSIGNED]", { leadId: leadData.leadId, coachId: bestCoach.id, coachName: bestCoach.name })
    } else {
      console.log("[NO COACH AVAILABLE]", { leadId: leadData.leadId, available_days: leadData.available_days })
    }

    return NextResponse.json({
      success: true,
      leadId,
      message: 'Lead received successfully',
      timestamp,
    })
  } catch (error) {
    console.error('[LEAD ERROR]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
