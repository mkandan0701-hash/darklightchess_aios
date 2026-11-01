import type { BranchStats, DashboardStats, DashboardStatsResponse, Expense, Lead, Payment, Student } from './types'
import type { Scope } from './auth/types'
import { canAccessBranch, systemScope } from './auth/rbac'
import { ALL_BRANCHES } from './auth/cookies'
import { branchName, isValidBranchId } from './branches'
import { isValidBatchId } from './batches'
import { monthKey } from './utils'

const BASE_URL = 'https://api.airtable.com/v0'

const TABLES = {
  students: 'Students',
  leads: 'Leads',
  payments: 'Payments',
  expenses: 'Expenses',
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

/**
 * Airtable refused the request for account-level reasons — the workspace's monthly API quota is
 * used up (PUBLIC_API_BILLING_LIMIT_EXCEEDED) or we're being rate limited (429). Kept distinct
 * from a plain failure so withAuth can tell the user the database is unavailable, instead of the
 * request surfacing as a generic 500 or, via assertInScope, a misleading 404.
 */
export class AirtableUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AirtableUnavailableError'
  }
}

function isAirtableUnavailable(status: number, errText: string): boolean {
  return status === 429 || errText.includes('PUBLIC_API_BILLING_LIMIT_EXCEEDED')
}

function airtableError(status: number, errText: string, message: string): Error {
  const full = `${message}: ${status} ${errText}`
  return isAirtableUnavailable(status, errText) ? new AirtableUnavailableError(full) : new Error(full)
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

// --- Read cache ---
//
// Airtable bills per request, and every page load used to re-list whole tables even when nothing
// had changed seconds earlier. Full-table lists are cached briefly, keyed on the complete scoped
// filterByFormula — so one scope can never be served another scope's rows, the same guarantee
// the uncached path gives. The promise is what's cached, so concurrent identical reads (the
// dashboard's Promise.all, two tabs loading at once) share a single fetch.
//
// Every write helper below invalidates its table, so a user's own change is visible on their
// next load. The cache is per serverless instance, though: a write handled by one instance can't
// clear another's copy, so a reload landing elsewhere may be up to the TTL stale. Only user-
// facing list() reads use it — AirtableClient.system() (cron/webhooks) and the find-before-write
// lookups (findOne/findMany) always go to Airtable, since they decide what gets written.

const readCache = new Map<string, { expires: number; promise: Promise<AirtableRecord[]> }>()

function cacheTtlMs(): number {
  const raw = process.env.AIRTABLE_CACHE_TTL_SECONDS
  const seconds = raw === undefined || raw === '' ? 60 : Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
}

function invalidateTable(table: string): void {
  const prefix = `${table}|`
  for (const key of readCache.keys()) {
    if (key.startsWith(prefix)) readCache.delete(key)
  }
}

function cachedRead(table: string, formula: string | null, load: () => Promise<AirtableRecord[]>): Promise<AirtableRecord[]> {
  const ttl = cacheTtlMs()
  if (ttl === 0) return load()

  const key = `${table}|${formula ?? ''}`
  const now = Date.now()
  const hit = readCache.get(key)
  if (hit && hit.expires > now) return hit.promise

  const promise = load()
  readCache.set(key, { expires: now + ttl, promise })
  // A failed read must not be served to the next caller for the rest of the TTL.
  promise.catch(() => {
    if (readCache.get(key)?.promise === promise) readCache.delete(key)
  })
  return promise
}

/** 401/403 while listing — list() reports these as an empty result rather than an error. */
class AirtableAuthError extends Error {}

async function fetchAllRecords(table: string, formula: string | null): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = []
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
      throw new AirtableAuthError(`Auth error listing ${table}: ${res.status}`)
    }
    if (!res.ok) {
      const errText = await res.text()
      throw airtableError(res.status, errText, `Airtable list ${table} failed`)
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string }
    out.push(...data.records)
    offset = data.offset
  } while (offset)

  return out
}

// --- Writes ---

async function patchRecord(table: string, recordId: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(tableUrl(table, `/${recordId}`), {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  })
  invalidateTable(table)
  if (!res.ok) {
    const errText = await res.text()
    console.error(`[AIRTABLE] Failed to update ${table} record ${recordId}: ${res.status} ${errText}`)
  }
}

// Of several Payment rows for one student, the one due in the same calendar month (UTC, like the
// monthly cron) as `refIso`; failing that, the most recently due. Null when there are none.
function pickCurrentMonthDue(records: AirtableRecord[], refIso: string): AirtableRecord | null {
  if (records.length === 0) return null
  const month = refIso.slice(0, 7)
  const due = (r: AirtableRecord) => String(r.fields.due_date ?? '')
  const inMonth = records.find((r) => due(r).startsWith(month))
  if (inMonth) return inMonth
  return [...records].sort((a, b) => due(b).localeCompare(due(a)))[0]
}

// Throwing variant of patchRecord for the mark paid/unpaid paths: a rejected write must reach the
// caller as an error, otherwise the UI reports "marked as paid" for a row Airtable never changed.
async function patchRecordStrict(table: string, recordId: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(tableUrl(table, `/${recordId}`), {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  })
  invalidateTable(table)
  if (!res.ok) {
    const errText = await res.text()
    throw airtableError(res.status, errText, `Airtable update of ${table} record ${recordId} failed`)
  }
}

async function createRecord(table: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
  const res = await fetch(tableUrl(table), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  })
  invalidateTable(table)
  if (!res.ok) {
    const errText = await res.text()
    throw airtableError(res.status, errText, `Airtable create record in ${table} failed`)
  }
  return (await res.json()) as AirtableRecord
}

// Unlike patchRecord, a failed delete throws rather than logging and returning: a silently
// failed patch just leaves a stale field, but a silently failed delete tells the caller
// something is gone that Airtable still has.
async function deleteRecord(table: string, recordId: string): Promise<void> {
  const res = await fetch(tableUrl(table, `/${recordId}`), { method: 'DELETE', headers: getHeaders() })
  invalidateTable(table)
  if (!res.ok) {
    const errText = await res.text()
    throw airtableError(res.status, errText, `Airtable delete record in ${table} failed`)
  }
}

// Airtable's delete endpoint accepts up to 10 record ids per request via repeated `records[]`
// query params. Used for cascades (e.g. every Payment tied to a deleted Student) so deletion
// time doesn't scale linearly with one HTTP round-trip per record.
async function deleteRecordsBatch(table: string, recordIds: string[]): Promise<void> {
  for (let i = 0; i < recordIds.length; i += 10) {
    const chunk = recordIds.slice(i, i + 10)
    const url = new URL(tableUrl(table))
    for (const id of chunk) url.searchParams.append('records[]', id)

    const res = await fetch(url, { method: 'DELETE', headers: getHeaders() })
    invalidateTable(table)
    if (!res.ok) {
      const errText = await res.text()
      throw airtableError(res.status, errText, `Airtable batch delete in ${table} failed`)
    }
  }
}

// Batched counterparts of patchRecord/createRecord, 10 records per request (Airtable's max), for
// loops that would otherwise spend one request per row — the daily overdue sweep and the monthly
// billing reset. Unlike patchRecord these throw on failure, so the cron callers can report it.
async function patchRecordsBatch(table: string, updates: { id: string; fields: Record<string, unknown> }[]): Promise<void> {
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10)
    const res = await fetch(tableUrl(table), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ records: chunk, typecast: true }),
    })
    invalidateTable(table)
    if (!res.ok) {
      const errText = await res.text()
      throw airtableError(res.status, errText, `Airtable batch update in ${table} failed`)
    }
  }
}

async function createRecordsBatch(table: string, fieldsList: Record<string, unknown>[]): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = []
  for (let i = 0; i < fieldsList.length; i += 10) {
    const chunk = fieldsList.slice(i, i + 10)
    const res = await fetch(tableUrl(table), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ records: chunk.map((fields) => ({ fields })), typecast: true }),
    })
    invalidateTable(table)
    if (!res.ok) {
      const errText = await res.text()
      throw airtableError(res.status, errText, `Airtable batch create in ${table} failed`)
    }
    const data = (await res.json()) as { records: AirtableRecord[] }
    out.push(...data.records)
  }
  return out
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
    batchId: (f.batch_timing as string) || undefined,
    branch: selectName(f.branch) || undefined,
    // Airtable omits an unchecked checkbox from the response entirely (undefined, not false).
    online: f.online === true,
    pausedMonth: (f.paused_month as string) || undefined,
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

function mapRecordToExpense(record: AirtableRecord): Expense {
  const f = record.fields
  return {
    id: record.id,
    description: (f.description as string) ?? '',
    amount: Number(f.amount) || 0,
    category: (f.category as string) || 'Other',
    date: (f.date as string) ?? '',
    branch: selectName(f.branch) || undefined,
  }
}

function emptyStats(): DashboardStats {
  return {
    totalLeads: 0,
    activeStudents: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    netProfit: 0,
    overduePayments: 0,
    leadsThisMonth: 0,
  }
}

function computeStats(students: Student[], leads: Lead[], payments: Payment[], expenses: Expense[]): DashboardStats {
  const now = new Date()
  const inCurrentMonth = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  // Expected recurring revenue: every enrolled student's monthly fee, regardless of whether
  // they've paid yet. Reflects a new student immediately rather than waiting on a Payments
  // row to be marked paid — see claude.md discussion of `computeStats`. Students paused for
  // this month are left out: no due is raised for them, so counting their fee would overstate
  // the month. They stay in activeStudents — a pause is a break, not an un-enrolment.
  const pausedThisMonth = monthKey(now)
  const monthlyRevenue = students
    .filter((s) => s.pausedMonth !== pausedThisMonth)
    .reduce((sum, s) => sum + s.monthlyFee, 0)

  const monthlyExpenses = expenses
    .filter((e) => e.date && inCurrentMonth(e.date))
    .reduce((sum, e) => sum + e.amount, 0)

  const leadsThisMonth = leads.filter((l) => inCurrentMonth(l.dateReceived)).length

  return {
    totalLeads: leads.length,
    activeStudents: students.length,
    monthlyRevenue,
    monthlyExpenses,
    netProfit: monthlyRevenue - monthlyExpenses,
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
  private constructor(
    private readonly scope: Scope,
    private readonly cacheReads = true
  ) {}

  /** Build a client for a signed-in user. Normal path — use this from route handlers. */
  static forScope(scope: Scope): AirtableClient {
    return new AirtableClient(scope)
  }

  /**
   * Cron jobs and inbound webhooks only. Bypasses branch filtering by design — they have no
   * user session. Named rather than implicit so it greps.
   *
   * Never reads through the cache: the monthly reset decides who to bill from what it reads, so
   * a stale copy from another instance could double-bill. Crons run rarely; the saving is nil.
   */
  static system(): AirtableClient {
    return new AirtableClient(systemScope(), false)
  }

  static isConfigured(): boolean {
    return !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID)
  }

  /**
   * Every list read. `extraFormula` narrows further (e.g. only overdue payments) and is always
   * ANDed with the scope formula, never in place of it. Mapping happens after the cache, so each
   * caller gets fresh objects and mutating one can't alter what's cached.
   */
  private async list<T>(table: string, mapper: (r: AirtableRecord) => T, extraFormula?: string): Promise<T[]> {
    if (!AirtableClient.isConfigured()) return []

    const scopeFormula = branchFormula(this.scope)
    const formula =
      scopeFormula && extraFormula ? `AND(${scopeFormula}, ${extraFormula})` : scopeFormula ?? extraFormula ?? null
    const load = () => fetchAllRecords(table, formula)

    try {
      const records = await (this.cacheReads ? cachedRead(table, formula, load) : load())
      return records.map(mapper)
    } catch (err) {
      if (err instanceof AirtableAuthError) {
        console.error(`[AIRTABLE] ${err.message}`)
        return []
      }
      throw err
    }
  }

  /**
   * Scoped single-record lookup by an extra formula term, e.g. finding the Payment row for a
   * given student. Swallows lookup failure to `null` rather than throwing — callers use this
   * for find-or-create, where "not found" and "lookup broke" both just mean "create a new one".
   */
  private async findOne(table: string, extraFormula: string): Promise<AirtableRecord | null> {
    if (!AirtableClient.isConfigured()) return null

    const scopeFormula = branchFormula(this.scope)
    const formula = scopeFormula ? `AND(${scopeFormula}, ${extraFormula})` : extraFormula

    const url = new URL(tableUrl(table))
    url.searchParams.set('pageSize', '1')
    url.searchParams.set('filterByFormula', formula)

    const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' })
    if (!res.ok) return null

    const data = (await res.json()) as { records: AirtableRecord[] }
    return data.records[0] ?? null
  }

  /**
   * Multi-record lookup by an extra formula term, e.g. every Payment tied to a student being
   * deleted. Paginated like `list()`, but returns raw `AirtableRecord`s since callers here only
   * need `.id`.
   *
   * `applyScope` defaults to true (every other read in this class is scoped). Pass false only
   * when the caller has already authorized the specific target via `assertInScope` and is now
   * cascading to *that record's* dependents — a superadmin narrowed to one branch via the
   * dl_branch cookie is still a superadmin, and narrowing is a UI convenience, not a smaller
   * grant. Scoping the cascade would silently skip dependents outside the narrowed view (e.g.
   * Unassigned-branch rows), leaving them behind as if the delete had succeeded.
   */
  private async findMany(table: string, extraFormula: string, applyScope = true): Promise<AirtableRecord[]> {
    if (!AirtableClient.isConfigured()) return []

    const scopeFormula = applyScope ? branchFormula(this.scope) : null
    const formula = scopeFormula ? `AND(${scopeFormula}, ${extraFormula})` : extraFormula

    const out: AirtableRecord[] = []
    let offset: string | undefined
    do {
      const url = new URL(tableUrl(table))
      url.searchParams.set('pageSize', '100')
      url.searchParams.set('filterByFormula', formula)
      if (offset) url.searchParams.set('offset', offset)

      const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' })
      if (!res.ok) return out

      const data = (await res.json()) as { records: AirtableRecord[]; offset?: string }
      out.push(...data.records)
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
   *
   * Returns the record it had to fetch, so a caller that needs the record's fields anyway can
   * skip a second request for the same row. Null when nothing was fetched (all-branches scope).
   */
  private async assertInScope(table: string, recordId: string): Promise<AirtableRecord | null> {
    if (this.scope.branches === ALL_BRANCHES) return null
    if (!AirtableClient.isConfigured()) return null

    const res = await fetch(tableUrl(table, `/${encodeURIComponent(recordId)}`), {
      headers: getHeaders(),
      cache: 'no-store',
    })

    if (res.status === 404) throw new ScopeError('not_found')
    if (!res.ok) {
      const errText = await res.text()
      console.error(`[AIRTABLE] Scope lookup failed for ${table}/${recordId}: ${res.status} ${errText}`)
      // Still fails closed either way — this only changes what the user is told.
      if (isAirtableUnavailable(res.status, errText)) {
        throw new AirtableUnavailableError(`Airtable scope lookup failed: ${res.status} ${errText}`)
      }
      throw new ScopeError('lookup_failed')
    }

    const record = (await res.json()) as AirtableRecord
    if (!canAccessBranch(this.scope, selectName(record.fields.branch))) {
      console.warn('[RBAC DENY]', { table, recordId, scope: this.scope.branches })
      // Surfaced to the client as 404, not 403: a 403 confirms the record exists and turns
      // the endpoint into an id oracle.
      throw new ScopeError('forbidden')
    }
    return record
  }

  /**
   * Reads a student the caller has already authorized. Only needed when assertInScope didn't
   * fetch it (all-branches scope) — otherwise reuse the record assertInScope returned. Does not
   * throw on failure: callers treat a missing record as "skip the secondary step".
   */
  private async getStudentRecord(studentId: string): Promise<AirtableRecord | null> {
    if (!AirtableClient.isConfigured()) return null
    const res = await fetch(tableUrl(TABLES.students, `/${encodeURIComponent(studentId)}`), {
      headers: getHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as AirtableRecord
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

  async getExpenses(): Promise<Expense[]> {
    return this.list(TABLES.expenses, mapRecordToExpense)
  }

  async getStats(): Promise<DashboardStatsResponse> {
    // computeStats only uses Payments for the overdue count, so only overdue rows are read —
    // the full table grows by one row per student per month.
    const [students, leads, payments, expenses] = await Promise.all([
      this.getStudents(),
      this.getLeads(),
      this.list(TABLES.payments, mapRecordToPayment, `{status}='overdue'`),
      this.getExpenses(),
    ])

    const totals = computeStats(students, leads, payments, expenses)
    if (this.scope.branches !== ALL_BRANCHES) return totals

    // All-branches mode: one unscoped fetch, then group in memory. The dataset is small
    // enough that a per-branch fan-out isn't worth 4x the Airtable calls.
    const seen = new Set<string>()
    for (const record of [...students, ...leads, ...payments, ...expenses]) {
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
          payments.filter((p) => (p.branch ?? '') === branch),
          expenses.filter((e) => (e.branch ?? '') === branch)
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
    data: {
      status: string
      paymentId: string
      paidAt: string
      enrollmentDate: string
      amount: number
      studentName: string
    }
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

    // Razorpay's webhook is the only payment source with no code path that ever wrote a
    // Payments row — find-or-create here so a real payment shows up in revenue/analytics too,
    // not just the manual "mark paid" path.
    await this.recordPayment(studentId, {
      amount: data.amount,
      studentName: data.studentName,
      paidAt: data.paidAt,
      razorpayPaymentId: data.paymentId,
    })
  }

  /**
   * Find-or-create the Payments row for a student and mark it paid. Every row this method
   * creates carries a correct `student_id`, so future lookups for that student are reliable —
   * self-healing going forward without needing to trust legacy hand-entered rows whose
   * `student_id` may be missing or wrong (see claude.md §9).
   */
  private async recordPayment(
    studentId: string,
    data: { amount: number; studentName: string; paidAt: string; razorpayPaymentId?: string }
  ): Promise<void> {
    // Arrears stack, so a student can have several unpaid dues. Settle this month's, not whichever
    // one Airtable happens to return first.
    const existing = pickCurrentMonthDue(
      await this.findMany(
        TABLES.payments,
        `AND({student_id}='${escapeFormulaString(studentId)}', {status}!='paid')`
      ),
      data.paidAt
    )
    const fields: Record<string, unknown> = {
      status: 'paid',
      amount_paid: data.amount,
      paid_date: data.paidAt.slice(0, 10),
    }
    if (data.razorpayPaymentId) fields.payment_id = data.razorpayPaymentId

    if (existing) {
      await patchRecordStrict(TABLES.payments, existing.id, fields)
      return
    }

    const branch = await this.getRecordBranch('students', studentId)
    await createRecord(TABLES.payments, {
      student_id: studentId,
      student_name: data.studentName,
      amount: data.amount,
      due_date: data.paidAt.slice(0, 10),
      branch,
      ...fields,
    })
  }

  async markStudentPaidManually(
    studentId: string,
    data: { paidAt: string; amount: number; studentName: string }
  ): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markStudentPaidManually`, { studentId, ...data })
      return
    }
    await patchRecordStrict(TABLES.students, studentId, { payment_status: 'paid' })
    await this.recordPayment(studentId, { amount: data.amount, studentName: data.studentName, paidAt: data.paidAt })
  }

  async markStudentUnpaid(studentId: string): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markStudentUnpaid`, { studentId })
      return
    }
    await patchRecordStrict(TABLES.students, studentId, { payment_status: 'pending' })

    const existing = pickCurrentMonthDue(
      await this.findMany(
        TABLES.payments,
        `AND({student_id}='${escapeFormulaString(studentId)}', {status}='paid')`
      ),
      new Date().toISOString()
    )
    if (existing) {
      await patchRecordStrict(TABLES.payments, existing.id, { status: 'pending', amount_paid: 0, paid_date: null })
    }
  }

  /**
   * Payments-page path: the caller already has the real Payment record id, so this skips the
   * find-or-create lookup `markStudentPaidManually` needs — the reliable case.
   */
  async markPaymentPaid(
    paymentId: string,
    data: { amountPaid: number; paidDate: string; studentId?: string }
  ): Promise<void> {
    await this.assertInScope(TABLES.payments, paymentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markPaymentPaid`, { paymentId, ...data })
      return
    }
    await patchRecordStrict(TABLES.payments, paymentId, {
      status: 'paid',
      amount_paid: data.amountPaid,
      paid_date: data.paidDate.slice(0, 10),
    })
    await this.syncStudentPaymentStatus(paymentId, data.studentId, 'paid')
  }

  async markPaymentUnpaid(paymentId: string, data: { studentId?: string } = {}): Promise<void> {
    await this.assertInScope(TABLES.payments, paymentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markPaymentUnpaid`, { paymentId })
      return
    }
    await patchRecordStrict(TABLES.payments, paymentId, { status: 'pending', amount_paid: 0, paid_date: null })
    await this.syncStudentPaymentStatus(paymentId, data.studentId, 'pending')
  }

  /**
   * Best-effort sync of Student.payment_status from a Payment-driven mutation. The Payment
   * record's `student_id` text field is a legacy join that may be stale or wrong (claude.md
   * §9); the primary, scope-checked mutation already succeeded, so a bad join here is logged
   * and swallowed rather than failing the whole request.
   */
  private async syncStudentPaymentStatus(
    paymentId: string,
    studentId: string | undefined,
    status: 'paid' | 'pending'
  ): Promise<void> {
    if (!studentId) return
    try {
      await this.assertInScope(TABLES.students, studentId)
      await patchRecord(TABLES.students, studentId, { payment_status: status })
    } catch (err) {
      if (!(err instanceof ScopeError)) throw err
      console.warn('[MARK PAID] could not sync Student.payment_status — student_id join unresolved', { paymentId })
    }
  }

  async markReminderSent(paymentId: string, data: { reminderSentAt: string }): Promise<void> {
    await this.assertInScope(TABLES.payments, paymentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markReminderSent`, { paymentId, ...data })
      return
    }
    await patchRecord(TABLES.payments, paymentId, { reminder_sent_at: data.reminderSentAt })
  }

  /** Batched markReminderSent for the daily cron — 10 rows per request instead of 1. */
  async markRemindersSent(paymentIds: string[], data: { reminderSentAt: string }): Promise<void> {
    for (const id of paymentIds) await this.assertInScope(TABLES.payments, id)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markRemindersSent`, { paymentIds, ...data })
      return
    }
    await patchRecordsBatch(
      TABLES.payments,
      paymentIds.map((id) => ({ id, fields: { reminder_sent_at: data.reminderSentAt } }))
    )
  }

  /** Daily cron: flag a set of pending payments overdue, 10 rows per request. */
  async markPaymentsOverdue(paymentIds: string[]): Promise<void> {
    for (const id of paymentIds) await this.assertInScope(TABLES.payments, id)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] markPaymentsOverdue`, { paymentIds })
      return
    }
    await patchRecordsBatch(TABLES.payments, paymentIds.map((id) => ({ id, fields: { status: 'overdue' } })))
  }

  /**
   * Monthly billing rollover — invoked by the 1st-of-month cron (`app/api/cron/monthly-reset`).
   * Every student gets a fresh Payment due this month, created (not mutated) so last month's
   * record — whatever it ended up as, paid or still-unpaid — stays intact as history. A student
   * who never paid last month therefore ends up with two open dues: last month's stays overdue,
   * and a new one is due this month. That's deliberate (confirmed with the academy) — arrears
   * should stack, not silently roll forward and hide how many months are actually owed.
   *
   * Idempotent per student per calendar month: skipped if a Payment already exists with a
   * `dueDate` in the current month, so a retried or re-triggered cron run never double-bills.
   */
  async runMonthlyReset(): Promise<{ created: number; skipped: number }> {
    const [students, payments] = await Promise.all([this.getStudents(), this.getPayments()])

    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] runMonthlyReset`, { students: students.length })
      return { created: 0, skipped: 0 }
    }

    const now = new Date()
    const currentYM = now.getUTCFullYear() * 12 + now.getUTCMonth()
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0]

    let skipped = 0
    const newDues: Record<string, unknown>[] = []

    // Same "YYYY-MM" a pause stores. Taken from dueDate so it uses the identical UTC parts as
    // the row being written, rather than re-deriving the month a second way.
    const billingMonth = dueDate.slice(0, 7)

    for (const student of students) {
      // Paused for exactly this month, so don't raise the due the pause just cancelled. The
      // stored month stops matching next time round, which is what resumes them.
      if (student.pausedMonth === billingMonth) {
        skipped++
        continue
      }

      const alreadyDueThisMonth = payments.some((p) => {
        if (p.studentId !== student.id || !p.dueDate) return false
        const due = new Date(p.dueDate)
        if (isNaN(due.getTime())) return false
        return due.getUTCFullYear() * 12 + due.getUTCMonth() === currentYM
      })

      if (alreadyDueThisMonth) {
        skipped++
        continue
      }

      newDues.push({
        student_id: student.id,
        student_name: student.name,
        amount: student.monthlyFee,
        due_date: dueDate,
        status: 'pending',
        branch: student.branch ?? '',
      })
    }

    // Batched, 10 rows per request. If a chunk fails partway, re-running is safe: students whose
    // due was already written are skipped by the check above.
    const created = await createRecordsBatch(TABLES.payments, newDues)

    // Best-effort, like the per-row patchRecord this replaces: the dues are what matter, and a
    // re-run would skip these students, so a failure here must not fail the whole reset.
    try {
      await patchRecordsBatch(
        TABLES.students,
        created.map((r) => ({ id: r.fields.student_id as string, fields: { payment_status: 'pending' } }))
      )
    } catch (err) {
      console.error('[MONTHLY RESET] could not set payment_status on students', err)
    }

    return { created: created.length, skipped }
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
    const enrolledDate = new Date().toISOString().split('T')[0]
    const online = !!data.online

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
        batchId: data.batchId,
        branch: data.branch,
        online,
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
      batch_timing: data.batchId ?? '',
      branch: data.branch,
      online,
    })

    // Without this, a newly enrolled student has no row in Payments at all — invisible to
    // monthlyRevenue/overduePayments and every Finance/Analytics figure (all computed solely
    // from Payments, see computeStats) until either the 1st-of-month reset cron runs or someone
    // manually marks them paid. Creating the first due here mirrors what runMonthlyReset does
    // for every existing student each month.
    //
    // The student row already exists at this point, so a failure here must not fail the request:
    // the admin would see an error, retry, and create a duplicate student. The missing due is
    // recoverable with scripts/backfill-missing-payments.js.
    try {
      await createRecord(TABLES.payments, {
        student_id: record.id,
        student_name: data.name,
        amount: data.monthlyFee,
        due_date: enrolledDate,
        status: 'pending',
        branch: data.branch,
      })
    } catch (err) {
      console.error(`[CREATE STUDENT] payment row failed for ${record.id}`, err)
    }

    return mapRecordToStudent(record)
  }

  /**
   * Batch and online/offline are the two exceptions to "every other Student field is
   * create-only" — there's otherwise no way to correct a mistaken batch selection, or to flip a
   * student between online and in-person delivery, after the student is created. Superadmin-only
   * is enforced at the route level (app/api/clickup/students/update-batch/route.ts), not here.
   * `batchId` may be `''` to clear the student's batch back to unset.
   */
  async updateStudentBatch(studentId: string, batchId: string): Promise<void> {
    if (batchId && !isValidBatchId(batchId)) {
      throw new Error(`Refusing to set unknown batch "${batchId}"`)
    }
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] updateStudentBatch`, { studentId, batchId })
      return
    }
    await patchRecord(TABLES.students, studentId, { batch_timing: batchId })
  }

  /**
   * Pause or resume a student for the current calendar month. The stored "YYYY-MM" stops matching
   * once the month turns over, so a paused student resumes on the 1st by themselves — nothing has
   * to remember to switch them back on.
   *
   * Pausing also cancels what they'd owe for the month they're sitting out; resuming inside that
   * same month puts it back, so a mis-click doesn't silently skip a month's fee. Unlike the batch
   * and online toggles this is open to any admin for their own branch: it's day-to-day operations,
   * and `assertInScope` still keeps it to their own students.
   */
  async setStudentPaused(studentId: string, paused: boolean): Promise<void> {
    const studentRecord = await this.assertInScope(TABLES.students, studentId)
    const month = monthKey()

    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] setStudentPaused`, { studentId, paused, month })
      return
    }

    await patchRecord(TABLES.students, studentId, { paused_month: paused ? month : '' })

    // Unscoped for the same reason deleteStudent's payment lookup is: a superadmin's dl_branch
    // cookie must not narrow which of this student's own rows we can see.
    const openDues = await this.findMany(
      TABLES.payments,
      `AND({student_id}='${escapeFormulaString(studentId)}', {status}!='paid', DATETIME_FORMAT({due_date},'YYYY-MM')='${month}')`,
      false
    )

    if (paused) {
      // Only unpaid dues go. Money already collected is never erased by a pause.
      if (openDues.length > 0) {
        await deleteRecordsBatch(TABLES.payments, openDues.map((r) => r.id))
      }
      return
    }

    if (openDues.length > 0) return

    // Read before the paused_month patch above, but none of the fields used here changed.
    const record = studentRecord ?? (await this.getStudentRecord(studentId))
    if (!record) return

    const f = record.fields
    await createRecord(TABLES.payments, {
      student_id: studentId,
      student_name: (f.name as string) ?? '',
      amount: Number(f.amount_due) || 0,
      due_date: `${month}-01`,
      status: 'pending',
      branch: selectName(f.branch) || '',
    })
    await patchRecord(TABLES.students, studentId, { payment_status: 'pending' })
  }

  /** See updateStudentBatch above — same create-only exception, same superadmin-at-the-route rule. */
  async updateStudentOnline(studentId: string, online: boolean): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] updateStudentOnline`, { studentId, online })
      return
    }
    await patchRecord(TABLES.students, studentId, { online })
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

    if (!AirtableClient.isConfigured()) {
      const expense: Expense = {
        id: `ex-mock-${Date.now()}`,
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date,
        branch: data.branch,
      }
      console.log(`[AIRTABLE MOCK] Created expense`, expense)
      return expense
    }

    const record = await createRecord(TABLES.expenses, {
      description: data.description,
      amount: data.amount,
      category: data.category,
      date: data.date,
      branch: data.branch,
    })

    return mapRecordToExpense(record)
  }

  /**
   * Hard delete, cascading to every linked Payment record — deletes the student's revenue
   * history too. Payments go first: if this fails partway, re-running deleteStudent just finds
   * fewer (or zero) remaining payments and picks up where it left off.
   *
   * The Payment lookup is deliberately unscoped (`applyScope: false`) — see findMany's doc
   * comment. Scoping it to the caller's possibly-narrowed branch view would leave some of the
   * student's Payments behind, exactly the orphaned-revenue bug this cascade exists to prevent.
   */
  async deleteStudent(studentId: string): Promise<void> {
    await this.assertInScope(TABLES.students, studentId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] deleteStudent`, { studentId })
      return
    }

    const linkedPayments = await this.findMany(
      TABLES.payments,
      `{student_id}='${escapeFormulaString(studentId)}'`,
      false
    )
    if (linkedPayments.length > 0) {
      await deleteRecordsBatch(TABLES.payments, linkedPayments.map((p) => p.id))
    }

    await deleteRecord(TABLES.students, studentId)
  }

  async deleteLead(leadId: string): Promise<void> {
    await this.assertInScope(TABLES.leads, leadId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] deleteLead`, { leadId })
      return
    }
    await deleteRecord(TABLES.leads, leadId)
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.assertInScope(TABLES.expenses, expenseId)
    if (!AirtableClient.isConfigured()) {
      console.log(`[AIRTABLE MOCK] deleteExpense`, { expenseId })
      return
    }
    await deleteRecord(TABLES.expenses, expenseId)
  }

  /**
   * Explicit scope gate for routes with side effects that happen *before* the mutation —
   * sending an email, say. Without it, an out-of-scope record id would still trigger the
   * side effect on its way to the 404.
   */
  async assertAccessible(table: 'students' | 'leads' | 'payments' | 'expenses', recordId: string): Promise<void> {
    await this.assertInScope(TABLES[table], recordId)
  }

  /** Reads a single record's branch, for routes that must propagate it (e.g. lead → student). */
  async getRecordBranch(table: 'students' | 'leads' | 'payments' | 'expenses', recordId: string): Promise<string> {
    await this.assertInScope(TABLES[table], recordId)
    if (!AirtableClient.isConfigured()) return ''

    const res = await fetch(tableUrl(TABLES[table], `/${encodeURIComponent(recordId)}`), {
      headers: getHeaders(),
      cache: 'no-store',
    })
    if (res.status === 404) throw new ScopeError('not_found')
    if (!res.ok) {
      const errText = await res.text()
      if (isAirtableUnavailable(res.status, errText)) {
        throw new AirtableUnavailableError(`Airtable branch lookup failed: ${res.status} ${errText}`)
      }
      throw new ScopeError('lookup_failed')
    }

    const record = (await res.json()) as AirtableRecord
    return selectName(record.fields.branch)
  }
}

export { emptyStats }
