// The role → reach rules. The single sanctioned place a Scope is constructed.

import type { Scope, Session } from './types'
import { isValidBranchId } from '../branches'
import { ALL_BRANCHES } from './cookies'

/**
 * @param requestedBranch the dl_branch cookie. Purely a narrowing hint, and ignored
 *   outright for an admin — a client-settable value may never *grant* reach.
 */
export function scopeForSession(session: Session, requestedBranch?: string | null): Scope {
  if (session.role === 'admin') {
    return { role: 'admin', branches: [session.branch], includeUnassigned: false }
  }

  if (requestedBranch && requestedBranch !== ALL_BRANCHES && isValidBranchId(requestedBranch)) {
    return { role: 'superadmin', branches: [requestedBranch], includeUnassigned: false }
  }

  return { role: 'superadmin', branches: ALL_BRANCHES, includeUnassigned: true }
}

/** Scope for cron jobs and inbound webhooks. Named, greppable, and documented as intentional. */
export function systemScope(): Scope {
  return { role: 'superadmin', branches: ALL_BRANCHES, includeUnassigned: true }
}

export function canAccessBranch(scope: Scope, branch: string | undefined | null): boolean {
  if (scope.branches === ALL_BRANCHES) return true
  // An unclassified record is reachable by the superadmin only — never silently exposed to
  // whichever admin happens to ask.
  if (!branch) return scope.includeUnassigned
  return scope.branches.includes(branch)
}

/** The branch a record created under this scope should be filed against. */
export function branchForNewRecord(scope: Scope, session: Session): string {
  return scope.branches === ALL_BRANCHES ? session.branch : scope.branches[0]
}

export function isAllBranches(scope: Scope): boolean {
  return scope.branches === ALL_BRANCHES
}
