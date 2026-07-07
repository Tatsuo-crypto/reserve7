/**
 * Reusable error message component
 */

import Icon from './icons'

interface ErrorMessageProps {
  message: string
  className?: string
}

export default function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  return (
    <div className={`rounded-md bg-red-50 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon name="xCircle" size={20} className="text-red-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-800">{message}</p>
        </div>
      </div>
    </div>
  )
}
