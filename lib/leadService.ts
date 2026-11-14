import type { AirtableClient } from '@/lib/airtableClient'
import type { Lead } from '@/lib/types'
import { normalizePhone, PHONE_ERROR } from '@/lib/phone'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreateLeadResult =
  | { ok: true; lead: Lead }
  | { ok: false; status: number; error: string }

/**
 * @param db a scoped client — from withAuth for a user request, or AirtableClient.system()
 *   for the lead-capture webhook.
 * @param branch resolved by the caller (the signed-in user's scope, or the webhook secret).
 *   Never read from the request body: a caller that can name its own branch isn't scoped.
 * @param opts.requireEmail true for the website form (it always collects one); false for
 *   leads typed in by staff, who usually only have a phone number. An email that *is* given
 *   is still validated.
 */
export async function validateAndCreateLead(
  db: AirtableClient,
  body: Record<string, unknown>,
  branch: string,
  opts: { requireEmail: boolean }
): Promise<CreateLeadResult> {
  const { name, email, phone, source, notes, online } = body

  if (typeof name !== 'string' || name.trim().length < 2) {
    return { ok: false, status: 400, error: 'Name is required (minimum 2 characters)' }
  }

  const emailValue = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (opts.requireEmail && !emailValue) {
    return { ok: false, status: 400, error: 'Email is required' }
  }
  if (emailValue && !EMAIL_REGEX.test(emailValue)) {
    return { ok: false, status: 400, error: 'Invalid email format' }
  }

  const phoneValue = normalizePhone(phone)
  if (!phoneValue) {
    return { ok: false, status: 400, error: PHONE_ERROR }
  }
  if (typeof source !== 'string' || !source.trim()) {
    return { ok: false, status: 400, error: 'Source is required' }
  }

  try {
    const lead = await db.createLead({
      name: name.trim(),
      email: emailValue,
      phone: phoneValue,
      source: source.trim(),
      notes: typeof notes === 'string' ? notes.trim() : undefined,
      online: online === true,
      branch,
    })
    return { ok: true, lead }
  } catch (err) {
    console.error('[CREATE LEAD ERROR]', err)
    return { ok: false, status: 500, error: 'Failed to create lead' }
  }
}
