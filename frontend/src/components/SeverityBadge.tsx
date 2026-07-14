import { AlertOctagon, AlertTriangle, AlertCircle, Info, Minus } from 'lucide-react'
import type { Severity } from '../types'

const styles: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high:     'bg-orange-100 text-orange-800 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  low:      'bg-green-100 text-green-800 border-green-200',
  info:     'bg-blue-100 text-blue-800 border-blue-200',
}

const icons: Record<Severity, React.ReactNode> = {
  critical: <AlertOctagon size={11} />,
  high:     <AlertTriangle size={11} />,
  medium:   <AlertCircle size={11} />,
  low:      <Minus size={11} />,
  info:     <Info size={11} />,
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[severity]}`}>
      {icons[severity]}
      {severity}
    </span>
  )
}
