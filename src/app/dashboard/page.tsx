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

// --- Sub Components ---

function OtherSubCard({ href, label, subLabel, color, icon }: { href: string, label: string, subLabel: string, color: string, icon: React.ReactNode }) {
  const colorMap: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100',
  };
  return (
    <Link href={href} className="flex items-center gap-4 p-5 rounded-3xl border transition-all shadow-sm bg-white hover:shadow-md transform hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorMap[color]?.split(' ')[0]} ${colorMap[color]?.split(' ')[1]}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
      <div className="flex-1">
        <div className="text-base font-normal text-gray-900">{label}</div>
        <div className="text-xs font-normal text-gray-400">{subLabel}</div>
      </div>
      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
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
            <AdminHeader 
              title="ダイエット管理" 
              subTitle="プランがONの会員のみ表示"
              showBack={false}
            />
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
              <div className="space-y-3">
                {dietLoading ? (
                  <div className="py-10 text-center flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                    <span className="text-xs font-normal text-gray-400">読み込み中...</span>
                  </div>
                ) : dietMembers.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 italic text-sm">対象者がいません</div>
                ) : (
                  dietMembers.map(member => (
                    <Link key={member.id} href={`/admin/diet-plan?userId=${member.id}`} className="flex items-center gap-4 p-5 hover:bg-gray-50 rounded-3xl border border-gray-50 transition-all shadow-sm">
                      <div className={`w-3 h-3 rounded-full ${getStatusDotColor(member.status)}`} />
                      <div className="flex-1">
                        <div className="text-base font-normal text-gray-900">{member.full_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase">
                            {member.stores?.name || '店舗未設定'}
                          </span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* HOME / RESERVATION TAB */}
        {activeTab === 'home' && (
          <div className="animate-slideUp -mt-10">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-0">
                <CalendarView key={searchParams.get('_t') || 'initial'} />
              </div>
            </div>
          </div>
        )}

        {/* OTHERS TAB */}
        {activeTab === 'others' && (
          <div className="grid grid-cols-1 gap-4 animate-slideUp">
            <AdminHeader 
              title="管理・設定" 
              subTitle="各種マスター設定と管理"
              showBack={false}
            />
            <OtherSubCard href="/admin/trainers" label="トレーナー管理" subLabel="スタッフの登録・編集" color="emerald" icon={<path d="M12 14l9-5-9-5-9 5 9 5z" />} />
            <OtherSubCard href="/admin/stores" label="店舗管理" subLabel="店舗情報の変更・設定" color="indigo" icon={<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />} />
            <OtherSubCard href="/admin/shifts" label="シフト管理" subLabel="勤務スケジュールの作成" color="emerald" icon={<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} />
            <OtherSubCard href="/admin/online-lesson" label="オンライン" subLabel="スケジュールの管理" color="orange" icon={<path d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.309a1 1 0 01-1.447.894L15 14" />} />
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
