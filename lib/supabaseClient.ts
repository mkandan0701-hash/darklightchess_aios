import type { BranchStats, DashboardStats, DashboardStatsResponse, Expense, Lead, Payment, Student } from './types'
import type { Scope } from './auth/types'
import { canAccessBranch, systemScope } from './auth/rbac'
import { ALL_BRANCHES } from './auth/cookies'
import { branchName, isValidBranchId } from './branches'
import { isValidBatchId } from './batches'
import { compareLeadsByDate, monthKey } from './utils'

// Supabase's REST API (PostgREST) over raw fetch, authenticated with the server-only secret key.
// That key bypasses row-level security, so branch isolation is enforced entirely in this file.
// Never import it from a client component or expose either variable as NEXT_PUBLIC_.

type Table = 'students' | 'leads' | 'payments' | 'expenses'
type Row = Record<string, unknown> & { id: string }
/** PostgREST filters as [column, "operator.value"] pairs. URLSearchParams does the encoding. */
type Filters = [string, string][]

const PAGE_SIZE = 1000
/** Ids per `in.(…)` filter, to keep URLs short. */
const ID_CHUNK = 100

/** Thrown when a caller aims a mutation at a record outside its branch. */
export class ScopeError extends Error {
  constructor(public readonly reason: 'not_found' | 'forbidden') {
    super(`Record is not accessible in this scope: ${reason}`)
    this.name = 'ScopeError'
  }
}

/** Not configured, unreachable (a paused project included), rate limited or 5xx. Reported as 503. */
export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseUnavailableError'
  }
}

// --- Requests. Every one throws on failure: a swallowed read can look like "no dues yet". ---

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  table: Table,
  params: Filters,
  opts: { body?: unknown; prefer?: string } = {}
): Promise<{ rows: Row[]; total: number | null }> {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!base || !key) throw new DatabaseUnavailableError('SUPABASE_URL / SUPABASE_SECRET_KEY are not set')

  const url = new URL(`/rest/v1/${table}`, base)
  for (const [k, v] of params) url.searchParams.append(k, v)

  let res: Response
  let text: string
  try {
    res = await fetch(url, {
      method,
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        ...(opts.prefer ? { Prefer: opts.prefer } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
    })
    text = await res.text()
  } catch (err) {
    throw new DatabaseUnavailableError(`Supabase ${method} ${table} unreachable: ${String(err)}`)
  }

  if (!res.ok) {
    const message = `Supabase ${method} ${table} failed: ${res.status} ${text.slice(0, 500)}`
    if (res.status === 429 || res.status >= 500) throw new DatabaseUnavailableError(message)
    throw new Error(message)
  }

  const total = Number(res.headers.get('content-range')?.split('/')[1])
  return { rows: text ? (JSON.parse(text) as Row[]) : [], total: Number.isFinite(total) ? total : null }
}

/** Reads every match. The server may return fewer rows than asked for, so the count decides. */
async function selectAll(table: Table, filters: Filters): Promise<Row[]> {
  const out: Row[] = []
  for (;;) {
    const { rows, total } = await request(
      'GET',
      table,
      [...filters, ['order', 'id'], ['limit', String(PAGE_SIZE)], ['offset', String(out.length)]],
      { prefer: 'count=exact' }
    )
    out.push(...rows)
    if (total === null) throw new Error(`Supabase GET ${table} returned no row count`)
    if (out.length >= total) return out
    if (rows.length === 0) throw new Error(`Supabase GET ${table} returned ${out.length} of ${total} rows`)
  }
}

async function selectById(table: Table, id: string): Promise<Row | null> {
  const { rows } = await request('GET', table, [['id', `eq.${id}`]])
  return rows[0] ?? null
}

async function insertRows(table: Table, values: Record<string, unknown>[]): Promise<Row[]> {
  if (values.length === 0) return []
  const { rows } = await request('POST', table, [], { body: values, prefer: 'return=representation' })
  return rows
}

async function updateById(table: Table, id: string, fields: Record<string, unknown>): Promise<void> {
  const { rows } = await request('PATCH', table, [['id', `eq.${id}`]], {
    body: fields,
    prefer: 'return=representation',
  })
  if (rows.length === 0) throw new ScopeError('not_found')
}

async function updateByIds(table: Table, ids: string[], fields: Record<string, unknown>): Promise<void> {
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    await request('PATCH', table, [['id', inList(ids.slice(i, i + ID_CHUNK))]], {
      body: fields,
      prefer: 'return=minimal',
    })
  }
}

async function deleteById(table: Table, id: string): Promise<void> {
  const { rows } = await request('DELETE', table, [['id', `eq.${id}`]], { prefer: 'return=representation' })
  if (rows.length === 0) throw new ScopeError('not_found')
}

/** `in.("a","b")` — every value quoted and escaped. */
function inList(values: readonly string[]): string {
  return `in.(${values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`
}

/**
 * The branch filter for a scope; empty means "no filter" (superadmin / system) only.
 *
 * Throws on an unrecognised or empty branch list: a silently-dropped filter is an unscoped read,
 * which looks exactly like success.
 */
function branchFilters(scope: Scope): Filters {
  if (scope.branches === ALL_BRANCHES) return []
  if (scope.branches.length === 0) throw new Error('Refusing to read with an empty branch scope')

  for (const branch of scope.branches) {
    if (!isValidBranchId(branch)) throw new Error(`Refusing to build a filter for unknown branch "${branch}"`)
  }

  const inBranches = inList(scope.branches)
  return scope.includeUnassigned ? [['or', `(branch.${inBranches},branch.is.null)`]] : [['branch', inBranches]]
}

// --- Row mappers ---

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const opt = (v: unknown): string | undefined => str(v) || undefined

function mapStudent(r: Row): Student {
  return {
    id: r.id,
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    classesPerWeek: Number(r.classes_per_week) || 0,
    duration: str(r.duration),
    monthlyFee: Number(r.amount_due) || 0,
    paymentStatus: (str(r.payment_status) || 'pending') as Student['paymentStatus'],
    enrolledDate: str(r.created_at),
    grade: opt(r.grade),
    batchId: opt(r.batch_timing),
    branch: opt(r.branch),
    online: r.online === true,
    pausedMonth: opt(r.paused_month),
  }
}

function mapLead(r: Row): Lead {
  return {
    id: r.id,
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    source: (str(r.source) || 'other') as Lead['source'],
    status: (str(r.status) || 'new') as Lead['status'],
    dateReceived: str(r.created_at),
    notes: opt(r.notes),
    branch: opt(r.branch),
    online: r.online === true,
    createdAt: opt(r.created_time),
  }
}

function mapPayment(r: Row): Payment {
  return {
    id: r.id,
    studentId: str(r.student_id),
    studentName: str(r.student_name),
    amountDue: Number(r.amount) || 0,
    amountPaid: Number(r.amount_paid) || 0,
    dueDate: str(r.due_date),
    paidDate: opt(r.paid_date),
    status: (str(r.status) || 'pending') as Payment['status'],
    razorpayPaymentId: opt(r.payment_id),
    branch: opt(r.branch),
  }
}

function mapExpense(r: Row): Expense {
  return {
    id: r.id,
    description: str(r.description),
    amount: Number(r.amount) || 0,
    category: str(r.category) || 'Other',
    date: str(r.date),
    branch: opt(r.branch),
  }
}

// Of several Payment rows for one student, the one due in the same calendar month (UTC, like the
// monthly cron) as `refIso`; failing that, the most recently due. Null when there are none.
function pickCurrentMonthDue(rows: Row[], refIso: string): Row | null {
  if (rows.length === 0) return null
  const month = refIso.slice(0, 7)
  return (
    rows.find((r) => str(r.due_date).startsWith(month)) ??
    [...rows].sort((a, b) => str(b.due_date).localeCompare(str(a.due_date)))[0]
  )
}

/** First day of the month after a "YYYY-MM". */
function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
}

function computeStats(students: Student[], leads: Lead[], payments: Payment[], expenses: Expense[]): DashboardStats {
  const now = new Date()
  const inCurrentMonth = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  // Expected recurring revenue: every enrolled student's monthly fee, regardless of whether
  // they've paid yet. Students paused for this month are left out: no due is raised for them.
  // They stay in activeStudents — a pause is a break, not an un-enrolment.
  const pausedThisMonth = monthKey(now)
  const billable = students.filter((s) => s.pausedMonth !== pausedThisMonth)
  const sumFees = (list: Student[]) => list.reduce((sum, s) => sum + s.monthlyFee, 0)
  const monthlyRevenueOnline = sumFees(billable.filter((s) => s.online))
  const monthlyRevenueOffline = sumFees(billable.filter((s) => !s.online))
  const monthlyRevenue = monthlyRevenueOnline + monthlyRevenueOffline

  // payment_status is set back to `pending` by the monthly cron, so `paid` means paid this month.
  const monthlyCollected = sumFees(billable.filter((s) => s.paymentStatus === 'paid'))
  const paused = students.filter((s) => s.pausedMonth === pausedThisMonth)

  const monthlyExpenses = expenses
    .filter((e) => e.date && inCurrentMonth(e.date))
    .reduce((sum, e) => sum + e.amount, 0)

  return {
    totalLeads: leads.length,
    activeStudents: students.length,
    monthlyRevenue,
    monthlyCollected,
    monthlyPending: monthlyRevenue - monthlyCollected,
    pausedStudents: paused.length,
    pausedFees: sumFees(paused),
    monthlyRevenueOnline,
    monthlyRevenueOffline,
    activeStudentsOnline: students.filter((s) => s.online).length,
    activeStudentsOffline: students.filter((s) => !s.online).length,
    monthlyExpenses,
    netProfit: monthlyRevenue - monthlyExpenses,
    overduePayments: payments.filter((p) => p.status === 'overdue').length,
    leadsThisMonth: leads.filter((l) => inCurrentMonth(l.dateReceived)).length,
  }
}

/**
 * The single choke point for every read and write. Deliberately has no unscoped static read
 * methods: to get data out you must hand it a Scope, so `tsc --noEmit` enumerates any call
 * site that forgot to.
 */
export class Database {
  private constructor(private readonly scope: Scope) {}

  /** Build a client for a signed-in user. Normal path — use this from route handlers. */
  static forScope(scope: Scope): Database {
    return new Database(scope)
  }

  /** Cron jobs and inbound webhooks only: no user session, so no branch filter. */
  static system(): Database {
    return new Database(systemScope())
  }

  static isConfigured(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
  }

  /** Every list read. `extra` narrows further and is always ANDed with the scope filter. */
  private async list<T>(table: Table, mapper: (r: Row) => T, extra: Filters = []): Promise<T[]> {
    return (await selectAll(table, [...branchFilters(this.scope), ...extra])).map(mapper)
  }

  /**
   * Raw rows for find-before-write. `applyScope: false` only when assertInScope has authorized the
   * target and this cascades to *its* dependents — a superadmin's dl_branch cookie is a view
   * preference and must not hide some of that record's rows.
   */
  private async findMany(table: Table, extra: Filters, applyScope = true): Promise<Row[]> {
    return selectAll(table, [...(applyScope ? branchFilters(this.scope) : []), ...extra])
  }

  /**
   * Ownership check for the write path, run BEFORE the write. Returns the row it fetched, or null
   * for an all-branches scope (nothing to check; the write itself 404s on a missing row).
   */
  private async assertInScope(table: Table, recordId: string): Promise<Row | null> {
    if (this.scope.branches === ALL_BRANCHES) return null

    const row = await selectById(table, recordId)
    if (!row) throw new ScopeError('not_found')
    if (!canAccessBranch(this.scope, str(row.branch))) {
      console.warn('[RBAC DENY]', { table, recordId, scope: this.scope.branches })
      // Surfaced as 404, not 403: a 403 confirms the record exists.
      throw new ScopeError('forbidden')
    }
    return row
  }

  // --- Reads ---

  async getStudents(): Promise<Student[]> {
    return this.list('students', mapStudent)
  }

  async getLeads(): Promise<Lead[]> {
    return (await this.list('leads', mapLead)).sort(compareLeadsByDate)
  }

  async getPayments(): Promise<Payment[]> {
    return this.list('payments', mapPayment)
  }

  async getExpenses(): Promise<Expense[]> {
    return this.list('expenses', mapExpense)
  }

  async getStats(): Promise<DashboardStatsResponse> {
    // computeStats only uses Payments for the overdue count, so only overdue rows are read.
    const [students, leads, payments, expenses] = await Promise.all([
      this.getStudents(),
      this.getLeads(),
      this.list('payments', mapPayment, [['status', 'eq.overdue']]),
      this.getExpenses(),
    ])

    const totals = computeStats(students, leads, payments, expenses)
    if (this.scope.branches !== ALL_BRANCHES) return totals

    const seen = new Set<string>()
    for (const record of [...students, ...leads, ...payments, ...expenses]) seen.add(record.branch ?? '')

    const byBranch: BranchStats[] = [...seen].sort().map((branch) => {
      const mine = (r: { branch?: string }) => (r.branch ?? '') === branch
      return {
        branch,
        branchName: branchName(branch),
        ...computeStats(students.filter(mine), leads.filter(mine), payments.filter(mine), expenses.filter(mine)),
      }
    })

    return { ...totals, byBranch }
  }

  // --- Writes ---

  async updateLeadStatus(
    leadId: string,
    status: string,
    demoDetails?: { demoDate: string; demoTime: string; meetLink: string }
  ): Promise<void> {
    await this.assertInScope('leads', leadId)
    const fields: Record<string, unknown> = { status }
    if (demoDetails) {
      fields.demo_date = demoDetails.demoDate || null
      fields.demo_time = demoDetails.demoTime
      fields.meet_link = demoDetails.meetLink
    }
    await updateById('leads', leadId, fields)
  }

  async updateStudentPaymentLink(studentId: string, paymentLink: string, invoiceId: string): Promise<void> {
    await this.assertInScope('students', studentId)
    await updateById('students', studentId, { payment_link: paymentLink, invoice_id: invoiceId })
  }

  async enrollStudent(
    studentId: string,
    data: {
      status: string
      paymentId: string
      paidAt: string
      enrollmentDate: string
      amount: number
      studentName: string
    }
  ): Promise<void> {
    await this.assertInScope('students', studentId)
    await updateById('students', studentId, {
      payment_status: 'paid',
      status: data.status,
      created_at: data.enrollmentDate.slice(0, 10),
    })
    await this.recordPayment(studentId, {
      amount: data.amount,
      studentName: data.studentName,
      paidAt: data.paidAt,
      razorpayPaymentId: data.paymentId,
    })
  }

  /** Find-or-create the Payments row for a student and mark it paid. */
  private async recordPayment(
    studentId: string,
    data: { amount: number; studentName: string; paidAt: string; razorpayPaymentId?: string }
  ): Promise<void> {
    // Arrears stack, so a student can have several unpaid dues. Settle this month's.
    const existing = pickCurrentMonthDue(
      await this.findMany('payments', [
        ['student_id', `eq.${studentId}`],
        ['status', 'neq.paid'],
      ]),
      data.paidAt
    )
    const fields: Record<string, unknown> = {
      status: 'paid',
      amount_paid: data.amount,
      paid_date: data.paidAt.slice(0, 10),
    }
    if (data.razorpayPaymentId) fields.payment_id = data.razorpayPaymentId

    if (existing) {
      await updateById('payments', existing.id, fields)
      return
    }

    const branch = await this.getRecordBranch('students', studentId)
    await insertRows('payments', [
      {
        student_id: studentId,
        student_name: data.studentName,
        amount: data.amount,
        due_date: data.paidAt.slice(0, 10),
        branch: branch || null,
        ...fields,
      },
    ])
  }

  async markStudentPaidManually(
    studentId: string,
    data: { paidAt: string; amount: number; studentName: string }
  ): Promise<void> {
    await this.assertInScope('students', studentId)
    await updateById('students', studentId, { payment_status: 'paid' })
    await this.recordPayment(studentId, data)
  }

  async markStudentUnpaid(studentId: string): Promise<void> {
    await this.assertInScope('students', studentId)
    await updateById('students', studentId, { payment_status: 'pending' })

    const existing = pickCurrentMonthDue(
      await this.findMany('payments', [
        ['student_id', `eq.${studentId}`],
        ['status', 'eq.paid'],
      ]),
      new Date().toISOString()
    )
    if (existing) {
      await updateById('payments', existing.id, { status: 'pending', amount_paid: 0, paid_date: null })
    }
  }

  /** Payments-page path: the caller already has the real Payment id. */
  async markPaymentPaid(
    paymentId: string,
    data: { amountPaid: number; paidDate: string; studentId?: string }
  ): Promise<void> {
    await this.assertInScope('payments', paymentId)
    await updateById('payments', paymentId, {
      status: 'paid',
      amount_paid: data.amountPaid,
      paid_date: data.paidDate.slice(0, 10),
    })
    await this.syncStudentPaymentStatus(paymentId, data.studentId, 'paid')
  }

  async markPaymentUnpaid(paymentId: string, data: { studentId?: string } = {}): Promise<void> {
    await this.assertInScope('payments', paymentId)
    await updateById('payments', paymentId, { status: 'pending', amount_paid: 0, paid_date: null })
    await this.syncStudentPaymentStatus(paymentId, data.studentId, 'pending')
  }

  /** A legacy payment's student_id may be wrong; the payment itself is already saved by now. */
  private async syncStudentPaymentStatus(
    paymentId: string,
    studentId: string | undefined,
    status: 'paid' | 'pending'
  ): Promise<void> {
    if (!studentId) return
    try {
      await this.assertInScope('students', studentId)
      await updateById('students', studentId, { payment_status: status })
    } catch (err) {
      if (!(err instanceof ScopeError)) throw err
      console.warn('[MARK PAID] could not sync Student.payment_status — student_id join unresolved', { paymentId })
    }
  }

  async markReminderSent(paymentId: string, data: { reminderSentAt: string }): Promise<void> {
    await this.assertInScope('payments', paymentId)
    await updateById('payments', paymentId, { reminder_sent_at: data.reminderSentAt })
  }

  async markRemindersSent(paymentIds: string[], data: { reminderSentAt: string }): Promise<void> {
    for (const id of paymentIds) await this.assertInScope('payments', id)
    await updateByIds('payments', paymentIds, { reminder_sent_at: data.reminderSentAt })
  }

  async markPaymentsOverdue(paymentIds: string[]): Promise<void> {
    for (const id of paymentIds) await this.assertInScope('payments', id)
    await updateByIds('payments', paymentIds, { status: 'overdue' })
  }

  /**
   * Monthly billing rollover (1st-of-month cron). Creates a fresh due per student and never edits
   * last month's, so arrears stack. Idempotent per student per calendar month. The insert is one
   * statement, so it either bills everyone or no one.
   */
  async runMonthlyReset(): Promise<{ created: number; skipped: number }> {
    const [students, payments] = await Promise.all([this.getStudents(), this.getPayments()])

    const now = new Date()
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
    // Same "YYYY-MM" a pause stores.
    const billingMonth = dueDate.slice(0, 7)
    const alreadyDue = new Set(payments.filter((p) => p.dueDate.startsWith(billingMonth)).map((p) => p.studentId))

    const toBill = students.filter((s) => s.pausedMonth !== billingMonth && !alreadyDue.has(s.id))
    const created = await insertRows(
      'payments',
      toBill.map((s) => ({
        student_id: s.id,
        student_name: s.name,
        amount: s.monthlyFee,
        due_date: dueDate,
        status: 'pending',
        branch: s.branch ?? null,
      }))
    )

    // Best-effort: the dues are what matter, and a re-run would skip these students.
    try {
      await updateByIds('students', toBill.map((s) => s.id), { payment_status: 'pending' })
    } catch (err) {
      console.error('[MONTHLY RESET] could not set payment_status on students', err)
    }

    return { created: created.length, skipped: students.length - toBill.length }
  }

  async createStudent(data: {
    name: string
    email: string
    phone: string
    classesPerWeek: number
    duration: string
    monthlyFee: number
    grade?: string
    batchId?: string
    branch: string
    online?: boolean
  }): Promise<Student> {
    const enrolledDate = new Date().toISOString().slice(0, 10)
    if (!isValidBranchId(data.branch)) {
      throw new Error(`Refusing to create a student in unknown branch "${data.branch}"`)
    }

    const [row] = await insertRows('students', [
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        classes_per_week: data.classesPerWeek,
        duration: data.duration,
        amount_due: data.monthlyFee,
        payment_status: 'pending',
        created_at: enrolledDate,
        grade: data.grade ?? '',
        batch_timing: data.batchId ?? '',
        branch: data.branch,
        online: !!data.online,
      },
    ])

    // The first due. The student already exists, so a failure here must not fail the request:
    // the admin would retry and create a duplicate.
    try {
      await insertRows('payments', [
        {
          student_id: row.id,
          student_name: data.name,
          amount: data.monthlyFee,
          due_date: enrolledDate,
          status: 'pending',
          branch: data.branch,
        },
      ])
    } catch (err) {
      console.error(`[CREATE STUDENT] payment row failed for ${row.id}`, err)
    }

    return mapStudent(row)
  }

  /** Superadmin-only at the route. `batchId` may be `''` to clear it. */
  async updateStudentBatch(studentId: string, batchId: string): Promise<void> {
    if (batchId && !isValidBatchId(batchId)) throw new Error(`Refusing to set unknown batch "${batchId}"`)
    await this.assertInScope('students', studentId)
    await updateById('students', studentId, { batch_timing: batchId })
  }

  /**
   * Pause or resume for the current calendar month; the stored "YYYY-MM" expires on its own.
   * Pausing removes that month's unpaid dues (never paid ones); resuming puts the due back.
   */
  async setStudentPaused(studentId: string, paused: boolean): Promise<void> {
    const checked = await this.assertInScope('students', studentId)
    const month = monthKey()

    await updateById('students', studentId, { paused_month: paused ? month : '' })

    const openDues: Filters = [
      ['student_id', `eq.${studentId}`],
      ['status', 'neq.paid'],
      ['due_date', `gte.${month}-01`],
      ['due_date', `lt.${nextMonthStart(month)}`],
    ]

    if (paused) {
      await request('DELETE', 'payments', openDues, { prefer: 'return=minimal' })
      return
    }

    if ((await this.findMany('payments', openDues, false)).length > 0) return

    const student = checked ?? (await selectById('students', studentId))
    if (!student) return

    await insertRows('payments', [
      {
        student_id: studentId,
        student_name: str(student.name),
        amount: Number(student.amount_due) || 0,
        due_date: `${month}-01`,
        status: 'pending',
        branch: str(student.branch) || null,
      },
    ])
    await updateById('students', studentId, { payment_status: 'pending' })
  }

  /** Superadmin-only at the route. */
  async updateStudentOnline(studentId: string, online: boolean): Promise<void> {
    await this.assertInScope('students', studentId)
    await updateById('students', studentId, { online })
  }

  async createLead(data: {
    name: string
    email: string
    phone: string
    source: string
    notes?: string
    online?: boolean
    branch: string
  }): Promise<Lead> {
    if (!isValidBranchId(data.branch)) {
      throw new Error(`Refusing to create a lead in unknown branch "${data.branch}"`)
    }
    const [row] = await insertRows('leads', [
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        source: data.source,
        status: 'new',
        created_at: new Date().toISOString().slice(0, 10),
        notes: data.notes ?? '',
        online: !!data.online,
        branch: data.branch,
      },
    ])
    return mapLead(row)
  }

  async createExpense(data: {
    description: string
    amount: number
    category: string
    date: string
    branch: string
  }): Promise<Expense> {
    if (!isValidBranchId(data.branch)) {
      throw new Error(`Refusing to create an expense in unknown branch "${data.branch}"`)
    }
    const [row] = await insertRows('expenses', [
      {
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date || null,
        branch: data.branch,
      },
    ])
    return mapExpense(row)
  }

  /**
   * Hard delete, cascading to every linked Payment (unscoped on purpose — see findMany). Payments
   * go first, so a failure partway can simply be retried.
   */
  async deleteStudent(studentId: string): Promise<void> {
    await this.assertInScope('students', studentId)
    await request('DELETE', 'payments', [['student_id', `eq.${studentId}`]], { prefer: 'return=minimal' })
    await deleteById('students', studentId)
  }

  async deleteLead(leadId: string): Promise<void> {
    await this.assertInScope('leads', leadId)
    await deleteById('leads', leadId)
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.assertInScope('expenses', expenseId)
    await deleteById('expenses', expenseId)
  }

  /** Scope gate for routes whose side effects (an email, say) happen before the mutation. */
  async assertAccessible(table: Table, recordId: string): Promise<void> {
    await this.assertInScope(table, recordId)
  }

  /** Reads a single record's branch, for routes that must propagate it (e.g. lead → student). */
  async getRecordBranch(table: Table, recordId: string): Promise<string> {
    const row = (await this.assertInScope(table, recordId)) ?? (await selectById(table, recordId))
    if (!row) throw new ScopeError('not_found')
    return str(row.branch)
  }
}
