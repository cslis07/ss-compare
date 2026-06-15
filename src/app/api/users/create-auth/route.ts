import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { login_id, password, user_id } = await req.json()
    if (!login_id || !password || !user_id) {
      return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 이메일 형식 변환: login_id → login_id@ss-compare.local
    const email = login_id.includes('@') ? login_id : `${login_id}@ss-compare.local`

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { login_id, user_id },
    })

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return NextResponse.json({ error: '이미 존재하는 아이디입니다.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // public.users에 auth_id 연결
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ auth_id: data.user.id })
      .eq('id', user_id)

    if (updateError) {
      // auth 계정은 생성됐지만 연결 실패 — auth 계정 삭제 후 오류 반환
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: 'auth_id 연결 실패: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ auth_id: data.user.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
