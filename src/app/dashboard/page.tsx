'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { getStatusDotColor } from '@/lib/utils/member'
import Icon, { IconName } from '@/components/ui/icons'
import { fetchJsonCached } from '@/lib/client-fetch-cache'
import ConsentGate from '@/components/ConsentGate'

const CalendarView = dynamic(() => import('@/components/CalendarView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
    </div>
  ),
})

// --- Sub Components ---

function OtherGridItem({ href, label, iconName }: { href: string, label: string, iconName: IconName }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[106px] flex-col items-center justify-start rounded-2xl px-2 py-3 text-center transition-colors active:scale-[0.98] hover:bg-surface-raised/50"
    >
      <div className="flex h-12 items-center justify-center text-text-secondary transition-colors group-hover:text-text-primary">
        <Icon name={iconName} size={40} />
      </div>
      <div className="mt-2 text-xs font-normal leading-snug text-text-secondary transition-colors group-hover:text-text-primary">
        {label}
      </div>
    </Link>
  )
}

// ハイドレーションエラーを防ぐためのラッパーコンポーネント
const AdminDashboard = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [mounted, setMounted] = useState(false);
  
  const [dietMembers, setDietMembers] = useState<any[]>([]);
  const [dietLoading, setDietLoading] = useState(false);
  const router = useRouter();
  
  // クライアントサイドでのみURLパラメータを読み込む
  useEffect(() => {
    setMounted(true);
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // ダイエットタブが選択された時だけデータを取得
  useEffect(() => {
    if (activeTab === 'diet' && dietMembers.length === 0) {
      const fetchDietMembers = async () => {
        setDietLoading(true);
        try {
          const data = await fetchJsonCached<any>('/api/admin/members?diet_only=true&compact=true', undefined, 30_000);
          setDietMembers(data.members || data.data?.members || []);
        } catch (e) {
          console.error('Failed to fetch diet members', e);
        } finally {
          setDietLoading(false);
        }
      };
      fetchDietMembers();
    }
  }, [activeTab, dietMembers.length]);

  if (!mounted) return null;

  return (
    <div className="animate-fadeIn">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* DIET TAB */}
        {activeTab === 'diet' && (
          <div className="space-y-6 animate-slideUp">
            <div className="bg-surface-raised p-6 rounded-2xl border border-border-subtle shadow-sm space-y-6">
              <div className="space-y-3">
                {dietLoading ? (
                  <div className="py-10 text-center flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                    <span className="text-xs font-normal text-text-muted">読み込み中...</span>
                  </div>
                ) : dietMembers.length === 0 ? (
                  <div className="py-10 text-center text-text-muted italic text-sm">対象者がいません</div>
                ) : (
                  dietMembers.map(member => (
                    <Link key={member.id} href={`/admin/diet-plan?userId=${member.id}`} className="flex items-center gap-4 p-5 hover:bg-surface-base rounded-2xl border border-border-subtle transition-all shadow-sm">
                      <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)}`} />
                      <div className="flex-1">
                        <div className="text-sm font-normal text-text-primary">{member.full_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-normal text-text-muted bg-surface-overlay px-2 py-0.5 rounded-lg uppercase">
                            {member.stores?.name || '店舗未設定'}
                          </span>
                        </div>
                      </div>
                      <Icon name="chevronRight" size={20} className="text-text-muted" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* HOME / RESERVATION TAB */}
        {activeTab === 'home' && (
          <div className="animate-slideUp -mt-4 sm:-mt-2">
            <div className="bg-surface-raised rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
              <div className="p-0">
                <CalendarView key={searchParams.get('_t') || 'initial'} />
              </div>
            </div>
          </div>
        )}

        {/* OTHERS TAB */}
        {activeTab === 'others' && (
          <div className="animate-slideUp">
            <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4">
              <OtherGridItem href="/admin/shifts" label="シフト管理" iconName="clock" />
              <OtherGridItem href="/admin/payroll" label="給与計算" iconName="currencyYen" />
              <OtherGridItem href="/admin/capacity" label="稼働率" iconName="chartBar" />
              <OtherGridItem href="/admin/online-lesson" label="オンライン" iconName="video" />
              <OtherGridItem href="/admin/trainers" label="トレーナー管理" iconName="academicCap" />
              <OtherGridItem href="/admin/stores" label="店舗管理" iconName="building" />
              <OtherGridItem href="/admin/mail-settings" label="配信設定" iconName="envelope" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') return null;
  if (!session) return null;

  return (
    <ConsentGate subjectType="admin" subjectId={session.user.role === 'ADMIN' ? session.user.id : null}>
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-8">
      <Suspense fallback={null}>
        {session.user.role === 'ADMIN' ? <AdminDashboard /> : <div className="text-center py-20 font-normal">アクセス権限がありません</div>}
      </Suspense>
    </div>
    </ConsentGate>
  );
}
