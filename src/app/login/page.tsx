'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Check if user is already logged in
    getSession().then((session) => {
      if (session) {
        router.push('/dashboard')
      }
    })

    // Show success message if redirected from registration
    const messageParam = searchParams.get('message')
    if (messageParam === 'registration_success') {
      setMessage('会員登録が完了しました。ログインしてください。')
    }
  }, [router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      console.log('ログイン試行:', formData.email)
      
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      console.log('ログイン結果:', result)

      if (result?.error) {
        console.error('ログインエラー:', result.error)
        setError('メールアドレスまたはパスワードが正しくありません')
      } else if (result?.ok) {
        console.log('ログイン成功、ダッシュボードにリダイレクト')
        router.push('/dashboard')
      } else {
        setError('ログインに失敗しました。もう一度お試しください。')
      }
    } catch (error) {
      setError('ログインに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            T&J GYM
          </h2>
          <p className="mt-2 text-center text-lg text-gray-700">
            予約確認フォーム
          </p>
        </div>

        {message && (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}
        
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">テスト用アカウント</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <div>
              <p className="font-semibold">◆管理者アカウント</p>
              <p><strong>T&J GYM1号店:</strong> tandjgym@gmail.com / 30tandjgym30</p>
              <p><strong>T&J GYM2号店:</strong> tandjgym2goutenn@gmail.com / 30tandjgym30</p>
            </div>
            <div className="mt-3">
              <p className="font-semibold">◆会員アカウント</p>
              <p><strong>1号店会員:</strong> member1@example.com / member1@example.com</p>
              <p><strong>2号店会員:</strong> member2@example.com / member2@example.com</p>
            </div>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="example@email.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="パスワード"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>

          <div className="text-center">
            <Link href="/register" className="text-sm text-indigo-600 hover:text-indigo-500">
              ← 新規登録
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
