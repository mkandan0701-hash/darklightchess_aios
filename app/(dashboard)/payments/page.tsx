'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import type { Payment, Student, Column } from '@/lib/types'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { useIsAllBranches, useIsSuperAdmin } from '@/components/SessionProvider'
import { branchName } from '@/lib/branches'

// Payments history starts here; earlier months were cleared and the page doesn't page back past it.
const FIRST_MONTH = '2026-11'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [modeFilter, setModeFilter] = useState<'all' | 'offline' | 'online'>('all')
  const showBranchColumn = useIsAllBranches()
  const isSuperAdmin = useIsSuperAdmin()

  const shiftMonth = (delta: number) => {
    setMonthDate(({ year, month }) => {
      const total = year * 12 + (month - 1) + delta
      return { year: Math.floor(total / 12), month: (total % 12) + 1 }
    })
  }

  useEffect(() => {
    fetch('/api/clickup/payments')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Payment[] }) => {
        if (d.success) setPayments(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/clickup/students')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Student[] }) => {
        if (d.success) setStudents(d.data)
      })
      .catch(() => {})
  }, [])

  const handleMarkPaid = async (payment: Payment) => {
    setActionLoading(payment.id)
    try {
      const student = students.find((s) => s.id === payment.studentId)
      const res = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          studentId: payment.studentId,
          studentName: payment.studentName,
          parentEmail: student?.email,
          parentPhone: student?.phone,
          amount: payment.amountDue || student?.monthlyFee,
          coachName: 'Darklight Coach',
        }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to mark as paid')
        return
      }
      // Local update, not a re-fetch: another serverless instance may still hold a cached list.
      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? { ...p, status: 'paid', amountPaid: p.amountDue, paidDate: new Date().toISOString().split('T')[0] }
            : p
        )
      )
      alert(`${payment.studentName} marked as paid`)
    } catch {
      alert('Failed to mark as paid. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendReminder = async (payment: Payment) => {
    setActionLoading(payment.id)
    try {
      const student = students.find((s) => s.id === payment.studentId)
      const res = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          studentName: payment.studentName,
          parentEmail: student?.email,
          parentPhone: student?.phone,
          amountDue: payment.amountDue,
          dueDate: payment.dueDate,
        }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to send reminder')
        return
      }
      alert(`Reminder sent to ${payment.studentName}`)
    } catch {
      alert('Failed to send reminder. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkUnpaid = async (payment: Payment) => {
    setActionLoading(payment.id)
    try {
      const res = await fetch('/api/mark-unpaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, studentId: payment.studentId }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to mark as unpaid')
        return
      }
      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id ? { ...p, status: 'pending', amountPaid: 0, paidDate: undefined } : p
        )
      )
      alert(`${payment.studentName} marked as unpaid`)
    } catch {
      alert('Failed to mark as unpaid. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const monthKey = `${monthDate.year}-${String(monthDate.month).padStart(2, '0')}`

  const monthPayments = useMemo(
    () => payments.filter((p) => (p.dueDate ?? '').startsWith(monthKey)),
    [payments, monthKey]
  )

  // A payment's class mode is its student's. A payment whose student can't be resolved (legacy
  // hand-entered rows with a bad student_id) counts as Offline — the default mode.
  const onlineById = useMemo(() => new Map(students.map((s) => [s.id, s.online])), [students])
  const isOnline = (p: Payment) => onlineById.get(p.studentId) === true

  const visiblePayments = useMemo(
    () =>
      isSuperAdmin && modeFilter !== 'all'
        ? monthPayments.filter((p) => (modeFilter === 'online') === (onlineById.get(p.studentId) === true))
        : monthPayments,
    [monthPayments, modeFilter, isSuperAdmin, onlineById]
  )

  const summary = useMemo(() => {
    const totalDue = monthPayments.reduce((s, p) => s + p.amountDue, 0)
    const totalCollected = monthPayments.reduce((s, p) => s + p.amountPaid, 0)
    const overdue = monthPayments.filter((p) => p.status === 'overdue').length
    const rate = totalDue ? Math.round((totalCollected / totalDue) * 100) : 0

    const byMode = (online: boolean) => {
      const list = monthPayments.filter((p) => (onlineById.get(p.studentId) === true) === online)
      return {
        due: list.reduce((s, p) => s + p.amountDue, 0),
        collected: list.reduce((s, p) => s + p.amountPaid, 0),
      }
    }

    return { totalDue, totalCollected, overdue, rate, online: byMode(true), offline: byMode(false) }
  }, [monthPayments, onlineById])

  const columns: Column<Payment>[] = [
    { key: 'studentName', label: 'Student' },
    {
      key: 'amountDue',
      label: 'Amount Due',
      render: (v) => formatCurrency(Number(v)),
    },
    {
      key: 'amountPaid',
      label: 'Amount Paid',
      render: (v) => formatCurrency(Number(v)),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (v) => formatDate(String(v)),
    },
    {
      key: 'paidDate',
      label: 'Paid Date',
      render: (v) => (v ? formatDate(String(v)) : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`status-badge ${getStatusColor(String(v))}`}>
          {String(v)}
        </span>
      ),
    },
    ...(isSuperAdmin
      ? [{
          key: 'studentId',
          label: 'Mode',
          render: (_: unknown, row: Payment) => (
            <span className={`status-badge ${isOnline(row) ? 'text-primary bg-blue-100' : 'text-gray-600 bg-gray-100'}`}>
              {isOnline(row) ? 'Online' : 'Offline'}
            </span>
          ),
        } as Column<Payment>]
      : []),
    ...(showBranchColumn
      ? [{ key: 'branch', label: 'Branch', render: (v: unknown) => branchName(v as string) } as Column<Payment>]
      : []),
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status !== 'paid' && (
            <>
              <button
                className="btn-sm bg-warning text-white hover:opacity-80 disabled:opacity-50"
                disabled={actionLoading === row.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSendReminder(row)
                }}
              >
                {actionLoading === row.id ? 'Sending...' : 'Remind'}
              </button>
              <button
                className="btn-sm bg-success text-white hover:opacity-80 disabled:opacity-50"
                disabled={actionLoading === row.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkPaid(row)
                }}
              >
                {actionLoading === row.id ? 'Marking...' : 'Mark Paid'}
              </button>
            </>
          )}
          {row.status === 'paid' && (
            <button
              className="btn-sm bg-warning text-white hover:opacity-80 disabled:opacity-50"
              disabled={actionLoading === row.id}
              onClick={(e) => {
                e.stopPropagation()
                handleMarkUnpaid(row)
              }}
            >
              {actionLoading === row.id ? 'Marking...' : 'Mark Unpaid'}
            </button>
          )}
          {row.razorpayPaymentId && (
            <span className="text-xs text-gray-400">{String(row.razorpayPaymentId)}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Payments</h1>
          <p className="text-gray-500 text-sm mt-1">Track fees, collections, and overdue payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-sm bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
            disabled={monthKey <= FIRST_MONTH}
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </button>
          <span className="text-sm font-medium text-textDark w-36 text-center">
            {new Date(monthDate.year, monthDate.month - 1, 1).toLocaleString('default', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <button
            type="button"
            className="btn-sm bg-white border border-gray-300 hover:bg-gray-50"
            onClick={() => shiftMonth(1)}
          >
            ›
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Due This Month</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(summary.totalDue)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Collected</p>
          <p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.totalCollected)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Collection Rate</p>
          <p className="text-2xl font-bold text-warning mt-1">{summary.rate}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Overdue</p>
          <p className="text-2xl font-bold text-error mt-1">{summary.overdue}</p>
        </div>
      </div>

      {/* Online / Offline split — superadmin only */}
      {isSuperAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Offline Due</p>
              <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(summary.offline.due)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Offline Collected</p>
              <p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.offline.collected)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Online Due</p>
              <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(summary.online.due)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Online Collected</p>
              <p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.online.collected)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['all', 'offline', 'online'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  modeFilter === m ? 'bg-primary text-white' : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Table */}
      <Table
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={visiblePayments as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No payments due in this month."
        rowClassName={(row) =>
          (row as unknown as Payment).status === 'overdue' ? 'bg-red-50' : ''
        }
      />
    </div>
  )
}
