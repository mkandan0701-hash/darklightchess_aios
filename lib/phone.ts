// Phone numbers are stored in E.164 (`+919876543210`) because WhatsApp (Twilio) and Razorpay
// need it. Staff type a plain 10-digit Indian mobile number in the dashboard; the website form
// can send an international number (foreign students) with its own `+<country>` prefix.

/** Digits only, for the dashboard's 10-digit input. */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10)
}

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/

export const PHONE_ERROR = 'Enter a valid 10-digit mobile number (e.g. 9876543210)'

/**
 * Returns the number in E.164, or null if it isn't a usable number.
 *   9876543210 / 919876543210 / +91 98765 43210 → +919876543210
 *   +447700900123                               → +447700900123 (international, kept as-is)
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')

  if (INDIAN_MOBILE_REGEX.test(digits)) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91') && INDIAN_MOBILE_REGEX.test(digits.slice(2))) {
    return `+${digits}`
  }
  if (trimmed.startsWith('+') && !digits.startsWith('91') && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}
