import { NextResponse, type NextRequest } from 'next/server'
import type { Role, Scope, Session } from './types'
import { verifySession } from './session'
import { scopeFromRequest } from './scope'
import { SESSION_COOKIE } from './cookies'
import { AirtableClient, ScopeError } from '../airtableClient'

export interface AuthContext {
  session: Session
  scope: Scope
  /** Already branch-scoped. A handler has no unscoped client to reach for. */
  db: AirtableClient
}

type Handler = (request: NextRequest, ctx: AuthContext) => Promise<Response> | Response

/**
 * Wraps a route handler with authentication, role checks, and a pre-scoped Airtable client.
 *
 * The session is verified here from scratch, independently of middleware.ts. That looks
 * redundant and isn't: it means a gap in the middleware matcher can never become an auth
 * bypass. Middleware sets no identity headers and this reads none.
 */
export function withAuth(handler: Handler, opts: { roles?: Role[] } = {}) {
  return async (request: NextRequest): Promise<Response> => {
    const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (opts.roles && !opts.roles.includes(session.role)) {
      console.warn('[RBAC DENY] role', {
        path: request.nextUrl.pathname,
        email: session.email,
        role: session.role,
        required: opts.roles,
      })
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const scope = scopeFromRequest(request, session)

    try {
      return await handler(request, { session, scope, db: AirtableClient.forScope(scope) })
    } catch (err) {
      // Cross-branch record ids surface as 404 so an admin can't enumerate another branch's
      // ids by probing status codes. The real denial is logged in assertInScope.
      if (err instanceof ScopeError) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      }
      throw err
    }
  }
}
