'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
  ResponsiveContainer,
} from 'recharts'
import type { Lead, Payment, Expense } from '@/lib/types'
import { useIsAllBranches, useSession } from '@/components/SessionProvider'

const PIE_COLORS = ['#10B981', '#F59E0B', '#DC2626']

// One color per branch line, cycled if there are ever more branches than colors. 'Total' gets
// its own fixed color below rather than one from this list, so it always reads as distinct.
const BRANCH_LINE_COLORS = ['#FFB81C', '#10B981', '#6366F1', '#EC4899', '#0EA5E9']
const TOTAL_LINE_COLOR = '#003366'
const UNASSIGNED_KEY = '(unassigned)'

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Trailing 6 calendar months, oldest first, ending on the current month. */
function trailingMonths(): { key: string; label: string }[] {
  const now = new Date()
  const months: { key: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    })
  }
  return months
}

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const { branches } = useSession()
  const isAllBranches = useIsAllBranches()

  useEffect(() => {
    Promise.all([
      fetch('/api/clickup/leads').then((r) => r.json()),
      fetch('/api/clickup/payments').then((r) => r.json()),
      fetch('/api/expenses').then((r) => r.json()),
    ])
      .then(([leadsData, paymentsData, expensesData]: [
        { success: boolean; data: Lead[] },
        { success: boolean; data: Payment[] },
        { success: boolean; data: Expense[] }
      ]) => {
        if (leadsData.success) setLeads(leadsData.data)
        if (paymentsData.success) setPayments(paymentsData.data)
        if (expensesData.success) setExpenses(expensesData.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const funnelData = [
    { stage: 'New', count: leads.filter((l) => l.status === 'new').length },
    { stage: 'Contacted', count: leads.filter((l) => l.status === 'contacted').length },
    { stage: 'Demo Booked', count: leads.filter((l) => l.status === 'demo_booked').length },
    { stage: 'Demo Done', count: leads.filter((l) => l.status === 'demo_done').length },
    { stage: 'Converted', count: leads.filter((l) => l.status === 'converted').length },
  ]

  const paymentPieData = [
    { name: 'Paid', value: payments.filter((p) => p.status === 'paid').length },
    { name: 'Pending', value: payments.filter((p) => p.status === 'pending').length },
    { name: 'Overdue', value: payments.filter((p) => p.status === 'overdue').length },
  ]

  // Real monthly turnover from Payments — /api/clickup/payments already returns only records
  // in scope (a single branch for a narrowed superadmin view, all of them otherwise), so no
  // extra filtering is needed here beyond bucketing by month and (when viewing all branches)
  // by branch.
  const revenueByMonth = useMemo(() => {
    const months = trailingMonths()
    const paid = payments.filter((p) => p.status === 'paid' && p.paidDate)

    return months.map(({ key, label }) => {
      const row: Record<string, string | number> = { month: label }
      let total = 0
      for (const p of paid) {
        if (monthKey(p.paidDate!) !== key) continue
        total += p.amountPaid
        if (isAllBranches) {
          const branchKey = p.branch || UNASSIGNED_KEY
          row[branchKey] = (Number(row[branchKey]) || 0) + p.amountPaid
        }
      }
      row.total = total
      return row
    })
  }, [payments, isAllBranches])

  const hasUnassignedRevenue = isAllBranches && payments.some((p) => p.status === 'paid' && !p.branch)

  // Income vs Expenses vs Net Profit — /api/expenses already returns only records in scope,
  // same as payments above, so this just buckets by month.
  const netProfitByMonth = useMemo(() => {
    const months = trailingMonths()
    const paid = payments.filter((p) => p.status === 'paid' && p.paidDate)

    return months.map(({ key, label }) => {
      let income = 0
      for (const p of paid) {
        if (monthKey(p.paidDate!) === key) income += p.amountPaid
      }
      let expenseTotal = 0
      for (const e of expenses) {
        if (e.date && monthKey(e.date) === key) expenseTotal += e.amount
      }
      return { month: label, income, expenses: expenseTotal, netProfit: income - expenseTotal }
    })
  }, [payments, expenses])

  const sourceMap: Record<string, { total: number; converted: number }> = {}
  leads.forEach((l) => {
    if (!sourceMap[l.source]) sourceMap[l.source] = { total: 0, converted: 0 }
    sourceMap[l.source].total++
    if (l.status === 'converted') sourceMap[l.source].converted++
  })
  const sourceData = Object.entries(sourceMap).map(([source, data]) => ({
    source: source.charAt(0).toUpperCase() + source.slice(1),
    rate: data.total ? Math.round((data.converted / data.total) * 100) : 0,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Performance insights for Darklight Chess Academy</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Lead Funnel */}
        <div className="card">
          <h3 className="mb-4">Lead Funnel</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#003366" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status */}
        <div className="card">
          <h3 className="mb-4">Payment Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={paymentPieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {paymentPieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
        <div className="card">
          <h3 className="mb-4">
            Revenue Trend (Last 6 Months){isAllBranches ? ' — All Branches' : ''}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueByMonth} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Legend />
              {isAllBranches &&
                branches.map((b, i) => (
                  <Line
                    key={b.id}
                    type="monotone"
                    dataKey={b.id}
                    name={b.name}
                    stroke={BRANCH_LINE_COLORS[i % BRANCH_LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              {hasUnassignedRevenue && (
                <Line
                  type="monotone"
                  dataKey={UNASSIGNED_KEY}
                  name="Unassigned"
                  stroke="#9CA3AF"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="total"
                name={isAllBranches ? 'Total' : 'Revenue'}
                stroke={TOTAL_LINE_COLOR}
                strokeWidth={isAllBranches ? 3 : 2}
                dot={{ fill: TOTAL_LINE_COLOR, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Income vs Expenses / Net Profit */}
        <div className="card">
          <h3 className="mb-4">Income vs Expenses (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={netProfitByMonth} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => [`₹${v.toLocaleString('en-IN')}`, name]} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke={TOTAL_LINE_COLOR} strokeWidth={3} dot={{ fill: TOTAL_LINE_COLOR, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Source Performance */}
        <div className="card">
          <h3 className="mb-4">Lead Source Conversion Rate (%)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sourceData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="source" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Conversion Rate']} />
              <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
