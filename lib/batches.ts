// A student's batch is their own set of convenient days plus a time window — not a pick from a
// fixed catalog. The code is stored verbatim in Students.batch_timing (an existing free-text
// Airtable field) as "<days>@<start>-<end>", e.g. "1,4@18:00-19:00" = Mon & Thu, 6–7 PM.
//
// Codes written before custom batches existed (the old 9-entry catalog: "MWF_5_6" … "WEEKEND_7_8")
// still parse, so students created back then keep working and are converted to the new format the
// next time their batch is edited. Nothing writes the legacy format any more.
//
// Zero I/O, zero Node-only APIs — safe to import from client components and server code alike.

export interface BatchSchedule {
  /** Date.getDay() values this batch meets on, sorted ascending: 0=Sun..6=Sat. */
  days: number[]
  /** "HH:MM", 24-hour. */
  startTime: string
  endTime: string
}

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

/**
 * Why a picker's current state can't be saved, or null if it can. No days picked is valid — it
 * means "no batch". Zero-padded "HH:MM" strings compare correctly as plain strings.
 */
export function batchInputError(schedule: BatchSchedule): string | null {
  if (schedule.days.length === 0) return null
  if (!isValidTime(schedule.startTime) || !isValidTime(schedule.endTime)) {
    return 'Enter both a start and an end time for the batch.'
  }
  if (schedule.endTime <= schedule.startTime) return 'Batch end time must be after the start time.'
  return null
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

function daysLabel(days: number[]): string {
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
