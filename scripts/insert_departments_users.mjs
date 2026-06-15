import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('C:/Users/GB/Documents/ss-compare/node_modules/xlsx-js-style')

const ENV_PATH = 'C:/Users/GB/Documents/ss-compare/.env.local'
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf-8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const FILE = 'C:/Users/GB/Documents/카카오톡 받은 파일/부서관리.xlsx'

/* ── 사용자구분 매핑 ── */
const TYPE_MAP = {
  '관리자': '시스템관리자',
  '중간관리자': '영업관리자',
  '영업담당자': '영업담당자',
}

console.log('📂 파일 읽는 중...')
const wb   = XLSX.readFile(FILE)
const ws   = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const data = rows.slice(1).filter(r => r[3]) // 아이디 있는 행만

console.log(`총 ${data.length}명 파싱 완료`)

/* ════════════════════════════
   1. 부서 테이블 초기화 + 삽입
════════════════════════════ */
const DEPTS = ['CSO1', 'CSO2', 'CSO3', 'CSO4']

console.log('\n[1/2] 부서 처리 중...')
const { error: delDeptErr } = await supabase
  .from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (delDeptErr) console.log('  부서 삭제 오류(무시):', delDeptErr.message)
else console.log('  기존 부서 삭제 완료')

const deptRows = DEPTS.map((name, i) => ({
  name,
  code: name,
  sort_order: i + 1,
  is_active: true,
  parent_id: null,
}))
const { error: deptErr } = await supabase.from('departments').insert(deptRows)
if (deptErr) console.error('  ❌ 부서 삽입 오류:', deptErr.message)
else console.log(`  ✅ 부서 ${deptRows.length}건 삽입 완료`)

/* ════════════════════════════
   2. 사용자 Upsert
════════════════════════════ */
console.log('\n[2/2] 사용자 처리 중...')

const userRows = data.map(r => ({
  login_id:     String(r[3] || '').trim(),
  name:         String(r[4] || '').trim(),
  department1:  String(r[1] || '').trim() || null,
  department2:  null,
  department3:  null,
  department4:  null,
  user_type:    TYPE_MAP[String(r[5]).trim()] || '영업담당자',
  commission_type: null,
  business_type:  '',
  patient_number: null,
  mobile:       String(r[7] || '').trim() || null,
  fax:          String(r[8] || '').trim() || null,
  email:        String(r[9] || '').trim() || null,
  note:         String(r[10] || '').trim() || null,
  is_active:    String(r[11]).trim().toUpperCase() === 'Y',
  cso_company_id: null,
  auth_id:      null,
})).filter(u => u.login_id)

console.log(`  삽입 예정: ${userRows.length}명`)

/* FK 제약으로 삭제 불가 → login_id 충돌 시 UPDATE (upsert) */
const BATCH = 50
let total = 0
let errors = 0
for (let i = 0; i < userRows.length; i += BATCH) {
  const chunk = userRows.slice(i, i + BATCH)
  const { error } = await supabase
    .from('users')
    .upsert(chunk, { onConflict: 'login_id', ignoreDuplicates: false })
  if (error) {
    errors++
    console.error(`\n  ❌ 오류 (${i}~):`, error.message)
  } else {
    total += chunk.length
    process.stdout.write(`\r  ${total}/${userRows.length}명 처리됨...`)
  }
}

console.log(`\n\n✅ 완료: 부서 ${DEPTS.length}건, 사용자 ${total}건 (오류 ${errors}건)`)
