'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useStoreChange } from '@/hooks/useStoreChange'
import { AdminStoreOption, fetchAdminStoresOnce } from '@/lib/admin-stores-client'
import BreakdownList from '@/components/ui/BreakdownList'
import StatCard from '@/components/ui/StatCard'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

type DemographicsData = {
    totalMembers: number
    scope: string
    averageAge: number | null
    ageGroups: { label: string; count: number }[]
    genderBreakdown: { label: string; count: number }[]
    jobBreakdown: { label: string; count: number }[]
    mainPurposeBreakdown: { label: string; count: number }[]
    routeBreakdown: { label: string; count: number }[]
    retention: {
        churnedMemberCount: number
        averageTenureDays: number | null
        averageTenureLabel: string | null
    }
}

export default function DemographicsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { currentStoreId } = useStoreChange()
    const [filterStoreId, setFilterStoreId] = useState<string>(currentStoreId || 'all')
    const [stores, setStores] = useState<AdminStoreOption[]>([])
    const [demographics, setDemographics] = useState<DemographicsData | null>(null)
    const [scope, setScope] = useState<'all' | 'current'>('all')
    const [demographicsLoading, setDemographicsLoading] = useState(true)

    useEffect(() => {
        if (status === 'loading') return
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }
        if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
            router.push('/dashboard')
            return
        }
    }, [status, session, router])

    useEffect(() => {
        let ignore = false
        const fetchStores = async () => {
            try {
                const list = await fetchAdminStoresOnce()
                if (!ignore) setStores(list)
            } catch (e) {
                if (!ignore) console.error('Failed to fetch stores', e)
            }
        }
        fetchStores()

        return () => {
            ignore = true
        }
    }, [])

    useEffect(() => {
        if (currentStoreId) {
            setFilterStoreId(currentStoreId)
        }
    }, [currentStoreId])

    // 会員統計(年齢層・男女比・職業・入会目的・入会経路)
    useEffect(() => {
        let ignore = false
        setDemographicsLoading(true)
        fetch(`/api/admin/demographics?storeId=${filterStoreId || 'all'}&scope=${scope}`)
            .then((res) => {
                if (!res.ok) throw new Error('failed')
                return res.json()
            })
            .then((json) => {
                if (!ignore) setDemographics(json)
            })
            .catch((e) => {
                if (!ignore) console.error('Failed to fetch demographics', e)
            })
            .finally(() => {
                if (!ignore) setDemographicsLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [filterStoreId, scope])

    if (status === 'loading') return null

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-text-primary">会員統計</h1>
                <div className="flex flex-wrap justify-end gap-2">
                    <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'current')} className="text-sm border-border-strong rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500 py-1 pl-2 pr-8">
                        <option value="all">全体</option>
                        <option value="current">現会員</option>
                    </select>
                    <select value={filterStoreId} onChange={(e) => setFilterStoreId(e.target.value)} className="text-sm border-border-strong rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500 py-1 pl-2 pr-8">
                        <option value="all">全店舗</option>
                        {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                    </select>
                </div>
            </div>
            <p className="mb-4 text-xs font-normal text-text-secondary">
                {demographics ? `対象: 登録会員 ${demographics.totalMembers}名(在籍・休会・退会を含む)` : ''}
            </p>

            {demographicsLoading ? (
                <p className="text-sm font-normal text-text-secondary">読み込み中...</p>
            ) : demographics ? (
                <>
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-sm">
                        <StatCard
                            label="平均継続期間"
                            value={demographics.retention.averageTenureLabel ?? '―'}
                            unit=""
                        />
                        <StatCard
                            label="退会済み会員数"
                            value={demographics.retention.churnedMemberCount}
                            unit="名"
                        />
                        <StatCard label="平均年齢" value={demographics.averageAge ?? '―'} unit={demographics.averageAge === null ? '' : '歳'} />
                    </div>
                    <p className="mb-4 -mt-3 text-xs font-normal text-text-secondary">
                        ※入会から退会までを完了している会員の実績値のみで算出(現在在籍中の会員は含みません)
                    </p>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <BreakdownPie title="年齢層" items={demographics.ageGroups} />
                        <BreakdownPie title="男女比" items={demographics.genderBreakdown} />
                        <BreakdownList title="職業傾向" items={demographics.jobBreakdown.map((j) => ({ label: j.label, count: j.count }))} note="自由入力(カウンセリング「職業」欄)の集計のため表記ゆれあり" />
                        <BreakdownList title="主な入会目的" items={demographics.mainPurposeBreakdown.map((p) => ({ label: p.label, count: p.count }))} />
                        <BreakdownList title="入会経路" items={demographics.routeBreakdown.map((r) => ({ label: r.label, count: r.count }))} />
                    </div>
                </>
            ) : (
                <p className="text-sm font-normal text-text-secondary">データを取得できませんでした</p>
            )}
            <p className="mt-4 text-xs font-normal text-text-secondary">
                ※職業・入会目的・入会経路は会員詳細の「カウンセリング」情報が入力されている会員のみ集計対象です(未入力分は「未入力」に集計)。
            </p>
        </div>
    )
}

const PIE_COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#64748b', '#db2777']

function BreakdownPie({ title, items }: { title: string; items: { label: string; count: number }[] }) {
    const total = items.reduce((sum, item) => sum + item.count, 0)
    const getColor = (label: string, index: number) => {
        if (title === '男女比') {
            if (label === '男性') return '#2563eb'
            if (label === '女性') return '#dc2626'
            return '#87909a'
        }
        return PIE_COLORS[index % PIE_COLORS.length]
    }
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4">
            <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            {items.length === 0 ? <p className="mt-2 text-sm text-text-secondary">データがありません</p> : (
                <div className="mt-2">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={items} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={68} label={false} labelLine={false}>
                                {items.map((item, index) => <Cell key={item.label} fill={getColor(item.label, index)} />)}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value}名`, '人数']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                        {items.map((item, index) => (
                            <span key={item.label} className="inline-flex items-center gap-1 whitespace-nowrap">
                                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: getColor(item.label, index) }} />
                                {item.label} {total ? Math.round((item.count / total) * 100) : 0}%（{item.count}名）
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
