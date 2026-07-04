import { NextRequest, NextResponse } from 'next/server'
import { findBestCoach, Coach } from '@/lib/coachMatcher'
import { getCoachPool } from '@/lib/coaches'
import { sendWelcomeEmail, sendEmailToCoach } from '@/lib/emailSender'
import { sendWelcomeWhatsApp } from '@/lib/whatsappSender'
import { validateAndCreateLead } from '@/lib/leadService'

interface LeadPayload {
  name: string
  email: string
  phone: string
  source: string
  available_days: string[]
  available_time: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LEAD_WEBHOOK_SECRET
    const providedSecret = request.headers.get('x-lead-webhook-secret')
    if (!secret || providedSecret !== secret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as LeadPayload

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name is required (minimum 2 characters)' },
        { status: 400 }
      )
    }

    if (!body.phone || !body.phone.startsWith('+')) {
      return NextResponse.json(
        { success: false, error: 'Phone must be in international format (e.g. +919876543210)' },
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

    const result = await validateAndCreateLead({
      name: body.name,
      email: body.email,
      phone: body.phone,
      source: body.source,
      notes: body.notes,
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      )
    }

    const { lead } = result
    const timestamp = new Date().toISOString()

    const bestCoach: Coach | null = findBestCoach(
      { name: lead.name, email: lead.email, available_days: body.available_days, available_time: body.available_time },
      getCoachPool()
    )

    if (bestCoach) {
      try {
        await Promise.all([
          sendWelcomeEmail(lead.email, lead.name),
          sendWelcomeWhatsApp(lead.phone, lead.name),
          sendEmailToCoach(bestCoach, lead),
        ])
      } catch (err) {
        console.error('[LEAD NOTIFICATION ERROR]', err)
      }
      console.log('[COACH ASSIGNED]', { leadId: lead.id, coachId: bestCoach.id, coachName: bestCoach.name })
    } else {
      console.log('[NO COACH AVAILABLE]', { leadId: lead.id, available_days: body.available_days })
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
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
