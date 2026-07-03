'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import type { Lead, Column } from '@/lib/types'
import { formatDate, getStatusColor } from '@/lib/utils'

type LeadStatus = Lead['status'] | 'all'
type LeadSource = Lead['source'] | 'all'

const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Demo Booked', value: 'demo_booked' },
  { label: 'Demo Done', value: 'demo_done' },
  { label: 'Converted', value: 'converted' },
  { label: 'Lost', value: 'lost' },
]

const SOURCE_OPTIONS: { label: string; value: LeadSource }[] = [
  { label: 'All Sources', value: 'all' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Referral', value: 'referral' },
  { label: 'Website', value: 'website' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Other', value: 'other' },
]

const FUNNEL_STAGES: { key: Lead['status']; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'demo_booked', label: 'Demo Booked' },
  { key: 'demo_done', label: 'Demo Done' },
  { key: 'converted', label: 'Converted' },
]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<LeadStatus>('all')
  const [filterSource, setFilterSource] = useState<LeadSource>('all')

  useEffect(() => {
    fetch('/api/clickup/leads')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Lead[] }) => {
        if (d.success) setLeads(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesStatus = filterStatus === 'all' || l.status === filterStatus
      const matchesSource = filterSource === 'all' || l.source === filterSource
      return matchesStatus && matchesSource
    })
  }, [leads, filterStatus, filterSource])

  const funnelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    FUNNEL_STAGES.forEach((s) => {
      counts[s.key] = leads.filter((l) => l.status === s.key).length
    })
    return counts
  }, [leads])

  const conversionRate = leads.length
    ? ((leads.filter((l) => l.status === 'converted').length / leads.length) * 100).toFixed(1)
    : '0'

  const columns: Column<Lead>[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'source',
      label: 'Source',
      render: (v) => (
        <span className="capitalize text-sm">{String(v)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`status-badge ${getStatusColor(String(v))}`}>
          {String(v).replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'dateReceived',
      label: 'Date Received',
      render: (v) => formatDate(String(v)),
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
              alert(`Demo booking link sent to ${row.name}`)
            }}
          >
            Book Demo
          </button>
          {row.status !== 'converted' && (
            <button
              className="btn-sm bg-success text-white hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation()
                alert(`${row.name} marked as converted`)
              }}
            >
              Convert
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
          <h1>Leads</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Loading...' : `${leads.length} total leads · ${conversionRate}% conversion rate`}
          </p>
        </div>
        <button className="btn-primary">+ Add Lead</button>
      </div>

      {/* Funnel */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {FUNNEL_STAGES.map((stage, idx) => (
          <div key={stage.key} className="card text-center py-4 relative">
            {idx < FUNNEL_STAGES.length - 1 && (
              <span className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 text-gray-400 z-10">→</span>
            )}
            <p className="text-2xl font-bold text-primary">{funnelCounts[stage.key] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{stage.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as LeadSource)}
          className="input-field w-auto"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`btn-sm px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
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
        emptyMessage="No leads found matching your filters."
      />
    </div>
  )
}
