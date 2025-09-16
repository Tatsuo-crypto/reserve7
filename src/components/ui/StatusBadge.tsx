/**
 * Reusable status badge component
 */

import { UserStatus } from '@/types/common'

interface StatusBadgeProps {
  status: UserStatus
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusStyles = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'withdrawn':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return '有効'
      case 'suspended':
        return '停止中'
      case 'withdrawn':
        return '退会済み'
      default:
        return '不明'
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyles(status)} ${className}`}>
      <span className={`w-2 h-2 rounded-full mr-1 ${status === 'active' ? 'bg-green-400' : status === 'suspended' ? 'bg-yellow-400' : 'bg-red-400'}`} />
      {getStatusText(status)}
    </span>
  )
}
