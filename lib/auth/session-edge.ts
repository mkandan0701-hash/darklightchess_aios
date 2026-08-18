// Edge-runtime session verification, for middleware.ts only.
//
// Next 14.2 runs middleware on the Edge runtime with no opt-out (`runtime = 'nodejs'` for
// middleware is a Next 15.2+ feature), so `node:crypto` is unavailable here and the
// verification has to go through Web Crypto.
//
// This module must only ever import ./base64url and ./types — both are pure. Anything that
// reaches `node:crypto`, even transitively, breaks the Edge build.

import type { Session } from './types'
import { isLiveSession } from './types'
import { base64UrlToBytes, base64UrlToUtf8 } from './base64url'

const VERSION = 'dl1'

let keyPromise: Promise<CryptoKey> | null = null

function importKey(): Promise<CryptoKey> {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    // NOTE: AUTH_SECRET is inlined into this bundle at build time, so rotating it requires
    // a redeploy, not just an env-var update.
    throw new Error(
      'AUTH_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -hex 32'
    )
  }
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(value),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
  }
  return keyPromise
}

export async function verifySessionEdge(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [version, payloadB64, signatureB64] = parts
  if (version !== VERSION) return null

  // Outside the try, for the same reason as the Node verifier: a bad AUTH_SECRET must be
  // loud, not an invisible sitewide logout.
  const key = await importKey()

  try {
    // crypto.subtle.verify does the constant-time comparison for us.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signatureB64),
      new TextEncoder().encode(`${version}.${payloadB64}`)
    )
    if (!valid) return null

    const payload: unknown = JSON.parse(base64UrlToUtf8(payloadB64))
    return isLiveSession(payload) ? payload : null
  } catch {
    return null
  }
}
