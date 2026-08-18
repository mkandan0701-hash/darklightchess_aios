import { NextResponse } from 'next/server'
import { RazorpayClient } from '@/lib/razorpay'
import { withAuth } from '@/lib/auth/withAuth'

// Razorpay payments have no branch dimension, so this is superadmin-only rather than
// exposing every branch's raw payment data to a branch admin.
export const GET = withAuth(
  async () => {
    try {
      const payments = await RazorpayClient.getPayments()
      return NextResponse.json({ success: true, data: payments })
    } catch {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch Razorpay payments' },
        { status: 500 }
      )
    }
  },
  { roles: ['superadmin'] }
)
