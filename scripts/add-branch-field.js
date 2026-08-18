#!/usr/bin/env node
//
// One-shot: add the `branch` singleSelect column to Students, Leads and Payments.
//
//   node scripts/add-branch-field.js
//
// Idempotent — skips any table that already has the field.
//
// ⚠️ The Airtable PAT needs the `schema.bases:write` scope. A 403 here is the most likely
//    first-run failure; add the scope at https://airtable.com/create/tokens and retry.
//
// The choices are the branch *ids* (BRANCH_SAIBABA…), not display names. Pre-creating them
// is what stops `typecast: true` on the app's writes from inventing a fourth branch out of a
// typo. Display names live in ACADEMY_BRANCHES.

const { loadEnvLocal, airtableHeaders, getBranches } = require('./_shared')

const env = loadEnvLocal(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'])
const META = `https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`
const TARGET_TABLES = ['Students', 'Leads', 'Payments']

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

  for (const name of TARGET_TABLES) {
    const table = tables.find((t) => t.name === name)
    if (!table) {
      console.error(`❌ Table "${name}" not found in base ${env.AIRTABLE_BASE_ID}`)
      process.exitCode = 1
      continue
    }

    if (table.fields.some((f) => f.name === 'branch')) {
      console.log(`⏭  ${name}: "branch" already exists — skipped`)
      continue
    }

    const create = await fetch(`${META}/${table.id}/fields`, {
      method: 'POST',
      headers: airtableHeaders(env),
      body: JSON.stringify({
        name: 'branch',
        type: 'singleSelect',
        options: { choices: branches.map((b) => ({ name: b.id })) },
      }),
    })

    if (!create.ok) {
      const text = await create.text()
      console.error(`❌ ${name}: failed to create "branch": ${create.status} ${text}`)
      process.exitCode = 1
      continue
    }

    console.log(`✅ ${name}: created "branch" with ${branches.length} choices`)
  }

  console.log('\nNext: node scripts/backfill-branch.js   (dry run, then --apply)')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
