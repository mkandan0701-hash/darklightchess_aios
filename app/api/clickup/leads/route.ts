import { NextResponse } from 'next/server'
import { ClickUpClient } from '@/lib/clickup'

export async function GET() {
  try {
    const leads = await ClickUpClient.getLeads()
    return NextResponse.json({ success: true, data: leads })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
