'use client'

import { INDIAN_MOBILE_REGEX, phoneDigits } from '@/lib/phone'

interface PhoneInputProps {
  /** Up to 10 digits, no +91. The server adds the country code. */
  value: string
  onChange: (digits: string) => void
  label?: string
}

/** 10-digit Indian mobile input with a fixed +91 prefix. Shared by Add Lead and Add Student. */
export default function PhoneInput({ value, onChange, label = 'Phone' }: PhoneInputProps) {
  const showError = value.length === 10 && !INDIAN_MOBILE_REGEX.test(value)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className="flex">
        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm text-gray-600">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          value={value}
          onChange={(e) => onChange(phoneDigits(e.target.value))}
          className="input-field rounded-l-none"
          placeholder="9876543210"
        />
      </div>
      {showError && <p className="text-xs text-error mt-1">Mobile numbers start with 6, 7, 8 or 9.</p>}
    </div>
  )
}
