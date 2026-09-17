// A student's batch is their own set of convenient days plus a time window — not a pick from a
// fixed catalog. The code is stored verbatim in Students.batch_timing (an existing free-text
// Airtable field) as "<days>@<start>-<end>", e.g. "1,4@18:00-19:00" = Mon & Thu, 6–7 PM.
//
// Codes written before custom batches existed (the old 9-entry catalog: "MWF_5_6" … "WEEKEND_7_8")
// still parse, so students created back then keep working and are converted to the new format the
// next time their batch is edited. Nothing writes the legacy format any more.
//
// Zero I/O, zero Node-only APIs — safe to import from client components and server code alike,
// which is why the day-of-week check lives here rather than being duplicated per call site.

export interface BatchSchedule {
  /** Date.getDay() values this batch meets on, sorted ascending: 0=Sun..6=Sat. */
  days: number[]
  /** "HH:MM", 24-hour. */
  startTime: string
  endTime: string
}

export interface WeekGroup {
  label: string
  dates: string[]
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Day toggles for the batch picker, Monday-first — how a timetable is normally read. */
export const DAY_OPTIONS: { value: number; label: string }[] = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
  value: d,
  label: DOW_SHORT[d],
}))

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const CODE_RE = /^([0-6](?:,[0-6])*)@(\d{2}:\d{2})-(\d{2}:\d{2})$/
const LEGACY_CODE_RE = /^(MWF|TTS|WEEKEND)_(5_6|6_7|7_8)$/

const LEGACY_DAYS: Record<string, number[]> = {
  MWF: [1, 3, 5],
  TTS: [2, 4, 6],
  WEEKEND: [0, 6],
}

const LEGACY_TIMES: Record<string, [string, string]> = {
  '5_6': ['17:00', '18:00'],
  '6_7': ['18:00', '19:00'],
  '7_8': ['19:00', '20:00'],
}

function sortedUniqueDays(days: number[]): number[] {
  return [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time)
}

export function encodeBatch(schedule: BatchSchedule): string {
  return `${sortedUniqueDays(schedule.days).join(',')}@${schedule.startTime}-${schedule.endTime}`
}

export function parseBatch(code: string | undefined | null): BatchSchedule | undefined {
  if (!code) return undefined

  const match = CODE_RE.exec(code)
  if (match) {
    const days = sortedUniqueDays(match[1].split(',').map(Number))
    if (days.length === 0 || !isValidTime(match[2]) || !isValidTime(match[3])) return undefined
    return { days, startTime: match[2], endTime: match[3] }
  }

  const legacy = LEGACY_CODE_RE.exec(code)
  if (legacy) {
    const [startTime, endTime] = LEGACY_TIMES[legacy[2]]
    return { days: LEGACY_DAYS[legacy[1]], startTime, endTime }
  }

  return undefined
}

/** Whitelists a batch code server-side the same way isValidBranchId does for branches. */
export function isValidBatchId(code: unknown): code is string {
  return typeof code === 'string' && !!parseBatch(code)
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

/** "Mon/Wed/Fri" from a raw day list — used to head a register group, which has no single code. */
export function daysLabel(days: number[]): string {
  if (days.length === 0) return '—'
  return days.map((d) => DOW_SHORT[d]).join('/')
}

/** "Mon/Wed/Fri" — the days half of a batch, for table columns that split days from time. */
export function dayPatternLabel(code: string | undefined | null): string {
  const batch = parseBatch(code)
  if (!batch) return '—'
  return daysLabel(batch.days)
}

/** "5:00 PM–6:00 PM" — the time half. */
export function timeSlotLabel(code: string | undefined | null): string {
  const batch = parseBatch(code)
  if (!batch) return '—'
  return `${formatTime(batch.startTime)}–${formatTime(batch.endTime)}`
}

export function batchLabel(code: string | undefined | null): string {
  const batch = parseBatch(code)
  if (!batch) return '—'
  return `${dayPatternLabel(code)} · ${timeSlotLabel(code)}`
}

/**
 * Grouping key for the attendance register: students whose batches fall on the same days share
 * one table, since the columns depend only on which weekdays are class days (their time windows
 * can still differ, which is why the register shows each student's own time per row).
 */
export function batchDayKey(code: string | undefined | null): string | undefined {
  const batch = parseBatch(code)
  if (!batch) return undefined
  return batch.days.join(',')
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

export function matchesBatchDay(code: string, dateStr: string): boolean {
  return parseBatch(code)?.days.includes(dayOfWeekFromDateString(dateStr)) ?? false
}

/** Null if the batch is unknown/unset (can't validate) or the date matches the schedule. */
export function batchScheduleMismatchMessage(code: string, dateStr: string): string | null {
  const batch = parseBatch(code)
  if (!batch) return null
  const dow = dayOfWeekFromDateString(dateStr)
  if (batch.days.includes(dow)) return null
  const days = batch.days.map((d) => DOW_NAMES[d]).join(', ')
  return `This student's batch meets ${days} — ${DOW_NAMES[dow]} isn't a scheduled day.`
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Every "YYYY-MM-DD" date in the given 1-indexed month falling on one of these weekdays. */
export function classDatesInMonth(days: number[], year: number, month: number): string[] {
  if (days.length === 0) return []
  const daysInMonth = new Date(year, month, 0).getDate()
  const dates: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    if (days.includes(new Date(year, month - 1, day).getDay())) {
      dates.push(toDateString(year, month, day))
    }
  }
  return dates
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
