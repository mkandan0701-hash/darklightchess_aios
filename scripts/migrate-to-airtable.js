const fs = require('fs')

function loadEnvLocal() {
  const env = {}
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

const env = loadEnvLocal()

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
const AIRTABLE_BASE = 'https://api.airtable.com/v0'

const REQUIRED_ENV = [
  'CLICKUP_API_KEY',
  'CLICKUP_LIST_STUDENTS',
  'CLICKUP_LIST_LEADS',
  'CLICKUP_LIST_PAYMENTS',
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
]
for (const key of REQUIRED_ENV) {
  if (!env[key]) {
    console.error(`❌ Missing ${key} in .env.local`)
    process.exit(1)
  }
}

function clickupHeaders() {
  return { Authorization: env.CLICKUP_API_KEY, 'Content-Type': 'application/json' }
}

function airtableHeaders() {
  return { Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' }
}

function toISODate(value) {
  if (value === undefined || value === null || value === '') return undefined
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  const num = Number(str)
  if (!Number.isNaN(num) && num > 0) return new Date(num).toISOString().slice(0, 10)
  return undefined
}

function numOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function getField(task, name) {
  const fields = task.custom_fields || []
  const f = fields.find((f) => f.name === name)
  return f && f.value !== null && f.value !== undefined ? f.value : undefined
}

function stripEmpty(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') out[k] = v
  }
  return out
}

const ISO_DATE = { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } }

// Field names left out below (age, coach, coach_assigned, status on Students, invoice_id)
// have no source in ClickUp today — see plan doc. They still get created as empty Airtable
// columns so the schema matches what was requested; they just won't be populated.
const TABLE_SCHEMAS = {
  Students: [
    { name: 'id', type: 'singleLineText' },
    { name: 'name', type: 'singleLineText' },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'phoneNumber' },
    { name: 'age', type: 'number', options: { precision: 0 } },
    { name: 'coach', type: 'singleLineText' },
    { name: 'status', type: 'singleSelect', options: { choices: [{ name: 'active' }, { name: 'pending' }, { name: 'inactive' }] } },
    { name: 'payment_status', type: 'singleSelect', options: { choices: [{ name: 'paid' }, { name: 'pending' }, { name: 'overdue' }] } },
    { name: 'amount_due', type: 'number', options: { precision: 2 } },
    { name: 'created_at', type: 'date', options: ISO_DATE },
  ],
  Leads: [
    { name: 'id', type: 'singleLineText' },
    { name: 'name', type: 'singleLineText' },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'phoneNumber' },
    { name: 'source', type: 'singleLineText' },
    { name: 'coach_assigned', type: 'singleLineText' },
    {
      name: 'status',
      type: 'singleSelect',
      // Real ClickUp lead statuses (new/contacted/demo_booked/demo_done/converted/lost) -
      // a superset of the 4 values in the original request, so no lead gets dropped/miscategorized.
      options: { choices: ['new', 'contacted', 'demo_booked', 'demo_done', 'converted', 'lost'].map((name) => ({ name })) },
    },
    { name: 'created_at', type: 'date', options: ISO_DATE },
    { name: 'notes', type: 'multilineText' },
  ],
  Payments: [
    { name: 'id', type: 'singleLineText' },
    { name: 'student_name', type: 'singleLineText' },
    { name: 'amount', type: 'number', options: { precision: 2 } },
    { name: 'status', type: 'singleSelect', options: { choices: [{ name: 'pending' }, { name: 'paid' }, { name: 'overdue' }] } },
    { name: 'due_date', type: 'date', options: ISO_DATE },
    { name: 'paid_date', type: 'date', options: ISO_DATE },
    { name: 'payment_id', type: 'singleLineText' },
    { name: 'invoice_id', type: 'singleLineText' },
    { name: 'created_at', type: 'date', options: ISO_DATE },
  ],
}

function mapStudent(task) {
  return stripEmpty({
    id: task.id,
    name: task.name,
    email: getField(task, 'Email'),
    phone: getField(task, 'Phone'),
    payment_status: getField(task, 'Payment Status'),
    amount_due: numOrUndefined(getField(task, 'Monthly Fee')),
    created_at: toISODate(getField(task, 'Enrolled Date')),
  })
}

function mapLead(task) {
  return stripEmpty({
    id: task.id,
    name: task.name,
    email: getField(task, 'Email'),
    phone: getField(task, 'Phone'),
    source: getField(task, 'Source'),
    status: getField(task, 'Status'),
    created_at: toISODate(getField(task, 'Date Received')),
    notes: getField(task, 'Notes'),
  })
}

function mapPayment(task) {
  return stripEmpty({
    id: task.id,
    student_name: task.name,
    amount: numOrUndefined(getField(task, 'Amount Due')),
    status: getField(task, 'Payment Status'),
    due_date: toISODate(getField(task, 'Due Date')),
    paid_date: toISODate(getField(task, 'Paid Date')),
    payment_id: getField(task, 'Razorpay Payment ID'),
    created_at: toISODate(task.date_created),
  })
}

async function fetchClickUpTasks(listId) {
  const res = await fetch(`${CLICKUP_BASE}/list/${listId}/task?archived=false`, { headers: clickupHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch ClickUp list ${listId}: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.tasks
}

async function listExistingTables() {
  const res = await fetch(`${AIRTABLE_BASE}/meta/bases/${env.AIRTABLE_BASE_ID}/tables`, { headers: airtableHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to list Airtable tables: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.tables
}

async function createTable(name, fields) {
  const res = await fetch(`${AIRTABLE_BASE}/meta/bases/${env.AIRTABLE_BASE_ID}/tables`, {
    method: 'POST',
    headers: airtableHeaders(),
    body: JSON.stringify({ name, fields }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create table "${name}": ${res.status} ${text}`)
  }
  return res.json()
}

async function batchCreateRecords(tableId, records) {
  let created = 0
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10)
    const res = await fetch(`${AIRTABLE_BASE}/${env.AIRTABLE_BASE_ID}/${tableId}`, {
      method: 'POST',
      headers: airtableHeaders(),
      body: JSON.stringify({ records: chunk.map((fields) => ({ fields })), typecast: true }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`❌ Failed to import records ${i}-${i + chunk.length}: ${res.status} ${text}`)
      continue
    }
    const data = await res.json()
    created += data.records.length
    if (i + 10 < records.length) await new Promise((r) => setTimeout(r, 250))
  }
  return created
}

async function countRecords(tableId) {
  let count = 0
  let offset
  do {
    const url = new URL(`${AIRTABLE_BASE}/${env.AIRTABLE_BASE_ID}/${tableId}`)
    url.searchParams.set('pageSize', '100')
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url, { headers: airtableHeaders() })
    if (!res.ok) throw new Error(`Failed to verify records: ${res.status}`)
    const data = await res.json()
    count += data.records.length
    offset = data.offset
  } while (offset)
  return count
}

async function migrateTable(tableName, listId, mapFn, existingTables) {
  console.log(`\n--- ${tableName} ---`)

  let table = existingTables.find((t) => t.name === tableName)
  if (table) {
    console.log(`⚠️  Table "${tableName}" already exists, skipping creation`)
  } else {
    table = await createTable(tableName, TABLE_SCHEMAS[tableName])
    existingTables.push(table)
    console.log(`✅ Created table "${tableName}"`)
  }

  const tasks = await fetchClickUpTasks(listId)
  console.log(`Fetched ${tasks.length} ${tableName.toLowerCase()} from ClickUp`)

  const records = tasks.map(mapFn)
  const created = await batchCreateRecords(table.id, records)
  console.log(`✅ Imported ${created}/${tasks.length} ${tableName.toLowerCase()}`)

  const verified = await countRecords(table.id)
  console.log(`Verified: ${verified} records now in Airtable "${tableName}"`)

  return { expected: tasks.length, imported: created, verified }
}

async function main() {
  console.log('Starting ClickUp -> Airtable migration...')

  const existingTables = await listExistingTables()

  const students = await migrateTable('Students', env.CLICKUP_LIST_STUDENTS, mapStudent, existingTables)
  const leads = await migrateTable('Leads', env.CLICKUP_LIST_LEADS, mapLead, existingTables)
  const payments = await migrateTable('Payments', env.CLICKUP_LIST_PAYMENTS, mapPayment, existingTables)

  const allVerified =
    students.verified === students.expected &&
    leads.verified === leads.expected &&
    payments.verified === payments.expected

  console.log('\n=== SUMMARY ===')
  console.log('✅ Tables created')
  console.log(`✅ ${students.imported} students imported (verified: ${students.verified}/${students.expected})`)
  console.log(`✅ ${leads.imported} leads imported (verified: ${leads.verified}/${leads.expected})`)
  console.log(`✅ ${payments.imported} payments imported (verified: ${payments.verified}/${payments.expected})`)
  console.log(allVerified ? '✅ All data verified' : '⚠️  Some counts do not match — check logs above')
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
