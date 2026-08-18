// Per-branch lead-capture webhook secrets. The secret IS the branch claim — a `branch` field
// on the inbound payload is never trusted, or any form holding a shared secret could write
// into any branch. See skill.md "Pattern F".

import crypto from 'crypto'
import { defaultBranchId, isValidBranchId } from '../branches'

interface SecretEntry {
  secret: string
  branch: string
}

let cachedMap: SecretEntry[] | null = null
let cachedLegacy: SecretEntry | null | undefined

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function loadMap(): SecretEntry[] {
  if (cachedMap) return cachedMap

  const raw = process.env.LEAD_WEBHOOK_SECRETS
  if (!raw) {
    cachedMap = []
    return cachedMap
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('LEAD_WEBHOOK_SECRETS is not valid JSON. Expected {"secret":"BRANCH_X", …}.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('LEAD_WEBHOOK_SECRETS must be a JSON object of secret → branch id.')
  }

  cachedMap = Object.entries(parsed as Record<string, unknown>).map(([secret, branch]) => {
    if (!secret || typeof branch !== 'string' || !isValidBranchId(branch)) {
      throw new Error(`LEAD_WEBHOOK_SECRETS has an entry with an unknown branch: "${String(branch)}"`)
    }
    return { secret, branch }
  })
  return cachedMap
}

/** Legacy single-secret form, kept working so already-deployed forms don't break. */
function loadLegacy(): SecretEntry | null {
  if (cachedLegacy !== undefined) return cachedLegacy

  const secret = process.env.LEAD_WEBHOOK_SECRET
  if (!secret) {
    cachedLegacy = null
    return cachedLegacy
  }

  cachedLegacy = { secret, branch: defaultBranchId() }
  return cachedLegacy
}

/**
 * Resolves the branch a webhook caller is authorized to write into, or null if the header
 * doesn't match any configured secret. Compares every candidate with timingSafeEqual so
 * response time can't be used to narrow down a valid secret.
 */
export function branchForWebhookSecret(provided: string | null): string | null {
  if (!provided) return null

  let matched: string | null = null
  for (const entry of loadMap()) {
    if (timingSafeStringEqual(provided, entry.secret)) matched = entry.branch
  }

  const legacy = loadLegacy()
  if (legacy && timingSafeStringEqual(provided, legacy.secret)) matched = legacy.branch

  return matched
}
