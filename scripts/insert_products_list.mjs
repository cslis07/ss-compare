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

const FILE = 'C:/Users/GB/Documents/카카오톡 받은 파일/제품관리 리스트.xlsx'

/* 수치 변환 헬퍼 */
const toNum = v => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
const toStr = v => {
  const s = String(v || '').trim()
  return s || null
}
const toDate = v => {
  const s = String(v || '').trim()
  return s ? s : null
}
const toBool = (v, trueVal = 'Y') =>
  String(v || '').trim().toUpperCase() === trueVal

console.log('📂 파일 읽는 중...')
const start = Date.now()
const wb   = XLSX.readFile(FILE)
const ws   = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const data = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''))
console.log(`파싱 완료: ${data.length}행`)

/* ── Excel 컬럼 매핑 (0-based) ──
  0:제조사SC코드  1:제조사  2:정산처코드  3:정산처  4:보험코드
  5:제품  6:규격/단위  7:제품그룹  8:제형  9:급여
  10:약품구분  11:매출금액  12:최종보험금액  13:최종적용일자  14:성분코드
  15:성분명  16:성분분류명  17:대체조제가능  18:저가대체인센티브  19:자체코드
  20:제약수수료율  21:추가수수료율(제약)  22:담당수수료율  23:추가수수료율(담당)
  24:비고  25:비고2  26:사용여부  27:품절여부
*/
const productRows = data.map(r => {
  const billingType = toStr(r[9]) || '급여'
  const isActive    = String(r[26] || '').trim().toUpperCase() !== 'N'
  return {
    manufacturer_sc_code:  toStr(r[0]),
    manufacturer_name:     toStr(r[1]) || '',   // NOT NULL 컬럼
    manufacturer_code:     toStr(r[2]),
    settlement_place:      toStr(r[3]),   // trim으로 공백 제거
    insurance_code:        toStr(r[4]),
    product_name:          toStr(r[5]) || '',
    specification:         toStr(r[6]),
    product_group:         toStr(r[7]),
    dosage_form:           toStr(r[8]) || '내복제',
    billing_type:          billingType,
    drug_type:             toStr(r[10]),
    sale_price:            toNum(r[11]),
    final_price:           toNum(r[12]),
    final_price_date:      toDate(r[13]),
    ingredient_code:       toStr(r[14]),
    ingredient_name:       toStr(r[15]),
    ingredient_category:   toStr(r[16]),
    generic_availability:  toStr(r[17]),
    low_cost_incentive:    toStr(r[18]),
    custom_code:           toStr(r[19]),
    mfg_commission_rate:             toNum(r[20]),
    additional_mfg_commission_rate:  toNum(r[21]),
    manager_commission_rate:         toNum(r[22]),
    additional_manager_commission_rate: toNum(r[23]),
    note:  toStr(r[24]),
    note2: toStr(r[25]),
    is_out_of_stock: toBool(r[27], 'Y'),
    has_insurance:   billingType === '급여',
    is_non_covered:  billingType === '비급여',
    is_internal:     true,
    is_deleted:      !isActive,
  }
})

console.log(`\n[1/2] 기존 제품 전체 삭제 중...`)
const { error: delErr } = await supabase
  .from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (delErr) {
  console.error('❌ 삭제 실패:', delErr.message)
  process.exit(1)
}
console.log('  기존 제품 삭제 완료')

console.log(`\n[2/2] 제품 ${productRows.length}건 삽입 중...`)
const BATCH = 300
let total = 0
let errors = 0
const t0 = Date.now()

for (let i = 0; i < productRows.length; i += BATCH) {
  const chunk = productRows.slice(i, i + BATCH)
  const { error } = await supabase.from('products').insert(chunk)
  if (error) {
    errors++
    console.error(`\n  ❌ 배치 오류 (${i}~${i+BATCH}):`, error.message)
    // 첫 번째 오류 행 확인
    if (errors === 1) console.error('  첫 행 데이터:', JSON.stringify(chunk[0]))
  } else {
    total += chunk.length
    const pct  = Math.round(total / productRows.length * 100)
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    process.stdout.write(`\r  ${total}/${productRows.length}건 (${pct}%) - ${secs}s`)
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\n\n✅ 완료: ${total}건 삽입, 오류 ${errors}건 (총 ${elapsed}s)`)
