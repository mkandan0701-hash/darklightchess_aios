#!/usr/bin/env node
//
// One-shot: create a Payments row for every Student that has none at all.
//
// Before the createStudent fix (see lib/airtableClient.ts), adding a student never wrote to
// Payments — only Students.amount_due/payment_status were set. Those students stayed invisible
// to /payments, Monthly Revenue, and every Finance/Analytics figure until the monthly-reset
// cron ran or someone manually marked them paid. This backfills one Payment row per such
// student, using the student's own amount_due/payment_status so it doesn't misrepresent
// students who are actually already paid or overdue.
//
//   node scripts/backfill-missing-payments.js            # dry run — prints what it would create
//   node scripts/backfill-missing-payments.js --apply    # creates
//
// A student that already has ANY Payment row (paid, pending, or overdue) is left alone — this
// script only fills the gap, it never adds a second row for a student already tracked.

const { loadEnvLocal, airtableHeaders, sleep } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const APPLY = process.argv.includes('--apply')
const BASE = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}`

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

function selectName(field) {
  if (field && typeof field === 'object' && 'name' in field) return field.name
  return field
}

/** Builds the Payments fields to create for one student, matching their existing payment_status. */
function paymentFieldsFor(student) {
  const name = student.fields.name || ''
  const amount = Number(student.fields.amount_due) || 0
  const dueDate = student.fields.created_at || new Date().toISOString().split('T')[0]
  const status = selectName(student.fields.payment_status) || 'pending'
  const branch = selectName(student.fields.branch) || ''

  const base = {
    student_id: student.id,
    student_name: name,
    amount,
    due_date: dueDate,
    branch,
  }

  if (status === 'paid') {
    return { ...base, status: 'paid', amount_paid: amount, paid_date: dueDate }
  }
  if (status === 'overdue') {
    return { ...base, status: 'overdue' }
  }
  return { ...base, status: 'pending' }
}

async function createBatch(table, records) {
  if (!APPLY || records.length === 0) return
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10)
    const url = `${BASE}/${encodeURIComponent(table)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: airtableHeaders(env),
      body: JSON.stringify({ records: chunk.map((fields) => ({ fields })), typecast: true }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`❌ ${table}: batch create failed: ${res.status} ${text}`)
      process.exitCode = 1
    }
    await sleep(250)
  }
}

async function main() {
  console.log(APPLY ? '⚙️  APPLY mode — records will be created.\n' : '🔍 DRY RUN — nothing will be created. Re-run with --apply.\n')

  const students = await listAll('Students')
  const payments = await listAll('Payments')

  const studentIdsWithPayments = new Set(
    payments.map((p) => (p.fields.student_id ? String(p.fields.student_id) : '')).filter(Boolean)
  )

  const missing = students.filter((s) => !studentIdsWithPayments.has(s.id))

  if (missing.length === 0) {
    console.log('✅ Every student already has at least one Payment row — nothing to do.')
    return
  }

  console.log(`Found ${missing.length} student(s) with no Payment row at all:\n`)
  const toCreate = missing.map((s) => {
    const fields = paymentFieldsFor(s)
    console.log(
      `  ${s.id}  name=${s.fields.name || '(none)'}  amount=${fields.amount}  ` +
      `status=${fields.status}  due_date=${fields.due_date}  branch=${fields.branch || '(unassigned)'}`
    )
    return fields
  })

  await createBatch('Payments', toCreate)

  console.log(APPLY ? '\n✅ Done — Payment rows created.' : '\n🔍 Dry run complete. Re-run with --apply to create these.')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
