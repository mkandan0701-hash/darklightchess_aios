// Cookie names and flags. No `next/*` imports so both the Edge middleware and the Node
// route handlers can share this module.

export const SESSION_COOKIE = 'dl_session'

/**
 * The superadmin's currently-selected branch. This cookie is NOT a privilege — it can only
 * ever *narrow* what a superadmin sees, and scopeForSession ignores it entirely for an
 * admin. See skill.md "Anti-patterns".
 */
export const BRANCH_COOKIE = 'dl_branch'

export const ALL_BRANCHES = 'all'

export function sessionTtlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS)
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 12
  return Math.max(60, Math.round(safe * 3600))
}

export interface CookieOptions {
  httpOnly: boolean
  sameSite: 'lax'
  path: string
  secure: boolean
  maxAge: number
}

/**
 * `sameSite: 'lax'` rather than 'strict' on purpose: under 'strict' the post-login redirect
 * and the return trips from Razorpay / Google Calendar arrive without the cookie, and the
 * user lands logged-out with no explanation.
 */
export function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  }
}

export function clearedCookieOptions(): CookieOptions {
  return cookieOptions(0)
}
