import { NextRequest, NextResponse } from 'next/server'
import { ClickUpClient } from '@/lib/clickup'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { studentId?: string }
    const { studentId } = body

    if (!studentId) {
      return NextResponse.json({ error: 'Missing required field: studentId' }, { status: 400 })
    }

    await ClickUpClient.markStudentUnpaid(studentId)

    console.log('[MARK UNPAID]', { studentId })

    return NextResponse.json({ success: true, studentId })
  } catch (err) {
    console.error('[MARK UNPAID ERROR]', err)
    return NextResponse.json({ error: 'Failed to mark student as unpaid' }, { status: 500 })
  }
}
