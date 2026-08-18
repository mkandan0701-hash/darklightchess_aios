import type { NextRequest } from 'next/server'
import type { Scope, Session } from './types'
import { scopeForSession } from './rbac'
import { BRANCH_COOKIE } from './cookies'

/**
 * The only sanctioned way to build a Scope for an incoming request. Reads the dl_branch
 * cookie and hands it to scopeForSession, which re-intersects it with what the session
 * actually allows — the cookie may narrow, never grant.
 */
export function scopeFromRequest(request: NextRequest, session: Session): Scope {
  return scopeForSession(session, request.cookies.get(BRANCH_COOKIE)?.value ?? null)
}
