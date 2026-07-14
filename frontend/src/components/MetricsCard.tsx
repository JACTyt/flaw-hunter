import type { ReactNode } from 'react'

interface MetricsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
}

export function MetricsCard({ title, value, subtitle, icon }: MetricsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
    </div>
  )
}
