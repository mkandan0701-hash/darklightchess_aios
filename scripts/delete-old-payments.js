#!/usr/bin/env node
//
// One-shot: delete every Payment record due before the 1st of the current month, so the Payments
// page and revenue figures start fresh from this month.
//
//   node scripts/delete-old-payments.js            # dry run — prints what it would delete
//   node scripts/delete-old-payments.js --apply    # deletes (permanent)
//   node scripts/delete-old-payments.js --before 2026-11-01 --apply
//
// Paid and unpaid rows both go. Rows with no due_date are left alone and reported, since there is
// no way to tell which month they belong to.

const { loadEnvLocal, airtableHeaders, sleep } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const APPLY = process.argv.includes('--apply')
const BASE = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}`

const beforeIdx = process.argv.indexOf('--before')
const now = new Date()
const CUTOFF =
  beforeIdx > -1
    ? process.argv[beforeIdx + 1]
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0]

if (!/^\d{4}-\d{2}-\d{2}$/.test(CUTOFF)) {
  console.error('❌ --before must be YYYY-MM-DD')
  process.exit(1)
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
      console.error(`❌ Could not list ${table}: ${res.status} ${await res.text()}`)
      process.exit(1)
    }
    const data = await res.json()
    records.push(...data.records)
    offset = data.offset
  } while (offset)
  return records
}

async function deleteBatch(table, ids) {
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    const url = new URL(`${BASE}/${encodeURIComponent(table)}`)
    for (const id of chunk) url.searchParams.append('records[]', id)

    const res = await fetch(url, { method: 'DELETE', headers: airtableHeaders(env) })
    if (!res.ok) {
      console.error(`❌ ${table}: batch delete failed: ${res.status} ${await res.text()}`)
      process.exitCode = 1
    }
    await sleep(250)
  }
}

async function main() {
  console.log(APPLY ? '⚙️  APPLY mode — records will be deleted.\n' : '🔍 DRY RUN — nothing will be deleted. Re-run with --apply.\n')
  console.log(`Cutoff: Payments due before ${CUTOFF}\n`)

  const payments = await listAll('Payments')
  const undated = payments.filter((p) => !p.fields.due_date)
  const old = payments.filter((p) => p.fields.due_date && String(p.fields.due_date).slice(0, 10) < CUTOFF)
  const keep = payments.length - old.length

  const byMonth = {}
  for (const p of old) {
    const m = String(p.fields.due_date).slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
  }
  console.log(`Total payments: ${payments.length}  |  to delete: ${old.length}  |  kept: ${keep}`)
  for (const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m]}`)
  if (undated.length) console.log(`\n⚠️  ${undated.length} payment(s) have no due_date and are being kept.`)

  if (!APPLY || old.length === 0) {
    console.log(old.length === 0 ? '\n✅ Nothing to delete.' : '\n🔍 Dry run complete. Re-run with --apply to delete these.')
    return
  }

  await deleteBatch('Payments', old.map((p) => p.id))
  console.log('\n✅ Done — old payments deleted.')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
