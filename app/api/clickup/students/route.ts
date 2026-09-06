import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { branchForNewRecord } from '@/lib/auth/rbac'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const GET = withAuth(async (_request, { db }) => {
  try {
    const students = await db.getStudents()
    return NextResponse.json({ success: true, data: students })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch students' },
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

  const { name, email, phone, classesPerWeek, duration, monthlyFee, grade, batchTiming } = body as Record<string, unknown>

  if (typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Name is required (minimum 2 characters)' }, { status: 400 })
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
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
    // The branch is never taken from the request body. An admin gets their own branch; a
    // superadmin viewing all branches files it under their home branch.
    const student = await db.createStudent({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      classesPerWeek: Number(classesPerWeek),
      duration: typeof duration === 'string' && duration.trim() ? duration.trim() : '45 min',
      monthlyFee: Number(monthlyFee),
      grade: typeof grade === 'string' ? grade.trim() : undefined,
      batchTiming: typeof batchTiming === 'string' && batchTiming.trim() ? batchTiming.trim() : undefined,
      branch: branchForNewRecord(scope, session),
    })

    return NextResponse.json({ success: true, data: student })
  } catch (err) {
    console.error('[CREATE STUDENT ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to create student' }, { status: 500 })
  }
})
