import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { branchForNewRecord } from '@/lib/auth/rbac'
import { ScopeError } from '@/lib/airtableClient'

export const POST = withAuth(async (request, { db, scope, session }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { leadId, name, email, phone, classesPerWeek, duration, monthlyFee, grade } = body as Record<string, unknown>

  if (typeof leadId !== 'string' || !leadId) {
    return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 })
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Name is required (minimum 2 characters)' }, { status: 400 })
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 })
  }
  if (typeof phone !== 'string' || !phone.startsWith('+')) {
    return NextResponse.json({ success: false, error: 'Phone must be in international format (e.g. +919876543210)' }, { status: 400 })
  }
  if (!Number.isFinite(Number(classesPerWeek)) || Number(classesPerWeek) <= 0) {
    return NextResponse.json({ success: false, error: 'Classes per week must be a positive number' }, { status: 400 })
  }
  if (!Number.isFinite(Number(monthlyFee)) || Number(monthlyFee) <= 0) {
    return NextResponse.json({ success: false, error: 'Monthly fee must be a positive number' }, { status: 400 })
  }

  try {
    // Throws ScopeError → 404 if the lead belongs to another branch. The new student
    // inherits the lead's branch rather than the caller's — a superadmin converting a
    // Sowripalayam lead must not accidentally re-file it under Kuniyamuthur. A lead that was
    // itself Unassigned (reachable by superadmin only) falls back to the caller's default.
    const leadBranch = await db.getRecordBranch('leads', leadId)
    const branch = leadBranch || branchForNewRecord(scope, session)

    const student = await db.createStudent({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      classesPerWeek: Number(classesPerWeek),
      duration: typeof duration === 'string' && duration.trim() ? duration.trim() : '45 min',
      monthlyFee: Number(monthlyFee),
      grade: typeof grade === 'string' ? grade.trim() : undefined,
      branch,
    })

    await db.updateLeadStatus(leadId, 'converted')

    return NextResponse.json({ success: true, data: student })
  } catch (err) {
    if (err instanceof ScopeError) throw err
    console.error('[LEAD CONVERT ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to convert lead' }, { status: 500 })
  }
})
