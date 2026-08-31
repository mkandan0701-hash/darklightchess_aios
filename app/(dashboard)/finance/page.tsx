'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import StatCard from '@/components/StatCard'
import type { Expense, DashboardStatsResponse, Column } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useIsAllBranches, useSession } from '@/components/SessionProvider'
import { branchName } from '@/lib/branches'

const CATEGORY_OPTIONS = ['Rent', 'Salaries', 'Utilities', 'Equipment', 'Marketing', 'Other']

const EMPTY_FORM = {
  description: '',
  amount: '',
  category: CATEGORY_OPTIONS[0],
  date: new Date().toISOString().split('T')[0],
}

function IncomeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ExpenseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 12H4" />
    </svg>
  )
}

function NetProfitIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const showBranchColumn = useIsAllBranches()
  const { session } = useSession()
  const isSuperAdmin = session.role === 'superadmin'

  useEffect(() => {
    Promise.all([
      fetch('/api/expenses').then((r) => r.json()),
      fetch('/api/clickup/stats').then((r) => r.json()),
    ])
      .then(([expensesData, statsData]: [
        { success: boolean; data: Expense[] },
        { success: boolean; data: DashboardStatsResponse }
      ]) => {
        if (expensesData.success) setExpenses(expensesData.data)
        if (statsData.success) setStats(statsData.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAddExpense = async () => {
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json() as { success: boolean; data?: Expense; error?: string }
      if (!result.success || !result.data) {
        setFormError(result.error ?? 'Failed to add expense')
        return
      }
      setExpenses((prev) => [result.data as Expense, ...prev])
      setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
    } catch {
      setFormError('Failed to add expense. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (expense: Expense) => {
    if (!window.confirm(`Delete this expense (${expense.description})? This cannot be undone.`)) return
    setActionLoading(`delete-${expense.id}`)
    try {
      const res = await fetch('/api/expenses/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId: expense.id }),
      })
      const result = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !result.success) {
        alert(result.error ?? 'Failed to delete expense')
        return
      }
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
    } catch {
      alert('Failed to delete expense. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses]
  )

  const columns: Column<Expense>[] = [
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(Number(v)) },
    { key: 'date', label: 'Date', render: (v) => formatDate(String(v)) },
    ...(showBranchColumn
      ? [{ key: 'branch', label: 'Branch', render: (v: unknown) => branchName(v as string) } as Column<Expense>]
      : []),
    ...(isSuperAdmin
      ? [{
          key: 'id',
          label: 'Actions',
          render: (_: unknown, row: Expense) => (
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
        } as Column<Expense>]
      : []),
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1>Finance</h1>
        <p className="text-gray-500 text-sm mt-1">Income, expenses, and net profit for this month</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Income (this month)"
          value={loading ? '—' : formatCurrency(stats?.monthlyRevenue ?? 0)}
          icon={<IncomeIcon />}
          color="success"
        />
        <StatCard
          label="Expenses (this month)"
          value={loading ? '—' : formatCurrency(stats?.monthlyExpenses ?? 0)}
          icon={<ExpenseIcon />}
          color="error"
        />
        <StatCard
          label="Net Profit (this month)"
          value={loading ? '—' : formatCurrency(stats?.netProfit ?? 0)}
          icon={<NetProfitIcon />}
          color="primary"
        />
      </div>

      {/* Per-branch breakdown — superadmin, all-branches view only */}
      {stats?.byBranch && stats.byBranch.length > 0 && (
        <div className="card">
          <h3 className="mb-4">By Branch</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.byBranch.map((b) => (
              <div key={b.branch || '(unassigned)'} className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-primary mb-2">{b.branchName}</p>
                <dl className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <dt>Income</dt>
                    <dd className="font-medium text-textDark">{formatCurrency(b.monthlyRevenue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Expenses</dt>
                    <dd className="font-medium text-textDark">{formatCurrency(b.monthlyExpenses)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Net Profit</dt>
                    <dd className="font-medium text-textDark">{formatCurrency(b.netProfit)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Expense */}
      <div className="card">
        <h3 className="mb-4">Add Expense</h3>
        {formError && (
          <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{formError}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field"
              placeholder="e.g. April rent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹)</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field"
              placeholder="5000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
        <button
          onClick={handleAddExpense}
          disabled={submitting || !form.description || !form.amount || !form.date}
          className={`btn-primary mt-4 ${
            submitting || !form.description || !form.amount || !form.date
              ? 'opacity-60 cursor-not-allowed'
              : ''
          }`}
        >
          {submitting ? 'Adding...' : '+ Add Expense'}
        </button>
      </div>

      {/* Table */}
      <Table
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={sorted as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No expenses recorded yet."
      />
    </div>
  )
}
