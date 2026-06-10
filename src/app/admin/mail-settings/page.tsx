'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminHeader from '@/app/components/AdminHeader'

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
    personal_reminder_template: 'ご予約のセッション日時が近づいてまいりましたので、お知らせいたします。\n内容をご確認いただき、お気をつけてお越しください。',
    online_announcement_template: 'オンラインレッスンが開催されますので、お知らせいたします。\nお時間になりましたら、以下のリンクよりご参加ください。\n\nレッスン：{title}\n開始時間：{time}\nURL：{url}',
    client_create_template: 'ご予約が確定しました。',
    client_update_template: 'ご予約内容が変更されましたのでご確認ください。',
    client_cancel_template: 'ご予約のキャンセルを承りました。',
  })

  const [tableExists, setTableExists] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberNotificationSetting[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersSaving, setMembersSaving] = useState(false)

  // Test send states
  const [testTo, setTestTo] = useState('')
  const [testType, setTestType] = useState('client')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Tabs states
  const [activeTab, setActiveTab] = useState<'members' | 'confirmation' | 'update' | 'reminder'>('members')
  const [activeSubTab, setActiveSubTab] = useState<'update' | 'cancel'>('update')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    fetchSettings()
    fetchMembers()
  }, [status])

  useEffect(() => {
    if (session?.user?.email && !testTo) {
      setTestTo(session.user.email)
    }
  }, [session, testTo])

  // Sync test type to active tabs
  useEffect(() => {
    if (activeTab === 'members') {
      setTestType('personal-reminder')
    } else if (activeTab === 'confirmation') {
      setTestType('client')
    } else if (activeTab === 'update') {
      setTestType(activeSubTab === 'update' ? 'client-update' : 'client-cancel')
    } else if (activeTab === 'reminder') {
      setTestType('personal-reminder')
    }
  }, [activeTab, activeSubTab])

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/mail-settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setSettings({
            ...data.settings,
            personal_reminder_enabled: data.settings.personal_reminder_enabled ?? true,
            personal_reminder_days_before: data.settings.personal_reminder_days_before ?? 1,
            personal_reminder_hour: data.settings.personal_reminder_hour ?? 21,
            personal_reminder_template: data.settings.personal_reminder_template ?? 'ご予約のセッション日時が近づいてまいりましたので、お知らせいたします。\n内容をご確認いただき、お気をつけてお越しください。',
            online_announcement_template: data.settings.online_announcement_template ?? 'オンラインレッスンが開催されますので、お知らせいたします。\nお時間になりましたら、以下のリンクよりご参加ください。\n\nレッスン：{title}\n開始時間：{time}\nURL：{url}',
            client_create_template: data.settings.client_create_template ?? 'ご予約が確定しました。',
            client_update_template: data.settings.client_update_template ?? 'ご予約内容が変更されましたのでご確認ください。',
            client_cancel_template: data.settings.client_cancel_template ?? 'ご予約のキャンセルを承りました。',
          })
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
        throw new Error(data.error || '会員通知設定の取得に失敗しました')
      }

      setMembers(data.members || [])
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '会員通知設定の読み込み中にエラーが発生しました。')
    } finally {
      setMembersLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (settings.additional_recipient_emails.trim()) {
      const emails = settings.additional_recipient_emails
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = emails.filter((email) => !emailRegex.test(email))

      if (invalidEmails.length > 0) {
        setError(`無効なメールアドレスが含まれています: ${invalidEmails.join(', ')}`)
        setSaving(false)
        return
      }
    }

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

  const handleMemberToggle = (memberId: string, key: 'emailEnabled' | 'pushEnabled') => {
    setMembers(prev => prev.map(member => (
      member.id === memberId ? { ...member, [key]: !member[key] } : member
    )))
  }

  const setAllMembers = (key: 'emailEnabled' | 'pushEnabled', value: boolean) => {
    setMembers(prev => prev.map(member => ({
      ...member,
      [key]: value
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
        throw new Error(data.error || '会員通知設定の保存に失敗しました')
      }

      setSuccess('会員ごとの通知設定を保存しました。')
      setTimeout(() => setSuccess(null), 3000)
      fetchMembers()
    } catch (err: any) {
      console.error(err)
      setError(err instanceof Error ? err.message : '会員通知設定の保存中にエラーが発生しました。')
    } finally {
      setMembersSaving(false)
    }
  }

  const handleTestSend = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!testTo.trim()) {
      alert('テスト送信先のメールアドレスを入力してください。')
      return
    }
    setTesting(true)
    setTestResult(null)

    const typeLabels: any = {
      'personal-reminder': 'パーソナルリマインダー',
      'client': '予約確定（会員向け）',
      'client-update': '予約変更（会員向け）',
      'client-cancel': '予約キャンセル（会員向け）',
    }

    try {
      const res = await fetch(`/api/admin/test-email?to=${encodeURIComponent(testTo.trim())}&type=${testType}`)
      const data = await res.json()
      if (res.ok && data.test?.result === 'SUCCESS') {
        setTestResult({
          success: true,
          message: `${typeLabels[testType] || 'テスト'}メールを ${testTo} 宛てに正常に送信しました！`
        })
      } else {
        throw new Error(data.test?.error || data.error || '送信に失敗しました。')
      }
    } catch (err: any) {
      console.error(err)
      setTestResult({
        success: false,
        message: `送信エラー: ${err.message || '送信中にエラーが発生しました。'}`
      })
    } finally {
      setTesting(false)
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

  // Preview content generators
  const getPreviewSubject = () => {
    if (activeTab === 'confirmation') return 'ご予約の確認'
    if (activeTab === 'update') {
      return activeSubTab === 'update' ? 'ご予約変更の確認' : 'ご予約キャンセルの確認'
    }
    // Reminder tab
    const daysBefore = settings.personal_reminder_days_before ?? 1
    return daysBefore === 1 ? 'ご予約前日のお知らせ' : `ご予約${daysBefore}日前のお知らせ`
  }

  const getPreviewBody = () => {
    let template = ''
    if (activeTab === 'confirmation') template = settings.client_create_template
    else if (activeTab === 'update') {
      template = activeSubTab === 'update' ? settings.client_update_template : settings.client_cancel_template
    } else {
      template = settings.personal_reminder_template
    }

    return template
      .replace(/{name}/g, 'テスト会員様')
      .replace(/{trainer}/g, '三井 達雄')
      .replace(/{store}/g, 'T&J GYM 1号店')
      .replace(/{date}/g, '2026年6月8日(月)')
      .replace(/{time}/g, '09:00 - 10:00')
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
        title="通知設定"
        subTitle="NOTIFICATION CONFIGURATION"
        onBack={() => router.push('/dashboard?tab=others')}
      />

      <div className="max-w-6xl mx-auto px-4">
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
        <div className="flex bg-gray-200/60 p-1.5 rounded-2xl mb-8 border border-gray-200/50 max-w-3xl mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'members'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
            会員別
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confirmation')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'confirmation'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            確認
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('update')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'update'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            変更
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reminder')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'reminder'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            リマインダー
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form Settings (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {activeTab === 'members' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">会員ごとの通知設定</h2>
                      <p className="mt-1 text-xs text-gray-500">メール通知とアプリ通知を会員ごとに一括管理できます。</p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchMembers}
                      disabled={membersLoading}
                      className="px-4 py-2 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      再読み込み
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAllMembers('emailEnabled', true)}
                      className="px-3 py-2 text-xs rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                    >
                      メールを全員ON
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllMembers('emailEnabled', false)}
                      className="px-3 py-2 text-xs rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
                    >
                      メールを全員OFF
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllMembers('pushEnabled', true)}
                      className="px-3 py-2 text-xs rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                    >
                      アプリ通知を全員ON
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllMembers('pushEnabled', false)}
                      className="px-3 py-2 text-xs rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100"
                    >
                      アプリ通知を全員OFF
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">会員</th>
                          <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">メール</th>
                          <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">アプリ通知</th>
                          <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">端末</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {membersLoading ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">読み込み中...</td>
                          </tr>
                        ) : members.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">会員が見つかりません</td>
                          </tr>
                        ) : (
                          memberStoreGroups.map(group => (
                            <Fragment key={group.storeName}>
                              <tr className="bg-gray-50/80">
                                <td colSpan={4} className="px-4 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold text-gray-600">{group.storeName}</span>
                                    <span className="text-[10px] text-gray-400">{group.members.length}名</span>
                                  </div>
                                </td>
                              </tr>
                              {group.members.map(member => (
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
                                    <div className="text-[11px] text-gray-400">{member.email}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={member.emailEnabled}
                                      onChange={() => handleMemberToggle(member.id, 'emailEnabled')}
                                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      aria-label={`${member.fullName}のメール通知`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={member.pushEnabled}
                                      onChange={() => handleMemberToggle(member.id, 'pushEnabled')}
                                      className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                      aria-label={`${member.fullName}のアプリ通知`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] ${
                                      member.pushSubscriptionCount > 0
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>
                                      {member.pushSubscriptionCount > 0 ? `${member.pushSubscriptionCount}台` : '未登録'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* TAB 1: Confirmation Email Settings */}
              {activeTab === 'confirmation' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">1</div>
                      予約確定通知の送信設定
                    </h2>
                    
                    <div className="space-y-4">
                      {/* Toggles */}
                      <div className="space-y-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            disabled={!tableExists}
                            checked={settings.client_create_notify}
                            onChange={() => handleToggle('client_create_notify')}
                            className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          />
                          <span className="text-sm font-medium text-gray-700">会員へ「予約確定メール」を送信する</span>
                        </label>
                        <p className="pl-7 text-xs text-gray-400">※ 会員管理で「メール通知」を有効にしている会員様にのみ送信されます。</p>

                        <label className="flex items-center gap-3 cursor-pointer select-none pt-2 border-t border-gray-200/50">
                          <input
                            type="checkbox"
                            disabled={!tableExists}
                            checked={settings.trainer_create_notify}
                            onChange={() => handleToggle('trainer_create_notify')}
                            className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          />
                          <span className="text-sm font-medium text-gray-700">担当トレーナーへ「新規予約メール」を送信する</span>
                        </label>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Update / Cancel Settings */}
              {activeTab === 'update' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">2</div>
                      予約変更・キャンセル通知の送信設定
                    </h2>

                    {/* Sub Tab Switcher */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6 border border-gray-200/50">
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('update')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                          activeSubTab === 'update'
                            ? 'bg-white text-gray-800 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        変更通知メールの設定
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('cancel')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                          activeSubTab === 'cancel'
                            ? 'bg-white text-gray-800 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        キャンセル通知メールの設定
                      </button>
                    </div>

                    {activeSubTab === 'update' ? (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Toggles */}
                        <div className="space-y-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={!tableExists}
                              checked={settings.client_update_notify}
                              onChange={() => handleToggle('client_update_notify')}
                              className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700">会員へ「予約変更メール」を送信する</span>
                          </label>
                          <p className="pl-7 text-xs text-gray-400">※ 会員管理で「メール通知」を有効にしている会員様にのみ送信されます。</p>

                          <label className="flex items-center gap-3 cursor-pointer select-none pt-2 border-t border-gray-200/50">
                            <input
                              type="checkbox"
                              disabled={!tableExists}
                              checked={settings.trainer_update_notify}
                              onChange={() => handleToggle('trainer_update_notify')}
                              className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700">担当トレーナーへ「予約変更メール」を送信する</span>
                          </label>
                        </div>

                      </div>
                    ) : (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Toggles */}
                        <div className="space-y-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={!tableExists}
                              checked={settings.client_cancel_notify}
                              onChange={() => handleToggle('client_cancel_notify')}
                              className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700">会員へ「予約キャンセルメール」を送信する</span>
                          </label>
                          <p className="pl-7 text-xs text-gray-400">※ 会員管理で「メール通知」を有効にしている会員様にのみ送信されます。</p>

                          <label className="flex items-center gap-3 cursor-pointer select-none pt-2 border-t border-gray-200/50">
                            <input
                              type="checkbox"
                              disabled={!tableExists}
                              checked={settings.trainer_cancel_notify}
                              onChange={() => handleToggle('trainer_cancel_notify')}
                              className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700">担当トレーナーへ「キャンセル通知メール」を送信する</span>
                          </label>
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Reminder Email Settings */}
              {activeTab === 'reminder' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">3</div>
                      前日リマインダー＆オンラインレッスン設定
                    </h2>

                    <div className="space-y-6">
                      {/* Personal Session Reminder Section */}
                      <div className="space-y-4 border-b border-gray-100 pb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          パーソナルセッション前日リマインダー
                        </h3>

                        {/* Toggle */}
                        <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={!tableExists}
                              checked={settings.personal_reminder_enabled}
                              onChange={() => handleToggle('personal_reminder_enabled')}
                              className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700">自動前日リマインダーメールを有効にする</span>
                          </label>
                          <p className="pl-7 text-xs text-gray-400">※ 会員管理で「メール通知」を有効にしている会員様にのみ送信されます。</p>
                        </div>

                        {settings.personal_reminder_enabled && (
                          <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">送信日設定</label>
                              <select
                                disabled={!tableExists}
                                value={settings.personal_reminder_days_before}
                                onChange={(e) => handleInputChange('personal_reminder_days_before', Number(e.target.value))}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                              >
                                <option value={1}>予約日の前日 (1日前)</option>
                                <option value={2}>予約日の2日前</option>
                                <option value={0}>予約日の当日</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">送信時刻</label>
                              <select
                                disabled={!tableExists}
                                value={settings.personal_reminder_hour}
                                onChange={(e) => handleInputChange('personal_reminder_hour', Number(e.target.value))}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                              >
                                {Array.from({ length: 24 }).map((_, i) => (
                                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}


                      </div>

                      {/* Online Lesson Section */}
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
                            オンラインレッスン開始時刻の何分前に、参加リンク記載のリマインダーメールを自動送信するか設定します。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced settings toggle (BCC & Display Name) */}
              {activeTab !== 'members' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    送信者名・管理者BCC通知などの詳細設定
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${advancedOpen ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {advancedOpen && (
                  <div className="p-6 border-t border-gray-100 bg-gray-50/30 space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        送信者表示名 (Sender Display Name)
                      </label>
                      <input
                        type="text"
                        disabled={!tableExists}
                        value={settings.sender_display_name}
                        onChange={(e) => handleInputChange('sender_display_name', e.target.value)}
                        placeholder="例: T&J GYM"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <p className="mt-1 text-xs text-gray-400">受信者のメール一覧に差出人として表示されるお名前です。</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        管理者BCC追加アドレス (BCC Recipient)
                      </label>
                      <input
                        type="text"
                        disabled={!tableExists}
                        value={settings.additional_recipient_emails}
                        onChange={(e) => handleInputChange('additional_recipient_emails', e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-400">会員にメールが飛ぶ際、同じメールのコピー(BCC)を受信するアドレスです。複数指定はカンマ(<code>,</code>)区切り。</p>
                    </div>
                  </div>
                )}
              </div>
              )}

            </div>

            {/* Right Column: Live Preview & Testing (5 cols) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
              {activeTab === 'members' ? (
                <>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <h2 className="text-base font-semibold text-gray-900">現在の設定状況</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                        <div className="text-[10px] text-blue-500 uppercase tracking-widest">メールON</div>
                        <div className="mt-1 text-3xl text-blue-700">{members.filter(member => member.emailEnabled).length}</div>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                        <div className="text-[10px] text-emerald-500 uppercase tracking-widest">アプリ通知ON</div>
                        <div className="mt-1 text-3xl text-emerald-700">{members.filter(member => member.pushEnabled).length}</div>
                      </div>
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                        <div className="text-[10px] text-gray-400 uppercase tracking-widest">会員数</div>
                        <div className="mt-1 text-3xl text-gray-700">{members.length}</div>
                      </div>
                      <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4">
                        <div className="text-[10px] text-violet-500 uppercase tracking-widest">端末登録あり</div>
                        <div className="mt-1 text-3xl text-violet-700">{members.filter(member => member.pushSubscriptionCount > 0).length}</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      アプリ通知は、管理チェックがONで、かつ会員様がスマホ側で通知を許可している場合に送信されます。
                    </p>
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
                        '会員通知設定を保存'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
              
              {/* simulated email frame */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden flex flex-col">
                {/* Header panel */}
                <div className="bg-gray-100/80 px-4 py-3.5 border-b border-gray-200 text-xs text-gray-500 space-y-1 select-none">
                  <div className="flex justify-between items-center mb-1">
                    <div><strong>差出人:</strong> {settings.sender_display_name || 'T&J GYM'}</div>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold tracking-wider">LIVE PREVIEW</span>
                  </div>
                  <div><strong>宛先:</strong> {testTo || 'client@example.com'}</div>
                  <div className="pt-1 text-gray-800 text-sm font-semibold flex gap-1.5 items-start">
                    <span className="text-gray-400 font-normal shrink-0">件名:</span>
                    <span>{getPreviewSubject()}</span>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-5 bg-white text-left font-sans text-sm leading-relaxed text-gray-800 overflow-y-auto max-h-[380px] border-b border-gray-100 shadow-inner">
                  {/* Test Warning Banner */}
                  <div className="bg-amber-50 text-amber-800 p-2.5 text-[11px] rounded-lg border border-amber-200 mb-4 font-sans leading-normal select-none">
                    <strong>【テスト配信】</strong> 本来の送信先: {testTo || 'client@example.com'}
                  </div>

                  {/* Mail Body Render */}
                  <div>
                    <p className="text-gray-900 font-medium mb-3">テスト会員様</p>
                    <p className="whitespace-pre-wrap text-gray-800 leading-relaxed mb-4">
                      {getPreviewBody()}
                    </p>

                    {/* Table Details */}
                    <table className="w-full border-collapse my-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <tbody>
                        <tr>
                          <td className="p-3 border-b border-slate-200 font-semibold text-slate-500 w-24">店舗</td>
                          <td className="p-3 border-b border-slate-200 text-slate-800 font-medium">T&J GYM 1号店</td>
                        </tr>
                        <tr>
                          <td className="p-3 border-b border-slate-200 font-semibold text-slate-500">トレーナー</td>
                          <td className="p-3 border-b border-slate-200 text-slate-800 font-medium">三井 達雄</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-500">日時</td>
                          <td className="p-3 text-slate-800 font-bold">2026年6月8日(月) 09:00</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Footers */}
                    {activeTab === 'reminder' ? (
                      <p className="text-[11px] text-gray-400 mt-6 pt-3 border-t border-gray-100 leading-normal">
                        ※ 変更やキャンセルの場合は公式LINEまでご連絡お願いします。<br />
                        ※ このメールはT&J GYMシステムから自動送信されています。
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-6 pt-3 border-t border-gray-100 leading-normal">
                        ※ このメールはT&J GYM予約システムから自動送信されています。
                      </p>
                    )}
                  </div>
                </div>


              </div>

              {/* Submit Buttons */}
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
                      設定を保存中...
                    </>
                  ) : (
                    '通知設定を保存'
                  )}
                </button>
              </div>
                </>
              )}

            </div>

          </div>
        </form>
      </div>
    </div>
  )
}
