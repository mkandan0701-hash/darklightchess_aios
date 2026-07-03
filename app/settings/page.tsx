'use client'

import { useEffect, useState } from 'react'

interface ApiStatus {
  clickup: boolean
  razorpay: boolean
  mailchimp: boolean
  twilio: boolean
}

interface BusinessSettings {
  academyName: string
  ownerName: string
  revenueGoal: string
  defaultFee: string
  gstRate: string
}

const DEFAULT_SETTINGS: BusinessSettings = {
  academyName: 'Darklight Chess Academy',
  ownerName: 'Manikandan',
  revenueGoal: '1000000',
  defaultFee: '5000',
  gstRate: '18',
}

const SERVICE_NAMES: (keyof ApiStatus)[] = ['clickup', 'razorpay', 'mailchimp', 'twilio']

const SERVICE_LABELS: Record<keyof ApiStatus, { label: string; description: string }> = {
  clickup: { label: 'ClickUp CRM', description: 'Student, lead & payment data' },
  razorpay: { label: 'Razorpay', description: 'Payment processing & invoices' },
  mailchimp: { label: 'Mailchimp', description: 'Email notifications' },
  twilio: { label: 'Twilio', description: 'WhatsApp messaging' },
}

export default function SettingsPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/status')
      .then((r) => r.json())
      .then((d: { success: boolean; data: ApiStatus }) => {
        if (d.success) setApiStatus(d.data)
      })

    const stored = localStorage.getItem('darklight_settings')
    if (stored) {
      try {
        setSettings(JSON.parse(stored) as BusinessSettings)
      } catch { /* ignore */ }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('darklight_settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleExport = async (type: 'students' | 'leads' | 'payments') => {
    const res = await fetch(`/api/clickup/${type}`)
    const data = await res.json() as { data: unknown }
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `darklight-${type}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1>Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage API connections, business settings, and data exports</p>
      </div>

      {/* API Status */}
      <div className="card">
        <h3 className="mb-4">API Connections</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SERVICE_NAMES.map((svc) => {
            const isConnected = apiStatus?.[svc] ?? false
            const info = SERVICE_LABELS[svc]
            return (
              <div
                key={svc}
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-success' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-sm font-semibold text-textDark">{info.label}</p>
                  <p className="text-xs text-gray-500">{info.description}</p>
                  <p className={`text-xs font-medium mt-1 ${isConnected ? 'text-success' : 'text-gray-400'}`}>
                    {isConnected ? 'Connected' : 'Not configured'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          To configure, add API keys to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file and restart the server.
        </p>
      </div>

      {/* Business Settings */}
      <div className="card">
        <h3 className="mb-4">Business Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academy Name</label>
            <input
              type="text"
              value={settings.academyName}
              onChange={(e) => setSettings({ ...settings, academyName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Name</label>
            <input
              type="text"
              value={settings.ownerName}
              onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Revenue Goal (₹)</label>
            <input
              type="number"
              value={settings.revenueGoal}
              onChange={(e) => setSettings({ ...settings, revenueGoal: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Default Session Fee (₹)</label>
            <input
              type="number"
              value={settings.defaultFee}
              onChange={(e) => setSettings({ ...settings, defaultFee: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">GST Rate (%)</label>
            <input
              type="number"
              value={settings.gstRate}
              onChange={(e) => setSettings({ ...settings, gstRate: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          className={`mt-4 btn-primary ${saved ? 'bg-success' : ''}`}
        >
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Data Management */}
      <div className="card">
        <h3 className="mb-4">Data Management</h3>
        <p className="text-sm text-gray-500 mb-4">Export your data as JSON files for backup or analysis.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => handleExport('students')} className="btn-outline">
            ↓ Export Students
          </button>
          <button onClick={() => handleExport('leads')} className="btn-outline">
            ↓ Export Leads
          </button>
          <button onClick={() => handleExport('payments')} className="btn-outline">
            ↓ Export Payments
          </button>
        </div>
      </div>
    </div>
  )
}
