import { NextResponse, type NextRequest } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import {
  ALL_BRANCHES,
  BRANCH_COOKIE,
  SESSION_COOKIE,
  clearedCookieOptions,
  cookieOptions,
  sessionTtlSeconds,
} from '@/lib/auth/cookies'
import { isValidBranchId } from '@/lib/branches'

export const dynamic = 'force-dynamic'

/**
 * Sets the superadmin's active branch. Admins get a 403 — for them the branch cookie is
 * ignored by scopeForSession anyway, but refusing outright keeps the rule visible.
 */
export async function POST(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'superadmin') {
    console.warn('[RBAC DENY] branch switch', { email: session.email, role: session.role })
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: { branch?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const branch = typeof body.branch === 'string' ? body.branch : ''
  if (branch !== ALL_BRANCHES && !isValidBranchId(branch)) {
    return NextResponse.json({ success: false, error: 'Unknown branch' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true, data: { branch } })
  if (branch === ALL_BRANCHES) {
    response.cookies.set(BRANCH_COOKIE, '', clearedCookieOptions())
  } else {
    response.cookies.set(BRANCH_COOKIE, branch, cookieOptions(sessionTtlSeconds()))
  }
  return response
}
