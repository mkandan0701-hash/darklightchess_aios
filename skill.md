# SKILL.md — Darklight AIOS Patterns

**Reusable patterns for this codebase: multi-tenant RBAC over a flat REST datastore, with no auth
library, no ORM, and no new dependencies.**

The house style here is deliberate: `next`, `react`, `react-dom`, `recharts`, `nodemailer` and
nothing else. Every pattern below is written to hold under that constraint. Read `claude.md` for the
project's current state; this file is the *how*.

---

## Pattern A — Env-user auth gate with no dependencies

**When:** a small, fixed set of internal users (here: 3). A user table, a signup flow, and
`next-auth` are all overkill, and each one is a dependency you now own.

**Shape:** users live in an env var, passwords are scrypt hashes, the session is an HMAC-signed
token in an HttpOnly cookie.

### Token format

```
dl1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, "dl1." + payloadB64))>
```

Payload: `{ email, name, role, branch, iat, exp }`.

This is a JWT in spirit with the parts that cause trouble removed. There is no `alg` header, so
there is no `alg: none` confusion attack and no algorithm negotiation to get wrong. One algorithm,
hardcoded. If you ever need a real JWT for a third party, add the library then — not before.

### The Edge/Node split

Next 14.2 runs `middleware.ts` on the Edge runtime with **no opt-out** (`runtime = 'nodejs'` for
middleware landed in Next 15.2). `node:crypto` is unavailable there. So the signing logic exists
twice, deliberately:

| File | Runtime | Uses |
|---|---|---|
| `lib/auth/session.ts` | Node | `crypto.createHmac`, `crypto.timingSafeEqual` |
| `lib/auth/session-edge.ts` | Edge | `crypto.subtle.importKey` + `crypto.subtle.verify` |
| `lib/auth/base64url.ts` | both | pure encoding, no crypto — shared so the encodings cannot drift |

**Never create `lib/auth/index.ts`.** A barrel would let the Edge bundle transitively import
`node:crypto` and the build fails with a module-not-found that points nowhere useful.

`crypto.subtle.verify` does the constant-time comparison for you. On the Node side you must do it
yourself with `timingSafeEqual` — a `===` on an HMAC is a timing oracle.

### Verify twice

Middleware verifies the cookie. Then `withAuth` verifies it **again** in the route handler, from
scratch. This looks redundant and is not:

```ts
// ❌ the version that breaks the day someone edits the matcher
export async function middleware(req) {
  const session = await verifySessionEdge(...)
  const res = NextResponse.next()
  res.headers.set('x-dl-user', session.email)   // handlers trust this
  return res
}
```

That makes the matcher regex load-bearing for authentication. Miss a path and every handler behind it
now trusts a header the client can set. Instead: **middleware sets no identity headers, handlers read
none.** An HMAC verify is microseconds; buy the independence.

### Passwords

`scrypt` with `N=16384, r=8, p=1, keylen=32` and a 16-byte random salt, stored as
`scrypt.N.r.p.<saltB64>.<hashB64>`. Node has it built in; `bcrypt` needs a native build. Encode the
parameters in the string so you can raise them later without invalidating existing hashes.

Delimited with `.`, deliberately not the traditional `$` (`scrypt$N$r$p$salt$hash`, as bcrypt and
crypt(3) use it). This value lives in `ACADEMY_USERS` inside `.env.local`, and Next's env loader
runs `dotenv-expand` over every value in that file — which treats `$word` as a variable reference
and silently strips it. A `$`-delimited hash gets silently truncated to garbage on load, and the
failure mode is "every login fails" with no error pointing at the cause. Found by testing an actual
login end to end, not by reading the code — a reminder that a value round-tripping through `tsc`
cleanly says nothing about it surviving the env loader untouched.

Two details on the login route:

- On an **unknown email, still run one `scryptSync`** against a dummy hash. Otherwise the response
  time tells an attacker which addresses are real.
- Return **one generic error** — "Invalid email or password" — for both unknown-user and
  bad-password.

### Cookies

```ts
httpOnly: true, sameSite: 'lax', path: '/', secure: NODE_ENV === 'production', maxAge: TTL
```

`lax`, not `strict`. Under `strict` the post-login redirect and any return trip from Razorpay or
Google arrives without the cookie and the user lands logged-out with no explanation.

Logout is **POST-only**. A GET logout is trivially CSRF-able — an `<img src="/api/auth/logout">` on
any page signs your users out.

### Fail closed

`getUsers()` **throws** on malformed `ACADEMY_USERS`. It never falls back to an empty list or a
default user, because "no users configured" and "auth is off" must never be the same state.
`AUTH_SECRET` throws at module load if missing or under 32 chars — a silent bad secret means every
session fails to verify with no clue why.

---

## Pattern B — Tenant scoping at the single choke point

**When:** one datastore holds records for several tenants and you need reads filtered per caller.

**Shape:** find the one function every read passes through, put the filter there, then **delete the
unscoped export so it is impossible to bypass**.

In this codebase that function is `AirtableClient.list()`. The class was rewritten from all-`static`
to an instance built from a `Scope`:

```ts
export class AirtableClient {
  private constructor(private readonly scope: Scope) {}
  static forScope(scope: Scope) { return new AirtableClient(scope) }
  /** cron + webhooks only. Bypasses branch filtering by design. */
  static system() { return new AirtableClient({ role: 'superadmin', branches: 'all', includeUnassigned: true }) }
}
```

Passing a `scope` argument to twelve static methods would have been the same amount of typing with
none of the guarantee. **Deleting the statics makes `tsc --noEmit` enumerate every unscoped call site
for you** — the compiler becomes the audit.

### Building the filter safely

```ts
function branchFormula(scope: Scope): string | null {
  if (scope.branches === 'all') return null                  // superadmin: no filter
  for (const b of scope.branches) {
    if (!isValidBranchId(b)) throw new Error(`Refusing to filter on unknown branch "${b}"`)
  }
  const terms = scope.branches.map((b) => `{branch}='${escapeFormulaString(b)}'`)
  if (scope.includeUnassigned) terms.push(`{branch}=''`)
  return terms.length === 1 ? terms[0] : `OR(${terms.join(',')})`
}
```

Three layers, in order of importance:

1. The values are **opaque ids we generate**, never user text.
2. `isValidBranchId` is a whitelist that **throws** rather than returning `null`. A silently-dropped
   filter is an unscoped read — the worst possible failure mode, because it looks like success.
3. `escapeFormulaString` handles `\` and `'` as a backstop.

### Pagination is part of the fix

Airtable returns at most 100 records per page. The original `list()` ignored the `offset` cursor, so
reads silently truncated. Add a filter on top of that and each tenant truncates independently and
invisibly.

```ts
let offset: string | undefined
do {
  const url = new URL(tableUrl(table))
  url.searchParams.set('pageSize', '100')
  if (formula) url.searchParams.set('filterByFormula', formula)
  if (offset) url.searchParams.set('offset', offset)
  const data = await (await fetch(url, { headers, cache: 'no-store' })).json()
  out.push(...data.records.map(mapper))
  offset = data.offset
} while (offset)
```

Warn people before shipping this: records that were invisible start appearing, and request counts
rise. It reads as a regression if it arrives unannounced.

---

## Pattern C — The RBAC route template

One wrapper, applied to every authenticated route. The route body stays otherwise unchanged.

```ts
type Handler = (req: NextRequest, ctx: { session: Session; scope: Scope; db: AirtableClient }) => Promise<Response>

export function withAuth(handler: Handler, opts: { roles?: Role[] } = {}) {
  return async (req: NextRequest) => {
    const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value ?? '')
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (opts.roles && !opts.roles.includes(session.role))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const scope = scopeFromRequest(req, session)
    try {
      return await handler(req, { session, scope, db: AirtableClient.forScope(scope) })
    } catch (err) {
      if (err instanceof ScopeError)
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      throw err
    }
  }
}
```

Before and after, for a real route:

```ts
// before — any anonymous caller could pass any studentId
export async function POST(req: NextRequest) {
  const { studentId } = await req.json()
  await AirtableClient.markStudentPaidManually(studentId, { paidAt })
}

// after — the body is otherwise byte-identical
export const POST = withAuth(async (req, { db, session }) => {
  const { studentId } = await req.json()
  await db.markStudentPaidManually(studentId, { paidAt })     // throws ScopeError → 404
  console.log('[MARK PAID MANUAL]', { studentId, by: session.email })
})
```

The `db` handed to the handler is *already* scoped. A handler cannot accidentally read another
tenant's data, because it has no unscoped client to reach for.

---

## Pattern D — Write-path ownership assertion

Read scoping stops a tenant from *listing* another tenant's records. It does nothing about a
mutation that takes a record id from the request body — the caller already has the id.

```ts
private async assertInScope(table: string, recordId: string): Promise<void> {
  if (this.scope.branches === 'all') return
  const res = await fetch(tableUrl(table, `/${encodeURIComponent(recordId)}`), { headers, cache: 'no-store' })
  if (res.status === 404) throw new ScopeError('not_found', 404)
  if (!res.ok) throw new ScopeError('lookup_failed', 502)
  const rec = await res.json()
  if (!canAccessBranch(this.scope, selectName(rec.fields.branch))) {
    console.warn('[RBAC DENY]', { table, recordId, scope: this.scope.branches })
    throw new ScopeError('forbidden', 403)
  }
}
```

Three decisions worth keeping:

**It lives in the client, not the routes.** Called at the top of every `update*` / `mark*` /
`enroll*` method, it cannot be forgotten by the next route someone adds. Authorization spread across
route handlers is authorization that will eventually be missed in one of them.

**It runs *before* `patchRecord`, never inside it.** `patchRecord` here logs and returns `void` on a
non-OK response:

```ts
if (!res.ok) { console.error(`[AIRTABLE] Failed to update…`); }   // ← returns void
```

A check placed inside a helper that swallows its own failures **fails open**. Put authorization
in front of fail-open code, never within it.

**Cross-tenant ids report 404, not 403.** A 403 confirms the record exists, turning the endpoint into
an id oracle: an admin could enumerate another branch's records by probing status codes. Log the real
403 server-side, return 404 to the client.

---

## Pattern E — Config-driven tenant identity

Store **opaque ids** in the datastore; keep display names in configuration.

```
Airtable singleSelect choices:  BRANCH_SAIBABA | BRANCH_SOWRIPALAYAM | BRANCH_KUNIYAMUTHUR
ACADEMY_BRANCHES env:           [{"id":"BRANCH_SAIBABA","name":"Saibaba Colony"}, …]
```

Renaming a branch becomes an env edit. Had the display name been the stored value, a rename would be
a select-choice migration plus a rewrite of every record plus a redeploy, done in the right order or
not at all.

Two corollaries:

- **Pre-create the select choices.** Airtable writes here use `typecast: true`, which will happily
  invent a new choice from a typo — `BRANCH_SAIBABA ` with a trailing space becomes a fourth branch
  that no filter ever matches. Creating the choices explicitly via the Meta API prevents the drift.
- **`isValidBranchId()` is the same whitelist** used by the formula builder in Pattern B, the branch
  switcher, and the user-config validator. One source of truth for "is this a real tenant".

---

## Pattern F — System-scope callers

Cron jobs and inbound webhooks have no user session. They need to bypass tenant filtering — and
that is exactly why they need a rule of their own.

**Reads:** `AirtableClient.system()`. Explicitly named, greppable, documented as intentional. Not a
`null` scope that silently means "everything".

**Writes: derive the tenant from the secret, never from the payload.**

```ts
// ❌ any form that has the shared secret can now write into any branch
const branch = body.branch

// ✅ the secret IS the branch claim
const branch = branchForWebhookSecret(request.headers.get('x-lead-webhook-secret'))
if (!branch) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
```

One secret per tenant, in a `LEAD_WEBHOOK_SECRETS` map of `secret → branch id`. Compare with
`timingSafeEqual` across the candidate set. Keep the legacy single-secret path working with a default
branch so the deploy does not break the forms that are already live.

**Never trusted, either way:** the tenant field on an inbound payload. If a caller can name its own
tenant, you do not have tenancy.

---

## Anti-patterns

| Don't | Why |
|---|---|
| Trust a middleware-injected `x-user` header | Makes the matcher regex load-bearing for auth. One missed path = full bypass. |
| Put the tenant in a query param or `localStorage` | Client-settable. It may *narrow*, never *grant*. Always re-intersect server-side. |
| Blanket-allow `/api/auth/*` in the matcher | This repo's `/api/auth/google/callback` prints a Google refresh token into an HTML page. Allow `/api/auth/login` only. |
| Authorize inside a helper that swallows errors | `patchRecord` returns `void` on failure — a check inside it fails open. |
| Interpolate user text into `filterByFormula` | Formula injection. Only whitelisted opaque ids go in, and the whitelist throws. |
| Return 403 for a cross-tenant record id | Confirms existence. Turns the endpoint into an id oracle. Return 404. |
| Wrap a whole route body in `try { … } catch (err) { return 500 }` | Swallows `ScopeError` before it reaches `withAuth`'s catch, turning every IDOR block into a generic 500 instead of the intended 404 — caught only by actually exercising the write path, not by reading the code. Re-throw `ScopeError` first: `if (err instanceof ScopeError) throw err`. |
| Let a missing filter degrade to no filter | A dropped scope looks like success and leaks everything. Throw. |
| Add `next-auth`/`jose`/`bcrypt` for 3 users | Node's `crypto` covers all of it. Every dependency is one you own. |

---

## Testing recipe

Two things are worth testing properly. Everything else is ordinary.

### The isolation matrix

For each of the 3 users, hit every list endpoint and confirm:

| | Admin A | Admin B | Superadmin |
|---|---|---|---|
| own-branch records | visible | visible | visible |
| other-branch records | **absent** | **absent** | visible |
| Unassigned (`branch=''`) | **absent** | **absent** | visible |
| totals in `/api/clickup/stats` | own branch only | own branch only | sum of all |

Admin A's and Admin B's result sets must be **disjoint**. Verify a total against a manual Airtable
count at least once — a filter that silently matches nothing also produces "isolation".

### The IDOR probe

The one test that actually proves the write path:

```bash
# 1. as Admin B, note a record id from their branch
# 2. as Admin A, aim every mutation at it
curl -b 'dl_session=<A-session>' -X POST localhost:3000/api/mark-paid \
     -H 'Content-Type: application/json' \
     -d '{"studentId":"recXXXX","studentName":"probe"}'
```

Expect **404**, the Airtable record **unchanged**, and `[RBAC DENY]` in the server log. Repeat for
every mutating route. Then repeat the whole thing with a spoofed `-H 'x-dl-user: …'` header and with
`-b 'dl_branch=<other-branch>'` appended — both must change nothing.

Also worth one pass each: a tampered cookie byte, a token signed with a different `AUTH_SECRET`, and
an unsigned hand-crafted `{"role":"superadmin"}` payload. All three must be rejected.
