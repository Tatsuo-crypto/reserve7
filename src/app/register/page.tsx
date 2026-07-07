'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/icons'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeId: '1' // Default to store 1
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    // Client-side validation
    const newErrors: Record<string, string> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = '氏名は必須です'
    }

    // Email is optional now
    // if (!formData.email.trim()) {
    //   newErrors.email = 'メールアドレスは必須です'
    // }

    if (formData.password.length < 8) {
      newErrors.password = 'パスワードは8文字以上で入力してください'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'パスワードが一致しません'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          storeId: formData.storeId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors({ submit: data.error || '登録に失敗しました' })
        return
      }

      // Registration successful, redirect to login
      router.push('/login?message=registration_success')
    } catch (error) {
      setErrors({ submit: 'ネットワークエラーが発生しました' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-normal text-text-primary">
            新規会員登録
          </h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            または{' '}
            <Link href="/login" className="font-normal text-brand-600 hover:text-brand-500">
              ログインはこちら
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="storeId" className="block text-sm font-normal text-text-secondary">
                利用店舗を選択してください
              </label>
              <div className="relative mt-1">
                <select
                  id="storeId"
                  name="storeId"
                  required
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-border-strong text-text-primary rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm bg-surface-raised"
                  value={formData.storeId}
                  onChange={handleChange}
                >
                  <option value="1">T&J GYM 1号店</option>
                  <option value="2">T&J GYM 2号店</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <Icon name="chevronDown" size={20} className="text-text-muted" />
                </div>
              </div>
              {errors.storeId && (
                <p className="mt-1 text-sm text-red-600">{errors.storeId}</p>
              )}
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-normal text-text-secondary">
                氏名
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-border-strong placeholder-gray-500 text-text-primary rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm"
                placeholder="山田太郎"
                value={formData.fullName}
                onChange={handleChange}
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-normal text-text-secondary">
                メールアドレス（任意）
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-border-strong placeholder-gray-500 text-text-primary rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm"
                placeholder="example@email.com"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-normal text-text-secondary">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-border-strong placeholder-gray-500 text-text-primary rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm"
                placeholder="8文字以上"
                value={formData.password}
                onChange={handleChange}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-normal text-text-secondary">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-border-strong placeholder-gray-500 text-text-primary rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm"
                placeholder="パスワードを再入力"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-normal rounded-md text-white bg-brand-700 hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登録中...' : '会員登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
