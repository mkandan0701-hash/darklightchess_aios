import type { Student, Lead, Payment, DashboardStats } from './types'

const BASE_URL = 'https://api.airtable.com/v0'

const TABLES = {
  students: 'Students',
  leads: 'Leads',
  payments: 'Payments',
} as const

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY ?? ''}`,
    'Content-Type': 'application/json',
  }
}

function tableUrl(table: string, path = ''): string {
  return `${BASE_URL}/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}${path}`
}

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

// singleSelect fields come back as { id, name, color } instead of a plain string.
function selectName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).name)
  }
  return typeof value === 'string' ? value : ''
}

async function patchRecord(table: string, recordId: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(tableUrl(table, `/${recordId}`), {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error(`[AIRTABLE] Failed to update ${table} record ${recordId}: ${res.status} ${errText}`)
  }
}

async function createRecord(table: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
  const res = await fetch(tableUrl(table), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Airtable create record in ${table} failed: ${res.status} ${errText}`)
  }
  return (await res.json()) as AirtableRecord
}

// --- Mock Data (used when Airtable env vars are not configured, e.g. local dev/preview) ---

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
]

// --- Airtable record mappers ---
// Base schema (Students/Leads/Payments tables) uses snake_case field names that predate
// this client; classesPerWeek/duration/grade/paymentLink/invoiceId on Students, studentId/
// amountPaid/reminderSentAt on Payments, and demoDate/demoTime/meetLink on Leads were added
// to the base to match the shape the rest of the app already expects from lib/types.ts.

function mapRecordToStudent(record: AirtableRecord): Student {
  const f = record.fields
  return {
    id: record.id,
    name: (f.name as string) ?? '',
    email: (f.email as string) ?? '',
    phone: (f.phone as string) ?? '',
    classesPerWeek: Number(f.classes_per_week) || 0,
    duration: (f.duration as string) ?? '',
    monthlyFee: Number(f.amount_due) || 0,
    paymentStatus: (selectName(f.payment_status) || 'pending') as Student['paymentStatus'],
    enrolledDate: (f.created_at as string) ?? '',
    grade: (f.grade as string) || undefined,
  }
}

function mapRecordToLead(record: AirtableRecord): Lead {
  const f = record.fields
  return {
    id: record.id,
    name: (f.name as string) ?? '',
    email: (f.email as string) ?? '',
    phone: (f.phone as string) ?? '',
    source: ((f.source as string) || 'other') as Lead['source'],
    status: (selectName(f.status) || 'new') as Lead['status'],
    dateReceived: (f.created_at as string) ?? '',
    notes: (f.notes as string) || undefined,
  }
}

function mapRecordToPayment(record: AirtableRecord): Payment {
  const f = record.fields
  return {
    id: record.id,
    studentId: (f.student_id as string) ?? '',
    studentName: (f.student_name as string) ?? '',
    amountDue: Number(f.amount) || 0,
    amountPaid: Number(f.amount_paid) || 0,
    dueDate: (f.due_date as string) ?? '',
    paidDate: (f.paid_date as string) || undefined,
    status: (selectName(f.status) || 'pending') as Payment['status'],
    razorpayPaymentId: (f.payment_id as string) || undefined,
  }
}

// --- Airtable API Client ---

export class AirtableClient {
  static isConfigured(): boolean {
    return !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID)
  }

  private static async list<T>(
    table: string,
    mapper: (r: AirtableRecord) => T,
    mock: T[]
  ): Promise<T[]> {
    if (!this.isConfigured()) return mock

    const res = await fetch(tableUrl(table), { headers: getHeaders(), cache: 'no-store' })

    if (res.status === 401 || res.status === 403) {
      console.error(`[AIRTABLE] Auth error listing ${table}: ${res.status}`)
      return []
    }
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Airtable list ${table} failed: ${res.status} ${errText}`)
    }

    const data = (await res.json()) as { records: AirtableRecord[] }
    return data.records.map(mapper)
  }

  static async getStudents(): Promise<Student[]> {
    return this.list(TABLES.students, mapRecordToStudent, MOCK_STUDENTS)
  }

  static async getLeads(): Promise<Lead[]> {
    return this.list(TABLES.leads, mapRecordToLead, MOCK_LEADS)
  }

  static async getPayments(): Promise<Payment[]> {
    return this.list(TABLES.payments, mapRecordToPayment, MOCK_PAYMENTS)
  }

  static async updateLeadStatus(
    leadId: string,
    status: string,
    demoDetails?: { demoDate: string; demoTime: string; meetLink: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE MOCK] Would update lead ${leadId} → "${status}"`, demoDetails ?? '')
      return
    }
    const fields: Record<string, unknown> = { status }
    if (demoDetails) {
      fields.demo_date = demoDetails.demoDate
      fields.demo_time = demoDetails.demoTime
      fields.meet_link = demoDetails.meetLink
    }
    await patchRecord(TABLES.leads, leadId, fields)
  }

  static async updateStudentPaymentLink(
    studentId: string,
    paymentLink: string,
    invoiceId: string
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE MOCK] Would update student ${studentId} with payment link`, { paymentLink, invoiceId })
      return
    }
    await patchRecord(TABLES.students, studentId, {
      payment_link: paymentLink,
      invoice_id: invoiceId,
    })
  }

  static async enrollStudent(
    studentId: string,
    data: { status: string; paymentId: string; paidAt: string; enrollmentDate: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE ENROLLED] { studentId: ${studentId}, enrollmentDate: ${data.enrollmentDate} }`)
      return
    }
    await patchRecord(TABLES.students, studentId, {
      payment_status: 'paid',
      status: data.status,
      created_at: data.enrollmentDate,
    })
  }

  static async markStudentPaidManually(
    studentId: string,
    data: { paidAt: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markStudentPaidManually`, { studentId, ...data })
      return
    }
    await patchRecord(TABLES.students, studentId, { payment_status: 'paid' })
  }

  static async markStudentUnpaid(studentId: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markStudentUnpaid`, { studentId })
      return
    }
    await patchRecord(TABLES.students, studentId, { payment_status: 'pending' })
  }

  static async markReminderSent(
    paymentId: string,
    data: { reminderSentAt: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markReminderSent`, { paymentId, ...data })
      return
    }
    await patchRecord(TABLES.payments, paymentId, { reminder_sent_at: data.reminderSentAt })
  }

  static async markPaymentOverdue(paymentId: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markPaymentOverdue`, { paymentId })
      return
    }
    await patchRecord(TABLES.payments, paymentId, { status: 'overdue' })
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
      console.log(`[AIRTABLE MOCK] Created student`, student)
      return student
    }

    const record = await createRecord(TABLES.students, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      classes_per_week: data.classesPerWeek,
      duration: data.duration,
      amount_due: data.monthlyFee,
      payment_status: 'pending',
      created_at: enrolledDate,
      grade: data.grade ?? '',
    })

    return mapRecordToStudent(record)
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
      console.log(`[AIRTABLE MOCK] Created lead`, lead)
      return lead
    }

    const record = await createRecord(TABLES.leads, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: data.source,
      status: 'new',
      created_at: dateReceived,
      notes: data.notes ?? '',
    })

    return mapRecordToLead(record)
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
