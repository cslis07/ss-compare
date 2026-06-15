import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const ENV_PATH = 'C:/Users/GB/Documents/ss-compare/.env.local'
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf-8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const files = (obj) => JSON.stringify({ text: '', files: obj })

const NEW_COMPANIES = [
  {
    name: 'k(100023)',
    business_type: '법인사업자',
    status: '정상',
    contract_type: '본사와 직접 계약',
    contract_start_date: '2000-01-01',
    contract_end_date: '2999-12-31',
    is_deleted: false,
  },
  {
    name: '히스토1',
    business_number: '123-45-67890',
    business_type: '개인사업자',
    status: '정상',
    contract_type: '본사와 직접 계약',
    contract_start_date: '2000-01-01',
    contract_end_date: '2999-12-31',
    is_deleted: false,
  },
  {
    name: '수호함',
    business_number: '111-32-93697',
    business_type: '개인사업자',
    representative: '강성학',
    contract_start_date: '2024-10-19',
    contract_end_date: '2999-12-31',
    report_number: '제 2024-4191050-0008',
    status: '정상',
    contract_type: '본사와 직접 계약',
    note: files({ '신고증': '신고증_수호함_강성학.jpg', '사업자등록증': '강성학_사업자등록증_수호함.jpg', '재위탁통보서': '', '재위탁계약서': '2024 계약서 - 수호함.pdf', '교육이수증': '' }),
    is_deleted: false,
  },
  {
    name: '더케이팜',
    business_number: '404-25-01674',
    business_type: '개인사업자',
    representative: '이송미',
    contract_start_date: '2000-01-01',
    contract_end_date: '2999-12-31',
    report_number: '제 2024-3940138-0005',
    status: '정상',
    contract_type: '본사와 직접 계약',
    note: files({ '신고증': '신고증_더케이팜_이송미.jpg', '사업자등록증': '사업자등록증_더케이팜_이송미.jpg', '재위탁통보서': '', '재위탁계약서': '2024 계약서 - 더케이팜.pdf', '교육이수증': '' }),
    is_deleted: false,
  },
]

console.log('[1/2] 기존 CSO업체 soft-delete 중...')
const { error: delErr } = await supabase
  .from('cso_companies')
  .update({ is_deleted: true, updated_at: new Date().toISOString() })
  .neq('id', '00000000-0000-0000-0000-000000000000')
if (delErr) console.error('  삭제 오류(무시):', delErr.message)
else console.log('  기존 데이터 삭제 완료')

console.log(`[2/2] CSO업체 ${NEW_COMPANIES.length}건 삽입 중...`)
const { error: insErr } = await supabase.from('cso_companies').insert(NEW_COMPANIES)
if (insErr) console.error('❌ 삽입 오류:', insErr.message)
else console.log(`✅ 완료: ${NEW_COMPANIES.length}건 삽입`)
