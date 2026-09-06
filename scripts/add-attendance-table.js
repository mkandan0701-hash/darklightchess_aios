#!/usr/bin/env node
//
// One-shot: create the `Attendance` table (student_id, student_name, date, present,
// homework_done, branch).
//
//   node scripts/add-attendance-table.js
//
// Idempotent — skips if a table named "Attendance" already exists.
//
// ⚠️ The Airtable PAT needs the `schema.bases:write` scope. A 403 here is the most likely
//    first-run failure; add the scope at https://airtable.com/create/tokens and retry.
//
// `branch` choices are the branch *ids* (BRANCH_SAIBABA…), not display names — same reasoning
// as add-branch-field.js: pre-creating them stops `typecast: true` from inventing a junk choice.

const { loadEnvLocal, airtableHeaders, getBranches } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const META = `https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`

async function main() {
  const branches = getBranches(env)
  console.log(`Branches: ${branches.map((b) => `${b.id} (${b.name})`).join(', ')}\n`)

  const res = await fetch(META, { headers: airtableHeaders(env) })
  if (!res.ok) {
    const text = await res.text()
    console.error(`❌ Could not list tables: ${res.status} ${text}`)
    if (res.status === 403) {
      console.error('   The PAT is missing the schema.bases:write (or schema.bases:read) scope.')
    }
    process.exit(1)
  }

  const { tables } = await res.json()

  if (tables.some((t) => t.name === 'Attendance')) {
    console.log('⏭  Attendance table already exists — skipped')
    return
  }

  const create = await fetch(META, {
    method: 'POST',
    headers: airtableHeaders(env),
    body: JSON.stringify({
      name: 'Attendance',
      fields: [
        { name: 'student_id', type: 'singleLineText' },
        { name: 'student_name', type: 'singleLineText' },
        { name: 'date', type: 'date', options: { dateFormat: { name: 'iso' } } },
        { name: 'present', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
        { name: 'homework_done', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
        { name: 'branch', type: 'singleSelect', options: { choices: branches.map((b) => ({ name: b.id })) } },
      ],
    }),
  })

  if (!create.ok) {
    const text = await create.text()
    console.error(`❌ Failed to create "Attendance" table: ${create.status} ${text}`)
    process.exit(1)
  }

  console.log(`✅ Created "Attendance" table with ${branches.length} branch choices`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
