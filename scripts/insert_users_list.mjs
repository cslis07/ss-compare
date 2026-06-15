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

const FILE = 'C:/Users/GB/Documents/카카오톡 받은 파일/사용자 관리_20260610093042.xlsx'

/* ── 사용자구분 매핑 ── */
const TYPE_MAP = {
  '관리자':    '시스템관리자',
  '중간관리자': '영업관리자',
  '영업담당자': '영업담당자',
}

const toStr = v => { const s = String(v || '').trim(); return s || null }
const toBool = v => String(v || '').trim().toUpperCase() === 'Y'

console.log('📂 파일 읽는 중...')
const wb   = XLSX.readFile(FILE)
const ws   = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

/* 헤더 행 출력 (확인용) */
console.log('헤더:', rows[0])
console.log('샘플행:', rows[1])

/*
  컬럼 매핑 (0-based):
  0:아이디  1:부서1  2:부서2  3:부서3  4:부서장
  5:이름    6:사용자구분  7:수수료적용구분  8:사업자구분명
  9:전화번호  10:Mobile  11:Fax  12:이메일  13:비고
  14:사용여부  15:웹코드  16:사업자번호  17:주민번호
  18:우편번호  19:도로명주소  20:상세주소
*/
const data = rows.slice(1).filter(r => toStr(r[0]))
console.log(`\n총 ${data.length}명 파싱 완료`)

const userRows = data.map(r => {
  const rawType   = String(r[6] || '').trim()
  const userType  = TYPE_MAP[rawType] || '영업담당자'
  const isActive  = toBool(r[14])

  return {
    login_id:        toStr(r[0]),
    department1:     toStr(r[1]),
    department2:     toStr(r[2]),
    department3:     toStr(r[3]),
    department4:     null,
    name:            toStr(r[5]) || '',
    user_type:       userType,
    commission_type: toStr(r[7]),
    business_type:   toStr(r[8]) || '',
    mobile:          toStr(r[10]),
    fax:             toStr(r[11]),
    email:           toStr(r[12]),
    note:            toStr(r[13]),
    is_active:       isActive,
    patient_number:  toStr(r[16]),
    cso_company_id:  null,
    auth_id:         null,
  }
})

console.log('\n[Upsert] 사용자 처리 중...')
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
    if (errors === 1) console.error('  첫 행:', JSON.stringify(chunk[0]))
  } else {
    total += chunk.length
    process.stdout.write(`\r  ${total}/${userRows.length}명 처리됨...`)
  }
}

console.log(`\n\n✅ 완료: 사용자 ${total}건 처리 (오류 ${errors}건)`)
