import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/env'
import { loginSchema } from '@/lib/validations'

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Validate input
          const { email, password } = loginSchema.parse(credentials)

          // Get user from database
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single()

          if (error || !user) {
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, user.password_hash)
          if (!isValidPassword) {
            return null
          }

          // Determine user role
          const role = isAdminEmail(user.email) ? 'ADMIN' : 'CLIENT'

          return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: role,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as 'CLIENT' | 'ADMIN'
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST, authOptions }
