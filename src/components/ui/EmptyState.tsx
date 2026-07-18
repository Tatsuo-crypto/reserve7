import Button from './Button'
import Icon, { type IconName } from './icons'

interface EmptyStateProps {
    icon?: IconName
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
    className?: string
}

export default function EmptyState({
    icon = 'informationCircle',
    title,
    description,
    actionLabel,
    onAction,
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`rounded-2xl border border-border-subtle bg-surface-raised px-5 py-8 text-center shadow-sm ${className}`}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                <Icon name={icon} size={22} />
            </div>
            <p className="text-base font-semibold text-text-primary">{title}</p>
            {description && (
                <p className="mx-auto mt-2 max-w-[280px] text-sm text-text-muted">{description}</p>
            )}
            {actionLabel && onAction && (
                <Button type="button" onClick={onAction} className="mt-5 h-10 px-5">
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}
