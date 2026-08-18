// base64url helpers built on btoa/atob and TextEncoder/TextDecoder — all four exist in
// both the Node and Edge runtimes. Deliberately free of `Buffer` so lib/auth/session-edge.ts
// can share these with lib/auth/session.ts and the two encodings can never drift.

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = b64.length % 4
  return remainder === 0 ? b64 : b64 + '='.repeat(4 - remainder)
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return toBase64Url(btoa(binary))
}

// Return type is inferred rather than annotated `Uint8Array` on purpose: recent TS lib
// definitions make Uint8Array generic over its buffer, and the bare alias widens to
// ArrayBufferLike, which crypto.subtle.verify won't accept as a BufferSource.
/** Throws on malformed input — callers verifying untrusted tokens must catch. */
export function base64UrlToBytes(value: string) {
  const binary = atob(fromBase64Url(value))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function utf8ToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

/** Throws on malformed input — callers verifying untrusted tokens must catch. */
export function base64UrlToUtf8(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value))
}
