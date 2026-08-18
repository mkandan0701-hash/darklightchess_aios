#!/usr/bin/env node
//
// One-shot: assign a branch to records that predate the branch column.
//
//   node scripts/backfill-branch.js            # dry run — prints what it would do
//   node scripts/backfill-branch.js --apply    # writes
//
// Resolution order:
//   Students  coach          → COACH_BRANCH_MAP → BACKFILL_DEFAULT_BRANCH
//   Leads     coach_assigned → COACH_BRANCH_MAP → BACKFILL_DEFAULT_BRANCH
//   Payments  the student it belongs to (see below)
//
// ⚠️ Payments are the hard case. lib/airtableClient.ts maps Payment.studentId from a
//    `student_id` field that the original ClickUp migration never created, and the daily
//    reminders cron already joins on it. So we try three keys in order — record id, then the
//    legacy `id` text column, then student_name vs name — and if none resolve we LEAVE THE
//    BRANCH EMPTY and log it. An unclassified record lands in the Unassigned bucket, which is
//    visible to the superadmin only. Guessing here would silently hand a payment to the wrong
//    branch admin.

const { loadEnvLocal, airtableHeaders, getBranches, defaultBranchId, sleep } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const APPLY = process.argv.includes('--apply')
const BASE = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}`

const branches = getBranches(env)
const validBranchIds = new Set(branches.map((b) => b.id))
const FALLBACK = defaultBranchId(env)

let coachBranchMap = {}
if (env.COACH_BRANCH_MAP) {
  try {
    coachBranchMap = JSON.parse(env.COACH_BRANCH_MAP)
  } catch {
    console.error('❌ COACH_BRANCH_MAP is not valid JSON.')
    process.exit(1)
  }
}

function selectName(value) {
  if (value && typeof value === 'object' && 'name' in value) return String(value.name)
  return typeof value === 'string' ? value : ''
}

function branchForCoach(coach) {
  if (!coach) return FALLBACK
  const mapped = coachBranchMap[String(coach).trim()]
  return validBranchIds.has(mapped) ? mapped : FALLBACK
}

async function listAll(table) {
  const records = []
  let offset
  do {
    const url = new URL(`${BASE}/${encodeURIComponent(table)}`)
    url.searchParams.set('pageSize', '100')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url, { headers: airtableHeaders(env) })
    if (!res.ok) {
      const text = await res.text()
      console.error(`❌ Could not list ${table}: ${res.status} ${text}`)
      process.exit(1)
    }
    const data = await res.json()
    records.push(...data.records)
    offset = data.offset
  } while (offset)
  return records
}

async function patchBatch(table, updates) {
  if (!APPLY || updates.length === 0) return
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10)
    const res = await fetch(`${BASE}/${encodeURIComponent(table)}`, {
      method: 'PATCH',
      headers: airtableHeaders(env),
      body: JSON.stringify({ records: chunk, typecast: true }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`❌ ${table}: batch patch failed: ${res.status} ${text}`)
      process.exitCode = 1
    }
    await sleep(250)
  }
}

function summarise(table, updates, unresolved) {
  const counts = {}
  for (const u of updates) {
    counts[u.fields.branch] = (counts[u.fields.branch] || 0) + 1
  }
  const detail = Object.entries(counts)
    .map(([id, n]) => `${id}=${n}`)
    .join(', ')
  console.log(`   ${table}: ${updates.length} to update${detail ? ` (${detail})` : ''}, ${unresolved} left unassigned`)
}

async function backfillByCoach(table, coachField) {
  const records = await listAll(table)
  const updates = []
  for (const record of records) {
    if (selectName(record.fields.branch)) continue
    const branch = branchForCoach(record.fields[coachField])
    updates.push({ id: record.id, fields: { branch } })
    // Reflect the pending change locally so a dry run reports the same payment resolution
    // that an --apply run would produce.
    record.fields.branch = branch
  }
  summarise(table, updates, 0)
  await patchBatch(table, updates)
  return records
}

async function backfillPayments(students) {
  const byRecordId = new Map(students.map((s) => [s.id, s]))
  const byLegacyId = new Map(students.filter((s) => s.fields.id).map((s) => [String(s.fields.id), s]))
  const byName = new Map(
    students.filter((s) => s.fields.name).map((s) => [String(s.fields.name).trim().toLowerCase(), s])
  )

  const payments = await listAll('Payments')
  const updates = []
  const unresolved = []

  for (const payment of payments) {
    if (selectName(payment.fields.branch)) continue

    const studentKey = payment.fields.student_id ? String(payment.fields.student_id) : ''
    const nameKey = payment.fields.student_name ? String(payment.fields.student_name).trim().toLowerCase() : ''

    const student =
      byRecordId.get(studentKey) || byLegacyId.get(studentKey) || byName.get(nameKey) || null

    const branch = student ? selectName(student.fields.branch) : ''
    if (branch) {
      updates.push({ id: payment.id, fields: { branch } })
    } else {
      unresolved.push({
        id: payment.id,
        student_id: studentKey || '(none)',
        student_name: payment.fields.student_name || '(none)',
      })
    }
  }

  summarise('Payments', updates, unresolved.length)
  if (unresolved.length > 0) {
    console.log('   Unresolved payments (left Unassigned → superadmin only):')
    for (const u of unresolved) {
      console.log(`     ${u.id}  student_id=${u.student_id}  student_name=${u.student_name}`)
    }
  }
  await patchBatch('Payments', updates)
}

async function main() {
  console.log(APPLY ? '⚙️  APPLY mode — records will be written.\n' : '🔍 DRY RUN — nothing will be written. Re-run with --apply.\n')
  console.log(`   Fallback branch: ${FALLBACK}`)
  console.log(`   Coach map: ${Object.keys(coachBranchMap).length ? JSON.stringify(coachBranchMap) : '(none)'}\n`)

  const students = await backfillByCoach('Students', 'coach')
  await backfillByCoach('Leads', 'coach_assigned')
  // Payments inherit from their student, so this must run after Students.
  await backfillPayments(students)

  console.log(APPLY ? '\n✅ Done.' : '\n🔍 Dry run complete. Re-run with --apply to write.')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
