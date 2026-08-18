// Branch (tenant) identity. Airtable stores the opaque id; the display name lives in
// ACADEMY_BRANCHES, so renaming a branch is an env edit rather than a select-choice
// migration plus a rewrite of every record. See skill.md "Pattern E".

export interface Branch {
  id: string
  name: string
}

const FALLBACK_BRANCHES: readonly Branch[] = [
  { id: 'BRANCH_SAIBABA', name: 'Saibaba Colony' },
  { id: 'BRANCH_SOWRIPALAYAM', name: 'Sowripalayam' },
  { id: 'BRANCH_KUNIYAMUTHUR', name: 'Kuniyamuthur' },
]

/** Label for a record whose branch field is empty. Reachable by superadmins only. */
export const UNASSIGNED_LABEL = 'Unassigned'

let cached: Branch[] | null = null

export function getBranches(): Branch[] {
  if (cached) return cached

  const raw = process.env.ACADEMY_BRANCHES
  if (!raw) {
    cached = [...FALLBACK_BRANCHES]
    return cached
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('ACADEMY_BRANCHES is not valid JSON. Expected [{"id":"BRANCH_X","name":"…"}].')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('ACADEMY_BRANCHES must be a non-empty JSON array of {id, name}.')
  }

  cached = parsed.map((entry, i) => {
    const b = entry as Record<string, unknown>
    if (typeof b?.id !== 'string' || !b.id.trim()) {
      throw new Error(`ACADEMY_BRANCHES[${i}] is missing a non-empty string "id".`)
    }
    return { id: b.id.trim(), name: typeof b.name === 'string' && b.name.trim() ? b.name.trim() : b.id.trim() }
  })
  return cached
}

/**
 * The whitelist. Every branch id that reaches a filterByFormula, a cookie, or a user
 * config passes through here first — which is what makes formula injection structurally
 * impossible rather than merely escaped.
 */
export function isValidBranchId(id: unknown): id is string {
  return typeof id === 'string' && getBranches().some((b) => b.id === id)
}

export function branchName(id: string | undefined | null): string {
  if (!id) return UNASSIGNED_LABEL
  return getBranches().find((b) => b.id === id)?.name ?? id
}

/**
 * Branch assigned to records that can't otherwise be classified (backfill script, and
 * the legacy single-secret lead webhook). Falls back to the last configured branch.
 */
export function defaultBranchId(): string {
  const configured = process.env.BACKFILL_DEFAULT_BRANCH
  if (isValidBranchId(configured)) return configured
  const branches = getBranches()
  return branches[branches.length - 1].id
}
