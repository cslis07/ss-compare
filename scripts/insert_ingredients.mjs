import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const ENV_PATH = 'C:/Users/GB/Documents/ss-compare/.env.local'
const env = Object.fromEntries(
  readFileSync(ENV_PATH,'utf-8').split('\n')
    .filter(l=>l.includes('='))
    .map(l=>{ const [k,...v]=l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g,'')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// iconv-lite 로드
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const iconv = require('C:/Users/GB/Documents/ss-compare/node_modules/iconv-lite')

const CSV_PATH = 'C:/Users/GB/Documents/카카오톡 받은 파일/건강보험심사평가원_약가마스터_의약품주성분_20251031.csv'

console.log('CSV 파일 읽는 중...')
const buf = readFileSync(CSV_PATH)
const text = iconv.decode(buf, 'cp949')
const lines = text.split('\n')
console.log(`총 ${lines.length}행 (헤더 포함)`)

// 파싱: 일반명코드,제형구분코드,제형,일반명,분류번호,투여,함량,단위
function parseCSVLine(line) {
  const cols = []
  let inQ = false, cur = ''
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
    else cur += ch
  }
  cols.push(cur.trim())
  return cols
}

const rows = []
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  const cols = parseCSVLine(line)
  if (cols.length < 4) continue
  rows.push({
    ingredient_code: cols[0] || null,
    form_code:       cols[1] || null,
    form_name:       cols[2] || null,
    ingredient_name: cols[3] || null,
    category_code:   cols[4] || null,
    administration:  cols[5] || null,
    amount:          cols[6] || null,
    unit:            cols[7] || null,
  })
}

console.log(`파싱 완료: ${rows.length}건`)

// 기존 데이터 삭제
console.log('기존 데이터 삭제 중...')
const { error: delErr } = await supabase.from('ingredients')
  .delete().neq('id','00000000-0000-0000-0000-000000000000')
if (delErr) console.log('삭제 오류(무시):', delErr.message)
else console.log('기존 데이터 삭제 완료')

// 배치 삽입 (500개씩)
const BATCH = 500
let total = 0
const start = Date.now()
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH)
  const { error } = await supabase.from('ingredients').insert(chunk)
  if (error) {
    console.error(`\n❌ 배치 오류 (${i}~${i+BATCH}):`, error.message)
  } else {
    total += chunk.length
    const pct = Math.round(total / rows.length * 100)
    const elapsed = ((Date.now()-start)/1000).toFixed(1)
    process.stdout.write(`\r  ${total}/${rows.length}건 (${pct}%) - ${elapsed}s 경과`)
  }
}
console.log(`\n✅ 성분 데이터 ${total}건 삽입 완료 (${((Date.now()-start)/1000).toFixed(1)}s)`)
