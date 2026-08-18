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
  return branches[branches.length - 1].id
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = { loadEnvLocal, airtableHeaders, getBranches, defaultBranchId, sleep }
