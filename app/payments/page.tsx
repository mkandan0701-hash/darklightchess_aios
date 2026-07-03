'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import type { Payment, Column } from '@/lib/types'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clickup/payments')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Payment[] }) => {
        if (d.success) setPayments(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const totalDue = payments.reduce((s, p) => s + p.amountDue, 0)
    const totalCollected = payments.reduce((s, p) => s + p.amountPaid, 0)
    const overdue = payments.filter((p) => p.status === 'overdue').length
    const rate = totalDue ? Math.round((totalCollected / totalDue) * 100) : 0
    return { totalDue, totalCollected, overdue, rate }
  }, [payments])

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
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status !== 'paid' && (
            <>
              <button
                className="btn-sm bg-warning text-white hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation()
                  alert(`Reminder sent to ${row.studentName}`)
                }}
              >
                Remind
              </button>
              <button
                className="btn-sm bg-success text-white hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation()
                  alert(`${row.studentName} marked as paid`)
                }}
              >
                Mark Paid
              </button>
            </>
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
      <div>
        <h1>Payments</h1>
        <p className="text-gray-500 text-sm mt-1">Track fees, collections, and overdue payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Due</p>
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

      {/* Table */}
      <Table
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={payments as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No payment records found."
        rowClassName={(row) =>
          (row as unknown as Payment).status === 'overdue' ? 'bg-red-50' : ''
        }
      />
    </div>
  )
}
