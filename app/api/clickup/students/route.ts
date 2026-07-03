import { NextResponse } from 'next/server'
import { ClickUpClient } from '@/lib/clickup'

export async function GET() {
  try {
    const students = await ClickUpClient.getStudents()
    return NextResponse.json({ success: true, data: students })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}
