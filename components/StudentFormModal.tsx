'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import BatchPicker from '@/components/BatchPicker'
import { encodeBatch } from '@/lib/batches'

export interface StudentFormValues {
  name: string
  email: string
  phone: string
  classesPerWeek: string
  duration: string
  monthlyFee: string
  grade: string
  /** Encoded batch code, or '' when no days were picked. */
  batchId: string
  online: boolean
}

interface FormState {
  name: string
  email: string
  phone: string
  classesPerWeek: string
  duration: string
  monthlyFee: string
  grade: string
  days: number[]
  startTime: string
  endTime: string
  online: boolean
}

function emptyForm(defaultOnline: boolean): FormState {
  return {
    name: '',
    email: '',
    phone: '',
    classesPerWeek: '3',
    duration: '45 min',
    monthlyFee: '',
    grade: '',
    days: [],
    startTime: '17:00',
    endTime: '18:00',
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
    const { days, startTime, endTime, ...rest } = form
    const success = await onSubmit({
      ...rest,
      batchId: days.length > 0 ? encodeBatch({ days, startTime, endTime }) : '',
    })
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

        <BatchPicker
          days={form.days}
          startTime={form.startTime}
          endTime={form.endTime}
          onChange={(next) => setForm({ ...form, ...next })}
        />

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
