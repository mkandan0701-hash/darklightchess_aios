'use client'

import type { ActivityItem } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

const typeColors: Record<ActivityItem['type'], string> = {
  payment: 'bg-success',
  enrollment: 'bg-primary',
  lead: 'bg-accent',
  communication: 'bg-warning',
}

const typeLabels: Record<ActivityItem['type'], string> = {
  payment: 'Payment',
  enrollment: 'Enrollment',
  lead: 'Lead',
  communication: 'Message',
}

interface RecentActivityProps {
  items: ActivityItem[]
}

export default function RecentActivity({ items }: RecentActivityProps) {
  return (
    <div className="card h-full">
      <h3 className="mb-4">Recent Activity</h3>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">No recent activity.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${typeColors[item.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-textDark leading-snug">{item.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.timestamp)}</p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                {typeLabels[item.type]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
