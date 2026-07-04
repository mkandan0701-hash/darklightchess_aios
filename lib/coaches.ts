import type { Coach } from '@/lib/coachMatcher'

const DEFAULT_COACH: Coach = {
  id: 'C1',
  name: 'Manikandan',
  email: 'manikandan@darklight.com',
  phone: '+919876543210',
  available_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  available_time_slots: ['9 AM - 12 PM', '12 PM - 3 PM', '3 PM - 6 PM', '6 PM - 9 PM'],
  current_students: 5,
  rating: 4.8,
}

export function getCoachPool(): Coach[] {
  const raw = process.env.COACH_POOL
  if (raw) {
    try {
      return JSON.parse(raw) as Coach[]
    } catch {
      console.warn('[COACHES] Invalid COACH_POOL JSON, falling back to default coach')
    }
  }
  return [DEFAULT_COACH]
}
