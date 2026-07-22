export default function BreakdownList({
    title,
    items,
    note,
}: {
    title: string
    items: { label: string; count: number; unit?: string }[]
    note?: string
}) {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
            <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            <div className="mt-2 space-y-1.5">
                {items.length === 0 ? (
                    <p className="text-sm font-normal text-text-secondary">データがありません</p>
                ) : (
                    items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-sm font-normal text-text-secondary">
                            <span className="truncate text-text-primary">{item.label}</span>
                            <span className="shrink-0 tabular-nums">{item.count}{item.unit || '件'}</span>
                        </div>
                    ))
                )}
            </div>
            {note && <p className="mt-2 text-xs font-normal text-text-secondary">{note}</p>}
        </div>
    )
}
