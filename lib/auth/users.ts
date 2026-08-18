// The user directory: a JSON array in ACADEMY_USERS. Three internal users don't justify a
// database, a signup flow, or an auth library. Node runtime only — never import from
// middleware.

import crypto from 'crypto'
import type { AcademyUser } from './types'
import { isRole } from './types'
import { isValidBranchId } from '../branches'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const SALT_BYTES = 16

/**
 * Encodes the cost parameters into the hash string so they can be raised later without
 * invalidating hashes that already exist.
 *
 * Delimited with `.`, not the traditional `$` (as in `scrypt$N$r$p$salt$hash`), because this
 * string is stored in ACADEMY_USERS inside .env.local — and Next's env loader runs
 * dotenv-expand over every value, which treats `$word` as a variable reference and silently
 * strips it. `.` has no special meaning there. Never reintroduce `$` here.
 */
export function hashPassword(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_BYTES)
  const derived = crypto.scryptSync(plaintext, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('.')
}

function verifyAgainstHash(plaintext: string, stored: string): boolean {
  const parts = stored.split('.')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  try {
    const salt = Buffer.from(parts[4], 'base64')
    const expected = Buffer.from(parts[5], 'base64')
    if (salt.length === 0 || expected.length === 0) return false

    const derived = crypto.scryptSync(plaintext, salt, expected.length, { N, r, p })
    return crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

let dummyHash: string | null = null

/**
 * Burn one scrypt on an unknown email so the response time doesn't reveal which addresses
 * are real. Callers pair this with a single generic error message.
 */
export function burnPasswordComparison(plaintext: string): void {
  if (!dummyHash) dummyHash = hashPassword('darklight-timing-equalizer')
  verifyAgainstHash(plaintext, dummyHash)
}

export function verifyPassword(user: AcademyUser, plaintext: string): boolean {
  return verifyAgainstHash(plaintext, user.passwordHash)
}

let cached: AcademyUser[] | null = null

function parseUsers(raw: string): AcademyUser[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('ACADEMY_USERS is not valid JSON. It must be a single-line JSON array.')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('ACADEMY_USERS must be a non-empty JSON array.')
  }

  return parsed.map((entry, i) => {
    const u = entry as Record<string, unknown>
    const at = `ACADEMY_USERS[${i}]`

    if (typeof u?.email !== 'string' || !u.email.includes('@')) {
      throw new Error(`${at} is missing a valid "email".`)
    }
    if (!isRole(u.role)) {
      throw new Error(`${at} has role "${String(u.role)}"; expected "admin" or "superadmin".`)
    }
    if (!isValidBranchId(u.branch)) {
      throw new Error(`${at} has branch "${String(u.branch)}", which is not in ACADEMY_BRANCHES.`)
    }
    if (typeof u.passwordHash !== 'string' || !u.passwordHash.startsWith('scrypt.')) {
      throw new Error(`${at} has no scrypt passwordHash. Generate one: node scripts/hash-password.js 'pw'`)
    }

    return {
      email: u.email.trim().toLowerCase(),
      name: typeof u.name === 'string' && u.name.trim() ? u.name.trim() : u.email.trim(),
      role: u.role,
      branch: u.branch,
      passwordHash: u.passwordHash,
    }
  })
}

/**
 * Throws on anything malformed and never falls back to an empty list or a default account:
 * "no users configured" and "authentication is disabled" must not be the same state.
 */
export function getUsers(): AcademyUser[] {
  if (cached) return cached

  const raw =
    process.env.ACADEMY_USERS ??
    (process.env.ACADEMY_USERS_B64
      ? Buffer.from(process.env.ACADEMY_USERS_B64, 'base64').toString('utf8')
      : undefined)

  if (!raw) {
    throw new Error(
      'ACADEMY_USERS is not set. Define the admin/superadmin accounts before the app can serve any request. See .env.example.'
    )
  }

  cached = parseUsers(raw)
  return cached
}

export function findUser(email: string): AcademyUser | null {
  const needle = email.trim().toLowerCase()
  return getUsers().find((u) => u.email === needle) ?? null
}
