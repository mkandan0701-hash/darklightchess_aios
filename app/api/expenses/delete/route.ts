import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (req, { db, session }) => {
  try {
    const body = await req.json() as { expenseId?: string }
    const { expenseId } = body

    if (!expenseId) {
      return NextResponse.json({ success: false, error: 'Missing required field: expenseId' }, { status: 400 })
    }

    await db.deleteExpense(expenseId)

    console.log('[DELETE EXPENSE]', { expenseId, by: session.email })

    return NextResponse.json({ success: true, expenseId })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[DELETE EXPENSE ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete expense' }, { status: 500 })
  }
}, { roles: ['superadmin'] })
