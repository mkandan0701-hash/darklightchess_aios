'use client'

import Link from 'next/link'
import type { ActionItem } from '@/lib/types'

const severityConfig = {
  high: { bg: 'bg-red-50 border-red-200', badge: 'bg-error text-white', dot: 'bg-error' },
  medium: { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-warning text-white', dot: 'bg-warning' },
  low: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-primary text-white', dot: 'bg-primary' },
}

interface ActionItemsProps {
  items: ActionItem[]
}

export default function ActionItems({ items }: ActionItemsProps) {
  return (
    <div className="card h-full">
      <h3 className="mb-4">Action Items</h3>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">No action items. You&apos;re all caught up!</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const config = severityConfig[item.severity]
            return (
              <li key={item.id} className={`rounded-lg border p-3 ${config.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div>
                      <p className="text-sm font-semibold text-textDark leading-snug">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${config.badge}`}>
                    {item.severity}
                  </span>
                </div>
                {item.link && (
                  <Link
                    href={item.link}
                    className="mt-2 inline-block text-xs text-primary font-semibold underline hover:no-underline"
                  >
                    Fix →
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
