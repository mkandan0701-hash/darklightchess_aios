# Darklight Chess Academy AIOS

**Internal operations dashboard + 5 automation workflows for a 3-branch chess academy.**

Next.js 14 App Router · TypeScript · Tailwind · deployed on Vercel · **Airtable is the system of record.**

> ClickUp was fully removed in commit `69b8ede`. Some API route *paths* still read `/api/clickup/*` —
> that naming is vestigial. Every one of them talks to Airtable. Do not add ClickUp code.

---

## 1. Current state

All 5 automation workflows are **built and live**. This is not a greenfield project.

### Pages (9)

| Path | Purpose | Who can see it |
|---|---|---|
| `/` | Dashboard — stat cards (leads, students, revenue, overdue, expenses, net profit), quick actions | admin + superadmin |
| `/students` | Student list, add, delete, payment link, mark paid/unpaid | admin + superadmin |
| `/leads` | Lead funnel, add, delete, book demo, convert to student | admin + superadmin |
| `/payments` | Payment list, remind, mark paid/unpaid | admin + superadmin |
| `/finance` | Expense entry/delete, Income/Expense/Net Profit summary (current month, per-branch for superadmin) | admin + superadmin |
| `/communications` | Email / WhatsApp composer | admin + superadmin |
| `/analytics` | Funnel, revenue, source conversion, income-vs-expense charts | **superadmin only** |
| `/settings` | API connection status, JSON export | **superadmin only** |
| `/login` | Credential login | public |

### API routes (27)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/auth/login` | POST | Credential login → session cookie | public (rate limited) |
| `/api/auth/logout` | POST | Clear session | session |
| `/api/auth/branch` | POST | Superadmin switches active branch | superadmin |
| `/api/auth/google` | GET | Google OAuth consent redirect | **superadmin** |
| `/api/auth/google/callback` | GET | Prints `GOOGLE_REFRESH_TOKEN` | **superadmin** |
| `/api/clickup/students` | GET/POST | List / create students (Airtable) | session, branch-scoped |
| `/api/clickup/students/delete` | POST | Hard-delete a student, cascading to all their Payments | **superadmin**, scope-asserted |
| `/api/clickup/leads` | GET/POST | List / create leads | session, branch-scoped |
| `/api/clickup/leads/delete` | POST | Hard-delete a lead | **superadmin**, scope-asserted |
| `/api/clickup/payments` | GET | List payments | session, branch-scoped |
| `/api/clickup/stats` | GET | Dashboard aggregates incl. `monthlyExpenses`/`netProfit` (+ `byBranch` for superadmin) | session, branch-scoped |
| `/api/expenses` | GET/POST | List / create expenses | session, branch-scoped |
| `/api/expenses/delete` | POST | Hard-delete an expense | **superadmin**, scope-asserted |
| `/api/leads/convert` | POST | Lead → Student; student inherits the lead's branch | session, scope-asserted |
| `/api/mark-paid` | POST | Mark paid (student- or payment-driven) + receipt email/WhatsApp | session, scope-asserted |
| `/api/mark-unpaid` | POST | Revert to pending (student- or payment-driven) | session, scope-asserted |
| `/api/send-reminder` | POST | Overdue reminder email/WhatsApp | session, scope-asserted |
| `/api/payment-link` | POST | Razorpay invoice + email/WhatsApp | session, scope-asserted |
| `/api/schedule-demo` | POST | Google Meet event + confirmations | session, scope-asserted |
| `/api/communications/email` | POST | Send an email | session |
| `/api/communications/whatsapp` | POST | Send a WhatsApp message | session |
| `/api/razorpay/payments` | GET | Raw Razorpay payments (no branch dimension) | **superadmin** |
| `/api/settings/status` | GET | Which integrations are configured | **superadmin** |
| `/api/webhooks/lead-capture` | POST | External form → lead + coach assign + welcome | per-branch shared secret |
| `/api/webhooks/payment` | POST | Razorpay payment → enroll + receipt | Razorpay HMAC |
| `/api/cron/daily-reminders` | GET | 09:00 daily overdue sweep | `Bearer CRON_SECRET` |

### Workflows

| # | Workflow | Entry point | Status |
|---|---|---|---|
| 1 | Lead capture + coach assignment | `/api/webhooks/lead-capture` | live |
| 2 | Demo scheduling + Google Meet | `/api/schedule-demo` | live |
| 3 | Payment link generation | `/api/payment-link` | live |
| 4 | Payment received processing | `/api/webhooks/payment` | live |
| 5 | Daily overdue reminders | `/api/cron/daily-reminders` | live (`vercel.json` cron) |

---

## 2. Stack and hard constraints

**Dependencies are deliberately minimal:** `next@14.2.0`, `react`, `react-dom`, `recharts`, `nodemailer`.

- **No-new-npm-deps rule.** Auth is built on Node's built-in `crypto` and the Web Crypto API. Do not
  add `next-auth`, `jose`, `bcrypt`, `jsonwebtoken`, an Airtable SDK, SWR, or react-query. If you
  think you need one, say so and ask first.
- **Next 14.2 ⇒ `middleware.ts` runs on the Edge runtime, with no opt-out.** `export const runtime = 'nodejs'`
  in middleware is a Next 15.2+ feature. Middleware therefore verifies sessions with
  `crypto.subtle` (`lib/auth/session-edge.ts`), never `node:crypto`.
- **Never create a barrel file at `lib/auth/index.ts`.** It would let the Edge middleware bundle
  transitively pull in `node:crypto` and break the build. `session-edge.ts` imports only
  `base64url.ts` and `types.ts`.
- No database. Airtable REST is called with raw `fetch` from `lib/airtableClient.ts`.
- All pages are `'use client'` and fetch from `/api/*` in `useEffect`. The only server components are
  `app/layout.tsx` and `app/(dashboard)/layout.tsx`.

---

## 3. Branch and role model

The academy runs **3 branches**. Branch identity is stored in Airtable as an **opaque id**; the
human-readable name lives in the `ACADEMY_BRANCHES` env var, so renaming a branch is an env edit and
never a data migration.

| Branch id | Display name |
|---|---|
| `BRANCH_SAIBABA` | Saibaba Colony |
| `BRANCH_SOWRIPALAYAM` | Sowripalayam |
| `BRANCH_KUNIYAMUTHUR` | Kuniyamuthur |

Two roles:

| Role | Sees | Can mutate | Notes |
|---|---|---|---|
| `admin` | exactly one branch | records in that branch only | 2 of these — one per branch |
| `superadmin` | all 3 branches + Unassigned | any record | 1 of these; home branch `BRANCH_SAIBABA`, which they run directly |

Assignment:

- Superadmin (Manikandan) → `BRANCH_SAIBABA` (runs it directly; also where online-sourced leads and
  students land — see below)
- Admin A → `BRANCH_SOWRIPALAYAM`
- Admin B → `BRANCH_KUNIYAMUTHUR`
- Records created by the superadmin while viewing "All Branches" default to `BRANCH_SAIBABA`

**Online lead intake.** Leads created through the external `lead-capture` webhook (the academy's
website form / Meta ads integration) are always attributed to `BRANCH_SAIBABA`, regardless of which
branch the lead would otherwise seem to belong to — see `LEAD_WEBHOOK_SECRETS` in §6. Converting such
a lead into a student inherits the same branch (`app/api/leads/convert/route.ts`), so online-sourced
students show up under Saibaba Colony automatically, with no separate "online" field needed. Leads
added by hand through the dashboard still go to whichever branch the entering admin is scoped to.

**The Unassigned rule.** A record with an empty `branch` field is visible to the **superadmin only**.
This is the deliberate fail-safe: an unclassified record is never silently exposed to the wrong
admin. The superadmin's job is to triage the Unassigned bucket.

**The branch cookie is not a privilege.** `dl_branch` only ever *narrows* what a superadmin sees. For
an `admin` it is ignored entirely — `scopeForSession` never reads it for that role.

---

## 4. Authorization model

Three independent planes. Each one assumes the others might have a hole.

1. **Gate** — `middleware.ts` rejects any request without a valid session cookie. Pages get a 307 to
   `/login?next=…`; `/api/*` gets a 401 JSON body. Public prefixes are exactly
   `/login`, `/api/auth/login`, `/api/webhooks/`, `/api/cron/`.
2. **Read scoping** — every Airtable read goes through one private `list()` method that applies a
   `filterByFormula` derived from the caller's `Scope`. There is no unscoped read export.
3. **Write authorization** — every mutation calls `assertInScope(table, recordId)` *before* patching.

The invariant, stated once:

> **Middleware gates the request. Every Airtable read carries a scope. Every mutation asserts the
> target record is in scope.**

Two rules that are easy to get wrong:

- **Middleware sets no identity headers, and handlers never read any.** `withAuth` re-verifies the
  cookie itself with `node:crypto`. A gap in the matcher can therefore never become an auth bypass.
- **`assertInScope` runs before `patchRecord`, not inside it.** `patchRecord` logs and returns `void`
  on a non-OK response — authorization placed inside it would fail *open*.

Cross-branch record ids are reported to the client as **404, not 403**, so an admin cannot enumerate
another branch's record ids by probing status codes. The real denial is logged server-side as
`[RBAC DENY]`.

---

## 5. Data model

Airtable base `AIRTABLE_BASE_ID`, four tables. Field names are **snake_case in Airtable** and
camelCase in `lib/types.ts`; the mappers in `lib/airtableClient.ts` translate.

| Table | Fields |
|---|---|
| **Students** | `id`, `name`, `email`, `phone`, `age`, `coach`, `status`, `payment_status`, `amount_due`, `classes_per_week`, `duration`, `grade`, `payment_link`, `invoice_id`, `created_at`, **`branch`** |
| **Leads** | `id`, `name`, `email`, `phone`, `source`, `coach_assigned`, `status`, `notes`, `demo_date`, `demo_time`, `meet_link`, `created_at`, **`branch`** |
| **Payments** | `id`, `student_id`, `student_name`, `amount`, `amount_paid`, `status`, `due_date`, `paid_date`, `payment_id`, `invoice_id`, `reminder_sent_at`, `created_at`, **`branch`** |
| **Expenses** | `id`, `description`, `amount`, `category`, `date`, **`branch`** |

**Expenses is a manually-created table** (there's no `add-expenses-field.js` equivalent to
`add-branch-field.js`) — before this feature ships, create it in the base with `description` (text),
`amount` (number), `category` (single line text or singleSelect), `date` (date), and a `branch`
singleSelect with the same 3 branch-id choices pre-created as the other tables, for the same
typecast-safety reason as below.

`branch` is a `singleSelect` whose choices are the **branch ids** (`BRANCH_SAIBABA`, …), not the
display names. Pre-creating those choices is what stops `typecast: true` from inventing a
`Branch_1`-style typo choice on the first bad write.

Two traps:

- **`id` is not the record id.** `Student.id` / `Lead.id` / `Payment.id` in TypeScript hold Airtable's
  `rec…` id. The tables *also* carry a legacy text column literally named `id`, holding old ClickUp
  task ids. They are different values. Mutations address records by the `rec…` id.
- **singleSelect fields deserialize as `{id, name, color}`**, not a string. Always read them through
  the `selectName()` helper.

---

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AIRTABLE_API_KEY` | yes | PAT. Needs `schema.bases:write` to run `scripts/add-branch-field.js`. |
| `AIRTABLE_BASE_ID` | yes | Base id |
| `AUTH_SECRET` | **yes** | ≥32 chars, `openssl rand -hex 32`. HMAC key for session tokens. |
| `ACADEMY_USERS` | **yes** | JSON array of users (below) |
| `ACADEMY_USERS_B64` | no | base64 of the above, for pasting into the Vercel UI |
| `ACADEMY_BRANCHES` | no | JSON `[{id,name}]`; falls back to the 3 built-in ids |
| `SESSION_TTL_HOURS` | no | default `12` |
| `LEAD_WEBHOOK_SECRETS` | no | JSON map `secret → branch id`. The academy's online form / Meta ads integration should send whatever secret is mapped to `BRANCH_SAIBABA` here. |
| `LEAD_WEBHOOK_SECRET` | no | legacy single secret; falls back to `BACKFILL_DEFAULT_BRANCH`. Currently unset (empty) in production — superseded by `LEAD_WEBHOOK_SECRETS`. |
| `BACKFILL_DEFAULT_BRANCH` | no | default `BRANCH_SAIBABA` — the superadmin's home branch, and the catch-all for anything that can't be classified |
| `COACH_BRANCH_MAP` | no | JSON `coach name → branch id`, used by the backfill script |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | | payments |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | | outbound email |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | | WhatsApp |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `GOOGLE_REFRESH_TOKEN` / `GOOGLE_CALENDAR_ID` | | Meet links |
| `CRON_SECRET` | | Vercel cron auth |
| `COACH_POOL` | no | JSON array of coaches for lead assignment |

`ACADEMY_USERS` shape — one line, unquoted, no `#` (the `.env.local` loader in `scripts/` parses
`^([A-Z0-9_]+)=(.*)$`):

```json
[
  {"email":"admin.saibaba@darklight.in","name":"Admin A","role":"admin","branch":"BRANCH_SOWRIPALAYAM","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"},
  {"email":"admin.sowripalayam@darklight.in","name":"Admin B","role":"admin","branch":"BRANCH_KUNIYAMUTHUR","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"},
  {"email":"manikandan@darklight.in","name":"Manikandan","role":"superadmin","branch":"BRANCH_SAIBABA","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"}
]
```

⚠️ The account emails here are still placeholders from initial setup and no longer match their
branch (`admin.saibaba@…` now manages Sowripalayam, not Saibaba) — the `branch` field is what's
authoritative, not the email string. Rename the emails once real staff accounts replace these.

⚠️ The hash is `.`-delimited, not the traditional `$`-delimited `scrypt$N$r$p$salt$hash` — Next's
env loader runs `dotenv-expand` over every value in `.env.local` and silently strips anything
matching `$word`. Never hand-write a hash with `$` in it.

Generate a hash with:

```bash
node scripts/hash-password.js 'the-password'
node scripts/hash-password.js --user admin.saibaba@darklight.in,Admin A,admin,BRANCH_SAIBABA 'the-password'
```

⚠️ **`AUTH_SECRET` is inlined into the Edge middleware bundle at build time.** Rotating it requires a
**redeploy**, not just an env-var update. Both session modules throw on first use if it is missing or
under 32 chars — and they throw *outside* the verify `try`, so a misconfiguration surfaces as a 500
rather than as a silent "every session is invalid". (First use, not module load, so `npm run build`
still works in an environment without secrets.)

---

## 7. Key files

| File | Role |
|---|---|
| `middleware.ts` | The gate. Edge runtime. Public-prefix list lives here. |
| `lib/airtableClient.ts` | The **only** data access. Scoped instance via `forScope()` / `system()`. |
| `lib/auth/session.ts` / `session-edge.ts` | Sign + verify. Node and Edge halves, deliberately separate. |
| `lib/auth/rbac.ts` | `scopeForSession`, `canAccessBranch` — the role → scope rules. |
| `lib/auth/withAuth.ts` | Route wrapper. Injects `{ session, scope, db }`. |
| `lib/branches.ts` | Branch ids, display names, `isValidBranchId` whitelist. |
| `app/(dashboard)/layout.tsx` | Verifies session server-side, injects `SessionProvider`. |
| `app/(dashboard)/analytics/layout.tsx`, `.../settings/layout.tsx` | Server-side `role === 'superadmin'` gate. The Sidebar hiding these links is UX only — these layouts are what actually stop a branch admin from loading the page by URL. |
| `scripts/add-branch-field.js` | One-shot: adds the `branch` singleSelect via the Airtable Meta API. |
| `scripts/backfill-branch.js` | One-shot: assigns branches to pre-existing records. `--apply` to write. |
| `scripts/cleanup-orphaned-payments.js` | One-shot: deletes Payment rows whose `student_id` points at a deleted Student — retroactive fix for students deleted before `deleteStudent()` cascaded. `--apply` to write. |

---

## 8. Setup and verification

```bash
npm install
cp .env.example .env.local          # fill in AUTH_SECRET, ACADEMY_USERS, AIRTABLE_*

node scripts/hash-password.js 'pw'  # → paste into ACADEMY_USERS
node scripts/add-branch-field.js    # adds the branch column (needs schema.bases:write)
node scripts/backfill-branch.js     # dry run — review the output
node scripts/backfill-branch.js --apply

npx tsc --noEmit && npm run build
npm run dev
```

`tsc` is the real check: because the unscoped static reads were deleted from `AirtableClient`, any
call site that forgot to pass a scope is a type error.

### Acceptance checks

1. `curl -i localhost:3000/` → 307 to `/login?next=%2F`.
   `curl -i localhost:3000/api/clickup/students` → **401 JSON**, not a redirect.
2. Webhooks and cron still work unauthenticated-by-cookie:
   `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/daily-reminders` → 200.
3. Log in as each of the 3 users. Wrong password → a generic error; the 6th attempt in 15 min → 429.
4. **Read isolation** — as Admin A, `/students` `/leads` `/payments` show only Sowripalayam rows.
   Repeat as Admin B (Kuniyamuthur); confirm the two sets are disjoint.
5. **IDOR blocked** — take a Kuniyamuthur student's `rec…` id and, as Admin A:
   `curl -b 'dl_session=<A>' -X POST localhost:3000/api/mark-paid -d '{"studentId":"rec…","studentName":"x"}'`
   → **404**, the Airtable record unchanged, `[RBAC DENY]` in the server log. Repeat for
   `mark-unpaid`, `send-reminder`, `payment-link`, `schedule-demo`, `leads/convert`.
6. **Header spoofing** — the same call with `-H 'x-dl-user: manikandan@…'` → still 404.
7. **Cookie tampering** — flip a character in `dl_session` → 401. A token signed with a different
   `AUTH_SECRET` → rejected. An unsigned hand-crafted `{"role":"superadmin"}` → rejected.
8. **Branch cookie is not a privilege** — as Admin A,
   `-b 'dl_session=<A>; dl_branch=BRANCH_KUNIYAMUTHUR'` → still only Sowripalayam.
   `POST /api/auth/branch` as Admin A → **403**.
9. **Superadmin** — sees all 3, the per-branch cards sum to the totals, the switcher narrows and
   restores, Analytics and Settings are reachable (Admin A gets no nav item and a 403 on the API).
10. **Unassigned** — a record with an empty `branch` is invisible to both admins, visible to the
    superadmin in All Branches mode.
11. **Expiry / logout** — `SESSION_TTL_HOURS=0.01`, wait, refresh → `/login`. Logout clears the
    cookie and the back button re-redirects.

---

## 9. Known issues and deliberate non-goals

- **Legacy `Payment.student_id` rows may still be unreliable.** Before this feature, no code path ever
  wrote a Payments row at all — `markStudentPaidManually` and `enrollStudent` (Razorpay webhook) both
  only ever patched `Students.payment_status`, so `computeStats`/Analytics (which read exclusively
  from Payments) never saw manual marks or real payments survive a refresh, and every historical
  Payment row was entered by hand. Both paths now find-or-create a properly-linked Payments row
  (`AirtableClient.recordPayment`, used by `markStudentPaidManually` and `enrollStudent`); every row
  written going forward carries a correct `student_id`, so the join is self-healing over time without
  needing to trust or migrate old hand-entered rows. Payments that still can't be resolved to a
  student are left **Unassigned** by the backfill script rather than guessed.
- **Reads are now paginated.** They previously capped silently at Airtable's first 100 records.
  Records that were invisible before will now appear — that is a fix, not a regression.
- **`schedule-demo` writes the lead status `'Demo Scheduled'`** while the type union expects
  `'demo_booked'`. With `typecast: true` Airtable silently creates a junk select choice. Pre-existing;
  not fixed here.
- **`/api/communications/*` takes a free-form `to:` address.** There is no record to scope it
  against, so a branch admin can email an arbitrary address. Residual risk; a follow-up should
  require a recipient drawn from the caller's own branch.
- **`mark-paid` trusts client-supplied `studentName` / `parentEmail` / `amount`** for the receipt
  body. A same-branch admin can send a receipt with a wrong amount. Out of scope.
- **Settings persist to `localStorage`** (`darklight_settings`), per-browser. They are not
  server-side and not branch-scoped.
- **Coach matching is availability-only** (`lib/coachMatcher.ts`) — no per-branch coach routing.
- **Login rate limiting is a module-level `Map`**, therefore per-serverless-instance and advisory
  only.
- **No audit log.** `[RBAC DENY]` plus `by: session.email` on action logs is the entire trail.
  Acceptable at 3 users.
- **Student/Lead/Expense delete is a hard delete**, no soft-delete field exists. Deleting a Student
  **does cascade** to every linked Payment record (`AirtableClient.deleteStudent` → `findMany` +
  `deleteRecordsBatch`, paid/pending/overdue all go, batched 10-at-a-time) — their revenue history
  is removed along with them, by design. The Payment lookup is deliberately unscoped
  (`findMany(..., applyScope: false)`) so it isn't silently narrowed by a superadmin's `dl_branch`
  cookie; it still can't catch a Payment whose `student_id` was never correctly linked in the
  first place (the pre-existing "unreliable join" case above) — `scripts/cleanup-orphaned-payments.js`
  is the one-shot fix for any such row left behind by a student deleted before this cascade existed.
  Delete is **superadmin-only** for all three (Students, Leads, Expenses): enforced server-side via
  `withAuth(handler, { roles: ['superadmin'] })` on each delete route, with the Delete button hidden
  client-side as UX only for branch admins. Guarded client-side by a `window.confirm()`, not a
  `Modal`.
- **`/finance` is visible to both `admin` and `superadmin`**, unlike `/analytics`/`/settings`. A
  branch admin's Net Profit there is computed only from their own branch-scoped `getStats()` result —
  the same scoping every other page already relies on — so this doesn't expose whole-business figures
  to a branch admin.
