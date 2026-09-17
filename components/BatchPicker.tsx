'use client'

import { DAY_OPTIONS } from '@/lib/batches'

interface BatchPickerProps {
  days: number[]
  startTime: string
  endTime: string
  onChange: (next: { days: number[]; startTime: string; endTime: string }) => void
}

/** Days + time window for one student's batch. Shared by the add-student and edit-batch modals. */
export default function BatchPicker({ days, startTime, endTime, onChange }: BatchPickerProps) {
  const toggleDay = (day: number) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    onChange({ days: next, startTime, endTime })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Class Days</label>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((opt) => {
            const selected = days.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleDay(opt.value)}
                className={`btn-sm px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selected
                    ? 'bg-primary text-white'
                    : 'bg-white border border-gray-300 text-textDark hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onChange({ days, startTime: e.target.value, endTime })}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onChange({ days, startTime, endTime: e.target.value })}
            className="input-field"
          />
        </div>
      </div>
    </div>
  )
}
