import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'cso-files'

/* ── 파일 업로드 ── */
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const companyId = form.get('companyId') as string | null
  const fileType = form.get('fileType') as string | null

  if (!file || !companyId) {
    return NextResponse.json({ error: '파일 또는 업체 ID 누락' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._\-() ]/g, '_')
  const path = `${companyId}/${fileType ?? 'file'}/${safeName}`
  const bytes = await file.arrayBuffer()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path: data.path })
}

/* ── 파일 삭제 ── */
export async function DELETE(req: NextRequest) {
  const { path } = await req.json() as { path?: string }
  if (!path) return NextResponse.json({ error: '경로 누락' }, { status: 400 })

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
