import { NextResponse } from 'next/server'
import { AirtableClient } from '@/lib/airtableClient'

export async function GET() {
  try {
    const payments = await AirtableClient.getPayments()
    return NextResponse.json({ success: true, data: payments })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
