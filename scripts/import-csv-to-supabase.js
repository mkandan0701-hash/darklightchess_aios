#!/usr/bin/env node
//
// Imports the Airtable CSV exports in data/ into Supabase.
//
//   node scripts/import-csv-to-supabase.js            dry run: check and report, write nothing
//   node scripts/import-csv-to-supabase.js --apply    upsert by record_id, then compare
//
// Each CSV needs a `record_id` column (Airtable formula RECORD_ID()); leads.csv also needs
// `created_time` (CREATED_TIME()). Bad data stops the import — nothing is guessed.
//
// --apply overwrites matching rows, so never re-run it once the app is live on Supabase.

const fs = require('fs')
const crypto = require('crypto')
const { loadEnvLocal, getBranches, supabaseRequest, supabaseSelectAll } = require('./_shared')

const apply = process.argv.includes('--apply')
const skipExpenses = process.argv.includes('--skip-expenses')
const env = loadEnvLocal(apply ? ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'] : [])
const branchIds = new Set(getBranches(env).map((b) => b.id))

const problems = []

// --- CSV: quoted fields, "" escapes, commas and newlines inside quotes ---
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (quoted) throw new Error('unclosed quote — the file looks truncated')
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

// --- Converters: (raw, where) → value, recording a problem instead of guessing ---
const text = (v) => v
const textOrNull = (v) => v || null
const trimmed = (fallback) => (v) => v.trim() || fallback
const checked = (v, where) => {
  if (v === '') return false
  if (/^(checked|true|1)$/i.test(v)) return true
  if (/^(false|0)$/i.test(v)) return false
  problems.push(`${where}: unreadable checkbox "${v}"`)
  return false
}
const num = (fallback) => (v, where) => {
  if (v.trim() === '') return fallback
  const n = Number(v.replace(/[₹,\s]/g, ''))
  if (!Number.isFinite(n)) problems.push(`${where}: unreadable number "${v}"`)
  return Number.isFinite(n) ? n : fallback
}
const ymd = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? date.toISOString().slice(0, 10)
    : null
}
// Airtable can export 1/11/2026 either way round; only an unambiguous form is accepted.
const date = (v, where) => {
  const s = v.trim()
  if (!s) return null
  let m, out = null
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/))) out = ymd(+m[1], +m[2], +m[3])
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: .*)?$/))) {
    const a = +m[1], b = +m[2], y = +m[3]
    if (a === b || b > 12) out = ymd(y, a, b)
    else if (a > 12) out = ymd(y, b, a)
    else { problems.push(`${where}: ambiguous date "${s}" — set the Airtable field to ISO format and re-export`); return null }
  } else if (/^[A-Za-z]{3,9} \d{1,2}, \d{4}$/.test(s)) {
    const d = new Date(`${s} UTC`)
    if (!isNaN(d)) out = d.toISOString().slice(0, 10)
  }
  if (!out) problems.push(`${where}: unreadable date "${s}"`)
  return out
}
const timestamp = (v, where, row = {}) => {
  const s = v.trim()
  if (!s) return null
  // Airtable's default for a "created time" field: M/D/YYYY h:mma, in GMT (the app API reported the
  // same leads at the same clock time in UTC). Month-first, so the day is checked against
  // created_at, which the app wrote from the same moment: a day/month mix-up can't slip through.
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (us) {
    const d = new Date(Date.UTC(+us[3], +us[1] - 1, +us[2], (+us[4] % 12) + (/pm/i.test(us[6]) ? 12 : 0), +us[5]))
    const day = (row.created_at || '').trim()
    if (d.getUTCMonth() !== +us[1] - 1 || d.getUTCDate() !== +us[2]) {
      problems.push(`${where}: impossible date "${s}"`)
      return null
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day !== d.toISOString().slice(0, 10)) {
      problems.push(`${where}: "${s}" is not the same day as created_at ${day} — check month/day order`)
      return null
    }
    return d.toISOString()
  }
  // Only a timestamp that states its zone is safe; otherwise it would shift with this PC's clock.
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(s)) return new Date(s).toISOString()
  // Airtable formulas are GMT by default and export as "YYYY-MM-DD h:mma" or "YYYY-MM-DD HH:mm".
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (m) {
    let h = +m[4]
    if (m[7]) h = (h % 12) + (/pm/i.test(m[7]) ? 12 : 0)
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], h, +m[5], +(m[6] || 0))).toISOString()
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`
  problems.push(`${where}: unreadable time "${s}" — set the Airtable field to ISO format, GMT`)
  return null
}
const branch = (v, where) => {
  const s = v.trim()
  if (!s) return null
  if (!branchIds.has(s)) problems.push(`${where}: unknown branch "${s}"`)
  return s
}

const SPEC = {
  students: {
    name: text, email: text, phone: text, age: num(null), coach: textOrNull, status: textOrNull,
    payment_status: trimmed('pending'), amount_due: num(0), classes_per_week: num(0), duration: text,
    grade: text, batch_timing: text, paused_month: text, online: checked, payment_link: textOrNull,
    invoice_id: textOrNull, created_at: date, branch,
  },
  leads: {
    name: text, email: text, phone: text, source: trimmed('other'), coach_assigned: textOrNull,
    status: trimmed('new'), notes: text, demo_date: date, demo_time: textOrNull, meet_link: textOrNull,
    online: checked, created_at: date, created_time: timestamp, branch,
  },
  payments: {
    student_id: text, student_name: text, amount: num(0), amount_paid: num(0), status: trimmed('pending'),
    due_date: date, paid_date: date, payment_id: textOrNull, invoice_id: textOrNull,
    reminder_sent_at: timestamp, branch,
  },
  expenses: { description: text, amount: num(0), category: trimmed('Other'), date, branch },
}
// Without these the import would lose data that matters, so a missing column is an error.
const REQUIRED = {
  students: ['name', 'phone', 'amount_due', 'payment_status', 'paused_month', 'online', 'created_at', 'branch'],
  leads: ['name', 'phone', 'status', 'source', 'created_at', 'created_time', 'branch'],
  payments: ['student_id', 'amount', 'amount_paid', 'status', 'due_date', 'paid_date', 'branch'],
  expenses: ['description', 'amount', 'category', 'date', 'branch'],
}
const IGNORED = new Set(['record_id', 'id'])

function load(table) {
  const file = `data/${table}.csv`
  if (!fs.existsSync(file)) { problems.push(`${file} is missing`); return [] }
  const [header, ...lines] = parseCsv(fs.readFileSync(file, 'utf8'))
  if (!header) { problems.push(`${file} is empty`); return [] }
  const cols = header.map((h) => h.trim())

  // Leads are the one table nothing points at (payments refer to students), so a leads export
  // without record_id is fine: each lead gets a stable id made from its own details instead.
  const hasIds = cols.includes('record_id')
  const needed = table === 'leads' && !hasIds ? REQUIRED[table] : ['record_id', ...REQUIRED[table]]
  for (const c of needed) {
    if (!cols.includes(c)) problems.push(`${file}: no "${c}" column (hidden in the view?)`)
  }
  const dropped = cols.filter((c) => !SPEC[table][c] && !IGNORED.has(c))
  if (dropped.length) console.log(`ℹ️  ${file}: columns not imported: ${dropped.join(', ')}`)

  const seen = new Set()
  const rows = []
  lines.forEach((line, i) => {
    const where = `${file} row ${i + 2}`
    if (line.length !== cols.length) problems.push(`${where}: ${line.length} values for ${cols.length} columns`)
    const raw = Object.fromEntries(cols.map((c, j) => [c, line[j] ?? '']))

    // A row with nothing in it but an id is a stray empty Airtable record. Skipped, and said so.
    if (Object.entries(raw).every(([c, v]) => IGNORED.has(c) || v.trim() === '')) {
      console.log(`ℹ️  ${where}: empty record${raw.record_id ? ` (${raw.record_id})` : ''} — skipped`)
      return
    }

    let id = (raw.record_id || '').trim()
    if (!id && table === 'leads' && !hasIds) {
      const key = [raw.name, raw.phone, raw.created_time, raw.created_at].map((v) => (v || '').trim()).join('|')
      id = 'led' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 14)
    }
    if (!/^(rec|led)[A-Za-z0-9]{14}$/.test(id)) problems.push(`${where}: bad record_id "${id}"`)
    if (seen.has(id)) problems.push(`${where}: duplicate record_id ${id}`)
    seen.add(id)

    const out = { id }
    for (const [col, convert] of Object.entries(SPEC[table])) {
      out[col] = convert(raw[col] ?? '', `${where}, ${col}`, raw)
    }
    if (table === 'leads' && !out.created_time) problems.push(`${where}: no created_time`)
    rows.push(out)
  })
  return rows
}

const MONEY = { students: ['amount_due'], leads: [], payments: ['amount', 'amount_paid'], expenses: ['amount'] }

function summary(table, rows) {
  const out = {}
  for (const r of rows) {
    const key = r.branch || '(unassigned)'
    const s = (out[key] ||= { rows: 0, ...Object.fromEntries(MONEY[table].map((c) => [c, 0])) })
    s.rows++
    for (const c of MONEY[table]) s[c] += Number(r[c]) || 0
  }
  return Object.fromEntries(Object.entries(out).sort())
}

async function main() {
  // --skip-expenses: leave that table out on purpose (e.g. it is empty in Airtable). Never implicit.
  const tables = Object.keys(SPEC).filter((t) => !(skipExpenses && t === 'expenses'))
  const data = Object.fromEntries(tables.map((t) => [t, load(t)]))

  for (const [t, rows] of Object.entries(data)) {
    console.log(`\n${t}: ${rows.length} rows`)
    console.table(summary(t, rows))
  }
  const studentIds = new Set(data.students.map((s) => s.id))
  console.log(`Payments with no matching student: ${data.payments.filter((p) => !studentIds.has(p.student_id)).length}`)

  if (problems.length) {
    console.error(`\n❌ ${problems.length} problem(s). Nothing was written.`)
    for (const p of problems.slice(0, 40)) console.error('  -', p)
    process.exitCode = 1
    return
  }
  if (!apply) { console.log('\n✅ Dry run passed. Nothing was written.'); return }

  for (const [t, rows] of Object.entries(data)) {
    for (let i = 0; i < rows.length; i += 500) {
      await supabaseRequest(env, 'POST', t, [['on_conflict', 'id']], {
        body: rows.slice(i, i + 500),
        prefer: 'resolution=merge-duplicates,return=minimal',
      })
    }
    const stored = await supabaseSelectAll(env, t)
    const same = JSON.stringify(summary(t, stored)) === JSON.stringify(summary(t, rows))
    console.log(`${same ? '✅' : '❌'} ${t}: ${stored.length} in Supabase, ${rows.length} in CSV`)
    if (!same) { console.table(summary(t, stored)); process.exitCode = 1 }
  }
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exitCode = 1
})
