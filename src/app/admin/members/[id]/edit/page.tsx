'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PLAN_LIST } from '@/lib/constants'

type Choice = { label: string; value: string }
type CounselingData = Record<string, string | string[]>

const tabs = [
  '基本情報',
  '目的・悩み・目標',
  '生活・食事・運動',
  '過去経験・ダイエット詳細',
  '健康確認・提案メモ',
  '入会情報',
]

const choices: Record<string, Choice[]> = {
  gender: [
    { label: '男性', value: 'male' },
    { label: '女性', value: 'female' },
    { label: 'その他', value: 'other' },
    { label: '回答しない', value: 'no_answer' },
  ],
  route: ['Google検索', 'Googleマップ', 'Instagram', '紹介', 'チラシ', '通りがかり', 'ホームページ', 'その他'].map(v => ({ label: v, value: v })),
  purposes: ['ダイエット', '体を引き締めたい', '筋力アップ', '体力をつけたい', '姿勢改善', '肩こり・腰痛改善', '健康診断の数値改善', '運動習慣をつけたい', '産後の体型戻し', 'その他'].map(v => ({ label: v, value: v })),
  mainPurpose: ['ダイエット', '引き締め', '筋力アップ', '体力向上', '姿勢改善', '痛み・不調改善', '健康改善', '運動習慣', 'その他'].map(v => ({ label: v, value: v })),
  bodyParts: ['お腹', '二の腕', '背中', 'お尻', '太もも', 'ふくらはぎ', '顔まわり', '全体的に', '特になし'].map(v => ({ label: v, value: v })),
  dailyActivity: [
    { label: 'ほとんど座っている', value: '1.2' },
    { label: '座り仕事が多いが、多少歩く', value: '1.375' },
    { label: '立ち仕事・歩くことが多い', value: '1.55' },
    { label: '体をよく動かす仕事をしている', value: '1.725' },
  ],
  exerciseHabit: ['ほとんど運動していない', '月に数回程度', '週1回程度', '週2〜3回', '週4回以上'].map(v => ({ label: v, value: v })),
  eatingPatterns: ['朝食を抜くことが多い', '昼食が不規則', '夕食が遅い', '間食が多い', '甘いものが多い', '外食が多い', 'コンビニ・惣菜が多い', 'お酒が多い', '炭水化物を抜きがち', '食事量にムラがある', '早食い', '夜に食べすぎる', '特に問題は感じていない'].map(v => ({ label: v, value: v })),
  sleep: ['5時間未満', '5〜6時間', '6〜7時間', '7時間以上'].map(v => ({ label: v, value: v })),
  water: ['500ml未満', '500ml〜1L', '1〜1.5L', '1.5L以上'].map(v => ({ label: v, value: v })),
  alcohol: ['飲まない', '月に数回', '週1〜2回', '週3〜4回', 'ほぼ毎日'].map(v => ({ label: v, value: v })),
  smoking: ['なし', 'あり', '過去に吸っていた'].map(v => ({ label: v, value: v })),
  stress: ['少ない', '普通', '多い', 'かなり多い'].map(v => ({ label: v, value: v })),
  exerciseExperience: ['学生時代の部活', 'スポーツ経験あり', 'ジム経験あり', 'パーソナルジム経験あり', '自宅トレーニング', 'ランニング・ウォーキング', 'ほとんどなし', 'その他'].map(v => ({ label: v, value: v })),
  dietExperience: ['糖質制限', 'カロリー制限', 'ファスティング', '置き換え', 'ランニング', 'ジム通い', 'パーソナルジム', '食事記録', '自己流', '特になし'].map(v => ({ label: v, value: v })),
  failedReasons: ['食事制限がきつかった', '運動がきつかった', '時間がなかった', '効果を感じなかった', '一人だと続かなかった', '仕事が忙しかった', '体調を崩した', 'リバウンドした', 'モチベーションが続かなかった', 'その他'].map(v => ({ label: v, value: v })),
  dietMotivation: ['まずは無理なく始めたい', 'できる範囲で頑張りたい', 'しっかり変えたい', '短期間で結果を出したい'].map(v => ({ label: v, value: v })),
  weightGainTriggers: ['運動量が減った', '食事量が増えた', '外食が増えた', '仕事が忙しくなった', 'ストレス', '睡眠不足', '出産', '年齢とともに', '在宅勤務', 'お酒が増えた', '特に思い当たらない'].map(v => ({ label: v, value: v })),
  overeatingTiming: ['朝', '昼', '夜', '仕事後', '休日', 'ストレス時', '疲れている時', '飲酒時', '生理前', '特になし'].map(v => ({ label: v, value: v })),
  hardToReduce: ['ご飯・パン・麺', '甘いもの', 'お菓子', 'お酒', '揚げ物', '外食', '夜食', 'ジュース・カフェラテ', '特になし'].map(v => ({ label: v, value: v })),
  foodSupport: ['しっかり管理してほしい', '無理のない範囲でアドバイスがほしい', '厳しい制限は不安', '食事制限はできるだけしたくない', 'まずは簡単なことから始めたい'].map(v => ({ label: v, value: v })),
  weighIn: ['毎日できる', '週に数回ならできる', 'あまり測りたくない', '相談して決めたい'].map(v => ({ label: v, value: v })),
  symptoms: ['首こり', '肩こり', '腰痛', '膝痛', '股関節痛', '足首痛', '頭痛', '疲れやすい', 'むくみ', '冷え', '睡眠の悩み', 'しびれ', 'めまい', '動悸', '特になし'].map(v => ({ label: v, value: v })),
  cautions: ['医療機関に通院中', '常用薬あり', '医師から運動制限あり', '大きな怪我・手術歴あり', '妊娠中・産後', '高血圧', '糖尿病', '脂質異常症', '腰椎・頸椎の問題', '膝・股関節の問題', 'その他', '特になし'].map(v => ({ label: v, value: v })),
  checkupFlags: ['血圧', '血糖値', 'HbA1c', '中性脂肪', 'LDLコレステロール', 'HDLコレステロール', '肝機能', '腎機能', '尿酸値', '貧血', '特になし', 'わからない'].map(v => ({ label: v, value: v })),
  improvementPriorities: ['運動習慣', '食事リズム', 'たんぱく質不足', '間食', '飲酒', '睡眠', '活動量', '姿勢・痛み', '筋力不足', 'ストレス', 'その他'].map(v => ({ label: v, value: v })),
  suggestedPlan: ['週1回プラン', '週2回プラン', 'ダイエットコース', 'メンテナンスコース', 'まず体験のみ', '要検討', 'その他'].map(v => ({ label: v, value: v })),
  contractChance: ['高い', '普通', '低い', '保留', '失注'].map(v => ({ label: v, value: v })),
  nextActions: ['入会手続き', '体験トレーニング', 'プラン説明', '料金案内', '後日連絡', '医師確認後', 'その他'].map(v => ({ label: v, value: v })),
}

const emptyCounseling: CounselingData = {
  furigana: '',
  weightKg: '',
  job: '',
  route: '',
  basicMemo: '',
  purposes: [],
  mainPurpose: '',
  changeGoal: '',
  currentConcern: '',
  goalDeadline: '',
  expectation: '',
  bodyParts: [],
  goalMemo: '',
  dailyActivity: '',
  exerciseHabit: '',
  eatingPatterns: [],
  sleep: '',
  water: '',
  alcohol: '',
  smoking: '',
  stress: '',
  lifestyleMemo: '',
  exerciseExperience: [],
  dietExperience: [],
  failedReasons: [],
  dislikedMethods: '',
  dietMotivation: '',
  targetLossKg: '',
  targetDeadline: '',
  weightGainTriggers: [],
  overeatingTiming: [],
  hardToReduce: [],
  foodSupport: '',
  weighIn: '',
  dietDetailMemo: '',
  symptoms: [],
  cautions: [],
  checkupFlags: [],
  medicalMemo: '',
  trainerFinding: '',
  improvementPriorities: [],
  suggestedPlan: '',
  contractChance: '',
  nextActions: [],
  nextActionMemo: '',
}

export default function EditMemberPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string

  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const didLoadInitialData = useRef(false)
  const pageTopRef = useRef<HTMLDivElement>(null)
  const [stores, setStores] = useState<{ id: string, name: string }[]>([])
  const [initialStatus, setInitialStatus] = useState('')
  const [initialPlan, setInitialPlan] = useState('')
  const [initialMonthlyFee, setInitialMonthlyFee] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    storeId: '',
    plan: '月4回',
    monthlyFee: '',
    startMonth: '',
    registrationDate: '',
    status: 'active',
    memo: '',
    changeDate: new Date().toISOString().split('T')[0],
    onlineReminderEnabled: false,
    pushNotificationEnabled: false,
    birthDate: '',
    gender: '',
    heightCm: '',
    activityLevel: '',
  })

  const [settings, setSettings] = useState({
    visible_items: { steps: false, sleep: false, water: false, alcohol: false, workout: false },
    visible_tabs: { input: false, analyze: false, progress: false },
    quit_goals: [] as unknown[],
    habit_targets: {} as Record<string, unknown>,
  })
  const [counseling, setCounseling] = useState<CounselingData>(emptyCounseling)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const [memberRes, settingsRes] = await Promise.all([
          fetch(`/api/admin/members/${memberId}`),
          fetch(`/api/lifestyle/settings?userId=${memberId}`),
        ])

        if (memberRes.ok) {
          const result = await memberRes.json()
          const member = result.data || result
          setInitialStatus(member.status || 'active')
          setInitialPlan(member.plan || '月4回')
          setInitialMonthlyFee(member.monthly_fee ? member.monthly_fee.toString() : '')

          const startMonth = member.billing_start_month ? member.billing_start_month.substring(0, 7) : ''
          setFormData({
            fullName: member.full_name || '',
            email: member.email || '',
            storeId: member.store_id || '',
            plan: member.plan || '月4回',
            monthlyFee: member.monthly_fee ? member.monthly_fee.toString() : '',
            startMonth,
            registrationDate: member.created_at ? member.created_at.split('T')[0] : '',
            status: member.status || 'active',
            memo: member.memo || '',
            changeDate: new Date().toISOString().split('T')[0],
            onlineReminderEnabled: member.online_reminder_enabled || false,
            pushNotificationEnabled: member.push_notification_enabled || false,
            birthDate: member.birth_date || '',
            gender: member.gender || '',
            heightCm: member.height_cm ? member.height_cm.toString() : '',
            activityLevel: member.activity_level ? member.activity_level.toString() : '',
          })
        }

        if (settingsRes.ok) {
          const { data } = await settingsRes.json()
          if (data) {
            const nextSettings = {
              visible_items: data.visible_items || { steps: true, sleep: true, water: true, alcohol: true, workout: true },
              visible_tabs: data.visible_tabs || { input: true, analyze: true, progress: true },
              quit_goals: data.quit_goals || [],
              habit_targets: data.habit_targets || {},
            }
            setSettings(nextSettings)
            const storedCounseling = (nextSettings.habit_targets?.counseling_profile || {}) as CounselingData
            setCounseling({ ...emptyCounseling, ...storedCounseling })
          }
        }
      } catch (error) {
        console.error('Failed to fetch:', error)
        setError('情報の取得中にエラーが発生しました')
      } finally {
        setFetchLoading(false)
      }
    }

    fetchMember()
  }, [memberId])

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/admin/stores')
        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          setStores(data.stores || [])
        }
      } catch (error) {
        console.error('Failed to fetch stores:', error)
      }
    }
    fetchStores()
  }, [])

  const isPlanChanged = formData.plan !== initialPlan
  const isFeeChanged = formData.monthlyFee !== initialMonthlyFee
  const isStatusChanged = formData.status !== initialStatus
  const isChanged = isPlanChanged || isFeeChanged || isStatusChanged
  const isDietSelected = Array.isArray(counseling.purposes) && counseling.purposes.includes('ダイエット')

  const summaryText = useMemo(() => {
    const name = formData.fullName || 'お客様'
    const mainPurpose = counseling.mainPurpose || '目的未設定'
    const lifestyle = listText(counseling.eatingPatterns) || '生活課題は未入力'
    const failed = listText(counseling.failedReasons) || '過去の挫折理由は未入力'
    const cautions = listText(counseling.cautions) || '健康上の注意点は未入力'
    const priority = listText(counseling.improvementPriorities) || '優先改善ポイントは未入力'
    const plan = counseling.suggestedPlan || '提案プラン未設定'
    return `${name}様は、${mainPurpose}を主目的として来店。現在は${lifestyle}が課題。過去の継続課題は${failed}。健康面では${cautions}に注意。まずは${plan}を軸に、${priority}から改善する方針。`
  }, [formData.fullName, counseling])

  const saveMemberData = async (isRetry = false) => {
    setLoading(true)
    setSaveStatus('saving')
    setError('')

    try {
      const [memberRes, settingsRes] = await Promise.all([
        fetch('/api/admin/members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId,
            fullName: formData.fullName,
            email: formData.email,
            storeId: formData.storeId,
            plan: formData.plan,
            monthlyFee: formData.monthlyFee,
            startMonth: formData.startMonth,
            registrationDate: formData.registrationDate,
            status: formData.status,
            memo: formData.memo,
            changeDate: formData.changeDate,
            onlineReminderEnabled: formData.onlineReminderEnabled,
            pushNotificationEnabled: formData.pushNotificationEnabled,
            birthDate: formData.birthDate,
            gender: formData.gender,
            heightCm: formData.heightCm,
            activityLevel: formData.activityLevel,
          }),
        }),
        fetch('/api/lifestyle/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: memberId,
            visibleItems: settings.visible_items,
            visibleTabs: settings.visible_tabs,
            quit_goals: settings.quit_goals,
            habit_targets: {
              ...settings.habit_targets,
              counseling_profile: counseling,
            },
          }),
        }),
      ])

      const result = await memberRes.json()
      if (memberRes.ok && settingsRes.ok) {
        setSaved(true)
        setSaveStatus('saved')
      } else {
        if (!isRetry) {
          window.setTimeout(() => saveMemberData(true), 1500)
        } else {
          setSaveStatus('idle')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      if (!isRetry) {
        window.setTimeout(() => saveMemberData(true), 1500)
      } else {
        setSaveStatus('idle')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (fetchLoading) return
    if (!didLoadInitialData.current) {
      didLoadInitialData.current = true
      return
    }

    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      saveMemberData()
    }, 900)

    return () => window.clearTimeout(timer)
  }, [formData, settings, counseling, fetchLoading])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData(prev => {
      const newData = { ...prev, [name]: val }
      if (name === 'status' && (value === 'suspended' || value === 'withdrawn')) {
        newData.monthlyFee = '0'
        newData.onlineReminderEnabled = false
        newData.pushNotificationEnabled = false
      }
      return newData
    })
  }

  const updateCounseling = (name: string, value: string | string[]) => {
    setCounseling(prev => ({ ...prev, [name]: value }))
  }

  const toggleCounseling = (name: string, value: string) => {
    setCounseling(prev => {
      const current = Array.isArray(prev[name]) ? prev[name] as string[] : []
      const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
      return { ...prev, [name]: next }
    })
  }

  const selectTab = (next: number) => {
    setActiveTab(Math.min(Math.max(next, 0), tabs.length - 1))
    window.requestAnimationFrame(() => {
      pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const changeTab = (next: number) => {
    selectTab(next)
  }

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">会員情報を読み込み中...</div>
      </div>
    )
  }

  return (
    <div ref={pageTopRef} className="max-w-5xl mx-auto py-6 px-4">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal text-text-primary">会員情報編集</h1>
          <p className="mt-1 text-sm text-text-secondary">カウンセリング内容と入会情報を管理します</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/members')}
          className="px-4 py-2 border border-border-strong rounded-lg text-sm text-text-secondary hover:bg-surface-base"
        >
          一覧へ戻る
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="bg-surface-raised shadow-sm border border-border-strong rounded-lg">
        <div className="border-b border-border-strong p-4">
          <div className="grid grid-cols-6 gap-2">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                onClick={() => selectTab(index)}
                aria-label={tab}
                title={tab}
                className={`h-11 rounded-lg border text-sm font-normal transition-colors ${
                  activeTab === index
                    ? 'border-brand-600 text-white bg-brand-600 shadow-sm'
                    : 'border-border-strong text-text-secondary bg-surface-raised hover:text-text-primary hover:bg-surface-base'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 text-center text-sm text-text-secondary">
            {activeTab + 1}. {tabs[activeTab]}
          </div>
        </div>

        <div className="p-5 md:p-6">
          {activeTab === 0 && (
            <Section title="基本情報" description="初回カウンセリングで最初に確認する内容です。">
              <TextField label="氏名" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="山田 太郎" />
              <TextField label="フリガナ" name="furigana" value={valueOf(counseling.furigana)} onValue={updateCounseling} placeholder="ヤマダ タロウ" />
              <TextField label="生年月日" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
              <ChoiceGroup label="性別" name="gender" value={formData.gender} options={choices.gender} onValue={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="身長" type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} required unit="cm" placeholder="160" />
                <TextField label="体重" type="number" name="weightKg" value={valueOf(counseling.weightKg)} onValue={updateCounseling} required unit="kg" placeholder="55" />
              </div>
              <TextField label="職業" name="job" value={valueOf(counseling.job)} onValue={updateCounseling} placeholder="会社員" />
              <ChoiceGroup label="来店経路" name="route" value={valueOf(counseling.route)} options={choices.route} onValue={updateCounseling} />
              <TextArea label="基本情報メモ" name="basicMemo" value={valueOf(counseling.basicMemo)} onValue={updateCounseling} placeholder="例：デスクワーク中心、勤務時間が不規則など" />
            </Section>
          )}

          {activeTab === 1 && (
            <Section title="目的・悩み・目標" description="目的がダイエットの場合は、4タブ目に詳細項目が表示されます。">
              <CheckGroup label="パーソナルジムに通う目的" name="purposes" values={arrayOf(counseling.purposes)} options={choices.purposes} onToggle={toggleCounseling} required />
              <ChoiceGroup label="一番の目的" name="mainPurpose" value={valueOf(counseling.mainPurpose)} options={choices.mainPurpose} onValue={updateCounseling} required />
              <TextArea label="今回、一番変えたいこと" name="changeGoal" value={valueOf(counseling.changeGoal)} onValue={updateCounseling} required placeholder="例：体重を落として、昔履いていたパンツを履けるようになりたい" />
              <TextArea label="現在、一番悩んでいること" name="currentConcern" value={valueOf(counseling.currentConcern)} onValue={updateCounseling} placeholder="例：お腹周りが気になる、疲れやすい、運動が続かない" />
              <TextArea label="いつまでにどうなりたいか" name="goalDeadline" value={valueOf(counseling.goalDeadline)} onValue={updateCounseling} placeholder="例：3ヶ月後までに-5kg、健康診断までに体重を落としたい" />
              <TextArea label="期待していること" name="expectation" value={valueOf(counseling.expectation)} onValue={updateCounseling} placeholder="例：食事も含めて自分に合った方法を知りたい" />
              <CheckGroup label="特に引き締めたい部位" name="bodyParts" values={arrayOf(counseling.bodyParts)} options={choices.bodyParts} onToggle={toggleCounseling} />
              <TextArea label="目的・目標メモ" name="goalMemo" value={valueOf(counseling.goalMemo)} onValue={updateCounseling} placeholder="会話で出た本音や背景を記録" />
            </Section>
          )}

          {activeTab === 2 && (
            <Section title="生活・食事・運動" description="会話しながら選択できるように、選択式を中心にしています。">
              <ChoiceGroup label="日頃の活動量" name="dailyActivity" value={valueOf(counseling.dailyActivity || formData.activityLevel)} options={choices.dailyActivity} onValue={(name, value) => {
                updateCounseling(name, value)
                setFormData(prev => ({ ...prev, activityLevel: value }))
              }} required />
              <ChoiceGroup label="日頃の運動習慣" name="exerciseHabit" value={valueOf(counseling.exerciseHabit)} options={choices.exerciseHabit} onValue={updateCounseling} required />
              <CheckGroup label="食生活の傾向" name="eatingPatterns" values={arrayOf(counseling.eatingPatterns)} options={choices.eatingPatterns} onToggle={toggleCounseling} required />
              <ChoiceGroup label="睡眠時間" name="sleep" value={valueOf(counseling.sleep)} options={choices.sleep} onValue={updateCounseling} />
              <ChoiceGroup label="水分摂取量" name="water" value={valueOf(counseling.water)} options={choices.water} onValue={updateCounseling} />
              <ChoiceGroup label="飲酒" name="alcohol" value={valueOf(counseling.alcohol)} options={choices.alcohol} onValue={updateCounseling} />
              <ChoiceGroup label="喫煙" name="smoking" value={valueOf(counseling.smoking)} options={choices.smoking} onValue={updateCounseling} />
              <ChoiceGroup label="日々のストレス" name="stress" value={valueOf(counseling.stress)} options={choices.stress} onValue={updateCounseling} />
              <TextArea label="生活・食事・運動メモ" name="lifestyleMemo" value={valueOf(counseling.lifestyleMemo)} onValue={updateCounseling} placeholder="例：平日は帰宅が遅く、夕食が22時以降になりやすい。" />
            </Section>
          )}

          {activeTab === 3 && (
            <Section title="過去経験・ダイエット詳細" description="ダイエット詳細は、目的でダイエットを選んだ場合だけ表示します。">
              <CheckGroup label="過去の運動経験" name="exerciseExperience" values={arrayOf(counseling.exerciseExperience)} options={choices.exerciseExperience} onToggle={toggleCounseling} />
              <CheckGroup label="過去のダイエット経験" name="dietExperience" values={arrayOf(counseling.dietExperience)} options={choices.dietExperience} onToggle={toggleCounseling} />
              <CheckGroup label="続かなかった理由" name="failedReasons" values={arrayOf(counseling.failedReasons)} options={choices.failedReasons} onToggle={toggleCounseling} />
              <TextArea label="合わなかった方法・もうやりたくない方法" name="dislikedMethods" value={valueOf(counseling.dislikedMethods)} onValue={updateCounseling} placeholder="例：糖質制限は一時的に痩せたが、続かずリバウンドした" />

              {isDietSelected ? (
                <div className="mt-6 pt-6 border-t border-border-subtle space-y-5">
                  <h3 className="text-base font-normal text-text-primary">ダイエット詳細</h3>
                  <ChoiceGroup label="ダイエット意欲" name="dietMotivation" value={valueOf(counseling.dietMotivation)} options={choices.dietMotivation} onValue={updateCounseling} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField label="目標減量" type="number" name="targetLossKg" value={valueOf(counseling.targetLossKg)} onValue={updateCounseling} unit="kg" placeholder="5" />
                    <TextField label="目標期限" name="targetDeadline" value={valueOf(counseling.targetDeadline)} onValue={updateCounseling} placeholder="3ヶ月後、健康診断まで" />
                  </div>
                  <CheckGroup label="体重が増えたきっかけ" name="weightGainTriggers" values={arrayOf(counseling.weightGainTriggers)} options={choices.weightGainTriggers} onToggle={toggleCounseling} />
                  <CheckGroup label="食べすぎやすいタイミング" name="overeatingTiming" values={arrayOf(counseling.overeatingTiming)} options={choices.overeatingTiming} onToggle={toggleCounseling} />
                  <CheckGroup label="減らすのが難しそうなもの" name="hardToReduce" values={arrayOf(counseling.hardToReduce)} options={choices.hardToReduce} onToggle={toggleCounseling} />
                  <ChoiceGroup label="食事管理の希望" name="foodSupport" value={valueOf(counseling.foodSupport)} options={choices.foodSupport} onValue={updateCounseling} />
                  <ChoiceGroup label="体重測定" name="weighIn" value={valueOf(counseling.weighIn)} options={choices.weighIn} onValue={updateCounseling} />
                  <TextArea label="ダイエット詳細メモ" name="dietDetailMemo" value={valueOf(counseling.dietDetailMemo)} onValue={updateCounseling} placeholder="例：お酒と夜の食事が課題。厳しい糖質制限は過去に続かなかった。" />
                </div>
              ) : (
                <div className="mt-6 rounded-lg bg-surface-base border border-border-strong p-4 text-sm text-text-secondary">
                  タブ2で「ダイエット」を選択すると、目標減量や食事管理希望などの詳細項目が表示されます。
                </div>
              )}
            </Section>
          )}

          {activeTab === 4 && (
            <Section title="健康確認・提案メモ" description="最後に提案内容と次回アクションまで残します。">
              <CheckGroup label="気になる不調" name="symptoms" values={arrayOf(counseling.symptoms)} options={choices.symptoms} onToggle={toggleCounseling} />
              <CheckGroup label="注意が必要な項目" name="cautions" values={arrayOf(counseling.cautions)} options={choices.cautions} onToggle={toggleCounseling} />
              <CheckGroup label="健康診断で指摘された項目" name="checkupFlags" values={arrayOf(counseling.checkupFlags)} options={choices.checkupFlags} onToggle={toggleCounseling} />
              <TextArea label="医療・服薬・怪我メモ" name="medicalMemo" value={valueOf(counseling.medicalMemo)} onValue={updateCounseling} placeholder="例：右膝に違和感あり。階段の下りで痛みが出ることがある。" />
              <TextArea label="トレーナー所見" name="trainerFinding" value={valueOf(counseling.trainerFinding)} onValue={updateCounseling} required placeholder="例：運動習慣がなく、夕食が遅い。まずは週1〜2回の筋トレと食事リズムの改善から開始。" />
              <CheckGroup label="優先改善ポイント" name="improvementPriorities" values={arrayOf(counseling.improvementPriorities)} options={choices.improvementPriorities} onToggle={toggleCounseling} />
              <ChoiceGroup label="提案プラン" name="suggestedPlan" value={valueOf(counseling.suggestedPlan)} options={choices.suggestedPlan} onValue={updateCounseling} />
              <ChoiceGroup label="成約見込み" name="contractChance" value={valueOf(counseling.contractChance)} options={choices.contractChance} onValue={updateCounseling} />
              <CheckGroup label="次回アクション" name="nextActions" values={arrayOf(counseling.nextActions)} options={choices.nextActions} onToggle={toggleCounseling} />
              <TextArea label="次回アクションメモ" name="nextActionMemo" value={valueOf(counseling.nextActionMemo)} onValue={updateCounseling} placeholder="例：料金案内後、家族に相談してLINEで連絡予定" />
              {saved && <SummaryBox summaryText={summaryText} formData={formData} counseling={counseling} />}
            </Section>
          )}

          {activeTab === 5 && (
            <Section title="入会情報" description="メールアドレス、プラン、店舗、通知設定など既存の管理項目です。">
              <TextField label="メールアドレス" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="example@email.com" />
              <SelectField label="店舗" name="storeId" value={formData.storeId} onChange={handleChange} required>
                <option value="">店舗を選択してください</option>
                {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
              </SelectField>
              <SelectField label="入会時プラン" name="plan" value={formData.plan} onChange={handleChange}>
                {PLAN_LIST.map(plan => <option key={plan} value={plan}>{plan}</option>)}
              </SelectField>
              <TextField label="入会時月会費" type="number" name="monthlyFee" value={formData.monthlyFee} onChange={handleChange} unit="円" placeholder="13200" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="開始月" type="month" name="startMonth" value={formData.startMonth} onChange={handleChange} />
                <TextField label="登録日" type="date" name="registrationDate" value={formData.registrationDate} onChange={handleChange} />
              </div>
              <SelectField label="ステータス" name="status" value={formData.status} onChange={handleChange}>
                <option value="active">有効</option>
                <option value="suspended">休会</option>
                <option value="withdrawn">退会</option>
              </SelectField>

              {isChanged && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <TextField label="変更適用日" type="date" name="changeDate" value={formData.changeDate} onChange={handleChange} />
                  <p className="mt-2 text-sm text-yellow-700">指定した日付から新しいプラン・会費が適用されます。</p>
                </div>
              )}

              <div className="pt-4 border-t border-border-subtle">
                <h3 className="text-lg font-normal text-text-primary mb-4">機能表示設定</h3>
                <label className="flex items-center gap-4 p-4 bg-brand-50/50 border border-brand-100 rounded-lg cursor-pointer hover:bg-brand-50">
                  <input
                    type="checkbox"
                    checked={settings.visible_tabs.input && settings.visible_tabs.analyze && settings.visible_tabs.progress}
                    onChange={(e) => {
                      const isChecked = e.target.checked
                      setSettings(prev => ({
                        ...prev,
                        visible_tabs: { input: isChecked, analyze: isChecked, progress: isChecked },
                        visible_items: { steps: isChecked, sleep: isChecked, water: isChecked, alcohol: isChecked, workout: isChecked },
                      }))
                    }}
                    className="w-6 h-6 text-brand-600 border-border-strong rounded focus:ring-brand-500"
                  />
                  <div>
                    <div className="font-normal text-text-primary">食事管理機能を表示する</div>
                    <div className="text-xs text-text-secondary mt-1">ダイエット会員向けの入力・分析・進捗タブを有効にします。</div>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-border-subtle">
                <h3 className="text-lg font-normal text-text-primary mb-4">通知設定</h3>
                <div className="space-y-4">
                  <SwitchCard name="onlineReminderEnabled" checked={formData.onlineReminderEnabled} onChange={handleChange} title="メール通知を送信する" description="予約確定・変更・リマインダーの自動通知メールを送信します。" />
                  <SwitchCard name="pushNotificationEnabled" checked={formData.pushNotificationEnabled} onChange={handleChange} title="プッシュ通知を送信する" description="お客様がアプリ通知を許可している場合にスマホへ通知します。" color="emerald" />
                </div>
              </div>

              <TextArea label="管理メモ" name="memo" value={formData.memo} onChange={handleChange} placeholder="入会・支払い・連絡事項など" />
            </Section>
          )}
        </div>

        <div className="px-5 md:px-6 py-4 border-t border-border-strong flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => changeTab(activeTab - 1)}
              disabled={activeTab === 0}
              className="px-5 py-2 border border-border-strong rounded-lg text-text-secondary hover:bg-surface-base disabled:opacity-40"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={() => changeTab(activeTab + 1)}
              disabled={activeTab === tabs.length - 1}
              className="px-5 py-2 border border-border-strong rounded-lg text-text-secondary hover:bg-surface-base disabled:opacity-40"
            >
              次のタブへ
            </button>
          </div>
          <div className="text-sm text-text-secondary">
            {saveStatus === 'saving' && '自動保存中...'}
            {saveStatus === 'saved' && '自動保存済み'}
            {saveStatus === 'error' && '自動保存に失敗しました'}
            {saveStatus === 'idle' && '入力内容は自動で保存されます'}
          </div>
        </div>
      </form>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-normal text-text-primary">{title}</h2>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ label, required, unit }: { label: string; required?: boolean; unit?: string }) {
  return (
    <span className="block text-sm font-normal text-text-secondary mb-2">
      {label}{unit ? `（${unit}）` : ''}{required && <span className="text-red-500"> *</span>}
    </span>
  )
}

function TextField({
  label,
  name,
  value,
  onChange,
  onValue,
  type = 'text',
  required,
  unit,
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValue?: (name: string, value: string) => void
  type?: string
  required?: boolean
  unit?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} unit={unit} />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange || ((e) => onValue?.(name, e.target.value))}
        required={required}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.1' : undefined}
        className="w-full px-3 py-3 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        placeholder={placeholder}
      />
    </label>
  )
}

function TextArea({
  label,
  name,
  value,
  onChange,
  onValue,
  required,
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onValue?: (name: string, value: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <textarea
        name={name}
        value={value}
        onChange={onChange || ((e) => onValue?.(name, e.target.value))}
        required={required}
        rows={4}
        className="w-full px-3 py-3 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        placeholder={placeholder}
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  value,
  onChange,
  required,
  children,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-3 border border-border-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      >
        {children}
      </select>
    </label>
  )
}

function ChoiceGroup({ label, name, value, options, onValue, required }: { label: string; name: string; value: string; options: Choice[]; onValue: (name: string, value: string) => void; required?: boolean }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(option => (
          <label key={option.value} className={`flex items-center gap-3 px-3 py-3 border rounded-lg cursor-pointer ${value === option.value ? 'border-brand-500 bg-brand-50' : 'border-border-strong hover:bg-surface-base'}`}>
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onValue(name, option.value)}
              className="w-5 h-5 text-brand-600 border-border-strong focus:ring-brand-500"
            />
            <span className="text-sm text-text-primary">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CheckGroup({ label, name, values, options, onToggle, required }: { label: string; name: string; values: string[]; options: Choice[]; onToggle: (name: string, value: string) => void; required?: boolean }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {options.map(option => (
          <label key={option.value} className={`flex items-center gap-3 px-3 py-3 border rounded-lg cursor-pointer ${values.includes(option.value) ? 'border-brand-500 bg-brand-50' : 'border-border-strong hover:bg-surface-base'}`}>
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => onToggle(name, option.value)}
              className="w-5 h-5 text-brand-600 border-border-strong rounded focus:ring-brand-500"
            />
            <span className="text-sm text-text-primary">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function SwitchCard({ name, checked, onChange, title, description, color = 'blue' }: { name: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; title: string; description: string; color?: 'blue' | 'emerald' }) {
  const colorClass = color === 'emerald' ? 'text-emerald-600 focus:ring-emerald-500 bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50' : 'text-brand-600 focus:ring-brand-500 bg-brand-50/50 border-brand-100 hover:bg-brand-50'
  return (
    <label className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer ${colorClass}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className={`w-6 h-6 border-border-strong rounded ${color === 'emerald' ? 'text-emerald-600 focus:ring-emerald-500' : 'text-brand-600 focus:ring-brand-500'}`}
      />
      <span>
        <span className="block font-normal text-text-primary">{title}</span>
        <span className="block text-xs text-text-secondary mt-1">{description}</span>
      </span>
    </label>
  )
}

function SummaryBox({ summaryText, formData, counseling }: { summaryText: string; formData: { fullName: string; gender: string; heightCm: string }; counseling: CounselingData }) {
  return (
    <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4">
      <h3 className="text-base font-normal text-brand-900 mb-3">保存後のカウンセリング要約</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-brand-900">
        <SummaryItem label="氏名" value={formData.fullName} />
        <SummaryItem label="性別" value={genderLabel(formData.gender)} />
        <SummaryItem label="身長" value={formData.heightCm ? `${formData.heightCm}cm` : ''} />
        <SummaryItem label="体重" value={valueOf(counseling.weightKg) ? `${valueOf(counseling.weightKg)}kg` : ''} />
        <SummaryItem label="主目的" value={valueOf(counseling.mainPurpose)} />
        <SummaryItem label="一番の悩み" value={valueOf(counseling.currentConcern)} />
        <SummaryItem label="目標" value={valueOf(counseling.changeGoal)} />
        <SummaryItem label="生活上の課題" value={listText(counseling.eatingPatterns)} />
        <SummaryItem label="過去の挫折理由" value={listText(counseling.failedReasons)} />
        <SummaryItem label="健康上の注意点" value={listText(counseling.cautions)} />
        <SummaryItem label="優先改善ポイント" value={listText(counseling.improvementPriorities)} />
        <SummaryItem label="提案プラン" value={valueOf(counseling.suggestedPlan)} />
      </div>
      <p className="mt-4 text-sm leading-6 text-brand-900">{summaryText}</p>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-raised/70 px-3 py-2">
      <span className="text-xs text-brand-700">{label}</span>
      <div className="text-sm text-text-primary">{value || '-'}</div>
    </div>
  )
}

function valueOf(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : ''
}

function arrayOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : []
}

function listText(value: string | string[] | undefined) {
  return arrayOf(value).join('、')
}

function genderLabel(value: string) {
  return choices.gender.find(option => option.value === value)?.label || ''
}
