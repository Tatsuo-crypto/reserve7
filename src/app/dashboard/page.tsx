'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CalendarView from '@/components/CalendarView'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getStatusDotColor, getStatusText, getStatusColor } from '@/lib/utils/member'
import AdminHeader from '@/app/components/AdminHeader'
import Card from '@/components/ui/Card'
import Icon, { IconName } from '@/components/ui/icons'

// --- Sub Components ---

// R-2: アイコン背景は装飾色ではなく常にニュートラル(surface.overlay相当)。
// 項目同士の区別はラベルとアイコン形状のみに任せ、色は使わない。
function OtherSubCard({ href, label, subLabel, iconName }: { href: string, label: string, subLabel: string, iconName: IconName }) {
  return (
    <Link href={href} className="block">
      <Card padding="sm" className="flex items-center gap-4 hover:bg-surface-base transition-colors">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-surface-overlay text-text-secondary shrink-0">
          <Icon name={iconName} size={24} />
        </div>
        <div className="flex-1">
          <div className="text-base font-normal text-text-primary">{label}</div>
          <div className="text-xs font-normal text-text-muted">{subLabel}</div>
        </div>
        <Icon name="chevronRight" size={20} className="text-text-muted" />
      </Card>
    </Link>
  );
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
          const res = await fetch('/api/admin/members?diet_only=true');
          if (res.ok) {
            const data = await res.json();
            setDietMembers(data.members || data.data?.members || []);
          }
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
            <div className="bg-surface-raised p-6 rounded-[2.5rem] border border-border-subtle shadow-sm space-y-6">
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
                    <Link key={member.id} href={`/admin/diet-plan?userId=${member.id}`} className="flex items-center gap-4 p-5 hover:bg-surface-base rounded-3xl border border-border-subtle transition-all shadow-sm">
                      <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)}`} />
                      <div className="flex-1">
                        <div className="text-base font-normal text-text-primary">{member.full_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-normal text-text-muted bg-surface-overlay px-2 py-0.5 rounded-md uppercase">
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
          <div className="animate-slideUp -mt-2">
            <div className="bg-surface-raised rounded-[2.5rem] border border-border-subtle shadow-sm overflow-hidden">
              <div className="p-0">
                <CalendarView key={searchParams.get('_t') || 'initial'} />
              </div>
            </div>
          </div>
        )}

        {/* OTHERS TAB */}
        {activeTab === 'others' && (
          <div className="space-y-8 animate-slideUp">
            <div className="space-y-3">
              <h3 className="px-1 text-xs font-normal text-text-muted uppercase tracking-widest">日々の運用</h3>
              <div className="grid grid-cols-1 gap-4">
                <OtherSubCard href="/admin/shifts" label="シフト管理" subLabel="勤務スケジュールの作成" iconName="clock" />
                <OtherSubCard href="/admin/online-lesson" label="オンライン" subLabel="スケジュールの管理" iconName="video" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="px-1 text-xs font-normal text-text-muted uppercase tracking-widest">設定</h3>
              <div className="grid grid-cols-1 gap-4">
                <OtherSubCard href="/admin/trainers" label="トレーナー管理" subLabel="スタッフの登録・編集" iconName="academicCap" />
                <OtherSubCard href="/admin/stores" label="店舗管理" subLabel="店舗情報の変更・設定" iconName="building" />
                <OtherSubCard
                  href="/admin/mail-settings"
                  label="配信設定"
                  subLabel="メール・アプリ通知の管理"
                  iconName="envelope"
                />
              </div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={null}>
        {session.user.role === 'ADMIN' ? <AdminDashboard /> : <div className="text-center py-20 font-normal">アクセス権限がありません</div>}
      </Suspense>
    </div>
  );
}
