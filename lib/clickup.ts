import type { Student, Lead, Payment, DashboardStats } from './types'

const BASE_URL = 'https://api.clickup.com/api/v2'

function getHeaders(): Record<string, string> {
  return {
    Authorization: process.env.CLICKUP_API_KEY ?? '',
    'Content-Type': 'application/json',
  }
}

const fieldIdCache = new Map<string, Record<string, string>>()

// ClickUp's task create/update API requires custom_fields to be keyed by field id, not name.
async function getFieldIds(listId: string): Promise<Record<string, string>> {
  const cached = fieldIdCache.get(listId)
  if (cached) return cached

  const res = await fetch(`${BASE_URL}/list/${listId}/field`, { headers: getHeaders() })
  if (!res.ok) {
    throw new Error(`Failed to fetch ClickUp custom fields for list ${listId}: ${res.status}`)
  }
  const data = await res.json() as { fields: { id: string; name: string }[] }
  const map = Object.fromEntries(data.fields.map((f) => [f.name, f.id]))
  fieldIdCache.set(listId, map)
  return map
}

// The Update Task endpoint (PUT /task/{id}) silently ignores a `custom_fields` body param -
// ClickUp requires the separate "Set Custom Field Value" endpoint for that.
async function setCustomFields(taskId: string, listId: string, fields: Record<string, string>): Promise<void> {
  const fieldIds = await getFieldIds(listId)

  await Promise.all(
    Object.entries(fields).map(async ([name, value]) => {
      const fieldId = fieldIds[name]
      if (!fieldId) {
        console.warn(`[CLICKUP] Unknown custom field "${name}" for list ${listId}; skipping`)
        return
      }
      const res = await fetch(`${BASE_URL}/task/${taskId}/field/${fieldId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ value }),
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error(`[CLICKUP] Failed to set field "${name}" on task ${taskId}: ${res.status} ${errText}`)
      }
    })
  )
}

// --- Mock Data ---

const MOCK_STUDENTS: Student[] = [
  {
    id: 'st-001',
    name: 'Arjun Sharma',
    email: 'arjun.sharma@gmail.com',
    phone: '+919876543210',
    classesPerWeek: 3,
    duration: '45 min',
    monthlyFee: 5000,
    paymentStatus: 'paid',
    enrolledDate: '2026-01-15',
    grade: 'U12',
  },
  {
    id: 'st-002',
    name: 'Priya Nair',
    email: 'priya.nair@gmail.com',
    phone: '+919876543211',
    classesPerWeek: 2,
    duration: '60 min',
    monthlyFee: 4000,
    paymentStatus: 'pending',
    enrolledDate: '2026-02-10',
    grade: 'U14',
  },
  {
    id: 'st-003',
    name: 'Rohan Patel',
    email: 'rohan.patel@gmail.com',
    phone: '+919876543212',
    classesPerWeek: 5,
    duration: '45 min',
    monthlyFee: 8000,
    paymentStatus: 'paid',
    enrolledDate: '2025-11-20',
    grade: 'Open',
  },
  {
    id: 'st-004',
    name: 'Sneha Krishnan',
    email: 'sneha.k@gmail.com',
    phone: '+919876543213',
    classesPerWeek: 2,
    duration: '30 min',
    monthlyFee: 3000,
    paymentStatus: 'overdue',
    enrolledDate: '2026-03-05',
    grade: 'U10',
  },
  {
    id: 'st-005',
    name: 'Karthik Rajan',
    email: 'karthik.r@gmail.com',
    phone: '+919876543214',
    classesPerWeek: 4,
    duration: '60 min',
    monthlyFee: 6500,
    paymentStatus: 'paid',
    enrolledDate: '2026-01-01',
    grade: 'U16',
  },
]

const MOCK_LEADS: Lead[] = [
  {
    id: 'ld-001',
    name: 'Vijay Menon',
    email: 'vijay.m@gmail.com',
    phone: '+919811223344',
    source: 'instagram',
    status: 'new',
    dateReceived: '2026-06-18',
  },
  {
    id: 'ld-002',
    name: 'Anita Desai',
    email: 'anita.d@gmail.com',
    phone: '+919811223345',
    source: 'referral',
    status: 'contacted',
    dateReceived: '2026-06-15',
    notes: 'Referred by Arjun Sharma',
  },
  {
    id: 'ld-003',
    name: 'Deepak Rao',
    email: 'deepak.rao@gmail.com',
    phone: '+919811223346',
    source: 'website',
    status: 'demo_booked',
    dateReceived: '2026-06-12',
  },
  {
    id: 'ld-004',
    name: 'Meera Iyer',
    email: 'meera.iyer@gmail.com',
    phone: '+919811223347',
    source: 'youtube',
    status: 'demo_done',
    dateReceived: '2026-06-08',
    notes: 'Very interested, following up',
  },
  {
    id: 'ld-005',
    name: 'Suresh Kumar',
    email: 'suresh.k@gmail.com',
    phone: '+919811223348',
    source: 'instagram',
    status: 'converted',
    dateReceived: '2026-05-30',
  },
  {
    id: 'ld-006',
    name: 'Lakshmi Pillai',
    email: 'lakshmi.p@gmail.com',
    phone: '+919811223349',
    source: 'referral',
    status: 'converted',
    dateReceived: '2026-05-20',
  },
  {
    id: 'ld-007',
    name: 'Rahul Tiwari',
    email: 'rahul.t@gmail.com',
    phone: '+919811223350',
    source: 'other',
    status: 'lost',
    dateReceived: '2026-05-10',
    notes: 'Too expensive, went with competitor',
  },
  {
    id: 'ld-008',
    name: 'Divya Srinivasan',
    email: 'divya.s@gmail.com',
    phone: '+919811223351',
    source: 'instagram',
    status: 'contacted',
    dateReceived: '2026-06-20',
  },
]

const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'pay-001',
    studentId: 'st-001',
    studentName: 'Arjun Sharma',
    amountDue: 5000,
    amountPaid: 5000,
    dueDate: '2026-06-01',
    paidDate: '2026-06-02',
    status: 'paid',
    razorpayPaymentId: 'pay_QxR1234567',
  },
  {
    id: 'pay-002',
    studentId: 'st-002',
    studentName: 'Priya Nair',
    amountDue: 4000,
    amountPaid: 0,
    dueDate: '2026-06-01',
    status: 'pending',
  },
  {
    id: 'pay-003',
    studentId: 'st-003',
    studentName: 'Rohan Patel',
    amountDue: 8000,
    amountPaid: 8000,
    dueDate: '2026-06-01',
    paidDate: '2026-05-31',
    status: 'paid',
    razorpayPaymentId: 'pay_QxR7654321',
  },
  {
    id: 'pay-004',
    studentId: 'st-004',
    studentName: 'Sneha Krishnan',
    amountDue: 3000,
    amountPaid: 0,
    dueDate: '2026-05-01',
    status: 'overdue',
  },
  {
    id: 'pay-005',
    studentId: 'st-005',
    studentName: 'Karthik Rajan',
    amountDue: 6500,
    amountPaid: 6500,
    dueDate: '2026-06-01',
    paidDate: '2026-06-03',
    status: 'paid',
    razorpayPaymentId: 'pay_QxR1122334',
  },
  {
    id: 'pay-006',
    studentId: 'st-001',
    studentName: 'Arjun Sharma',
    amountDue: 5000,
    amountPaid: 5000,
    dueDate: '2026-05-01',
    paidDate: '2026-05-01',
    status: 'paid',
    razorpayPaymentId: 'pay_QxR5566778',
  },
  {
    id: 'pay-007',
    studentId: 'st-003',
    studentName: 'Rohan Patel',
    amountDue: 8000,
    amountPaid: 8000,
    dueDate: '2026-05-01',
    paidDate: '2026-04-29',
    status: 'paid',
  },
  {
    id: 'pay-008',
    studentId: 'st-005',
    studentName: 'Karthik Rajan',
    amountDue: 6500,
    amountPaid: 0,
    dueDate: '2026-07-01',
    status: 'pending',
  },
  {
    id: 'pay-009',
    studentId: 'st-002',
    studentName: 'Priya Nair',
    amountDue: 4000,
    amountPaid: 0,
    dueDate: '2026-05-01',
    status: 'overdue',
  },
  {
    id: 'pay-010',
    studentId: 'st-004',
    studentName: 'Sneha Krishnan',
    amountDue: 3000,
    amountPaid: 3000,
    dueDate: '2026-04-01',
    paidDate: '2026-04-05',
    status: 'paid',
  },
]

// --- ClickUp task mappers ---

function mapTaskToStudent(task: Record<string, unknown>): Student {
  const fields = (task.custom_fields as Record<string, unknown>[]) ?? []
  const getField = (name: string) =>
    fields.find((f: Record<string, unknown>) => f.name === name)?.value ?? ''

  return {
    id: task.id as string,
    name: task.name as string,
    email: getField('Email') as string,
    phone: getField('Phone') as string,
    classesPerWeek: Number(getField('Classes Per Week')) || 0,
    duration: getField('Duration') as string,
    monthlyFee: Number(getField('Monthly Fee')) || 0,
    paymentStatus: (getField('Payment Status') as Student['paymentStatus']) || 'pending',
    enrolledDate: getField('Enrolled Date') as string,
    grade: getField('Grade') as string,
  }
}

function mapTaskToLead(task: Record<string, unknown>): Lead {
  const fields = (task.custom_fields as Record<string, unknown>[]) ?? []
  const getField = (name: string) =>
    fields.find((f: Record<string, unknown>) => f.name === name)?.value ?? ''

  return {
    id: task.id as string,
    name: task.name as string,
    email: getField('Email') as string,
    phone: getField('Phone') as string,
    source: (getField('Source') as Lead['source']) || 'other',
    status: (getField('Status') as Lead['status']) || 'new',
    dateReceived: getField('Date Received') as string,
    notes: getField('Notes') as string,
  }
}

function mapTaskToPayment(task: Record<string, unknown>): Payment {
  const fields = (task.custom_fields as Record<string, unknown>[]) ?? []
  const getField = (name: string) =>
    fields.find((f: Record<string, unknown>) => f.name === name)?.value ?? ''

  return {
    id: task.id as string,
    studentId: getField('Student ID') as string,
    studentName: task.name as string,
    amountDue: Number(getField('Amount Due')) || 0,
    amountPaid: Number(getField('Amount Paid')) || 0,
    dueDate: getField('Due Date') as string,
    paidDate: getField('Paid Date') as string,
    status: (getField('Payment Status') as Payment['status']) || 'pending',
    razorpayPaymentId: getField('Razorpay Payment ID') as string,
  }
}

// --- ClickUp API Client ---

export class ClickUpClient {
  static isConfigured(): boolean {
    return !!(
      process.env.CLICKUP_API_KEY &&
      process.env.CLICKUP_LIST_STUDENTS &&
      process.env.CLICKUP_LIST_LEADS &&
      process.env.CLICKUP_LIST_PAYMENTS
    )
  }

  static async getStudents(): Promise<Student[]> {
    if (!this.isConfigured()) return MOCK_STUDENTS
    const res = await fetch(
      `${BASE_URL}/list/${process.env.CLICKUP_LIST_STUDENTS}/task?archived=false`,
      { headers: getHeaders() }
    )
    const data = await res.json() as { tasks: Record<string, unknown>[] }
    return data.tasks.map(mapTaskToStudent)
  }

  static async getLeads(): Promise<Lead[]> {
    if (!this.isConfigured()) return MOCK_LEADS
    const res = await fetch(
      `${BASE_URL}/list/${process.env.CLICKUP_LIST_LEADS}/task?archived=false`,
      { headers: getHeaders() }
    )
    const data = await res.json() as { tasks: Record<string, unknown>[] }
    return data.tasks.map(mapTaskToLead)
  }

  static async getPayments(): Promise<Payment[]> {
    if (!this.isConfigured()) return MOCK_PAYMENTS
    const res = await fetch(
      `${BASE_URL}/list/${process.env.CLICKUP_LIST_PAYMENTS}/task?archived=false`,
      { headers: getHeaders() }
    )
    const data = await res.json() as { tasks: Record<string, unknown>[] }
    return data.tasks.map(mapTaskToPayment)
  }

  static async updateLeadStatus(
    leadId: string,
    status: string,
    demoDetails?: { demoDate: string; demoTime: string; meetLink: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP MOCK] Would update lead ${leadId} → "${status}"`, demoDetails ?? '')
      return
    }
    await fetch(`${BASE_URL}/task/${leadId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    })
    if (demoDetails) {
      await setCustomFields(leadId, process.env.CLICKUP_LIST_LEADS!, {
        'Demo Date': demoDetails.demoDate,
        'Demo Time': demoDetails.demoTime,
        'Meet Link': demoDetails.meetLink,
      })
    }
  }

  static async updateStudentPaymentLink(
    studentId: string,
    paymentLink: string,
    invoiceId: string
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP MOCK] Would update student ${studentId} with payment link`, { paymentLink, invoiceId })
      return
    }
    await setCustomFields(studentId, process.env.CLICKUP_LIST_STUDENTS!, {
      'Payment Link': paymentLink,
      'Invoice ID': invoiceId,
    })
  }

  static async enrollStudent(
    studentId: string,
    data: { status: string; paymentId: string; paidAt: string; enrollmentDate: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP ENROLLED] { studentId: ${studentId}, enrollmentDate: ${data.enrollmentDate} }`)
      return
    }
    await fetch(`${BASE_URL}/task/${studentId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: data.status }),
    })
    await setCustomFields(studentId, process.env.CLICKUP_LIST_STUDENTS!, {
      'Payment Status': 'paid',
      'Razorpay Payment ID': data.paymentId,
      'Paid Date': data.paidAt,
      'Enrolled Date': data.enrollmentDate,
    })
  }

  static async markStudentPaidManually(
    studentId: string,
    data: { paidAt: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP MOCK] markStudentPaidManually`, { studentId, ...data })
      return
    }
    await setCustomFields(studentId, process.env.CLICKUP_LIST_STUDENTS!, {
      'Payment Status': 'paid',
      'Paid Date': data.paidAt,
    })
  }

  static async markStudentUnpaid(studentId: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP MOCK] markStudentUnpaid`, { studentId })
      return
    }
    await setCustomFields(studentId, process.env.CLICKUP_LIST_STUDENTS!, {
      'Payment Status': 'pending',
    })
  }

  static async markReminderSent(
    paymentId: string,
    data: { reminderSentAt: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP MOCK] markReminderSent`, { paymentId, ...data })
      return
    }
    await setCustomFields(paymentId, process.env.CLICKUP_LIST_PAYMENTS!, {
      'Reminder Sent At': data.reminderSentAt,
    })
  }

  static async markPaymentOverdue(paymentId: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[CLICKUP MOCK] markPaymentOverdue`, { paymentId })
      return
    }
    await setCustomFields(paymentId, process.env.CLICKUP_LIST_PAYMENTS!, {
      'Payment Status': 'overdue',
    })
  }

  static async createStudent(data: {
    name: string
    email: string
    phone: string
    classesPerWeek: number
    duration: string
    monthlyFee: number
    grade?: string
  }): Promise<Student> {
    const enrolledDate = new Date().toISOString().split('T')[0]

    if (!this.isConfigured()) {
      const student: Student = {
        id: `st-mock-${Date.now()}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        classesPerWeek: data.classesPerWeek,
        duration: data.duration,
        monthlyFee: data.monthlyFee,
        paymentStatus: 'pending',
        enrolledDate,
        grade: data.grade,
      }
      MOCK_STUDENTS.push(student)
      console.log(`[CLICKUP MOCK] Created student`, student)
      return student
    }

    const listId = process.env.CLICKUP_LIST_STUDENTS!
    const fieldIds = await getFieldIds(listId)
    const field = (name: string, value: string) =>
      fieldIds[name] ? [{ id: fieldIds[name], value }] : []

    const res = await fetch(`${BASE_URL}/list/${listId}/task`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: data.name,
        custom_fields: [
          ...field('Email', data.email),
          ...field('Phone', data.phone),
          ...field('Classes Per Week', String(data.classesPerWeek)),
          ...field('Duration', data.duration),
          ...field('Monthly Fee', String(data.monthlyFee)),
          ...field('Payment Status', 'pending'),
          ...field('Enrolled Date', enrolledDate),
          ...field('Grade', data.grade ?? ''),
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`ClickUp create task failed: ${res.status} ${errText}`)
    }

    const task = await res.json() as Record<string, unknown>
    return mapTaskToStudent(task)
  }

  static async createLead(data: {
    name: string
    email: string
    phone: string
    source: string
    notes?: string
  }): Promise<Lead> {
    const dateReceived = new Date().toISOString().split('T')[0]

    if (!this.isConfigured()) {
      const lead: Lead = {
        id: `ld-mock-${Date.now()}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        source: data.source as Lead['source'],
        status: 'new',
        dateReceived,
        notes: data.notes,
      }
      MOCK_LEADS.push(lead)
      console.log(`[CLICKUP MOCK] Created lead`, lead)
      return lead
    }

    const listId = process.env.CLICKUP_LIST_LEADS!
    const fieldIds = await getFieldIds(listId)
    const field = (name: string, value: string) =>
      fieldIds[name] ? [{ id: fieldIds[name], value }] : []

    const res = await fetch(`${BASE_URL}/list/${listId}/task`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: data.name,
        custom_fields: [
          ...field('Email', data.email),
          ...field('Phone', data.phone),
          ...field('Source', data.source),
          ...field('Status', 'new'),
          ...field('Date Received', dateReceived),
          ...field('Notes', data.notes ?? ''),
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`ClickUp create task failed: ${res.status} ${errText}`)
    }

    const task = await res.json() as Record<string, unknown>
    return mapTaskToLead(task)
  }

  static async getStats(): Promise<DashboardStats> {
    const [students, leads, payments] = await Promise.all([
      this.getStudents(),
      this.getLeads(),
      this.getPayments(),
    ])

    const now = new Date()
    const monthlyRevenue = payments
      .filter((p) => p.status === 'paid' && p.paidDate)
      .filter((p) => {
        const d = new Date(p.paidDate!)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, p) => sum + p.amountPaid, 0)

    const leadsThisMonth = leads.filter((l) => {
      const d = new Date(l.dateReceived)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    return {
      totalLeads: leads.length,
      activeStudents: students.length,
      monthlyRevenue,
      overduePayments: payments.filter((p) => p.status === 'overdue').length,
      leadsThisMonth,
      studentsChange: 2,
    }
  }
}
