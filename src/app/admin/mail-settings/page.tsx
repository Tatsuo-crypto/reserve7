'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminHeader from '@/app/components/AdminHeader'

// メール送信機能は廃止（2026-07決定）。通知はアプリのプッシュ通知のみ。
// APIとの互換性のため、これらのフィールドはやり取りするが画面上には出さない。
interface MailSettings {
  reminder_before_minutes: number
  sender_display_name: string
  additional_recipient_emails: string
  client_create_notify: boolean
  client_update_notify: boolean
  client_cancel_notify: boolean
  trainer_create_notify: boolean
  trainer_update_notify: boolean
  trainer_cancel_notify: boolean
  personal_reminder_enabled: boolean
  personal_reminder_days_before: number
  personal_reminder_hour: number
  personal_reminder_template: string
  online_announcement_template: string
  client_create_template: string
  client_update_template: string
  client_cancel_template: string
}

interface MemberNotificationSetting {
  id: string
  fullName: string
  email: string
  status: string
  storeId: string | null
  storeName: string
  emailEnabled: boolean
  pushEnabled: boolean
  pushSubscriptionCount: number
}

export default function AdminMailSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [settings, setSettings] = useState<MailSettings>({
    reminder_before_minutes: 30,
    sender_display_name: 'T&J GYM',
    additional_recipient_emails: '',
    client_create_notify: true,
    client_update_notify: true,
    client_cancel_notify: true,
    trainer_create_notify: true,
    trainer_update_notify: true,
    trainer_cancel_notify: true,
    personal_reminder_enabled: true,
    personal_reminder_days_before: 1,
    personal_reminder_hour: 21,
    personal_reminder_template: '',
    online_announcement_template: '',
    client_create_template: '',
    client_update_template: '',
    client_cancel_template: '',
  })

  const [tableExists, setTableExists] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberNotificationSetting[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersSaving, setMembersSaving] = useState(false)

  const [activeTab, setActiveTab] = useState<'members' | 'reminder'>('members')

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    fetchSettings()
    fetchMembers()
  }, [status])

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/mail-settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
        setTableExists(data.tableExists ?? true)
      } else {
        throw new Error('設定の取得に失敗しました')
      }
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '設定の読み込み中にエラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/admin/member-notification-settings')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '会員の通知設定の取得に失敗しました')
      }

      setMembers(data.members || [])
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '会員の通知設定の読み込み中にエラーが発生しました。')
    } finally {
      setMembersLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/mail-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '設定の保存に失敗しました')
      }

      setSuccess('通知設定を保存しました。')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '設定の保存中にエラーが発生しました。')
    } finally {
      setSaving(false)
    }
  }

  const handleMemberToggle = (memberId: string) => {
    setMembers(prev => prev.map(member => (
      member.id === memberId ? { ...member, pushEnabled: !member.pushEnabled } : member
    )))
  }

  const setAllMembers = (value: boolean) => {
    setMembers(prev => prev.map(member => ({
      ...member,
      pushEnabled: value
    })))
  }

  const memberStoreGroups = useMemo(() => {
    const statusOrder: Record<string, number> = {
      active: 0,
      suspended: 1,
      withdrawn: 2,
    }

    const sortedMembers = [...members].sort((a, b) => {
      const storeCompare = (a.storeName || '店舗未設定').localeCompare(b.storeName || '店舗未設定', 'ja')
      if (storeCompare !== 0) return storeCompare

      const statusCompare = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
      if (statusCompare !== 0) return statusCompare

      return a.fullName.localeCompare(b.fullName, 'ja')
    })

    const groups = new Map<string, MemberNotificationSetting[]>()

    for (const member of sortedMembers) {
      const storeName = member.storeName || '店舗未設定'
      groups.set(storeName, [...(groups.get(storeName) || []), member])
    }

    return Array.from(groups.entries()).map(([storeName, storeMembers]) => ({
      storeName,
      members: storeMembers,
    }))
  }, [members])

  const notificationStats = useMemo(() => {
    const readyCount = members.filter(member => member.pushEnabled && member.pushSubscriptionCount > 0).length
    const missingDeviceCount = members.filter(member => member.pushEnabled && member.pushSubscriptionCount === 0).length

    return {
      total: members.length,
      readyCount,
      missingDeviceCount,
    }
  }, [members])

  const handleSaveMembers = async () => {
    setMembersSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/member-notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: members.map(member => ({
            id: member.id,
            emailEnabled: member.emailEnabled,
            pushEnabled: member.pushEnabled,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '会員の通知設定の保存に失敗しました')
      }

      setSuccess('会員ごとの通知設定を保存しました。')
      setTimeout(() => setSuccess(null), 3000)
      fetchMembers()
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '会員の通知設定の保存中にエラーが発生しました。')
    } finally {
      setMembersSaving(false)
    }
  }

  const handleToggle = (key: keyof MailSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key] as any,
    }))
  }

  const handleInputChange = (key: keyof MailSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <AdminHeader
        title="配信設定"
        subTitle="PUSH NOTIFICATION SETTINGS"
        onBack={() => router.push('/dashboard?tab=others')}
      />

      <div className="max-w-3xl mx-auto px-4">
        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700 flex items-center gap-2 animate-fadeIn">
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex items-center gap-2 animate-fadeIn">
            <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Table Migration Warning */}
        {!tableExists && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 animate-fadeIn">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold mb-1">データベースの準備ができていません</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <code>mail_settings</code> テーブルがデータベースに存在しません。管理者ユーザーが Supabase の SQL Editor などで、以下のマイグレーションファイルの内容を実行するまで、この設定画面はデフォルト値の読み取り専用となります。
                </p>
                <p className="mt-2 text-xs font-mono bg-amber-100/50 p-2 rounded-lg border border-amber-200/50 select-all overflow-x-auto">
                  supabase/migrations/20260604_create_mail_settings.sql
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Tab Bar */}
        <div className="flex bg-gray-200/60 p-1.5 rounded-2xl mb-8 border border-gray-200/50 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
              activeTab === 'members'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            会員別の通知
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reminder')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
              activeTab === 'reminder'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            リマインダーの時間
          </button>
        </div>

        {/* TAB: Members */}
        {activeTab === 'members' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">会員ごとのアプリ通知</h2>
                  <p className="mt-1 text-xs text-gray-500">このスイッチ1つで、予約の確定・変更連絡と前日リマインダー、オンラインレッスン開始前の通知すべてを制御します。</p>
                  <p className="mt-0.5 text-xs text-gray-400">メール送信は行わず、アプリのプッシュ通知だけで届きます。</p>
                </div>
                <button
                  type="button"
                  onClick={fetchMembers}
                  disabled={membersLoading}
                  className="px-4 py-2 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 shrink-0"
                >
                  再読み込み
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">
                  通知を受け取れる会員: <span className="font-semibold text-gray-900 tabular-nums">{notificationStats.readyCount}</span> / {notificationStats.total}名
                </p>
                {notificationStats.missingDeviceCount > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    うち{notificationStats.missingDeviceCount}名は通知ONですが、会員さん側でスマホの通知許可がまだのため届きません。
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAllMembers(true)}
                  className="px-4 py-2 text-xs rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                >
                  全員ON
                </button>
                <button
                  type="button"
                  onClick={() => setAllMembers(false)}
                  className="px-4 py-2 text-xs rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
                >
                  全員OFF
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">会員</th>
                      <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">通知</th>
                      <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {membersLoading ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">読み込み中...</td>
                      </tr>
                    ) : members.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">会員が見つかりません</td>
                      </tr>
                    ) : (
                      memberStoreGroups.map(group => (
                        <Fragment key={group.storeName}>
                          <tr className="bg-gray-50/80">
                            <td colSpan={3} className="px-4 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-gray-600">{group.storeName}</span>
                                <span className="text-[10px] text-gray-400">{group.members.length}名</span>
                              </div>
                            </td>
                          </tr>
                          {group.members.map(member => {
                            const receivable = member.pushEnabled && member.pushSubscriptionCount > 0
                            return (
                              <tr key={member.id} className="hover:bg-gray-50/70">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm text-gray-900">{member.fullName}</div>
                                    {member.status !== 'active' && (
                                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                                        {member.status === 'suspended' ? '休会' : '退会'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={member.pushEnabled}
                                    onChange={() => handleMemberToggle(member.id)}
                                    className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                    aria-label={`${member.fullName}のアプリ通知`}
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] ${
                                    receivable
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : member.pushEnabled
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    {receivable ? '受信可能' : member.pushEnabled ? '未許可' : 'OFF'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard?tab=others')}
                className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors flex-1 text-center"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={handleSaveMembers}
                disabled={membersSaving || membersLoading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 flex-[2] shadow-md shadow-blue-500/10"
              >
                {membersSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    保存中...
                  </>
                ) : (
                  '保存する'
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Reminder timing */}
        {activeTab === 'reminder' && (
          <form onSubmit={handleSave} className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              <div className="space-y-4 border-b border-gray-100 pb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  パーソナルセッション前日リマインダー
                </h3>

                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={!tableExists}
                      checked={settings.personal_reminder_enabled}
                      onChange={() => handleToggle('personal_reminder_enabled')}
                      className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                    />
                    <span className="text-sm font-medium text-gray-700">自動リマインダー通知を有効にする</span>
                  </label>
                  <p className="pl-7 text-xs text-gray-400">※ 通知ONかつスマホ側で許可済みの会員様にのみ届きます。</p>
                  <p className="pl-7 text-xs text-gray-400">毎晩21:00に、翌日ご予約のある会員様へまとめて送信します（サーバー側の制約で1日1回のみ）。</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  オンラインレッスン用自動リマインダー設定
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    リマインダー自動送信タイミング
                  </label>
                  <select
                    disabled={!tableExists}
                    value={settings.reminder_before_minutes}
                    onChange={(e) => handleInputChange('reminder_before_minutes', Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value={15}>レッスン開始 15分前</option>
                    <option value={30}>レッスン開始 30分前</option>
                    <option value={60}>レッスン開始 60分前</option>
                    <option value={120}>レッスン開始 120分前</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400 leading-normal">
                    毎晩21:00のチェックから「◯分後」に開催されるレッスンの参加者へ通知します（例: 30分前を選ぶと、21:30開始のレッスンに通知）。
                  </p>
                  <p className="mt-1 text-xs text-gray-400 leading-normal">
                    ※ サーバー側の制約でチェックは1日1回(21:00)のみのため、21:00からこの時間だけ後の枠しか通知できません。それより前や翌日以降の時間帯のレッスンには対応できません。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard?tab=others')}
                className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors flex-1 text-center"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving || !tableExists}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 flex-[2] shadow-md shadow-blue-500/10"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    保存中...
                  </>
                ) : (
                  '保存する'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
