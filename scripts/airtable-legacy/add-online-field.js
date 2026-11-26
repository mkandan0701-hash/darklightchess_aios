#!/usr/bin/env node
//
// One-shot: add the `online` (checkbox) field to Students and Leads.
// (Leads gained it on 2026-11-14 for the Online/Offline choice on Add Lead.)
//
//   node scripts/add-online-field.js
//
// Idempotent — skips if the field already exists.
//
// ⚠️ The Airtable PAT needs the `schema.bases:write` scope.

const { loadEnvLocal, airtableHeaders } = require('../_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const META = `https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`
const TARGET_TABLES = ['Students', 'Leads']

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
  for (const name of TARGET_TABLES) {
    const table = tables.find((t) => t.name === name)
    if (!table) {
      console.error(`❌ Table "${name}" not found in base ${env.AIRTABLE_BASE_ID}`)
      process.exitCode = 1
      continue
    }

    if (table.fields.some((f) => f.name === 'online')) {
      console.log(`⏭  ${name}: "online" already exists — skipped`)
      continue
    }

    const create = await fetch(`${META}/${table.id}/fields`, {
      method: 'POST',
      headers: airtableHeaders(env),
      body: JSON.stringify({
        name: 'online',
        type: 'checkbox',
        options: { icon: 'check', color: 'greenBright' },
      }),
    })

    if (!create.ok) {
      const text = await create.text()
      console.error(`❌ ${name}: failed to create "online": ${create.status} ${text}`)
      process.exitCode = 1
      continue
    }

    console.log(`✅ ${name}: created "online"`)
  }
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
