'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function HomePage() {
  const { status } = useSession()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect logic is now handled by the "Get Started" button or manual navigation
  // but we can still auto-redirect if already logged in for convenience, 
  // OR we can let the user see the landing page even if logged in.
  // For a "cool" feel, let's show the landing page and change the button to "Go to Dashboard" if logged in.

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-space-black text-white selection:bg-nebula-purple selection:text-white">

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-nebula-purple/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-nebula-blue/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-nebula-pink/10 rounded-full blur-[100px] animate-pulse-slow" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 w-full px-6 py-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          T&J GYM
        </div>
        <div className="flex gap-4">
          {status === 'authenticated' ? (
            <Link href="/dashboard" className="glass-button px-6 py-2 rounded-full text-sm font-medium hover:scale-105 active:scale-95">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="glass-button px-6 py-2 rounded-full text-sm font-medium hover:scale-105 active:scale-95">
                Login
              </Link>
              <Link href="/register" className="bg-white text-space-black px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center">
        <div className={`transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight mb-6">
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              DEFY
            </span>
            <span className="block text-transparent bg-clip-text bg-nebula-gradient text-glow">
              GRAVITY
            </span>
          </h1>

          <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed">
            Experience the next evolution of fitness management.
            Seamless reservations, intelligent tracking, and a community that pushes limits.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            {status === 'authenticated' ? (
              <Link
                href="/dashboard"
                className="group relative px-8 py-4 bg-white text-space-black rounded-full font-bold text-lg overflow-hidden hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(255,255,255,0.4)]"
              >
                <span className="relative z-10">Enter Dashboard</span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            ) : (
              <Link
                href="/register"
                className="group relative px-8 py-4 bg-white text-space-black rounded-full font-bold text-lg overflow-hidden hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(255,255,255,0.4)]"
              >
                <span className="relative z-10">Start Your Journey</span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            )}

            <a href="#features" className="px-8 py-4 text-gray-400 hover:text-white transition-colors duration-300 font-medium">
              Learn More
            </a>
          </div>
        </div>
      </main>

      {/* Features Preview */}
      <section id="features" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Smart Scheduling', desc: 'Effortless booking system that adapts to your lifestyle.', icon: '📅' },
            { title: 'Performance Tracking', desc: 'Visualize your progress with advanced analytics.', icon: '📈' },
            { title: 'Elite Community', desc: 'Connect with trainers and peers who share your drive.', icon: '🤝' },
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 group">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-gray-600 text-sm">
        <p>&copy; {new Date().getFullYear()} T&J GYM. All rights reserved.</p>
      </footer>
    </div>
  )
}
