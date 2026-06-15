import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const ENV_PATH = 'C:/Users/GB/Documents/ss-compare/.env.local'
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf-8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

console.log('버킷 생성 중...')
const { data, error } = await supabase.storage.createBucket('cso-files', {
  public: true,
  fileSizeLimit: 20 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg','image/png','image/jpg','image/gif','image/webp',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
})

if (error) {
  if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
    console.log('✅ 버킷 이미 존재 (정상)')
  } else {
    console.error('❌ 오류:', error.message)
  }
} else {
  console.log('✅ 버킷 생성 완료:', data?.name)
}
