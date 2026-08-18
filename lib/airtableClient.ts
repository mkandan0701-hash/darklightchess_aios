import type { BranchStats, DashboardStats, DashboardStatsResponse, Lead, Payment, Student } from './types'
import type { Scope } from './auth/types'
import { canAccessBranch, systemScope } from './auth/rbac'
import { ALL_BRANCHES } from './auth/cookies'
import { branchName, isValidBranchId } from './branches'

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

/** Thrown when a caller aims a mutation at a record outside its branch. */
export class ScopeError extends Error {
  constructor(public readonly reason: 'not_found' | 'forbidden' | 'lookup_failed') {
    super(`Record is not accessible in this scope: ${reason}`)
    this.name = 'ScopeError'
  }
}

// singleSelect fields come back as { id, name, color } instead of a plain string.
function selectName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).name)
  }
  return typeof value === 'string' ? value : ''
}

function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Builds the branch filter for a scope, or null for "no filter" (superadmin / system).
 *
 * Throws rather than returning null on an unrecognised id, deliberately: a silently-dropped
 * filter is an unscoped read, which looks exactly like success. Values here are opaque ids we
 * generate and `isValidBranchId` whitelists them; the escaping is a second layer, not the
 * first. Never interpolate user text into a formula.
 */
function branchFormula(scope: Scope): string | null {
  if (scope.branches === ALL_BRANCHES) return null

  for (const branch of scope.branches) {
    if (!isValidBranchId(branch)) {
      throw new Error(`Refusing to build an Airtable filter for unknown branch "${branch}"`)
    }
  }

  const terms = scope.branches.map((b) => `{branch}='${escapeFormulaString(b)}'`)
  if (scope.includeUnassigned) terms.push(`{branch}=''`)
  return terms.length === 1 ? terms[0] : `OR(${terms.join(',')})`
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

// --- Airtable record mappers ---
// Base schema (Students/Leads/Payments tables) uses snake_case field names that predate
// this client; classesPerWeek/duration/grade/paymentLink/invoiceId on Students, studentId/
// amountPaid/reminderSentAt on Payments, and demoDate/demoTime/meetLink on Leads were added
// to the base to match the shape the rest of the app already expects from lib/types.ts.
//
// `branch` is a singleSelect, so it must go through selectName().

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
    branch: selectName(f.branch) || undefined,
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
    branch: selectName(f.branch) || undefined,
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
    branch: selectName(f.branch) || undefined,
  }
}

function emptyStats(): DashboardStats {
  return { totalLeads: 0, activeStudents: 0, monthlyRevenue: 0, overduePayments: 0, leadsThisMonth: 0 }
}

function computeStats(students: Student[], leads: Lead[], payments: Payment[]): DashboardStats {
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
  }
}

// --- Airtable API Client ---
//
// The single choke point for every read and write. Deliberately has no unscoped static read
// methods: to get data out you must hand it a Scope, so `tsc --noEmit` enumerates any call
// site that forgot to. See skill.md "Pattern B".

export class AirtableClient {
  private constructor(private readonly scope: Scope) {}

  /** Build a client for a signed-in user. Normal path — use this from route handlers. */
  static forScope(scope: Scope): AirtableClient {
    return new AirtableClient(scope)
  }

  /**
   * Cron jobs and inbound webhooks only. Bypasses branch filtering by design — they have no
   * user session. Named rather than implicit so it greps.
   */
  static system(): AirtableClient {
    return new AirtableClient(systemScope())
  }

  static isConfigured(): boolean {
    return !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID)
  }

  private async list<T>(table: string, mapper: (r: AirtableRecord) => T): Promise<T[]> {
    if (!AirtableClient.isConfigured()) return []

    const formula = branchFormula(this.scope)
    const out: T[] = []
    let offset: string | undefined

    // Airtable caps a page at 100 records. This used to ignore `offset` and truncate
    // silently; with a per-branch filter on top, each branch would truncate independently.
    do {
      const url = new URL(tableUrl(table))
      url.searchParams.set('pageSize', '100')
      if (formula) url.searchParams.set('filterByFormula', formula)
      if (offset) url.searchParams.set('offset', offset)

      const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' })

      if (res.status === 401 || res.status === 403) {
        console.error(`[AIRTABLE] Auth error listing ${table}: ${res.status}`)
        return []
      }
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Airtable list ${table} failed: ${res.status} ${errText}`)
      }

      const data = (await res.json()) as { records: AirtableRecord[]; offset?: string }
      out.push(...data.records.map(mapper))
      offset = data.offset
    } while (offset)

    return out
  }

  /**
   * Ownership check for the write path. Read scoping stops a caller listing another branch's
   * records; it does nothing about a mutation carrying a record id in its body.
   *
   * Runs BEFORE patchRecord, never inside it — patchRecord logs and returns void on a non-OK
   * response, so a check placed within it would fail open.
   */
  private async assertInScope(table: string, recordId: string): Promise<void> {
    if (this.scope.branches === ALL_BRANCHES) return
    if (!AirtableClient.isConfigured()) return

    const res = await fetch(tableUrl(table, `/${encodeURIComponent(recordId)}`), {
      headers: getHeaders(),
      cache: 'no-store',
    })

    if (res.status === 404) throw new ScopeError('not_found')
    if (!res.ok) {
      console.error(`[AIRTABLE] Scope lookup failed for ${table}/${recordId}: ${res.status}`)
      throw new ScopeError('lookup_failed')
    }

    const record = (await res.json()) as AirtableRecord
    if (!canAccessBranch(this.scope, selectName(record.fields.branch))) {
      console.warn('[RBAC DENY]', { table, recordId, scope: this.scope.branches })
      // Surfaced to the client as 404, not 403: a 403 confirms the record exists and turns
      // the endpoint into an id oracle.
      throw new ScopeError('forbidden')
    }
  }

  // --- Reads ---

  async getStudents(): Promise<Student[]> {
    return this.list(TABLES.students, mapRecordToStudent)
  }

  async getLeads(): Promise<Lead[]> {
    return this.list(TABLES.leads, mapRecordToLead)
  }

  async getPayments(): Promise<Payment[]> {
    return this.list(TABLES.payments, mapRecordToPayment)
  }

  async getStats(): Promise<DashboardStatsResponse> {
    const [students, leads, payments] = await Promise.all([
      this.getStudents(),
      this.getLeads(),
      this.getPayments(),
    ])

    const totals = computeStats(students, leads, payments)
    if (this.scope.branches !== ALL_BRANCHES) return totals

    // All-branches mode: one unscoped fetch, then group in memory. The dataset is small
    // enough that a per-branch fan-out isn't worth 3x the Airtable calls.
    const seen = new Set<string>()
    for (const record of [...students, ...leads, ...payments]) {
      seen.add(record.branch ?? '')
    }

    const byBranch: BranchStats[] = [...seen]
      .sort()
      .map((branch) => ({
        branch,
        branchName: branchName(branch),
        ...computeStats(
          students.filter((s) => (s.branch ?? '') === branch),
          leads.filter((l) => (l.branch ?? '') === branch),
          payments.filter((p) => (p.branch ?? '') === branch)
        ),
      }))

    return { ...totals, byBranch }
  }

  // --- Writes ---

  async updateLeadStatus(
    leadId: string,
    status: string,
    demoDetails?: { demoDate: string; demoTime: string; meetLink: string }
  ): Promise<void> {
    await this.assertInScope(TABLES.leads, leadId)
    if (!AirtableClient.isConfigured()) {
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

  async updateStudentPaymentLink(studentId: string, paymentLink: string, invoiceId: string): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] Would update student ${studentId} with payment link`, { paymentLink, invoiceId })
      return
    }
    await patchRecord(TABLES.students, studentId, {
      payment_link: paymentLink,
      invoice_id: invoiceId,
    })
  }

  async enrollStudent(
    studentId: string,
    data: { status: string; paymentId: string; paidAt: string; enrollmentDate: string }
  ): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE ENROLLED] { studentId: ${studentId}, enrollmentDate: ${data.enrollmentDate} }`)
      return
    }
    await patchRecord(TABLES.students, studentId, {
      payment_status: 'paid',
      status: data.status,
      created_at: data.enrollmentDate,
    })
  }

  async markStudentPaidManually(studentId: string, data: { paidAt: string }): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markStudentPaidManually`, { studentId, ...data })
      return
    }
    await patchRecord(TABLES.students, studentId, { payment_status: 'paid' })
  }

  async markStudentUnpaid(studentId: string): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markStudentUnpaid`, { studentId })
      return
    }
    await patchRecord(TABLES.students, studentId, { payment_status: 'pending' })
  }

  async markReminderSent(paymentId: string, data: { reminderSentAt: string }): Promise<void> {
    await this.assertInScope(TABLES.payments, paymentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markReminderSent`, { paymentId, ...data })
      return
    }
    await patchRecord(TABLES.payments, paymentId, { reminder_sent_at: data.reminderSentAt })
  }

  async markPaymentOverdue(paymentId: string): Promise<void> {
    await this.assertInScope(TABLES.payments, paymentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markPaymentOverdue`, { paymentId })
      return
    }
    await patchRecord(TABLES.payments, paymentId, { status: 'overdue' })
  }

  async createStudent(data: {
    name: string
    email: string
    phone: string
    classesPerWeek: number
    duration: string
    monthlyFee: number
    grade?: string
    branch: string
  }): Promise<Student> {
    const enrolledDate = new Date().toISOString().split('T')[0]

    if (!isValidBranchId(data.branch)) {
      throw new Error(`Refusing to create a student in unknown branch "${data.branch}"`)
    }

    if (!AirtableClient.isConfigured()) {
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
        branch: data.branch,
      }
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
      branch: data.branch,
    })

    return mapRecordToStudent(record)
  }

  async createLead(data: {
    name: string
    email: string
    phone: string
    source: string
    notes?: string
    branch: string
  }): Promise<Lead> {
    const dateReceived = new Date().toISOString().split('T')[0]

    if (!isValidBranchId(data.branch)) {
      throw new Error(`Refusing to create a lead in unknown branch "${data.branch}"`)
    }

    if (!AirtableClient.isConfigured()) {
      const lead: Lead = {
        id: `ld-mock-${Date.now()}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        source: data.source as Lead['source'],
        status: 'new',
        dateReceived,
        notes: data.notes,
        branch: data.branch,
      }
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
      branch: data.branch,
    })

    return mapRecordToLead(record)
  }

  /**
   * Explicit scope gate for routes with side effects that happen *before* the mutation —
   * sending an email, say. Without it, an out-of-scope record id would still trigger the
   * side effect on its way to the 404.
   */
  async assertAccessible(table: 'students' | 'leads' | 'payments', recordId: string): Promise<void> {
    await this.assertInScope(TABLES[table], recordId)
  }

  /** Reads a single record's branch, for routes that must propagate it (e.g. lead → student). */
  async getRecordBranch(table: 'students' | 'leads' | 'payments', recordId: string): Promise<string> {
    await this.assertInScope(TABLES[table], recordId)
    if (!AirtableClient.isConfigured()) return ''

    const res = await fetch(tableUrl(TABLES[table], `/${encodeURIComponent(recordId)}`), {
      headers: getHeaders(),
      cache: 'no-store',
    })
    if (res.status === 404) throw new ScopeError('not_found')
    if (!res.ok) throw new ScopeError('lookup_failed')

    const record = (await res.json()) as AirtableRecord
    return selectName(record.fields.branch)
  }
}

export { emptyStats }
