import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'CLIENT' | 'ADMIN' | 'TRAINER'
    }
  }

  interface User {
    role: 'CLIENT' | 'ADMIN' | 'TRAINER'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'CLIENT' | 'ADMIN' | 'TRAINER'
  }
}
