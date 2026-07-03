import { NextResponse } from 'next/server'
import { RazorpayClient } from '@/lib/razorpay'

export async function GET() {
  try {
    const payments = await RazorpayClient.getPayments()
    return NextResponse.json({ success: true, data: payments })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Razorpay payments' },
      { status: 500 }
    )
  }
}
