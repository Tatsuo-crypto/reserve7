import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'CLIENT' | 'ADMIN'
    }
  }

  interface User {
    role: 'CLIENT' | 'ADMIN'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'CLIENT' | 'ADMIN'
  }
}
