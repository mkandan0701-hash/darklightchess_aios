// Shared helpers for the one-shot maintenance scripts.
// Same .env.local parser as scripts/migrate-to-airtable.js: values must be single-line and
// unquoted, which is why the JSON env vars in .env.example are written on one line.

const fs = require('fs')

function loadEnvLocal(required = []) {
  const env = {}
  let content = ''
  try {
    content = fs.readFileSync('.env.local', 'utf8')
  } catch {
    console.error('❌ Could not read .env.local from the current directory.')
    process.exit(1)
  }
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  for (const key of required) {
    if (!env[key]) {
      console.error(`❌ Missing ${key} in .env.local`)
      process.exit(1)
    }
  }
  return env
}

function airtableHeaders(env) {
  return { Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' }
}

const FALLBACK_BRANCHES = [
  { id: 'BRANCH_SAIBABA', name: 'Saibaba Colony' },
  { id: 'BRANCH_SOWRIPALAYAM', name: 'Sowripalayam' },
  { id: 'BRANCH_KUNIYAMUTHUR', name: 'Kuniyamuthur' },
  { id: 'BRANCH_THOPPAMPATI', name: 'Thoppampati' },
]

/** Mirrors getBranches() in lib/branches.ts. Kept in sync by hand — these are plain node scripts. */
function getBranches(env) {
  if (!env.ACADEMY_BRANCHES) return FALLBACK_BRANCHES
  try {
    const parsed = JSON.parse(env.ACADEMY_BRANCHES)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((b) => ({ id: String(b.id), name: String(b.name || b.id) }))
    }
  } catch {
    console.error('❌ ACADEMY_BRANCHES is not valid JSON.')
    process.exit(1)
  }
  return FALLBACK_BRANCHES
}

function defaultBranchId(env) {
  const branches = getBranches(env)
  const configured = env.BACKFILL_DEFAULT_BRANCH
  if (configured && branches.some((b) => b.id === configured)) return configured
  return branches[0].id
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function supabaseRequest(env, method, table, params = [], { body, prefer } = {}) {
  const url = new URL(`/rest/v1/${table}`, env.SUPABASE_URL)
  for (const [k, v] of params) url.searchParams.append(k, v)
  const res = await fetch(url, {
    method,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${method} ${table}: ${res.status} ${text.slice(0, 500)}`)
  return { rows: text ? JSON.parse(text) : [], total: Number(res.headers.get('content-range')?.split('/')[1]) }
}

/** Every row, whatever the server's page cap. `pageSize` is adjustable so paging can be tested. */
async function supabaseSelectAll(env, table, pageSize = 1000) {
  const out = []
  for (;;) {
    const { rows, total } = await supabaseRequest(
      env, 'GET', table,
      [['order', 'id'], ['limit', String(pageSize)], ['offset', String(out.length)]],
      { prefer: 'count=exact' }
    )
    out.push(...rows)
    if (!Number.isFinite(total)) throw new Error(`Supabase returned no row count for ${table}`)
    if (out.length >= total) return out
    if (rows.length === 0) throw new Error(`Supabase returned ${out.length} of ${total} rows for ${table}`)
  }
}

module.exports = {
  loadEnvLocal, airtableHeaders, getBranches, defaultBranchId, sleep, supabaseRequest, supabaseSelectAll,
}
