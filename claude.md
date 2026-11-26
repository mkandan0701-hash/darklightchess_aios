# Darklight Chess Academy AIOS

**Internal operations dashboard + 6 automation workflows for a 4-branch chess academy.**

Next.js 14 App Router · TypeScript · Tailwind · deployed on Vercel · **Supabase (Postgres) is the system of record.**

> ClickUp was fully removed in commit `69b8ede`. Some API route *paths* still read `/api/clickup/*` —
> that naming is vestigial. Every one of them talks to the database (Supabase). Do not add ClickUp code.

> **Airtable → Supabase, 2026-11-26.** Airtable's monthly API quota ran out twice (10-27, 11-23) and took the
> dashboard down. The data now lives in Supabase Postgres on the Free plan (project `darklight-aios`,
> `ap-south-1`, ref `badvspldtfwqlmxugmiv`, org "darklightchessaios"). The old Airtable base was left
> untouched as a fallback; its scripts are in `scripts/airtable-legacy/` and do not work against Supabase.

---

## 1. Current state

All 6 automation workflows are **built and live**. This is not a greenfield project.

### Pages (9)

| Path | Purpose | Who can see it |
|---|---|---|
| `/` | Dashboard — stat cards (leads, students, revenue, overdue, expenses, net profit), quick actions | admin + superadmin |
| `/students` | Student list, add, delete, payment link, mark paid/unpaid, pause/resume for a month | admin + superadmin |
| `/leads` | Lead funnel, add, delete, book demo, convert to student | admin + superadmin |
| `/payments` | Payment list for one month at a time (prev/next switcher), remind, mark paid/unpaid | admin + superadmin |
| `/finance` | Expense entry/delete, Income/Expense/Net Profit summary (current month, per-branch for superadmin) | admin + superadmin |
| `/communications` | Email / WhatsApp composer | admin + superadmin |
| `/analytics` | Funnel, revenue, source conversion, income-vs-expense charts | **superadmin only** |
| `/settings` | API connection status, JSON export | **superadmin only** |
| `/login` | Credential login | public |

### API routes (28)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/auth/login` | POST | Credential login → session cookie | public (rate limited) |
| `/api/auth/logout` | POST | Clear session | session |
| `/api/auth/branch` | POST | Superadmin switches active branch | superadmin |
| `/api/auth/google` | GET | Google OAuth consent redirect | **superadmin** |
| `/api/auth/google/callback` | GET | Prints `GOOGLE_REFRESH_TOKEN` | **superadmin** |
| `/api/clickup/students` | GET/POST | List / create students (Supabase) | session, branch-scoped |
| `/api/clickup/students/delete` | POST | Hard-delete a student, cascading to all their Payments | **superadmin**, scope-asserted |
| `/api/clickup/students/pause` | POST | Pause/resume a student for the current month | session, scope-asserted |
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
| `/api/cron/monthly-reset` | GET | 09:00 on the 1st: new Payment due per student, `payment_status` → pending | `Bearer CRON_SECRET` |

### Workflows

| # | Workflow | Entry point | Status |
|---|---|---|---|
| 1 | Lead capture + coach assignment | `/api/webhooks/lead-capture` | live |
| 2 | Demo scheduling + Google Meet | `/api/schedule-demo` | live |
| 3 | Payment link generation | `/api/payment-link` | live |
| 4 | Payment received processing | `/api/webhooks/payment` | live |
| 5 | Daily overdue reminders | `/api/cron/daily-reminders` | live (`vercel.json` cron) |
| 6 | Monthly billing reset | `/api/cron/monthly-reset` | live (`vercel.json` cron) |

---

## 2. Stack and hard constraints

**Dependencies are deliberately minimal:** `next@14.2.0`, `react`, `react-dom`, `recharts`, `nodemailer`.

- **No-new-npm-deps rule.** Auth is built on Node's built-in `crypto` and the Web Crypto API. Do not
  add `next-auth`, `jose`, `bcrypt`, `jsonwebtoken`, a Supabase SDK (`@supabase/supabase-js`), SWR, or react-query. If you
  think you need one, say so and ask first.
- **Next 14.2 ⇒ `middleware.ts` runs on the Edge runtime, with no opt-out.** `export const runtime = 'nodejs'`
  in middleware is a Next 15.2+ feature. Middleware therefore verifies sessions with
  `crypto.subtle` (`lib/auth/session-edge.ts`), never `node:crypto`.
- **Never create a barrel file at `lib/auth/index.ts`.** It would let the Edge middleware bundle
  transitively pull in `node:crypto` and break the build. `session-edge.ts` imports only
  `base64url.ts` and `types.ts`.
- Supabase's REST API (PostgREST) is called with raw `fetch` from `lib/supabaseClient.ts`, using the server-only secret key.
- All pages are `'use client'` and fetch from `/api/*` in `useEffect`. The only server components are
  `app/layout.tsx` and `app/(dashboard)/layout.tsx`.

---

## 3. Branch and role model

The academy runs **4 branches**. Branch identity is stored in the database as an **opaque id**; the
human-readable name lives in the `ACADEMY_BRANCHES` env var, so renaming a branch is an env edit and
never a data migration.

| Branch id | Display name |
|---|---|
| `BRANCH_SAIBABA` | Saibaba Colony |
| `BRANCH_SOWRIPALAYAM` | Sowripalayam |
| `BRANCH_KUNIYAMUTHUR` | Kuniyamuthur |
| `BRANCH_THOPPAMPATI` | Thoppampati (added 2026-11-13) |

Two roles:

| Role | Sees | Can mutate | Notes |
|---|---|---|---|
| `admin` | exactly one branch | records in that branch only | 3 of these — one per non-Saibaba branch |
| `superadmin` | all 4 branches + Unassigned | any record | 1 of these; home branch `BRANCH_SAIBABA`, which they run directly |

Assignment:

- Superadmin (Manikandan) → `BRANCH_SAIBABA` (runs it directly; also where online-sourced leads and
  students land — see below)
- Admin A → `BRANCH_SOWRIPALAYAM`
- Admin B → `BRANCH_KUNIYAMUTHUR`
- Admin C (`admin.thoppampati@darklight.in`) → `BRANCH_THOPPAMPATI`
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
2. **Read scoping** — every database read goes through one private `list()` method that applies a
   PostgREST filter (`branch=in.(…)`) derived from the caller's `Scope`. There is no unscoped read export.
3. **Write authorization** — every mutation calls `assertInScope(table, recordId)` *before* patching.

The invariant, stated once:

> **Middleware gates the request. Every database read carries a scope. Every mutation asserts the
> target record is in scope.**

Two rules that are easy to get wrong:

- **Middleware sets no identity headers, and handlers never read any.** `withAuth` re-verifies the
  cookie itself with `node:crypto`. A gap in the matcher can therefore never become an auth bypass.
- **`assertInScope` runs before the write, and the secret key bypasses row-level security.** RLS is on
  with no policies, so the publishable key reads nothing; the secret key ignores RLS entirely. All branch
  isolation therefore lives in `lib/supabaseClient.ts`. Never expose `SUPABASE_SECRET_KEY` to the browser
  or prefix it `NEXT_PUBLIC_`.

Cross-branch record ids are reported to the client as **404, not 403**, so an admin cannot enumerate
another branch's record ids by probing status codes. The real denial is logged server-side as
`[RBAC DENY]`.

---

## 5. Data model

Supabase Postgres, four tables defined in `supabase/schema.sql` (safe to re-run). Columns are **snake_case**
and camelCase in `lib/types.ts`; the mappers in `lib/supabaseClient.ts` translate.

| Table | Fields |
|---|---|
| **Students** | `id`, `name`, `email`, `phone`, `age`, `coach`, `status`, `payment_status`, `amount_due`, `classes_per_week`, `duration`, `grade`, `batch_timing`, `paused_month`, `online`, `payment_link`, `invoice_id`, `created_at`, **`branch`** |
| **Leads** | `id`, `name`, `email`, `phone`, `source`, `coach_assigned`, `status`, `notes`, `demo_date`, `demo_time`, `meet_link`, `online`, `created_at`, `created_time`, **`branch`** |
| **Payments** | `id`, `student_id`, `student_name`, `amount`, `amount_paid`, `status`, `due_date`, `paid_date`, `payment_id`, `invoice_id`, `reminder_sent_at`, `created_at`, **`branch`** |
| **Expenses** | `id`, `description`, `amount`, `category`, `date`, **`branch`** |

**Lead email is optional; phones are stored E.164.** Leads typed in on `/leads` have no email
field — only the website form (`lead-capture` webhook, `requireEmail: true` in
`validateAndCreateLead`) carries one. Converting such a lead takes an optional email, so a
Student may also have `email: ''`; schedule-demo, payment-link, send-reminder skip the email and
use WhatsApp, and the daily-reminders cron (email-only) skips that student. Staff type a plain
10-digit Indian mobile number (`components/PhoneInput.tsx`, fixed `+91` prefix); `lib/phone.ts`
`normalizePhone` turns it into `+91…` server-side and passes `+`-prefixed international numbers
(foreign students via the website) through unchanged. Leads' `online` column (Online/Offline
choice on Add Lead, added 2026-11-14) is copied onto the Student on convert.

**Expenses** (`description`, `amount`, `category`, `date`, `branch`) were **not** part of the 2026-11-26 import (no export
was provided), so the table started empty. Add old rows with `scripts/import-csv-to-supabase.js` if they turn up.

**Attendance tracking was removed on 2026-10-27** (the `/attendance` page, its API routes, and the
monthly register/report) to cut Airtable API usage. The `Attendance` table was not migrated; it only exists in
the old Airtable base. Restore from git history if it's wanted back.

`Student.batch_timing` is set at
student-creation time and editable afterwards by a superadmin (see `updateStudentBatch`) — along
with `online`, one of only two editable Student fields. `online` is a real boolean column (default false).

**`batch_timing` holds a per-student batch code, not free text and no longer a catalog id.** Each
student picks their own convenient days plus a time window, encoded by `lib/batches.ts` as
`"<days>@<start>-<end>"` — day-of-week ints (0=Sun…6=Sat, `Date.getDay()` order) sorted and
comma-joined, then 24-hour times, e.g. `1,4@18:00-19:00` = Mon & Thu, 6–7 PM. The column is
plain `text` (no schema change across any of its three formats — only the values
written into it changed) and the TypeScript property is `Student.batchId`, not `batchTiming`, to
make clear it's a code, not prose; `isValidBatchId` whitelists it server-side the same way
`isValidBranchId` does for branches.

Codes from the **previous fixed 9-batch catalog** (3 day-patterns × 3 time-slots, `MWF_5_6`…
`WEEKEND_7_8`) still parse, so students created under it keep working; `parseBatch` falls back to
that table, and re-saving such a student through the edit-batch modal rewrites them in the current
format. Nothing writes legacy codes any more.

`branch` holds the **branch id** (`BRANCH_SAIBABA`, …), not the display name. Empty means Unassigned and is stored
as NULL (a CHECK rejects `''`); `isValidBranchId` is the whitelist for every write.

**Ids.** `id` is the text primary key. Rows moved from Airtable keep their `rec…` id (payments' `student_id`,
existing Razorpay invoices and payment links refer to it); leads moved in got a `led…` id (a hash of name,
phone and time); new rows get a uuid. `payments.student_id` is deliberately *not* a foreign key — some legacy
rows point at nothing. Every write throws on a database error; nothing logs and carries on.

---

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co`. Server-only — never `NEXT_PUBLIC_`. |
| `SUPABASE_SECRET_KEY` | yes | The `sb_secret_…` key (bypasses RLS). Server-only. Not the legacy `service_role` key. |
| `SUPABASE_DB_PASSWORD` | no | Only for the Supabase CLI (`supabase db …`). The app does not read it. |
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
  {"email":"admin.sowripalayam@darklight.in","name":"Admin A","role":"admin","branch":"BRANCH_SOWRIPALAYAM","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"},
  {"email":"admin.kuniyamuthur@darklight.in","name":"Admin B","role":"admin","branch":"BRANCH_KUNIYAMUTHUR","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"},
  {"email":"admin.thoppampati@darklight.in","name":"Admin C","role":"admin","branch":"BRANCH_THOPPAMPATI","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"},
  {"email":"manikandan@darklight.in","name":"Manikandan","role":"superadmin","branch":"BRANCH_SAIBABA","passwordHash":"scrypt.16384.8.1.<salt>.<hash>"}
]
```


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
| `lib/supabaseClient.ts` | The **only** data access (class `Database`). Scoped instance via `forScope()` / `system()`. |
| `lib/auth/session.ts` / `session-edge.ts` | Sign + verify. Node and Edge halves, deliberately separate. |
| `lib/auth/rbac.ts` | `scopeForSession`, `canAccessBranch` — the role → scope rules. |
| `lib/auth/withAuth.ts` | Route wrapper. Injects `{ session, scope, db }`. |
| `lib/branches.ts` | Branch ids, display names, `isValidBranchId` whitelist. |
| `app/(dashboard)/layout.tsx` | Verifies session server-side, injects `SessionProvider`. |
| `app/(dashboard)/analytics/layout.tsx`, `.../settings/layout.tsx` | Server-side `role === 'superadmin'` gate. The Sidebar hiding these links is UX only — these layouts are what actually stop a branch admin from loading the page by URL. |
| `supabase/schema.sql` | The schema. Run it in Supabase → SQL Editor (re-runnable). RLS on, no policies. |
| `scripts/import-csv-to-supabase.js` | One-shot: Airtable CSV exports in `data/` → Supabase. Dry run by default; `--apply` writes; `--skip-expenses`. Overwrites matching ids — do not re-run now the app is live. |
| `scripts/backup-supabase.js` | Dumps every table to `data/backups/<time>/`. Run weekly — the Free plan has no automatic backups. |
| `scripts/airtable-legacy/` | The old Airtable setup/backfill scripts. Reference only; they do not touch Supabase. |

---

## 8. Setup and verification

```bash
npm install
cp .env.example .env.local          # fill in AUTH_SECRET, ACADEMY_USERS, SUPABASE_URL, SUPABASE_SECRET_KEY

node scripts/hash-password.js 'pw'  # → paste into ACADEMY_USERS
# Supabase → SQL Editor: run supabase/schema.sql   (re-runnable)
node scripts/backup-supabase.js     # weekly; the Free plan has no automatic backups

npx tsc --noEmit && npm run build
npm run dev
```

`tsc` is the real check: because the unscoped static reads were deleted from `Database`, any
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
   → **404**, the record unchanged, `[RBAC DENY]` in the server log. Repeat for
   `mark-unpaid`, `send-reminder`, `payment-link`, `schedule-demo`, `leads/convert`.
6. **Header spoofing** — the same call with `-H 'x-dl-user: manikandan@…'` → still 404.
7. **Cookie tampering** — flip a character in `dl_session` → 401. A token signed with a different
   `AUTH_SECRET` → rejected. An unsigned hand-crafted `{"role":"superadmin"}` → rejected.
8. **Branch cookie is not a privilege** — as Admin A,
   `-b 'dl_session=<A>; dl_branch=BRANCH_KUNIYAMUTHUR'` → still only Sowripalayam.
   `POST /api/auth/branch` as Admin A → **403**.
9. **Superadmin** — sees all 4, the per-branch cards sum to the totals, the switcher narrows and
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
  (`Database.recordPayment`, used by `markStudentPaidManually` and `enrollStudent`); every row
  written going forward carries a correct `student_id`, so the join is self-healing over time without
  needing to trust or migrate old hand-entered rows. Payments that still can't be resolved to a
  student are left **Unassigned** by the backfill script rather than guessed.
- **Reads page through every row.** `selectAll` pages with a stable `order=id` and checks the row count, so
  nothing is silently truncated.
- **`schedule-demo` writes the lead status `'Demo Scheduled'`** while the type union expects
  `'demo_booked'`. `status` is plain text now, so the value is stored as given and the funnel (which counts
  `demo_booked`) does not see it. Pre-existing; not fixed here.
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
  **does cascade** to every linked Payment (`Database.deleteStudent` issues one `DELETE … WHERE student_id = …`
  before deleting the student; paid/pending/overdue all go) — their revenue history is removed along with
  them, by design. The delete filters on `student_id` alone, so a superadmin's `dl_branch` cookie cannot narrow
  it; it still cannot catch a Payment whose `student_id` was never correctly linked (the "unreliable join"
  case above).
  Delete is **superadmin-only** for all three (Students, Leads, Expenses): enforced server-side via
  `withAuth(handler, { roles: ['superadmin'] })` on each delete route, with the Delete button hidden
  client-side as UX only for branch admins. Guarded client-side by a `window.confirm()`, not a
  `Modal`.
- **`/finance` is visible to both `admin` and `superadmin`**, unlike `/analytics`/`/settings`. A
  branch admin's Net Profit there is computed only from their own branch-scoped `getStats()` result —
  the same scoping every other page already relies on — so this doesn't expose whole-business figures
  to a branch admin.
- **Online vs offline revenue is split by the student's `online` flag, superadmin only.** `computeStats`
  partitions the same billable (non-paused) students into `monthlyRevenueOnline`/`Offline` and
  `activeStudentsOnline`/`Offline` (they sum to `monthlyRevenue`/`activeStudents`); `/api/clickup/stats`
  strips these fields for admins. `/payments` derives a payment's mode by joining `studentId` to the
  student — unresolvable (legacy) rows count as Offline. Expenses have no mode, so Net Profit is not split.
  `/students` has All/Offline/Online tabs for every role.
- **Revenue on the dashboard is Expected / Collected / Pending** (added 2026-11-16, after a
  "Sowripalayam revenue is wrong" report that turned out to be 12 paused students silently
  missing from the figure). `monthlyRevenue` = **Expected** = fees of students *not* paused this
  month; `monthlyCollected` = the part from students whose `payment_status` is `paid` (reset to
  `pending` by the monthly cron, so this means paid this month); `monthlyPending` = the difference;
  `pausedStudents`/`pausedFees` are shown as a "N paused · ₹X not billed" note so the gap is
  visible. All from the Students rows `getStats` already reads — no extra queries. It's
  fee-based, not the amount actually received in Razorpay. Visible to admins too.
- **Monthly billing arrears stack, by design.** `Database.runMonthlyReset()` (the
  `/api/cron/monthly-reset` cron, 1st of the month) always *creates* a new Payment due for every
  student rather than mutating an existing one — a student who never paid last month ends up with
  two open dues (last month's stays overdue, a new one is due this month) rather than silently
  merging them into one. Idempotent per student per calendar month (skips if a Payment already has a
  `dueDate` in the current month), so a retried cron run never double-bills.
- **Pausing a student is scoped to one calendar month and expires on its own.** `paused_month`
  holds a `"YYYY-MM"` string; `isStudentPaused` (lib/utils.ts) just asks whether it equals the
  current month, so the pause ends when the calendar turns over — no cron, no cleanup pass, and
  nothing to forget to switch back on. Consequences, all keyed on that same string:
  `runMonthlyReset` skips a student paused for the month it's billing (needed because the cron
  runs at 09:00 on the 1st and could otherwise re-raise a due someone cancelled hours earlier);
  `computeStats` leaves their fee out of `monthlyRevenue` while counting them in
  `activeStudents`, since a pause is a break and not an un-enrolment; and
  `setStudentPaused` deletes their **unpaid** dues for that month, leaving anything already paid
  alone. Resuming inside the paused month re-creates the due, so a mis-click can't quietly skip a
  month's fee. Unlike `update-batch`/`update-online` the route is **not** superadmin-gated —
  pausing is routine branch work, and `assertInScope` still confines it to the caller's branch.
- **Supabase Free plan: no request limit, but no automatic backups, and idle projects pause.** Unlimited API
  requests (the reason Airtable was left), 500 MB database, 5 GB egress, 2 active projects per organisation.
  **Free projects are paused after 1 week of inactivity** — the daily reminder cron should count as activity,
  but if the site says "database unavailable", check the Supabase dashboard and restore the project. **Run
  `node scripts/backup-supabase.js` weekly** and keep `data/` out of git (it holds parents' personal data).
  A paused or unreachable database surfaces as a 503 via `DatabaseUnavailableError` in `withAuth`. Pro
  ($25/mo) adds daily backups (kept 7 days) and no pausing. Reads are not cached, so changes show at once;
  `getStats` still reads only `status = 'overdue'` Payments.
- **India network blocks.** Some Indian ISPs blocked `supabase.co` from February 2026. The app is unaffected
  (browsers only talk to Vercel, whose functions run in `bom1`), but the Supabase dashboard may not open on
  some networks — use another DNS (1.1.1.1) or a VPN.
- **`/payments` starts at November 2026 and is scoped to one month at a time.** Every Payment due before
  2026-11-01 was deleted (`scripts/airtable-legacy/delete-old-payments.js`), so the month switcher stops at
  `FIRST_MONTH` in the page and there is no Arrears card. Cards and table cover the month on screen,
  keyed on `dueDate`.
- **Mark paid / unpaid write strictly.** Every write helper throws on a database error (nothing logs and carries on), so
  the UI can't report success for a write that failed; a write that matches no row is a `ScopeError`. The student-driven path settles the Payment
  due in the *current* month (`pickCurrentMonthDue`), not an arbitrary unpaid one. Unpaid clears
  `paid_date` with `null`, not `''`.
