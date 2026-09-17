'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import Modal from '@/components/Modal'
import StudentFormModal, { type StudentFormValues } from '@/components/StudentFormModal'
import BatchPicker from '@/components/BatchPicker'
import type { Student, Column } from '@/lib/types'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { useIsAllBranches, useIsSuperAdmin } from '@/components/SessionProvider'
import { branchName } from '@/lib/branches'
import { batchLabel, encodeBatch, parseBatch } from '@/lib/batches'

type FilterStatus = 'all' | 'paid' | 'pending' | 'overdue'

const FILTER_OPTIONS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Overdue', value: 'overdue' },
]

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [editBatch, setEditBatch] = useState({ days: [] as number[], startTime: '17:00', endTime: '18:00' })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const showBranchColumn = useIsAllBranches()
  const isSuperAdmin = useIsSuperAdmin()

  useEffect(() => {
    fetch('/api/clickup/students')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Student[] }) => {
        if (d.success) setStudents(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAddStudent = async (values: StudentFormValues): Promise<boolean> => {
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/clickup/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await res.json() as { success: boolean; data?: Student; error?: string }
      if (!result.success || !result.data) {
        setFormError(result.error ?? 'Failed to add student')
        return false
      }
      setStudents((prev) => [result.data as Student, ...prev])
      return true
    } catch {
      setFormError('Failed to add student. Please try again.')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleOnline = async (student: Student) => {
    setActionLoading(`online-${student.id}`)
    try {
      const res = await fetch('/api/clickup/students/update-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, online: !student.online }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to update online status')
        return
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, online: !s.online } : s))
      )
    } catch {
      alert('Failed to update online status. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendLink = async (student: Student) => {
    setActionLoading(`link-${student.id}`)
    try {
      const res = await fetch('/api/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          parentEmail: student.email,
          parentPhone: student.phone,
          amount: student.monthlyFee,
          coachName: 'Darklight Coach',
        }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to send payment link')
        return
      }
      alert(`Payment link sent to ${student.email}`)
    } catch {
      alert('Failed to send payment link. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkPaid = async (student: Student) => {
    setActionLoading(`paid-${student.id}`)
    try {
      const res = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          parentEmail: student.email,
          parentPhone: student.phone,
          amount: student.monthlyFee,
          coachName: 'Darklight Coach',
        }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to mark as paid')
        return
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, paymentStatus: 'paid' } : s))
      )
      alert(`Marked ${student.name} as paid`)
    } catch {
      alert('Failed to mark as paid. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkUnpaid = async (student: Student) => {
    setActionLoading(`unpaid-${student.id}`)
    try {
      const res = await fetch('/api/mark-unpaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to mark as unpaid')
        return
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, paymentStatus: 'pending' } : s))
      )
      alert(`Marked ${student.name} as unpaid`)
    } catch {
      alert('Failed to mark as unpaid. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenEditBatch = (student: Student) => {
    setEditingStudent(student)
    // A student still on a pre-custom-batch code is pre-filled from its parsed days/times, so
    // saving quietly migrates them to the new format.
    const existing = parseBatch(student.batchId)
    setEditBatch({
      days: existing?.days ?? [],
      startTime: existing?.startTime ?? '17:00',
      endTime: existing?.endTime ?? '18:00',
    })
    setEditError('')
  }

  const handleSaveBatch = async () => {
    if (!editingStudent) return
    setEditError('')
    setEditSubmitting(true)
    try {
      const batchId = editBatch.days.length > 0 ? encodeBatch(editBatch) : ''
      const res = await fetch('/api/clickup/students/update-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: editingStudent.id, batchId }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        setEditError(result.error ?? 'Failed to update batch')
        return
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === editingStudent.id ? { ...s, batchId: batchId || undefined } : s))
      )
      setEditingStudent(null)
    } catch {
      setEditError('Failed to update batch. Please try again.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async (student: Student) => {
    if (!window.confirm(`Delete ${student.name}? This cannot be undone and will also delete their payment records.`)) return
    setActionLoading(`delete-${student.id}`)
    try {
      const res = await fetch('/api/clickup/students/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to delete student')
        return
      }
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
    } catch {
      alert('Failed to delete student. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
      const matchesStatus = filterStatus === 'all' || s.paymentStatus === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [students, search, filterStatus])

  const columns: Column<Student>[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'classesPerWeek',
      label: 'Classes/Week',
      render: (v) => `${v}× / week`,
    },
    {
      key: 'monthlyFee',
      label: 'Monthly Fee',
      render: (v) => formatCurrency(Number(v)),
    },
    {
      key: 'enrolledDate',
      label: 'Enrolled',
      render: (v) => formatDate(String(v)),
    },
    {
      key: 'batchId',
      label: 'Batch',
      render: (v) => batchLabel(v as string | undefined),
    },
    {
      key: 'online',
      label: 'Mode',
      render: (v) => (
        <span className={`status-badge ${v ? 'text-primary bg-blue-100' : 'text-gray-500 bg-gray-100'}`}>
          {v ? 'Online' : 'Offline'}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      label: 'Status',
      render: (v) => (
        <span className={`status-badge ${getStatusColor(String(v))}`}>
          {String(v)}
        </span>
      ),
    },
    // Only shown to a superadmin viewing every branch at once — a branch admin's rows are
    // already all the same branch.
    ...(showBranchColumn
      ? [{ key: 'branch', label: 'Branch', render: (v: unknown) => branchName(v as string) } as Column<Student>]
      : []),
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            className="btn-sm bg-primary text-white hover:opacity-80 disabled:opacity-50"
            disabled={actionLoading === `link-${row.id}`}
            onClick={(e) => {
              e.stopPropagation()
              handleSendLink(row)
            }}
          >
            {actionLoading === `link-${row.id}` ? 'Sending...' : 'Send Link'}
          </button>
          {row.paymentStatus === 'paid' ? (
            <button
              className="btn-sm bg-warning text-white hover:opacity-80 disabled:opacity-50"
              disabled={actionLoading === `unpaid-${row.id}`}
              onClick={(e) => {
                e.stopPropagation()
                handleMarkUnpaid(row)
              }}
            >
              {actionLoading === `unpaid-${row.id}` ? 'Marking...' : 'Mark Unpaid'}
            </button>
          ) : (
            <button
              className="btn-sm bg-success text-white hover:opacity-80 disabled:opacity-50"
              disabled={actionLoading === `paid-${row.id}`}
              onClick={(e) => {
                e.stopPropagation()
                handleMarkPaid(row)
              }}
            >
              {actionLoading === `paid-${row.id}` ? 'Marking...' : 'Mark Paid'}
            </button>
          )}
          {isSuperAdmin && (
            <button
              className="btn-sm bg-white border border-gray-300 text-textDark hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenEditBatch(row)
              }}
            >
              Edit Batch
            </button>
          )}
          {isSuperAdmin && (
            <button
              className="btn-sm bg-white border border-gray-300 text-textDark hover:bg-gray-50 disabled:opacity-50"
              disabled={actionLoading === `online-${row.id}`}
              onClick={(e) => {
                e.stopPropagation()
                handleToggleOnline(row)
              }}
            >
              {actionLoading === `online-${row.id}`
                ? 'Updating...'
                : row.online
                ? 'Mark Offline'
                : 'Mark Online'}
            </button>
          )}
          {isSuperAdmin && (
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
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Students</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Loading...' : `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Student</button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`btn-sm px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterStatus === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No students found. Try adjusting your search or filter."
      />

      {/* Add Student Modal */}
      <StudentFormModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setFormError('')
        }}
        onSubmit={handleAddStudent}
        submitting={submitting}
        error={formError}
        title="Add Student"
        defaultOnline={false}
      />

      {/* Edit Batch Modal — superadmin only; one of the two editable Student fields */}
      <Modal
        isOpen={!!editingStudent}
        onClose={() => {
          setEditingStudent(null)
          setEditError('')
        }}
        title={`Edit Batch — ${editingStudent?.name ?? ''}`}
      >
        <div className="space-y-4">
          {editError && (
            <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>
          )}

          <BatchPicker
            days={editBatch.days}
            startTime={editBatch.startTime}
            endTime={editBatch.endTime}
            onChange={setEditBatch}
          />
          <p className="text-xs text-gray-500">Clear every day to unset this student&apos;s batch.</p>

          <button
            onClick={handleSaveBatch}
            disabled={editSubmitting}
            className={`btn-primary w-full justify-center ${editSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {editSubmitting ? 'Saving...' : 'Save Batch'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
