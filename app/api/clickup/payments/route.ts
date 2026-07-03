import { NextResponse } from 'next/server'
import { ClickUpClient } from '@/lib/clickup'

export async function GET() {
  try {
    const payments = await ClickUpClient.getPayments()
    return NextResponse.json({ success: true, data: payments })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
