#!/usr/bin/env node
//
// Generate a scrypt password hash for ACADEMY_USERS.
//
//   node scripts/hash-password.js 'the-password'
//   node scripts/hash-password.js --user admin.saibaba@darklight.in,Admin A,admin,BRANCH_SAIBABA 'the-password'
//
// The password is read from argv only — it is never echoed back and never written to a file.
//
// The cost parameters below intentionally mirror lib/auth/users.ts. This is a plain node
// script with no build step, so the duplication is deliberate; if you raise the parameters
// there, raise them here too. (Existing hashes stay valid — the cost is encoded in the string.)
//
// The hash is `.`-delimited, not `$`-delimited (unlike the traditional scrypt$N$r$p$salt$hash
// format): this string gets pasted into .env.local, and Next's env loader runs dotenv-expand
// over every value, silently stripping anything that looks like `$word`. Never use `$` here.

const crypto = require('crypto')

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const SALT_BYTES = 16

function hashPassword(plaintext) {
  const salt = crypto.randomBytes(SALT_BYTES)
  const derived = crypto.scryptSync(plaintext, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), derived.toString('base64')].join('.')
}

function usage(message) {
  if (message) console.error(`❌ ${message}\n`)
  console.error("Usage: node scripts/hash-password.js [--user <email,name,role,branch>] '<password>'")
  console.error("  e.g. node scripts/hash-password.js 'Correct-Horse-1'")
  console.error("       node scripts/hash-password.js --user a@b.in,Admin A,admin,BRANCH_SAIBABA 'Correct-Horse-1'")
  process.exit(1)
}

const args = process.argv.slice(2)
let userSpec = null

const flagIndex = args.indexOf('--user')
if (flagIndex !== -1) {
  userSpec = args[flagIndex + 1]
  if (!userSpec) usage('--user needs a value: <email,name,role,branch>')
  args.splice(flagIndex, 2)
}

const password = args[0]
if (!password) usage('No password given.')
if (password.length < 8) usage('Use a password of at least 8 characters.')

const hash = hashPassword(password)

if (!userSpec) {
  console.log(hash)
  process.exit(0)
}

const [email, name, role, branch] = userSpec.split(',').map((s) => (s || '').trim())
if (!email || !name || !role || !branch) usage('--user must be <email,name,role,branch>')
if (role !== 'admin' && role !== 'superadmin') usage(`role must be "admin" or "superadmin", got "${role}"`)

console.log('\nAdd this object to the ACADEMY_USERS array in .env.local (keep it on one line):\n')
console.log(JSON.stringify({ email, name, role, branch, passwordHash: hash }))
console.log('')
