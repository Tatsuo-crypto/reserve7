'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
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
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else if (result?.ok) {
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
    <div className="min-h-screen flex items-center justify-center bg-space-black relative overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-nebula-purple/10 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-nebula-blue/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-4s' }} />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center animate-slideUp">
          <Link href="/" className="inline-block">
            <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
              T&J GYM
            </h2>
          </Link>
          <p className="text-gray-400 text-lg">
            Welcome back, Challenger.
          </p>
        </div>

        <div className="glass-panel p-8 rounded-2xl animate-slideUp" style={{ animationDelay: '0.1s' }}>
          {message && (
            <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
              <p className="text-sm text-green-400 text-center">{message}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-nebula-blue focus:border-transparent transition-all duration-200"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-nebula-blue focus:border-transparent transition-all duration-200"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-nebula-gradient hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nebula-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(67,97,238,0.3)] hover:shadow-[0_0_30px_rgba(67,97,238,0.5)]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center mt-4">
              <Link href="/register" className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
                Don&apos;t have an account? <span className="text-nebula-blue hover:underline">Sign up</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-space-black">
        <div className="w-8 h-8 border-4 border-nebula-blue/30 border-t-nebula-blue rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
