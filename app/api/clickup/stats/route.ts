import { NextResponse } from 'next/server'
import { AirtableClient } from '@/lib/airtableClient'

export async function GET() {
  try {
    const stats = await AirtableClient.getStats()
    return NextResponse.json({ success: true, data: stats })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
