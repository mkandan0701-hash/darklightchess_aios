'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import { BATCHES } from '@/lib/batches'

export interface StudentFormValues {
  name: string
  email: string
  phone: string
  classesPerWeek: string
  duration: string
  monthlyFee: string
  grade: string
  batchId: string
  online: boolean
}

function emptyForm(defaultOnline: boolean): StudentFormValues {
  return {
    name: '',
    email: '',
    phone: '',
    classesPerWeek: '3',
    duration: '45 min',
    monthlyFee: '',
    grade: '',
    batchId: '',
    online: defaultOnline,
  }
}

interface StudentFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Return true on success — the modal resets and closes itself; false leaves the form as-is. */
  onSubmit: (values: StudentFormValues) => Promise<boolean>
  submitting: boolean
  error: string
  title: string
  submitLabel?: string
  defaultOnline?: boolean
}

/** Shared by /students and /online-classes so the add-student form can't drift between the two. */
export default function StudentFormModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  error,
  title,
  submitLabel = 'Add Student',
  defaultOnline = false,
}: StudentFormModalProps) {
  const [form, setForm] = useState(() => emptyForm(defaultOnline))

  useEffect(() => {
    if (isOpen) setForm(emptyForm(defaultOnline))
  }, [isOpen, defaultOnline])

  const handleSubmit = async () => {
    const success = await onSubmit(form)
    if (success) onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-error bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
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

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Batch</label>
          <select
            value={form.batchId}
            onChange={(e) => setForm({ ...form, batchId: e.target.value })}
            className="input-field"
          >
            <option value="">Select a batch…</option>
            {BATCHES.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-textDark">
          <input
            type="checkbox"
            checked={form.online}
            onChange={(e) => setForm({ ...form, online: e.target.checked })}
            className="w-4 h-4"
          />
          Online class
        </label>

        <button
          onClick={handleSubmit}
          disabled={submitting || !form.name || !form.email || !form.phone || !form.monthlyFee}
          className={`btn-primary w-full justify-center ${
            submitting || !form.name || !form.email || !form.phone || !form.monthlyFee
              ? 'opacity-60 cursor-not-allowed'
              : ''
          }`}
        >
          {submitting ? 'Adding...' : submitLabel}
        </button>
      </div>
    </Modal>
  )
}
