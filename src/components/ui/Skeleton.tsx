interface SkeletonProps {
    className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return <div className={`animate-pulse rounded-2xl bg-surface-overlay ${className}`} />
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
    return (
        <div className={`rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm ${className}`}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-40" />
            <div className="mt-5 grid grid-cols-3 gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
            </div>
        </div>
    )
}

export function WeeklyPanelSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex justify-center">
                <Skeleton className="h-12 w-full max-w-[300px]" />
            </div>
            <SkeletonCard />
            <SkeletonCard />
            <div className="grid grid-cols-2 gap-3">
                <SkeletonCard className="p-4" />
                <SkeletonCard className="p-4" />
            </div>
        </div>
    )
}

export function ChartSkeleton() {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
            <Skeleton className="h-4 w-28" />
            <div className="mt-5 flex h-48 items-end gap-2">
                <Skeleton className="h-20 flex-1" />
                <Skeleton className="h-32 flex-1" />
                <Skeleton className="h-24 flex-1" />
                <Skeleton className="h-40 flex-1" />
                <Skeleton className="h-28 flex-1" />
                <Skeleton className="h-36 flex-1" />
            </div>
        </div>
    )
}
