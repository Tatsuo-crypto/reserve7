'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useStoreChange } from '@/hooks/useStoreChange'
import { AdminStoreOption, fetchAdminStoresOnce } from '@/lib/admin-stores-client'
import BreakdownList from '@/components/ui/BreakdownList'

type DemographicsData = {
    totalMembers: number
    ageGroups: { label: string; count: number }[]
    genderBreakdown: { label: string; count: number }[]
    jobBreakdown: { label: string; count: number }[]
    mainPurposeBreakdown: { label: string; count: number }[]
    routeBreakdown: { label: string; count: number }[]
}

export default function DemographicsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { currentStoreId } = useStoreChange()
    const [filterStoreId, setFilterStoreId] = useState<string>(currentStoreId || 'all')
    const [stores, setStores] = useState<AdminStoreOption[]>([])
    const [demographics, setDemographics] = useState<DemographicsData | null>(null)
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
        fetch(`/api/admin/demographics?storeId=${filterStoreId || 'all'}`)
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
    }, [filterStoreId])

    if (status === 'loading') return null

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-text-primary">会員統計</h1>
                <select
                    value={filterStoreId}
                    onChange={(e) => setFilterStoreId(e.target.value)}
                    className="text-sm border-border-strong rounded-lg shadow-sm focus:border-brand-500 focus:ring-brand-500 py-1 pl-2 pr-8"
                >
                    <option value="all">全店舗</option>
                    {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                </select>
            </div>
            <p className="mb-4 text-xs font-normal text-text-secondary">
                {demographics ? `対象: 登録会員 ${demographics.totalMembers}名(在籍・休会・退会を含む)` : ''}
            </p>

            {demographicsLoading ? (
                <p className="text-sm font-normal text-text-secondary">読み込み中...</p>
            ) : demographics ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <BreakdownList title="年齢層" items={demographics.ageGroups.map((a) => ({ label: a.label, count: a.count }))} />
                    <BreakdownList title="男女比" items={demographics.genderBreakdown.map((g) => ({ label: g.label, count: g.count }))} />
                    <BreakdownList title="職業傾向" items={demographics.jobBreakdown.map((j) => ({ label: j.label, count: j.count }))} note="自由入力(カウンセリング「職業」欄)の集計のため表記ゆれあり" />
                    <BreakdownList title="主な入会目的" items={demographics.mainPurposeBreakdown.map((p) => ({ label: p.label, count: p.count }))} />
                    <BreakdownList title="入会経路" items={demographics.routeBreakdown.map((r) => ({ label: r.label, count: r.count }))} />
                </div>
            ) : (
                <p className="text-sm font-normal text-text-secondary">データを取得できませんでした</p>
            )}
            <p className="mt-4 text-xs font-normal text-text-secondary">
                ※職業・入会目的・入会経路は会員詳細の「カウンセリング」情報が入力されている会員のみ集計対象です(未入力分は「未入力」に集計)。
            </p>
        </div>
    )
}
