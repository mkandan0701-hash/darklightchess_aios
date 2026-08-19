import { NextRequest, NextResponse } from 'next/server'
import { findBestCoach, Coach } from '@/lib/coachMatcher'
import { getCoachPool } from '@/lib/coaches'
import { sendWelcomeEmail, sendEmailToCoach } from '@/lib/emailSender'
import { sendWelcomeWhatsApp } from '@/lib/whatsappSender'
import { validateAndCreateLead } from '@/lib/leadService'
import { AirtableClient } from '@/lib/airtableClient'
import { branchForWebhookSecret } from '@/lib/auth/webhookSecrets'

interface LeadPayload {
  name: string
  email: string
  phone: string
  source: string
  available_days: string[]
  available_time: string
  notes?: string
}

// The public site posts to this route from the browser, so it needs to answer CORS
// preflights. Origin allow-list (not the auth boundary — the secret is) as defense in depth.
const ALLOWED_ORIGINS = ['https://www.darklightchess.com', 'https://darklightchess.com']

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-lead-webhook-secret',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request)
  try {
    // The secret IS the branch claim. A `branch` field on the payload itself is never
    // trusted — otherwise any caller holding one branch's secret could write into another.
    const branch = branchForWebhookSecret(request.headers.get('x-lead-webhook-secret'))
    if (!branch) {
      console.warn('[LEAD WEBHOOK] rejected — bad or missing secret', {
        origin: request.headers.get('origin'),
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: cors }
      )
    }

    const body = await request.json() as LeadPayload

    if (!body.name || body.name.trim().length < 2) {
      console.warn('[LEAD WEBHOOK] rejected — invalid name', { branch })
      return NextResponse.json(
        { success: false, error: 'Name is required (minimum 2 characters)' },
        { status: 400, headers: cors }
      )
    }

    if (!body.phone || !body.phone.startsWith('+')) {
      console.warn('[LEAD WEBHOOK] rejected — invalid phone', { branch })
      return NextResponse.json(
        { success: false, error: 'Phone must be in international format (e.g. +919876543210)' },
        { status: 400, headers: cors }
      )
    }

    if (!Array.isArray(body.available_days) || body.available_days.length === 0) {
      console.warn('[LEAD WEBHOOK] rejected — missing available_days', { branch })
      return NextResponse.json(
        { success: false, error: 'At least one available day is required' },
        { status: 400, headers: cors }
      )
    }

    if (!body.available_time || !body.available_time.trim()) {
      console.warn('[LEAD WEBHOOK] rejected — missing available_time', { branch })
      return NextResponse.json(
        { success: false, error: 'Available time is required' },
        { status: 400, headers: cors }
      )
    }

    const result = await validateAndCreateLead(
      AirtableClient.system(),
      {
        name: body.name,
        email: body.email,
        phone: body.phone,
        source: body.source,
        notes: body.notes,
      },
      branch
    )

    if (!result.ok) {
      console.warn('[LEAD WEBHOOK] rejected by validateAndCreateLead', { branch, error: result.error })
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status, headers: cors }
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
    }, { headers: cors })
  } catch (error) {
    console.error('[LEAD ERROR]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: cors }
    )
  }
}
