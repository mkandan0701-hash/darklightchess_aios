import { NextResponse, type NextRequest } from 'next/server'
import { burnPasswordComparison, findUser, verifyPassword } from '@/lib/auth/users'
import { signSession } from '@/lib/auth/session'
import { BRANCH_COOKIE, SESSION_COOKIE, clearedCookieOptions, cookieOptions, sessionTtlSeconds } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

// Best-effort only. This Map lives in one serverless instance, so on Vercel it slows a
// casual attacker down and nothing more. Documented as advisory in claude.md.
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

function clearAttempts(key: string): void {
  attempts.delete(key)
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 })
  }

  const key = `${request.headers.get('x-forwarded-for') ?? 'local'}:${email.toLowerCase()}`
  if (rateLimited(key)) {
    console.warn('[LOGIN RATE LIMIT]', { email })
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429 }
    )
  }

  const user = findUser(email)

  // Burn one scrypt on an unknown address so response time doesn't reveal which accounts
  // exist, and return the same generic message either way.
  if (!user) {
    burnPasswordComparison(password)
    console.warn('[LOGIN FAILED]', { email, reason: 'unknown_user' })
    return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 })
  }

  if (!verifyPassword(user, password)) {
    console.warn('[LOGIN FAILED]', { email: user.email, reason: 'bad_password' })
    return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 })
  }

  clearAttempts(key)

  const token = signSession({
    email: user.email,
    name: user.name,
    role: user.role,
    branch: user.branch,
  })

  console.log('[LOGIN]', { email: user.email, role: user.role, branch: user.branch })

  const response = NextResponse.json({
    success: true,
    data: { name: user.name, role: user.role, branch: user.branch },
  })
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(sessionTtlSeconds()))
  // A fresh session starts in the default view — never inheriting a stale branch selection.
  response.cookies.set(BRANCH_COOKIE, '', clearedCookieOptions())
  return response
}
