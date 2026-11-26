#!/usr/bin/env node
//
// Saves every table to data/backups/<timestamp>/ as JSON. Read-only on the database.
// Supabase's Free plan has no automatic backups, so run this weekly:
//
//   node scripts/backup-supabase.js
//
// The files hold parents' personal data. data/ is gitignored — keep it that way.

const fs = require('fs')
const path = require('path')
const { loadEnvLocal, supabaseSelectAll } = require('./_shared')

const env = loadEnvLocal(['SUPABASE_URL', 'SUPABASE_SECRET_KEY'])

async function main() {
  const tables = {}
  for (const t of ['students', 'leads', 'payments', 'expenses']) tables[t] = await supabaseSelectAll(env, t)

  // Written only once every table has been read, so a folder is never a partial backup.
  const dir = path.join('data', 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
  fs.mkdirSync(dir, { recursive: true })
  for (const [t, rows] of Object.entries(tables)) {
    fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2))
    console.log(`✅ ${t}: ${rows.length} rows`)
  }
  console.log(`\nSaved to ${dir}`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exitCode = 1
})
