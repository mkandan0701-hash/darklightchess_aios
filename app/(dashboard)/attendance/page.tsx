'use client'

import { useEffect, useMemo, useState } from 'react'
import Table from '@/components/Table'
import Modal from '@/components/Modal'
import AttendanceGrid from '@/components/AttendanceGrid'
import type { Attendance, Student, Column } from '@/lib/types'
import { formatDate, getStatusColor } from '@/lib/utils'
import { useIsAllBranches, useIsSuperAdmin } from '@/components/SessionProvider'
import { branchName } from '@/lib/branches'
import { batchLabel, batchScheduleMismatchMessage, dayPatternLabel, encodeBatch, parseBatch, timeSlotLabel } from '@/lib/batches'

const EMPTY_FORM = {
  studentId: '',
  date: new Date().toISOString().split('T')[0],
  present: true,
  homeworkDone: false,
}

interface ReportRow {
  studentId: string
  studentName: string
  branch?: string
  totalMarked: number
  presentCount: number
  attendancePct: number
  homeworkDoneCount: number
  paymentStatus: Student['paymentStatus']
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [gridDate, setGridDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const showBranchColumn = useIsAllBranches()
  const isSuperAdmin = useIsSuperAdmin()

  const shiftGridMonth = (delta: number) => {
    setGridDate(({ year, month }) => {
      const total = year * 12 + (month - 1) + delta
      return { year: Math.floor(total / 12), month: (total % 12) + 1 }
    })
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/attendance').then((r) => r.json()),
      fetch('/api/clickup/students').then((r) => r.json()),
    ])
      .then(([attendanceData, studentsData]: [
        { success: boolean; data: Attendance[] },
        { success: boolean; data: Student[] }
      ]) => {
        if (attendanceData.success) setAttendance(attendanceData.data)
        if (studentsData.success) setStudents(studentsData.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>()
    for (const s of students) map.set(s.id, s)
    return map
  }, [students])

  const selectedStudent = form.studentId ? studentsById.get(form.studentId) : undefined

  const batchMismatch = useMemo(() => {
    if (!selectedStudent?.batchId || !form.date) return null
    return batchScheduleMismatchMessage(selectedStudent.batchId, form.date)
  }, [selectedStudent, form.date])

  const handleAddAttendance = async () => {
    setFormError('')
    setSubmitting(true)
    try {
      const student = studentsById.get(form.studentId)
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          studentName: student?.name ?? '',
          date: form.date,
          present: form.present,
          homeworkDone: form.homeworkDone,
        }),
      })
      const result = await res.json() as { success: boolean; data?: Attendance; error?: string }
      if (!result.success || !result.data) {
        setFormError(result.error ?? 'Failed to save attendance')
        return
      }
      const saved = result.data
      setAttendance((prev) => {
        const idx = prev.findIndex((a) => a.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [saved, ...prev]
      })
      setForm({ ...EMPTY_FORM, date: form.date })
      setShowAddModal(false)
    } catch {
      setFormError('Failed to save attendance. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: Attendance) => {
    if (!window.confirm(`Delete this attendance record for ${record.studentName} on ${formatDate(record.date)}? This cannot be undone.`)) return
    setActionLoading(`delete-${record.id}`)
    try {
      const res = await fetch('/api/attendance/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: record.id }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to delete attendance record')
        return
      }
      setAttendance((prev) => prev.filter((a) => a.id !== record.id))
    } catch {
      alert('Failed to delete attendance record. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGridMark = async (student: Student, date: string, present: boolean) => {
    const key = `${student.id}-${date}`
    setSavingCell(key)
    try {
      const existing = attendance.find((a) => a.studentId === student.id && a.date === date)
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          date,
          present,
          homeworkDone: existing?.homeworkDone ?? false,
        }),
      })
      const result = await res.json() as { success: boolean; data?: Attendance; error?: string }
      if (!result.success || !result.data) {
        alert(result.error ?? 'Failed to save attendance')
        return
      }
      const saved = result.data
      setAttendance((prev) => {
        const idx = prev.findIndex((a) => a.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [saved, ...prev]
      })
    } catch {
      alert('Failed to save attendance. Please try again.')
    } finally {
      setSavingCell(null)
    }
  }

  const handleGridUnmark = async (record: Attendance) => {
    setSavingCell(`${record.studentId}-${record.date}`)
    try {
      const res = await fetch('/api/attendance/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: record.id }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to clear attendance')
        return
      }
      setAttendance((prev) => prev.filter((a) => a.id !== record.id))
    } catch {
      alert('Failed to clear attendance. Please try again.')
    } finally {
      setSavingCell(null)
    }
  }

  const sorted = useMemo(
    () => [...attendance].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [attendance]
  )

  const filteredSorted = useMemo(
    () => sorted.filter((a) => !search || a.studentName.toLowerCase().includes(search.toLowerCase())),
    [sorted, search]
  )

  const searchedStudents = useMemo(
    () => students.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  )

  // Batches are per-student now, so the register rebuilds them: students sharing both the same
  // days and the same time window are one batch (5–6 PM and 6–7 PM on the same days are separate
  // tables). Keying on the re-encoded code rather than the stored string normalizes legacy codes,
  // so a student still on `MWF_5_6` groups with an identical custom one.
  const studentsByBatchKey = useMemo(() => {
    const map = new Map<string, { days: number[]; students: Student[] }>()
    for (const s of searchedStudents) {
      const batch = parseBatch(s.batchId)
      if (!batch) continue
      const key = encodeBatch(batch)
      if (!map.has(key)) map.set(key, { days: batch.days, students: [] })
      map.get(key)!.students.push(s)
    }
    return map
  }, [searchedStudents])

  const noBatchCount = useMemo(
    () => searchedStudents.filter((s) => !parseBatch(s.batchId)).length,
    [searchedStudents]
  )

  const registerGroups = useMemo(() => {
    // Codes are "<days>@<start>-<end>" with zero-padded 24h times, so a plain sort puts each
    // day-set together and orders its time slots earliest-first.
    const keys = [...studentsByBatchKey.keys()].sort()
    const groupsFor = (branch?: string) =>
      keys
        .map((key) => {
          const { days, students: members } = studentsByBatchKey.get(key)!
          return {
            key,
            days,
            students: branch === undefined ? members : members.filter((s) => (s.branch ?? '') === branch),
          }
        })
        .filter((g) => g.students.length > 0)

    if (!showBranchColumn) {
      return [{ branch: undefined as string | undefined, batches: groupsFor(undefined) }]
    }

    const branchKeys = new Set<string>()
    for (const group of studentsByBatchKey.values()) {
      for (const s of group.students) branchKeys.add(s.branch ?? '')
    }
    return [...branchKeys]
      .sort((a, b) => a.localeCompare(b))
      .map((branch) => ({ branch, batches: groupsFor(branch) }))
  }, [studentsByBatchKey, showBranchColumn])

  const reportRows = useMemo<ReportRow[]>(() => {
    return searchedStudents.map((s) => {
      const rows = attendance.filter((a) => a.studentId === s.id)
      const presentCount = rows.filter((a) => a.present).length
      return {
        studentId: s.id,
        studentName: s.name,
        branch: s.branch,
        totalMarked: rows.length,
        presentCount,
        attendancePct: rows.length ? Math.round((presentCount / rows.length) * 100) : 0,
        homeworkDoneCount: rows.filter((a) => a.homeworkDone).length,
        paymentStatus: s.paymentStatus,
      }
    })
  }, [searchedStudents, attendance])

  const reportByBranch = useMemo(() => {
    if (!showBranchColumn) return null
    const groups = new Map<string, ReportRow[]>()
    for (const row of reportRows) {
      const key = row.branch ?? ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [reportRows, showBranchColumn])

  const columns: Column<Attendance>[] = [
    { key: 'date', label: 'Date', render: (v) => formatDate(String(v)) },
    { key: 'studentName', label: 'Student' },
    {
      key: 'batchDay',
      label: 'Batch',
      render: (_, row) => dayPatternLabel(studentsById.get(row.studentId)?.batchId),
    },
    {
      key: 'batchTime',
      label: 'Timing',
      render: (_, row) => timeSlotLabel(studentsById.get(row.studentId)?.batchId),
    },
    {
      key: 'present',
      label: 'Attendance',
      render: (v) => (
        <span className={`status-badge ${v ? 'text-success bg-green-100' : 'text-error bg-red-100'}`}>
          {v ? 'Present' : 'Absent'}
        </span>
      ),
    },
    {
      key: 'homeworkDone',
      label: 'Homework',
      render: (v) => (
        <span className={`status-badge ${v ? 'text-success bg-green-100' : 'text-warning bg-yellow-100'}`}>
          {v ? 'Done' : 'Not done'}
        </span>
      ),
    },
    ...(showBranchColumn
      ? [{ key: 'branch', label: 'Branch', render: (v: unknown) => branchName(v as string) } as Column<Attendance>]
      : []),
    ...(isSuperAdmin
      ? [{
          key: 'id',
          label: 'Actions',
          render: (_: unknown, row: Attendance) => (
            <button
              className="btn-sm bg-error text-white hover:opacity-80 disabled:opacity-50"
              disabled={actionLoading === `delete-${row.id}`}
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(row)
              }}
            >
              {actionLoading === `delete-${row.id}` ? 'Deleting...' : 'Delete'}
            </button>
          ),
        } as Column<Attendance>]
      : []),
  ]

  const renderReportTable = (rows: ReportRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 pr-3">Student</th>
            <th className="py-1 pr-3">Attendance</th>
            <th className="py-1 pr-3">Homework Done</th>
            <th className="py-1 pr-3">Fee Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td className="py-1.5 pr-3 font-medium text-textDark">{row.studentName}</td>
              <td className="py-1.5 pr-3">
                {row.totalMarked > 0 ? `${row.attendancePct}% (${row.presentCount}/${row.totalMarked})` : '—'}
              </td>
              <td className="py-1.5 pr-3">{row.homeworkDoneCount}/{row.totalMarked || 0}</td>
              <td className="py-1.5 pr-3">
                <span className={`status-badge ${getStatusColor(row.paymentStatus)}`}>{row.paymentStatus}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Attendance</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Loading...' : `${filteredSorted.length} record${filteredSorted.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Mark Attendance</button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by student name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* Monthly Attendance Register */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3>Monthly Attendance Register</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-sm bg-white border border-gray-300 hover:bg-gray-50"
              onClick={() => shiftGridMonth(-1)}
            >
              ‹
            </button>
            <span className="text-sm font-medium text-textDark w-36 text-center">
              {new Date(gridDate.year, gridDate.month - 1, 1).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              className="btn-sm bg-white border border-gray-300 hover:bg-gray-50"
              onClick={() => shiftGridMonth(1)}
            >
              ›
            </button>
          </div>
        </div>

        {noBatchCount > 0 && (
          <p className="text-xs text-warning bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
            {noBatchCount} student{noBatchCount !== 1 ? 's' : ''} {noBatchCount !== 1 ? 'have' : 'has'} no batch
            assigned and {noBatchCount !== 1 ? "aren't" : "isn't"} shown here — set a batch on the Students page,
            or use &ldquo;+ Mark Attendance&rdquo; above.
          </p>
        )}

        {registerGroups.every((g) => g.batches.length === 0) ? (
          <p className="text-sm text-gray-500">
            No students with a batch assigned{search ? ' match your search' : ''}.
          </p>
        ) : (
          <div className="space-y-6">
            {registerGroups.map((group) => (
              <div key={group.branch ?? 'all'}>
                {showBranchColumn && (
                  <p className="text-sm font-semibold text-primary mb-2">{branchName(group.branch)}</p>
                )}
                <div className="space-y-5">
                  {group.batches.map((batch) => (
                    <div key={batch.key}>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{batchLabel(batch.key)}</p>
                      <AttendanceGrid
                        days={batch.days}
                        students={batch.students}
                        attendance={attendance}
                        year={gridDate.year}
                        month={gridDate.month}
                        isSuperAdmin={isSuperAdmin}
                        savingCell={savingCell}
                        onMark={handleGridMark}
                        onUnmark={handleGridUnmark}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report — attendance & homework alongside fee status */}
      <div className="card">
        <h3 className="mb-4">Attendance & Fee Report</h3>
        {reportByBranch ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reportByBranch.map(([branch, rows]) => (
              <div key={branch || '(unassigned)'} className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-primary mb-2">{branchName(branch)}</p>
                {renderReportTable(rows)}
              </div>
            ))}
          </div>
        ) : (
          renderReportTable(reportRows)
        )}
      </div>

      {/* Table */}
      <Table
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filteredSorted as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No attendance records yet."
      />

      {/* Mark Attendance Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setForm(EMPTY_FORM)
          setFormError('')
        }}
        title="Mark Attendance"
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Student</label>
            <select
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              className="input-field"
            >
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Batch: {batchLabel(selectedStudent?.batchId)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-field"
            />
            {batchMismatch && (
              <p className="text-xs text-error mt-1">{batchMismatch}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Attendance</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, present: true })}
                className={`btn-sm px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  form.present ? 'bg-success text-white' : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
                }`}
              >
                Present
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, present: false })}
                className={`btn-sm px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  !form.present ? 'bg-error text-white' : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
                }`}
              >
                Absent
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Homework</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, homeworkDone: true })}
                className={`btn-sm px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  form.homeworkDone ? 'bg-success text-white' : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
                }`}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, homeworkDone: false })}
                className={`btn-sm px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  !form.homeworkDone ? 'bg-warning text-white' : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
                }`}
              >
                Not done
              </button>
            </div>
          </div>

          <button
            onClick={handleAddAttendance}
            disabled={submitting || !form.studentId || !form.date || !!batchMismatch}
            className={`btn-primary w-full justify-center ${
              submitting || !form.studentId || !form.date || !!batchMismatch ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
