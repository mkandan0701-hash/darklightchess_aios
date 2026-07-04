'use client'

import { useEffect, useState, useMemo } from 'react'
import Table from '@/components/Table'
import Modal from '@/components/Modal'
import type { Lead, Column } from '@/lib/types'
import { formatDate, getStatusColor } from '@/lib/utils'

const DEFAULT_COACH = { id: 'C1', name: 'Manikandan', email: 'manikandan@darklight.com' }

const EMPTY_LEAD_FORM = {
  name: '',
  email: '',
  phone: '',
  source: 'website',
  notes: '',
}

const EMPTY_BOOKING_FORM = {
  selectedDate: '',
  selectedTime: '',
}

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
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [bookingLead, setBookingLead] = useState<Lead | null>(null)
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')

  useEffect(() => {
    fetch('/api/clickup/leads')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Lead[] }) => {
        if (d.success) setLeads(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAddLead = async () => {
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/clickup/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json() as { success: boolean; data?: Lead; error?: string }
      if (!result.success || !result.data) {
        setFormError(result.error ?? 'Failed to add lead')
        return
      }
      setLeads((prev) => [result.data as Lead, ...prev])
      setForm(EMPTY_LEAD_FORM)
      setShowAddModal(false)
    } catch {
      setFormError('Failed to add lead. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBookDemo = async () => {
    if (!bookingLead) return
    setBookingError('')
    setBookingSubmitting(true)
    try {
      const res = await fetch('/api/schedule-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: bookingLead.id,
          parentEmail: bookingLead.email,
          parentName: bookingLead.name,
          parentPhone: bookingLead.phone,
          coachId: DEFAULT_COACH.id,
          coachEmail: DEFAULT_COACH.email,
          coachName: DEFAULT_COACH.name,
          selectedDate: bookingForm.selectedDate,
          selectedTime: bookingForm.selectedTime,
        }),
      })
      const result = await res.json() as { success?: boolean; meetLink?: string; error?: string }
      if (!res.ok || !result.success) {
        setBookingError(result.error ?? 'Failed to schedule demo')
        return
      }
      setLeads((prev) =>
        prev.map((l) => (l.id === bookingLead.id ? { ...l, status: 'demo_booked' } : l))
      )
      setBookingLead(null)
      setBookingForm(EMPTY_BOOKING_FORM)
      alert(`Demo scheduled! Meet link sent to ${bookingLead.email}:\n${result.meetLink}`)
    } catch {
      setBookingError('Failed to schedule demo. Please try again.')
    } finally {
      setBookingSubmitting(false)
    }
  }

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
    { key: 'email', label: 'Email', width: '200px' },
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
              setBookingError('')
              setBookingForm(EMPTY_BOOKING_FORM)
              setBookingLead(row)
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
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Lead</button>
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

      {/* Add Lead Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setForm(EMPTY_LEAD_FORM)
          setFormError('')
        }}
        title="Add Lead"
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
              placeholder="Parent's full name"
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="input-field"
            >
              {SOURCE_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
          </div>

          <button
            onClick={handleAddLead}
            disabled={submitting || !form.name || !form.email || !form.phone}
            className={`btn-primary w-full justify-center ${
              submitting || !form.name || !form.email || !form.phone
                ? 'opacity-60 cursor-not-allowed'
                : ''
            }`}
          >
            {submitting ? 'Adding...' : 'Add Lead'}
          </button>
        </div>
      </Modal>

      {/* Book Demo Modal */}
      <Modal
        isOpen={!!bookingLead}
        onClose={() => {
          setBookingLead(null)
          setBookingForm(EMPTY_BOOKING_FORM)
          setBookingError('')
        }}
        title="Book Demo Class"
      >
        {bookingLead && (
          <div className="space-y-4">
            {bookingError && (
              <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bookingError}</p>
            )}

            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 space-y-1">
              <p><span className="font-semibold">Parent:</span> {bookingLead.name} ({bookingLead.email})</p>
              <p><span className="font-semibold">Coach:</span> {DEFAULT_COACH.name} ({DEFAULT_COACH.email})</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={bookingForm.selectedDate}
                onChange={(e) => setBookingForm({ ...bookingForm, selectedDate: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={bookingForm.selectedTime}
                onChange={(e) => setBookingForm({ ...bookingForm, selectedTime: e.target.value })}
                className="input-field"
              />
            </div>

            <button
              onClick={handleBookDemo}
              disabled={bookingSubmitting || !bookingForm.selectedDate || !bookingForm.selectedTime}
              className={`btn-primary w-full justify-center ${
                bookingSubmitting || !bookingForm.selectedDate || !bookingForm.selectedTime
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
            >
              {bookingSubmitting ? 'Scheduling...' : 'Confirm & Send Meet Link'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
