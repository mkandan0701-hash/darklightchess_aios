import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionEdge } from '@/lib/auth/session-edge'
import { SESSION_COOKIE } from '@/lib/auth/cookies'

// Runs on the Edge runtime — Next 14.2 offers no `runtime = 'nodejs'` opt-out for
// middleware. That is why session verification goes through lib/auth/session-edge.ts
// (Web Crypto) rather than lib/auth/session.ts (node:crypto).

/**
 * The real allow-list. The matcher below is intentionally broad; this array is the readable
 * source of truth for what is reachable without a session.
 *
 * `/api/auth/google` and `/api/auth/google/callback` are deliberately absent — the callback
 * prints a Google refresh token into an HTML page, and both are additionally restricted to
 * superadmin inside their handlers.
 *
 * `/api/webhooks/*` and `/api/cron/*` are open here because they authenticate their own
 * callers (Razorpay HMAC, a per-branch shared secret, `Bearer CRON_SECRET`). Gating them on
 * a session cookie would break Razorpay and Vercel Cron.
 */
const PUBLIC_PREFIXES = ['/login', '/api/auth/login', '/api/webhooks/', '/api/cron/']

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const session = await verifySessionEdge(request.cookies.get(SESSION_COOKIE)?.value)

  // No identity headers are set here, and no handler reads any. Route handlers re-verify the
  // cookie themselves via withAuth, so a gap in the matcher can never become an auth bypass.
  if (session) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)'],
}
