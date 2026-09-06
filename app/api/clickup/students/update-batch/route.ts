import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'
import { isValidBatchId } from '@/lib/batches'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { studentId?: string; batchId?: string }
    const { studentId, batchId } = body

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'Missing required field: studentId' }, { status: 400 })
    }
    if (batchId && !isValidBatchId(batchId)) {
      return NextResponse.json({ success: false, error: 'Invalid batch selected' }, { status: 400 })
    }

    await db.updateStudentBatch(studentId, batchId ?? '')

    console.log('[UPDATE STUDENT BATCH]', { studentId, batchId, by: session.email })

    return NextResponse.json({ success: true, studentId, batchId: batchId || undefined })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[UPDATE STUDENT BATCH ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to update batch' }, { status: 500 })
  }
}, { roles: ['superadmin'] })
