#!/usr/bin/env node
//
// One-shot: create the `Expenses` table (description, amount, category, date, branch).
//
//   node scripts/add-expenses-table.js
//
// Idempotent — skips if the table already exists. The `branch` singleSelect is created with the
// branch-id choices up front so `typecast: true` can't invent a typo choice on a bad write.
//
// ⚠️ The Airtable PAT needs the `schema.bases:write` scope.

const { loadEnvLocal, airtableHeaders, getBranches } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const META = `https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`
const TABLE = 'Expenses'

async function main() {
  const res = await fetch(META, { headers: airtableHeaders(env) })
  if (!res.ok) {
    console.error(`❌ Could not list tables: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  const { tables } = await res.json()
  if (tables.some((t) => t.name === TABLE)) {
    console.log(`⏭  "${TABLE}" already exists — skipped`)
    return
  }

  const create = await fetch(META, {
    method: 'POST',
    headers: airtableHeaders(env),
    body: JSON.stringify({
      name: TABLE,
      fields: [
        { name: 'description', type: 'singleLineText' },
        { name: 'amount', type: 'number', options: { precision: 2 } },
        { name: 'category', type: 'singleLineText' },
        { name: 'date', type: 'date', options: { dateFormat: { name: 'iso' } } },
        {
          name: 'branch',
          type: 'singleSelect',
          options: { choices: getBranches(env).map((b) => ({ name: b.id })) },
        },
      ],
    }),
  })

  if (!create.ok) {
    console.error(`❌ Failed to create "${TABLE}": ${create.status} ${await create.text()}`)
    process.exit(1)
  }
  console.log(`✅ Created "${TABLE}"`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
