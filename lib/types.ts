import { ReactNode } from 'react'

// NOTE on `id`: this is Airtable's record id (`rec…`). The Airtable tables also carry a
// legacy text column literally named `id`, holding old ClickUp task ids — a different value.
// Mutations address records by the `rec…` id.
//
// `branch` is the tenant key. An empty/absent branch is the "Unassigned" bucket, reachable
// by superadmins only. See claude.md §3.

export interface Student {
  id: string
  name: string
  email: string
  phone: string
  classesPerWeek: number
  duration: string
  monthlyFee: number
  paymentStatus: 'paid' | 'pending' | 'overdue'
  enrolledDate: string
  grade?: string
  batchId?: string
  branch?: string
}

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: 'instagram' | 'referral' | 'website' | 'youtube' | 'other'
  status: 'new' | 'contacted' | 'demo_booked' | 'demo_done' | 'converted' | 'lost'
  dateReceived: string
  notes?: string
  branch?: string
}

export interface Payment {
  id: string
  studentId: string
  studentName: string
  amountDue: number
  amountPaid: number
  dueDate: string
  paidDate?: string
  status: 'paid' | 'pending' | 'overdue'
  razorpayPaymentId?: string
  receiptUrl?: string
  branch?: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  category: string
  date: string
  branch?: string
}

export interface Attendance {
  id: string
  studentId: string
  studentName: string
  date: string
  present: boolean
  homeworkDone: boolean
  branch?: string
}

export interface DashboardStats {
  totalLeads: number
  activeStudents: number
  monthlyRevenue: number
  monthlyExpenses: number
  netProfit: number
  overduePayments: number
  leadsThisMonth: number
  studentsChange?: number
}

export interface BranchStats extends DashboardStats {
  branch: string
  branchName: string
}

/** `byBranch` is only populated for a superadmin viewing all branches at once. */
export interface DashboardStatsResponse extends DashboardStats {
  byBranch?: BranchStats[]
}

export interface ActivityItem {
  id: string
  type: 'payment' | 'enrollment' | 'lead' | 'communication'
  message: string
  timestamp: string
}

export interface ActionItem {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  link?: string
}

export interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: number
  trendLabel?: string
  color?: 'primary' | 'success' | 'warning' | 'error'
}

export interface Column<T> {
  key: string
  label: string
  render?: (value: unknown, row: T) => ReactNode
  width?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
