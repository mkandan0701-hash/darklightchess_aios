'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import Modal from '@/components/Modal'
import type { Student, Column } from '@/lib/types'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'

type FilterStatus = 'all' | 'paid' | 'pending' | 'overdue'

const FILTER_OPTIONS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Overdue', value: 'overdue' },
]

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  classesPerWeek: '3',
  duration: '45 min',
  monthlyFee: '',
  grade: '',
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clickup/students')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Student[] }) => {
        if (d.success) setStudents(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAddStudent = async () => {
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/clickup/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json() as { success: boolean; data?: Student; error?: string }
      if (!result.success || !result.data) {
        setFormError(result.error ?? 'Failed to add student')
        return
      }
      setStudents((prev) => [result.data as Student, ...prev])
      setForm(EMPTY_FORM)
      setShowAddModal(false)
    } catch {
      setFormError('Failed to add student. Please try again.')
    } finally {
      setSubmitting(false)
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
      key: 'paymentStatus',
      label: 'Status',
      render: (v) => (
        <span className={`status-badge ${getStatusColor(String(v))}`}>
          {String(v)}
        </span>
      ),
    },
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
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setForm(EMPTY_FORM)
          setFormError('')
        }}
        title="Add Student"
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Student's full name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="parent@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
              placeholder="+919876543210"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Classes/Week</label>
              <input
                type="number"
                min="1"
                value={form.classesPerWeek}
                onChange={(e) => setForm({ ...form, classesPerWeek: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duration</label>
              <input
                type="text"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="input-field"
                placeholder="45 min"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Fee (₹)</label>
              <input
                type="number"
                min="1"
                value={form.monthlyFee}
                onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
                className="input-field"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Grade</label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="input-field"
                placeholder="U12"
              />
            </div>
          </div>

          <button
            onClick={handleAddStudent}
            disabled={submitting || !form.name || !form.email || !form.phone || !form.monthlyFee}
            className={`btn-primary w-full justify-center ${
              submitting || !form.name || !form.email || !form.phone || !form.monthlyFee
                ? 'opacity-60 cursor-not-allowed'
                : ''
            }`}
          >
            {submitting ? 'Adding...' : 'Add Student'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
