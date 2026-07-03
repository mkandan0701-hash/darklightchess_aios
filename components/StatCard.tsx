import type { StatCardProps } from '@/lib/types'

const colorMap: Record<string, string> = {
  primary: 'bg-secondary text-primary',
  success: 'bg-green-100 text-success',
  warning: 'bg-yellow-100 text-warning',
  error: 'bg-red-100 text-error',
}

export default function StatCard({ label, value, icon, trend, trendLabel, color = 'primary' }: StatCardProps) {
  const iconColors = colorMap[color] ?? colorMap.primary

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-textDark mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColors}`}>
          {icon}
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          <span className={trend >= 0 ? 'text-success font-semibold' : 'text-error font-semibold'}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
          <span className="text-gray-500">{trendLabel ?? 'vs last month'}</span>
        </div>
      )}
    </div>
  )
}
