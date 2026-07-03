import { ReactNode } from 'react'

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
}

export interface DashboardStats {
  totalLeads: number
  activeStudents: number
  monthlyRevenue: number
  overduePayments: number
  leadsThisMonth: number
  studentsChange: number
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
