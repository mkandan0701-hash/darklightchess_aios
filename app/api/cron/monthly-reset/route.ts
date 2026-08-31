import { NextRequest, NextResponse } from 'next/server'
import { AirtableClient } from '@/lib/airtableClient'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const timestamp = new Date().toISOString()
  console.log(`[MONTHLY RESET START] Running at ${timestamp}`)

  // No user session — a cron trigger authenticates via CRON_SECRET above, not a branch scope.
  const db = AirtableClient.system()

  try {
    const { created, skipped } = await db.runMonthlyReset()

    console.log(`[MONTHLY RESET COMPLETED] { created: ${created}, skipped: ${skipped} }`)

    return NextResponse.json({ success: true, created, skipped, timestamp })
  } catch (err) {
    console.error('[MONTHLY RESET ERROR]', err)
    return NextResponse.json(
      { success: false, error: 'Failed to run monthly reset' },
      { status: 500 }
    )
  }
}
