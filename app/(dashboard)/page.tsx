'use client'

import { useEffect, useState } from 'react'
import StatCard from '@/components/StatCard'
import RecentActivity from '@/components/RecentActivity'
import ActionItems from '@/components/ActionItems'
import type { DashboardStatsResponse } from '@/lib/types'
import { formatCurrency, getGreeting } from '@/lib/utils'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'

function LeadsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function StudentsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function RevenueIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function OverdueIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { session } = useSession()

  useEffect(() => {
    fetch('/api/clickup/stats')
      .then((r) => r.json())
      .then((d: { success: boolean; data: DashboardStatsResponse }) => {
        if (d.success) setStats(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          {getGreeting()}, {session.name}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here&apos;s what&apos;s happening at Darklight Chess Academy today.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads"
          value={loading ? '—' : (stats?.totalLeads ?? 0)}
          icon={<LeadsIcon />}
          color="primary"
        />
        <StatCard
          label="Active Students"
          value={loading ? '—' : (stats?.activeStudents ?? 0)}
          icon={<StudentsIcon />}
          trend={stats?.studentsChange}
          color="success"
        />
        <StatCard
          label="Monthly Revenue"
          value={loading ? '—' : formatCurrency(stats?.monthlyRevenue ?? 0)}
          icon={<RevenueIcon />}
          color="warning"
        />
        <StatCard
          label="Overdue Payments"
          value={loading ? '—' : (stats?.overduePayments ?? 0)}
          icon={<OverdueIcon />}
          color="error"
        />
      </div>

      {/* Finance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
          color="success"
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
                    <dt>Students</dt>
                    <dd className="font-medium text-textDark">{b.activeStudents}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Revenue (mo)</dt>
                    <dd className="font-medium text-textDark">{formatCurrency(b.monthlyRevenue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Expenses (mo)</dt>
                    <dd className="font-medium text-textDark">{formatCurrency(b.monthlyExpenses)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Net Profit (mo)</dt>
                    <dd className="font-medium text-textDark">{formatCurrency(b.netProfit)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Overdue</dt>
                    <dd className="font-medium text-textDark">{b.overduePayments}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <RecentActivity items={[]} />
        </div>
        <div className="lg:col-span-2">
          <ActionItems items={[]} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/leads" className="btn-primary">
            + Add New Lead
          </Link>
          <Link href="/communications" className="btn-outline">
            Send Payment Reminders
          </Link>
          <Link href="/analytics" className="btn-outline">
            View Analytics
          </Link>
          <Link href="/payments" className="btn-outline">
            View Overdue Payments
          </Link>
          <Link href="/finance" className="btn-outline">
            Manage Expenses
          </Link>
        </div>
      </div>
    </div>
  )
}
