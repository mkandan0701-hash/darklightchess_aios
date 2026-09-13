// Fixed batch catalog: 3 day-patterns × 3 time-slots = 9 batches. Hardcoded rather than
// env-configurable (unlike lib/branches.ts) — a 10th batch is a source edit, not a
// per-deployment config the way branches (real-world locations) are.
//
// Zero I/O, zero Node-only APIs — safe to import from client components and server code alike,
// which is why the day-of-week check lives here rather than being duplicated per call site.

export interface Batch {
  /** Stored verbatim in Students.batch_timing (an existing free-text Airtable field). */
  id: string
  dayPatternLabel: string
  /** Date.getDay() values this batch meets on: 0=Sun..6=Sat. */
  days: number[]
  timeSlotLabel: string
  startTime: string
  endTime: string
  label: string
}

interface DayPattern {
  id: string
  label: string
  days: number[]
}

interface TimeSlot {
  id: string
  label: string
  start: string
  end: string
}

const DAY_PATTERNS: DayPattern[] = [
  { id: 'MWF', label: 'Mon/Wed/Fri', days: [1, 3, 5] },
  { id: 'TTS', label: 'Tue/Thu/Sat', days: [2, 4, 6] },
  { id: 'WEEKEND', label: 'Weekend (Sat & Sun)', days: [0, 6] },
]

const TIME_SLOTS: TimeSlot[] = [
  { id: '5_6', label: '5:00–6:00 PM', start: '17:00', end: '18:00' },
  { id: '6_7', label: '6:00–7:00 PM', start: '18:00', end: '19:00' },
  { id: '7_8', label: '7:00–8:00 PM', start: '19:00', end: '20:00' },
]

export const BATCHES: Batch[] = DAY_PATTERNS.flatMap((dp) =>
  TIME_SLOTS.map((ts) => ({
    id: `${dp.id}_${ts.id}`,
    dayPatternLabel: dp.label,
    days: dp.days,
    timeSlotLabel: ts.label,
    startTime: ts.start,
    endTime: ts.end,
    label: `${dp.label} · ${ts.label}`,
  }))
)

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function isValidBatchId(id: unknown): id is string {
  return typeof id === 'string' && BATCHES.some((b) => b.id === id)
}

export function batchById(id: string | undefined | null): Batch | undefined {
  if (!id) return undefined
  return BATCHES.find((b) => b.id === id)
}

export function batchLabel(id: string | undefined | null): string {
  return batchById(id)?.label ?? '—'
}

export function dayPatternLabel(id: string | undefined | null): string {
  return batchById(id)?.dayPatternLabel ?? '—'
}

export function timeSlotLabel(id: string | undefined | null): string {
  return batchById(id)?.timeSlotLabel ?? '—'
}

/**
 * Parses a "YYYY-MM-DD" string into its weekday without going through UTC. `new
 * Date(dateStr).getDay()` parses a bare date string as UTC midnight, so `.getDay()` reflects the
 * *local* day after UTC→local conversion — which can disagree with the intended calendar date
 * depending on timezone. Building the Date from explicit y/m/d components sidesteps that, so the
 * client (likely IST) and the server (likely UTC) always agree on which weekday a date means.
 */
export function dayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function matchesBatchDay(batchId: string, dateStr: string): boolean {
  return batchById(batchId)?.days.includes(dayOfWeekFromDateString(dateStr)) ?? false
}

/** Null if the batch is unknown/unset (can't validate) or the date matches the schedule. */
export function batchScheduleMismatchMessage(batchId: string, dateStr: string): string | null {
  const batch = batchById(batchId)
  if (!batch) return null
  const dow = dayOfWeekFromDateString(dateStr)
  if (batch.days.includes(dow)) return null
  return `This student's batch meets ${batch.dayPatternLabel} — ${DOW_NAMES[dow]} isn't a scheduled day.`
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Every "YYYY-MM-DD" date in the given 1-indexed month that falls on one of the batch's class days. */
export function classDatesInMonth(batchId: string, year: number, month: number): string[] {
  const batch = batchById(batchId)
  if (!batch) return []
  const daysInMonth = new Date(year, month, 0).getDate()
  const dates: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    if (batch.days.includes(new Date(year, month - 1, day).getDay())) {
      dates.push(toDateString(year, month, day))
    }
  }
  return dates
}

export interface WeekGroup {
  label: string
  dates: string[]
}

/**
 * Buckets a sorted list of "YYYY-MM-DD" dates (as produced by `classDatesInMonth`, always within a
 * single calendar month) into Sunday-start weeks. A week's day-of-month-minus-weekday is constant
 * across all dates that fall in it, so it doubles as a cheap grouping key without needing a second
 * Date object per date.
 */
export function groupDatesByWeek(dates: string[]): WeekGroup[] {
  const groups: WeekGroup[] = []
  let currentWeekKey: number | null = null
  for (const dateStr of dates) {
    const day = Number(dateStr.split('-')[2])
    const weekKey = day - dayOfWeekFromDateString(dateStr)
    if (currentWeekKey === null || weekKey !== currentWeekKey) {
      currentWeekKey = weekKey
      groups.push({ label: `Week ${groups.length + 1}`, dates: [] })
    }
    groups[groups.length - 1].dates.push(dateStr)
  }
  return groups
}
