// Node-runtime session signing and verification.
//
// Token format:  dl1.<base64url(payload JSON)>.<base64url(HMAC-SHA256)>
//
// A JWT in spirit, minus the parts that cause trouble: there is no `alg` header, so there
// is no algorithm-confusion attack and nothing to negotiate. One algorithm, hardcoded.
//
// The Edge half lives in ./session-edge.ts. Do NOT merge them, and do NOT add a
// lib/auth/index.ts barrel — the Edge middleware bundle cannot contain `node:crypto`.

import crypto from 'crypto'
import type { Session } from './types'
import { isLiveSession } from './types'
import { base64UrlToBytes, base64UrlToUtf8, bytesToBase64Url, utf8ToBase64Url } from './base64url'
import { sessionTtlSeconds } from './cookies'

const VERSION = 'dl1'

/**
 * Throws rather than returning a default. "No secret configured" and "auth is off" must
 * never be the same state. Deliberately lazy rather than module-load so `npm run build`
 * still works in an environment without secrets.
 */
function secret(): string {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error(
      'AUTH_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -hex 32'
    )
  }
  return value
}

function sign(body: string): Uint8Array {
  return new Uint8Array(crypto.createHmac('sha256', secret()).update(body).digest())
}

export function signSession(claims: Omit<Session, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000)
  const session: Session = { ...claims, iat: now, exp: now + sessionTtlSeconds() }
  const body = `${VERSION}.${utf8ToBase64Url(JSON.stringify(session))}`
  return `${body}.${bytesToBase64Url(sign(body))}`
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [version, payloadB64, signatureB64] = parts
  if (version !== VERSION) return null

  // Outside the try: a misconfigured AUTH_SECRET must surface as a 500, not as a silent
  // "every session is invalid".
  const expected = Buffer.from(sign(`${version}.${payloadB64}`))

  try {
    const actual = Buffer.from(base64UrlToBytes(signatureB64))
    if (actual.length !== expected.length) return null
    if (!crypto.timingSafeEqual(actual, expected)) return null

    const payload: unknown = JSON.parse(base64UrlToUtf8(payloadB64))
    return isLiveSession(payload) ? payload : null
  } catch {
    return null
  }
}
