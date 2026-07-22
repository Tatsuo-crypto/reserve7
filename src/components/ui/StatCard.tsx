export default function StatCard({ label, value, unit }: { label: string; value: number | string; unit: string }) {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
            <div className="text-xs font-normal text-text-secondary">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
                <span className="stat-value">{value}</span>
                {unit && <span className="text-xs font-normal text-text-secondary">{unit}</span>}
            </div>
        </div>
    )
}
