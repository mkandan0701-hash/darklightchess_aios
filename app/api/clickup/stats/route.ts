import { NextResponse } from 'next/server'
import { ClickUpClient } from '@/lib/clickup'

export async function GET() {
  try {
    const stats = await ClickUpClient.getStats()
    return NextResponse.json({ success: true, data: stats })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
