import type { AirtableClient } from '@/lib/airtableClient'
import type { Lead } from '@/lib/types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreateLeadResult =
  | { ok: true; lead: Lead }
  | { ok: false; status: number; error: string }

/**
 * @param db a scoped client — from withAuth for a user request, or AirtableClient.system()
 *   for the lead-capture webhook.
 * @param branch resolved by the caller (the signed-in user's scope, or the webhook secret).
 *   Never read from the request body: a caller that can name its own branch isn't scoped.
 */
export async function validateAndCreateLead(
  db: AirtableClient,
  body: Record<string, unknown>,
  branch: string
): Promise<CreateLeadResult> {
  const { name, email, phone, source, notes } = body

  if (typeof name !== 'string' || name.trim().length < 2) {
    return { ok: false, status: 400, error: 'Name is required (minimum 2 characters)' }
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return { ok: false, status: 400, error: 'Invalid email format' }
  }
  if (typeof phone !== 'string' || !phone.startsWith('+')) {
    return { ok: false, status: 400, error: 'Phone must be in international format (e.g. +919876543210)' }
  }
  if (typeof source !== 'string' || !source.trim()) {
    return { ok: false, status: 400, error: 'Source is required' }
  }

  try {
    const lead = await db.createLead({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      source: source.trim(),
      notes: typeof notes === 'string' ? notes.trim() : undefined,
      branch,
    })
    return { ok: true, lead }
  } catch (err) {
    console.error('[CREATE LEAD ERROR]', err)
    return { ok: false, status: 500, error: 'Failed to create lead' }
  }
}
