'use client'

import { useEffect, useMemo, useState } from 'react'
import Table from '@/components/Table'
import StudentFormModal, { type StudentFormValues } from '@/components/StudentFormModal'
import type { Student, Column } from '@/lib/types'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { useIsAllBranches } from '@/components/SessionProvider'
import { branchName } from '@/lib/branches'
import { batchLabel } from '@/lib/batches'

export default function OnlineClassesPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const showBranchColumn = useIsAllBranches()

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

  const handleSwitchToOffline = async (student: Student) => {
    setActionLoading(`online-${student.id}`)
    try {
      const res = await fetch('/api/clickup/students/update-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, online: false }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to update online status')
        return
      }
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, online: false } : s)))
    } catch {
      alert('Failed to update online status. Please try again.')
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
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, paymentStatus: 'paid' } : s)))
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
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, paymentStatus: 'pending' } : s)))
    } catch {
      alert('Failed to mark as unpaid. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const onlineStudents = useMemo(() => students.filter((s) => s.online), [students])

  const filtered = useMemo(() => {
    return onlineStudents.filter(
      (s) =>
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
    )
  }, [onlineStudents, search])

  const columns: Column<Student>[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'batchId',
      label: 'Batch',
      render: (v) => batchLabel(v as string | undefined),
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
      key: 'paymentStatus',
      label: 'Status',
      render: (v) => <span className={`status-badge ${getStatusColor(String(v))}`}>{String(v)}</span>,
    },
    ...(showBranchColumn
      ? [{ key: 'branch', label: 'Branch', render: (v: unknown) => branchName(v as string) } as Column<Student>]
      : []),
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            className="btn-sm bg-white border border-gray-300 text-textDark hover:bg-gray-50 disabled:opacity-50"
            disabled={actionLoading === `online-${row.id}`}
            onClick={(e) => {
              e.stopPropagation()
              handleSwitchToOffline(row)
            }}
          >
            {actionLoading === `online-${row.id}` ? 'Updating...' : 'Switch to Offline'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Online Classes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Loading...' : `${filtered.length} online student${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Online Student</button>
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
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <Table
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No online students yet. Add one, or switch an existing student to Online from the Students page."
      />

      {/* Add Online Student Modal */}
      <StudentFormModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setFormError('')
        }}
        onSubmit={handleAddStudent}
        submitting={submitting}
        error={formError}
        title="Add Online Student"
        submitLabel="Add Student"
        defaultOnline={true}
      />
    </div>
  )
}
