import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/googleAuth'
import { withAuth } from '@/lib/auth/withAuth'

// Superadmin-only: this flow exists to mint GOOGLE_REFRESH_TOKEN for the whole academy's
// Meet integration, not a per-user login.
export const GET = withAuth(
  async () => NextResponse.redirect(getGoogleAuthUrl()),
  { roles: ['superadmin'] }
)
