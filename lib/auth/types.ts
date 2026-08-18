// Auth + RBAC types. Pure TypeScript with no crypto imports, so this module is safe to
// pull into the Edge middleware bundle. See claude.md §2 for why that matters.

export type Role = 'admin' | 'superadmin'

export const ROLES: readonly Role[] = ['admin', 'superadmin']

/** A user as declared in the ACADEMY_USERS env var. */
export interface AcademyUser {
  email: string
  name: string
  role: Role
  /** Home branch id. For a superadmin this is the branch they run directly. */
  branch: string
  /**
   * scrypt.N.r.p.<saltB64>.<hashB64> — '.'-delimited, not the traditional '$'-delimited
   * format, because this string lives in ACADEMY_USERS in .env.local and Next's env loader
   * strips `$word` sequences via dotenv-expand. See lib/auth/users.ts.
   */
  passwordHash: string
}

/** The verified contents of a dl_session cookie. */
export interface Session {
  email: string
  name: string
  role: Role
  branch: string
  iat: number
  exp: number
}

/**
 * The effective read/write reach of a request.
 * `branches: 'all'` means no filter at all — superadmin, or a system caller.
 * Only ever built by scopeForSession(); never constructed from client input directly.
 */
export interface Scope {
  role: Role
  branches: 'all' | string[]
  /** Whether records with an empty branch field are in reach. */
  includeUnassigned: boolean
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Shape + expiry check for a decoded token payload. Shared by the Node and Edge
 * verifiers so the two can't drift on what counts as a valid session.
 */
export function isLiveSession(value: unknown, nowSeconds = Math.floor(Date.now() / 1000)): value is Session {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.email === 'string' &&
    s.email.length > 0 &&
    typeof s.name === 'string' &&
    isRole(s.role) &&
    typeof s.branch === 'string' &&
    typeof s.exp === 'number' &&
    s.exp > nowSeconds
  )
}
