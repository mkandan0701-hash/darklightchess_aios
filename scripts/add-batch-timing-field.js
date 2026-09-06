#!/usr/bin/env node
//
// One-shot: add the `batch_timing` (single line text) field to Students.
//
//   node scripts/add-batch-timing-field.js
//
// Idempotent — skips if the field already exists.
//
// ⚠️ The Airtable PAT needs the `schema.bases:write` scope.

const { loadEnvLocal, airtableHeaders } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const META = `https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`
const TARGET_TABLE = 'Students'

async function main() {
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
  const table = tables.find((t) => t.name === TARGET_TABLE)
  if (!table) {
    console.error(`❌ Table "${TARGET_TABLE}" not found in base ${env.AIRTABLE_BASE_ID}`)
    process.exit(1)
  }

  if (table.fields.some((f) => f.name === 'batch_timing')) {
    console.log(`⏭  ${TARGET_TABLE}: "batch_timing" already exists — skipped`)
    return
  }

  const create = await fetch(`${META}/${table.id}/fields`, {
    method: 'POST',
    headers: airtableHeaders(env),
    body: JSON.stringify({ name: 'batch_timing', type: 'singleLineText' }),
  })

  if (!create.ok) {
    const text = await create.text()
    console.error(`❌ ${TARGET_TABLE}: failed to create "batch_timing": ${create.status} ${text}`)
    process.exit(1)
  }

  console.log(`✅ ${TARGET_TABLE}: created "batch_timing"`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
