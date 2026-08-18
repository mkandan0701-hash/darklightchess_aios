'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
  ResponsiveContainer,
} from 'recharts'
import type { Lead, Payment } from '@/lib/types'

const MONTHLY_REVENUE = [
  { month: 'Jan', revenue: 45000 },
  { month: 'Feb', revenue: 52000 },
  { month: 'Mar', revenue: 48000 },
  { month: 'Apr', revenue: 61000 },
  { month: 'May', revenue: 55000 },
  { month: 'Jun', revenue: 68500 },
]

const PIE_COLORS = ['#10B981', '#F59E0B', '#DC2626']

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/clickup/leads').then((r) => r.json()),
      fetch('/api/clickup/payments').then((r) => r.json()),
    ])
      .then(([leadsData, paymentsData]: [
        { success: boolean; data: Lead[] },
        { success: boolean; data: Payment[] }
      ]) => {
        if (leadsData.success) setLeads(leadsData.data)
        if (paymentsData.success) setPayments(paymentsData.data)
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
          <h3 className="mb-4">Revenue Trend (Jan – Jun 2026)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={MONTHLY_REVENUE} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#FFB81C"
                strokeWidth={2}
                dot={{ fill: '#FFB81C', r: 4 }}
                activeDot={{ r: 6 }}
              />
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
