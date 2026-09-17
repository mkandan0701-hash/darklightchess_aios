'use client'

import type { Attendance, Student } from '@/lib/types'
import { classDatesInMonth, groupDatesByWeek, dayOfWeekFromDateString } from '@/lib/batches'

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AttendanceGridProps {
  /** Weekdays this batch meets on — every student in it shares them, and the same time window. */
  days: number[]
  students: Student[]
  attendance: Attendance[]
  year: number
  month: number
  isSuperAdmin: boolean
  savingCell: string | null
  onMark: (student: Student, date: string, present: boolean) => void
  onUnmark: (record: Attendance) => void
}

/**
 * One student-by-class-day register for everyone whose batch falls on the same days. Columns are
 * generated from those days, so every column is a real class day for every row — a mismatched
 * click is structurally impossible here (unlike the free-date "Mark Attendance" modal).
 *
 * Cell cycle: unmarked -> present -> absent. Clearing a marked cell back to unmarked deletes the
 * Attendance record, which the API restricts to superadmin (see app/api/attendance/delete) — so
 * only a superadmin can complete the cycle back to unmarked; other admins loop between
 * present/absent once a cell has been marked.
 */
export default function AttendanceGrid({
  days,
  students,
  attendance,
  year,
  month,
  isSuperAdmin,
  savingCell,
  onMark,
  onUnmark,
}: AttendanceGridProps) {
  const dates = classDatesInMonth(days, year, month)
  const weeks = groupDatesByWeek(dates)

  if (dates.length === 0 || students.length === 0) return null

  const recordFor = (studentId: string, date: string) =>
    attendance.find((a) => a.studentId === studentId && a.date === date)

  const handleClick = (student: Student, date: string) => {
    const record = recordFor(student.id, date)
    if (!record) {
      onMark(student, date, true)
    } else if (record.present) {
      onMark(student, date, false)
    } else if (isSuperAdmin) {
      onUnmark(record)
    } else {
      onMark(student, date, true)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 sticky left-0 bg-white">Student</th>
            {weeks.map((week) => (
              <th
                key={week.label}
                colSpan={week.dates.length}
                className="text-center py-1 border-b border-gray-200 text-gray-500 font-semibold"
              >
                {week.label}
              </th>
            ))}
          </tr>
          <tr>
            <th className="pb-2 pr-3 sticky left-0 bg-white" />
            {dates.map((date) => (
              <th key={date} className="text-center pb-2 px-1 text-gray-400 font-medium whitespace-nowrap">
                {DOW_SHORT[dayOfWeekFromDateString(date)]}
                <br />
                {Number(date.split('-')[2])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.map((student) => (
            <tr key={student.id}>
              <td className="py-1.5 pr-3 font-medium text-textDark whitespace-nowrap sticky left-0 bg-white">
                {student.name}
              </td>
              {dates.map((date) => {
                const record = recordFor(student.id, date)
                const saving = savingCell === `${student.id}-${date}`
                const state: 'unmarked' | 'present' | 'absent' = !record
                  ? 'unmarked'
                  : record.present
                  ? 'present'
                  : 'absent'
                const stateClass =
                  state === 'present'
                    ? 'bg-green-100 text-success'
                    : state === 'absent'
                    ? 'bg-red-100 text-error'
                    : 'bg-gray-50 text-gray-300 border border-dashed border-gray-300'
                const title =
                  state === 'unmarked'
                    ? 'Unmarked — click to mark present'
                    : state === 'present'
                    ? 'Present — click to mark absent'
                    : isSuperAdmin
                    ? 'Absent — click to clear'
                    : 'Absent — click to mark present'
                return (
                  <td key={date} className="text-center px-1 py-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleClick(student, date)}
                      className={`w-7 h-7 rounded-md text-[11px] font-semibold transition-colors ${stateClass} ${
                        saving ? 'opacity-50' : 'hover:opacity-80'
                      }`}
                      title={title}
                    >
                      {state === 'present' ? 'P' : state === 'absent' ? 'A' : ''}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
