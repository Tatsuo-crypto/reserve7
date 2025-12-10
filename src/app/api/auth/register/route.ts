import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { createUserSchema } from '@/lib/validations'
import { getUserStoreId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const { fullName, email, password, storeId: selectedStoreId } = body
    const validatedData = createUserSchema.parse({ fullName, email, password })

    // Check if user already exists (only if email is provided)
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 400 }
        )
      }
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Use selected store ID or determine from email as fallback
    const storeId = selectedStoreId === '1' ? 'tandjgym@gmail.com' : 'tandjgym2goutenn@gmail.com'

    // Handle empty email by generating a unique dummy email
    // Format: no-email-[timestamp]-[random]@example.com
    const finalEmail = email
      ? email.toLowerCase()
      : `no-email-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name: fullName,
        email: finalEmail,
        password_hash: passwordHash,
        store_id: storeId,
      })
      .select('id, full_name, email, store_id, created_at')
      .single()

    if (error) {
      console.error('Registration error:', error)
      return NextResponse.json(
        { error: 'ユーザー登録に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'ユーザー登録が完了しました',
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        createdAt: user.created_at,
      }
    })

  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '入力データが正しくありません' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
