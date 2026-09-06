import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { branchForNewRecord } from '@/lib/auth/rbac'
import { ScopeError } from '@/lib/airtableClient'

export const GET = withAuth(async (_request, { db }) => {
  try {
    const attendance = await db.getAttendance()
    return NextResponse.json({ success: true, data: attendance })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attendance' },
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

  const { studentId, studentName, date, present, homeworkDone } = body as Record<string, unknown>

  if (typeof studentId !== 'string' || studentId.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Student is required' }, { status: 400 })
  }
  if (typeof studentName !== 'string' || studentName.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Student name is required' }, { status: 400 })
  }
  if (typeof date !== 'string' || isNaN(Date.parse(date))) {
    return NextResponse.json({ success: false, error: 'A valid date is required' }, { status: 400 })
  }
  if (typeof present !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Present must be true or false' }, { status: 400 })
  }
  if (typeof homeworkDone !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Homework done must be true or false' }, { status: 400 })
  }

  try {
    // The branch is never taken from the request body. An admin gets their own branch; a
    // superadmin viewing all branches files it under their home branch.
    const attendance = await db.createAttendance({
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      date: date.trim(),
      present,
      homeworkDone,
      branch: branchForNewRecord(scope, session),
    })

    return NextResponse.json({ success: true, data: attendance })
  } catch (err) {
    // A foreign-branch studentId surfaces as 404 via withAuth's ScopeError handling, not a 500.
    if (err instanceof ScopeError) throw err
    console.error('[CREATE ATTENDANCE ERROR]', err)
    return NextResponse.json({ success: false, error: 'Failed to create attendance record' }, { status: 500 })
  }
})
