// 엑셀 데이터 Supabase 자동 삽입 스크립트
// 실행: node scripts/import-data.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// .env.local에서 읽기
const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const SQL_DIR = 'C:\\Users\\GB\\Documents\\카카오톡 받은 파일\\컴페어 구조'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ .env.local에서 SUPABASE_URL 또는 SERVICE_ROLE_KEY를 찾을 수 없습니다.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function parseInserts(sql) {
  const tableMatch = sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/)
  if (!tableMatch) return null
  const table = tableMatch[1]
  const cols = tableMatch[2].split(',').map(c => c.trim())

  const rows = []
  const valueRegex = /VALUES\s*\(([^;]+)\)\s*ON CONFLICT/g
  let m
  while ((m = valueRegex.exec(sql)) !== null) {
    const vals = splitValues(m[1])
    if (vals.length !== cols.length) continue
    const obj = {}
    cols.forEach((col, i) => {
      const v = vals[i].trim()
      if (v === 'NULL') obj[col] = null
      else if (v === 'TRUE') obj[col] = true
      else if (v === 'FALSE') obj[col] = false
      else if (v.startsWith("'") && v.endsWith("'")) obj[col] = v.slice(1, -1).replace(/''/g, "'")
      else if (!isNaN(v) && v !== '') obj[col] = Number(v)
      else obj[col] = null
    })
    rows.push(obj)
  }
  return { table, rows }
}

function splitValues(str) {
  const result = []
  let depth = 0, cur = '', inStr = false
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === "'" && str[i - 1] !== "'") { inStr = !inStr; cur += ch; continue }
    if (inStr) { cur += ch; continue }
    if (ch === '(') { depth++; cur += ch }
    else if (ch === ')') { depth--; cur += ch }
    else if (ch === ',' && depth === 0) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) result.push(cur.trim())
  return result
}

// 테이블별 NOT NULL 필수 컬럼
const REQUIRED = {
  products: ['manufacturer_name', 'product_name'],
  users: ['login_id', 'name'],
  prescriptions: ['prescription_month', 'settlement_month'],
  notices: ['title'],
  cso_companies: ['name'],
}

function cleanRows(table, rows) {
  const required = REQUIRED[table] || []
  return rows
    .filter(row => required.every(col => row[col] != null && row[col] !== ''))
    .map(row => {
      // manufacturer_name, product_name NULL → 기본값
      if (table === 'products') {
        if (!row.manufacturer_name) row.manufacturer_name = '(미지정)'
        if (!row.product_name) row.product_name = '(미지정)'
      }
      return row
    })
}

async function insertBatch(table, rows) {
  const cleaned = cleanRows(table, rows)
  const skipped = rows.length - cleaned.length
  if (skipped > 0) process.stdout.write(`(${skipped}건 스킵) `)

  const BATCH = 100
  let total = 0
  for (let i = 0; i < cleaned.length; i += BATCH) {
    const chunk = cleaned.slice(i, i + BATCH)
    const { error } = await supabase.from(table).upsert(chunk, { ignoreDuplicates: true })
    if (error) {
      console.error(`  ❌ 오류 (${i}~${i + chunk.length}):`, error.message)
    } else {
      total += chunk.length
    }
  }
  return total
}

async function main() {
  // 특정 테이블만 재시도하려면: RETRY_TABLE=products node scripts/import-data.mjs
  const retryTable = process.env.RETRY_TABLE
  const files = readdirSync(SQL_DIR)
    .filter(f => f.startsWith('ins_') && f.endsWith('.sql'))
    .filter(f => !retryTable || f.includes(retryTable))
    .sort()

  console.log(`\n총 ${files.length}개 파일 처리 시작\n`)

  const summary = {}
  for (const file of files) {
    const sql = readFileSync(join(SQL_DIR, file), 'utf-8')
    const parsed = parseInserts(sql)
    if (!parsed || parsed.rows.length === 0) {
      console.log(`⚠️  ${file}: 파싱 실패 또는 빈 파일`)
      continue
    }
    const { table, rows } = parsed
    process.stdout.write(`📥 ${file} (${rows.length}행) → ${table}... `)
    const inserted = await insertBatch(table, rows)
    console.log(`완료 (${inserted}건)`)
    summary[table] = (summary[table] || 0) + inserted
  }

  console.log('\n✅ 완료!')
  console.log('테이블별 삽입 건수:')
  Object.entries(summary).forEach(([t, n]) => console.log(`  ${t}: ${n}건`))
}

main().catch(console.error)
