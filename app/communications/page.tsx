'use client'

import { useEffect, useState } from 'react'
import type { Student } from '@/lib/types'
import { formatDate } from '@/lib/utils'

type Tab = 'email' | 'whatsapp'

const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: 'Welcome to Darklight Chess Academy!',
    body: `Dear Parent,

We are delighted to welcome your child to Darklight Chess Academy!

Your classes begin this week. Please ensure your child is prepared with a chessboard if possible.

Looking forward to a wonderful chess journey together!

Warm regards,
Manikandan
Darklight Chess Academy`,
  },
  payment_reminder: {
    subject: 'Fee Payment Reminder – Darklight Chess Academy',
    body: `Dear Parent,

This is a friendly reminder that the monthly fee for your child is due.

Please complete the payment at your earliest convenience to continue uninterrupted classes.

Thank you for your prompt attention.

Regards,
Darklight Chess Academy`,
  },
  course_update: {
    subject: 'Course Update from Darklight Chess Academy',
    body: `Dear Parent,

We have an exciting update regarding your child's chess program!

Please check the dashboard or contact us for the latest schedule updates.

Best regards,
Manikandan`,
  },
  congratulations: {
    subject: 'Congratulations from Darklight Chess Academy! 🏆',
    body: `Dear Parent,

We are thrilled to congratulate your child on their recent achievement!

Their hard work and dedication at Darklight Chess Academy is truly commendable.

Keep up the great work!

Proud coach,
Manikandan`,
  },
}

const WHATSAPP_TEMPLATES: Record<string, string> = {
  welcome: 'Hi! Welcome to Darklight Chess Academy 🎉 Your child\'s chess journey begins this week. We\'ll send class details shortly!',
  payment_reminder: 'Hi! This is a reminder that your monthly chess class fee is due. Please complete payment to continue classes. Thank you! 🙏',
  course_update: 'Hi! There\'s an important update about your child\'s chess schedule. Please check your email or reply here for details.',
  congratulations: 'Congratulations! 🏆 Your child performed brilliantly at Darklight Chess Academy. We\'re so proud! Keep it up!',
}

const MOCK_HISTORY = [
  { id: 'h1', name: 'Arjun Sharma', type: 'Email', template: 'Payment Reminder', time: '2026-06-18', status: 'Delivered' },
  { id: 'h2', name: 'Priya Nair', type: 'WhatsApp', template: 'Payment Reminder', time: '2026-06-17', status: 'Read' },
  { id: 'h3', name: 'All Students', type: 'Email', template: 'Course Update', time: '2026-06-15', status: 'Delivered' },
  { id: 'h4', name: 'Sneha Krishnan', type: 'WhatsApp', template: 'Welcome', time: '2026-06-10', status: 'Delivered' },
]

export default function CommunicationsPage() {
  const [tab, setTab] = useState<Tab>('email')
  const [students, setStudents] = useState<Student[]>([])
  const [recipient, setRecipient] = useState('all')
  const [template, setTemplate] = useState('welcome')
  const [subject, setSubject] = useState(EMAIL_TEMPLATES.welcome.subject)
  const [body, setBody] = useState(EMAIL_TEMPLATES.welcome.body)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    fetch('/api/clickup/students')
      .then((r) => r.json())
      .then((d: { success: boolean; data: Student[] }) => {
        if (d.success) setStudents(d.data)
      })
  }, [])

  const handleTemplateChange = (t: string) => {
    setTemplate(t)
    if (tab === 'email') {
      setSubject(EMAIL_TEMPLATES[t]?.subject ?? '')
      setBody(EMAIL_TEMPLATES[t]?.body ?? '')
    } else {
      setBody(WHATSAPP_TEMPLATES[t] ?? '')
    }
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setSent(false)
    if (t === 'email') {
      setSubject(EMAIL_TEMPLATES[template]?.subject ?? '')
      setBody(EMAIL_TEMPLATES[template]?.body ?? '')
    } else {
      setBody(WHATSAPP_TEMPLATES[template] ?? '')
    }
  }

  const handleSend = async () => {
    setSending(true)
    const endpoint = tab === 'email' ? '/api/communications/email' : '/api/communications/whatsapp'
    const targetStudent = students.find((s) => s.id === recipient)
    const to = targetStudent?.email ?? 'all@students.com'

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, toName: targetStudent?.name, subject, message: body }),
    })

    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Communications</h1>
        <p className="text-gray-500 text-sm mt-1">Send emails and WhatsApp messages to parents</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['email', 'whatsapp'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-textDark'
            }`}
          >
            {t === 'email' ? '✉️ Email' : '💬 WhatsApp'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="card space-y-4">
          <h3>Compose {tab === 'email' ? 'Email' : 'WhatsApp'}</h3>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Recipient</label>
            <select
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="input-field"
            >
              <option value="all">All Students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Template */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Template</label>
            <select
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="input-field"
            >
              <option value="welcome">Welcome</option>
              <option value="payment_reminder">Payment Reminder</option>
              <option value="course_update">Course Update</option>
              <option value="congratulations">Congratulations</option>
            </select>
          </div>

          {/* Subject (email only) */}
          {tab === 'email' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          {/* Message body */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={tab === 'email' ? 10 : 4}
              className="input-field resize-none font-mono text-xs"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !body}
            className={`btn-primary w-full justify-center ${sending || !body ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {sending ? 'Sending...' : sent ? '✓ Sent!' : `Send ${tab === 'email' ? 'Email' : 'WhatsApp'}`}
          </button>
        </div>

        {/* History */}
        <div className="card">
          <h3 className="mb-4">Message History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs text-gray-500 font-semibold">Recipient</th>
                  <th className="text-left py-2 px-2 text-xs text-gray-500 font-semibold">Type</th>
                  <th className="text-left py-2 px-2 text-xs text-gray-500 font-semibold">Template</th>
                  <th className="text-left py-2 px-2 text-xs text-gray-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-2 text-xs text-gray-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_HISTORY.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{h.name}</td>
                    <td className="py-2 px-2 text-gray-500">{h.type}</td>
                    <td className="py-2 px-2 text-gray-500">{h.template}</td>
                    <td className="py-2 px-2 text-gray-500">{formatDate(h.time)}</td>
                    <td className="py-2 px-2">
                      <span className="text-xs text-success font-medium">{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
