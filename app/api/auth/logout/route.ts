import { NextResponse } from 'next/server'
import { BRANCH_COOKIE, SESSION_COOKIE, clearedCookieOptions } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

// POST only. A GET logout is trivially CSRF-able — an <img src="/api/auth/logout"> on any
// page would sign users out.
export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', clearedCookieOptions())
  response.cookies.set(BRANCH_COOKIE, '', clearedCookieOptions())
  return response
}
