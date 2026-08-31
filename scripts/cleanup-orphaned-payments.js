#!/usr/bin/env node
//
// One-shot: delete Payment records whose student_id points at a Student that no longer
// exists. This is the retroactive cleanup for students deleted *before* deleteStudent()
// started cascading to Payments (see lib/airtableClient.ts) — those Payment rows were left
// behind and still count toward Monthly Revenue / Analytics forever, since nothing else ever
// re-checks that the student they point at still exists.
//
//   node scripts/cleanup-orphaned-payments.js            # dry run — prints what it would delete
//   node scripts/cleanup-orphaned-payments.js --apply    # deletes
//
// A Payment with an EMPTY student_id is left alone — that's the pre-existing "unreliable
// join" case (see CLAUDE.md §9), not an orphan, and deleting those would destroy legitimate
// unlinked revenue history with no way to tell it apart from a real orphan.

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

async function deleteBatch(table, ids) {
  if (!APPLY || ids.length === 0) return
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    const url = new URL(`${BASE}/${encodeURIComponent(table)}`)
    for (const id of chunk) url.searchParams.append('records[]', id)

    const res = await fetch(url, { method: 'DELETE', headers: airtableHeaders(env) })
    if (!res.ok) {
      const text = await res.text()
      console.error(`❌ ${table}: batch delete failed: ${res.status} ${text}`)
      process.exitCode = 1
    }
    await sleep(250)
  }
}

async function main() {
  console.log(APPLY ? '⚙️  APPLY mode — records will be deleted.\n' : '🔍 DRY RUN — nothing will be deleted. Re-run with --apply.\n')

  const students = await listAll('Students')
  const studentIds = new Set(students.map((s) => s.id))

  const payments = await listAll('Payments')
  const orphaned = payments.filter((p) => {
    const studentId = p.fields.student_id ? String(p.fields.student_id) : ''
    return studentId && !studentIds.has(studentId)
  })

  if (orphaned.length === 0) {
    console.log('✅ No orphaned payments found — every Payment.student_id points at an existing student.')
    return
  }

  console.log(`Found ${orphaned.length} orphaned payment(s) (student_id points at a deleted student):\n`)
  for (const p of orphaned) {
    console.log(
      `  ${p.id}  student_id=${p.fields.student_id}  student_name=${p.fields.student_name || '(none)'}  ` +
      `amount_paid=${p.fields.amount_paid ?? 0}  status=${p.fields.status?.name ?? p.fields.status ?? '(none)'}  ` +
      `paid_date=${p.fields.paid_date || '(none)'}`
    )
  }

  await deleteBatch('Payments', orphaned.map((p) => p.id))

  console.log(APPLY ? '\n✅ Done — orphaned payments deleted.' : '\n🔍 Dry run complete. Re-run with --apply to delete these.')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
