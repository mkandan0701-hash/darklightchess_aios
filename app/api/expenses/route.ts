import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { branchForNewRecord } from '@/lib/auth/rbac'

export const GET = withAuth(async (_request, { db }) => {
  try {
    const expenses = await db.getExpenses()
    return NextResponse.json({ success: true, data: expenses })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, { db, scope, session }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { description, amount, category, date } = body as Record<string, unknown>

  if (typeof description !== 'string' || description.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Description is required (minimum 2 characters)' }, { status: 400 })
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ success: false, error: 'Amount must be a positive number' }, { status: 400 })
  }
  if (typeof category !== 'string' || category.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 })
  }
  if (typeof date !== 'string' || date.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 })
  }

  try {
    // The branch is never taken from the request body. An admin gets their own branch; a
    // superadmin viewing all branches files it under their home branch.
    const expense = await db.createExpense({
      description: description.trim(),
      amount: Number(amount),
      category: category.trim(),
      date: date.trim(),
      branch: branchForNewRecord(scope, session),
    })

    return NextResponse.json({ success: true, data: expense })
  } catch (err) {
    console.error('[CREATE EXPENSE ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to create expense' }, { status: 500 })
  }
})
