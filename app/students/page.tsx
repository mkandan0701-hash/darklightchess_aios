'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import type { Student, Column } from '@/lib/types'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'

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

  useEffect(() => {
    fetch('/api/clickup/students')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Student[] }) => {
        if (d.success) setStudents(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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
            className="btn-sm bg-primary text-white hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation()
              alert(`Payment link sent to ${row.name}`)
            }}
          >
            Send Link
          </button>
          <button
            className="btn-sm bg-success text-white hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation()
              alert(`Marked ${row.name} as paid`)
            }}
          >
            Mark Paid
          </button>
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
        <button className="btn-primary">+ Add Student</button>
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
    </div>
  )
}
