import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

const CLOVA_URL = process.env.CLOVA_OCR_INVOKE_URL!
const CLOVA_SECRET = process.env.CLOVA_OCR_SECRET!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const DRAFT_MODEL = process.env.OCR_DRAFT_MODEL || 'claude-haiku-4-5'
const VERIFY_MODEL = process.env.OCR_VERIFY_MODEL || 'claude-sonnet-4-6'

interface ClovaField {
  inferText: string
  inferConfidence: number
  boundingPoly: { vertices: Array<{ x: number; y: number }> }
  lineBreak?: boolean
}

interface RawRow {
  제조사: string
  보험코드: string
  자체코드: string
  제품: string
  급여: string
  단가: number
  총사용량: number
  총금액: number
  원외: boolean
}

export interface MergedRow {
  제조사: string
  보험코드: string
  자체코드: string
  제품: string
  급여: string
  단가: number
  수량원외: number
  수량원내: number
}

/* 병원마다 EMR 프로그램이 달라 컬럼 구조가 다양함 — 레이아웃 비종속 명세 */
const COLUMN_SPEC = `병원마다 EMR 프로그램이 달라 테이블 컬럼 구성과 순서가 모두 다릅니다.
**반드시 이미지의 컬럼 헤더를 먼저 읽고** 각 숫자가 어떤 컬럼인지 파악하세요. 컬럼 위치를 추측하지 마세요.

공통 개념 (헤더 명칭은 프로그램마다 다를 수 있음):
- 제품명: 약품명/수가명칭/명칭 컬럼
- 보험코드: EDI코드/청구코드/보험코드 (9자리 숫자)
- 단가: 약품 1단위 가격 (보통 수십~수십만원대)
- 총사용량: 추출할 수량 (수량/처방횟수/일수/일평균 컬럼이 아님!)
- 총금액: 단가 × 총사용량

**절대 검산 규칙: 단가 × 총사용량 = 총금액** 이 모든 데이터 행에서 성립해야 합니다.
- 예: 단가 115, 총사용량 324 → 총금액 37,260 (115×324=37260 ✓)
- 예: 단가 40, 총사용량 21,792 → 총금액 871,680 ✓
- 검산이 깨지면 행이 어긋났거나 컬럼을 혼동한 것입니다. 반드시 다시 읽으세요.

원외/원내 판단:
- 행마다 원외 체크박스(☑/☐)가 있는 화면 → 체크된 행만 원외:true
- 행별 체크박스가 없고 화면 상단 검색조건이 '원외'로 설정된 화면 → 모든 행 원외:true
- 검색조건이 '원내'이거나 구분이 없으면 → 원외:false

제외할 행: 합계/소계 행, 그룹 요약 헤더 행, 컬럼 헤더 행. (합계 행은 보통 제품명이 없고 수치만 있음)`

const ROW_FORMAT = `[{"제조사":"(주)회사명","보험코드":"청구코드","자체코드":"","제품":"약품명","급여":"급여","단가":0,"총사용량":0,"총금액":0,"원외":false}]`

/* ── 1단계: Clova OCR (좌표 기반 행/열 재구성) ── */
async function runClovaOCR(imageBase64: string): Promise<string> {
  try {
    const res = await fetch(CLOVA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OCR-SECRET': CLOVA_SECRET },
      body: JSON.stringify({
        version: 'V2',
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        lang: 'ko',
        images: [{ format: 'jpg', name: 'document', data: imageBase64 }],
        enableTableDetect: false,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const fields: ClovaField[] = data.images?.[0]?.fields ?? []
    return buildTableText(fields)
  } catch {
    return ''
  }
}

/** 바운딩박스 좌표로 행 그룹핑 → 탭구분 텍스트 */
function buildTableText(fields: ClovaField[]): string {
  if (fields.length === 0) return ''

  const words = fields.map(f => {
    const xs = f.boundingPoly.vertices.map(v => v.x)
    const ys = f.boundingPoly.vertices.map(v => v.y)
    return {
      text: f.inferText,
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      h: Math.max(...ys) - Math.min(...ys),
    }
  })

  // 평균 글자 높이의 60%를 행 허용 오차로 사용 (기울어진 사진 대응)
  const avgH = words.reduce((a, w) => a + w.h, 0) / words.length
  const tol = Math.max(10, avgH * 0.6)

  type RowGroup = { ySum: number; count: number; words: Array<{ text: string; x: number }> }
  const groups: RowGroup[] = []

  for (const w of words.sort((a, b) => a.y - b.y)) {
    const g = groups.find(g => Math.abs(g.ySum / g.count - w.y) < tol)
    if (g) {
      g.words.push({ text: w.text, x: w.x })
      g.ySum += w.y
      g.count++
    } else {
      groups.push({ ySum: w.y, count: 1, words: [{ text: w.text, x: w.x }] })
    }
  }

  groups.sort((a, b) => a.ySum / a.count - b.ySum / b.count)
  for (const g of groups) g.words.sort((a, b) => a.x - b.x)
  return groups.map(g => g.words.map(w => w.text).join('\t')).join('\n')
}

async function callClaude(model: string, content: unknown): Promise<RawRow[] | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: 'user', content }] }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Claude(${model}) error ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return null
  try {
    return JSON.parse(m[0]) as RawRow[]
  } catch {
    return null
  }
}

/* ── 2단계: OCR 텍스트 → 구조화 초안 ── */
async function draftFromText(tableText: string): Promise<RawRow[] | null> {
  const prompt = `다음은 병원 EMR 처방 통계 화면을 Clova OCR로 추출해 행별 탭구분으로 재구성한 텍스트입니다.
사진이 기울어진 경우 행이 섞여 있을 수 있으니, 검산 규칙으로 숫자 묶음이 올바른지 확인하면서 파싱하세요.

${COLUMN_SPEC}

기타:
- 텍스트에서 컬럼 헤더 행을 찾아 구조를 먼저 파악할 것
- 원외 체크박스는 OCR 텍스트로 판단이 어려우면 false로 두기 (다음 단계에서 이미지로 검증)
- 급여는 "급여"로 설정

JSON 배열만 출력 (설명 금지):
${ROW_FORMAT}

OCR 텍스트:
${tableText}`

  return callClaude(DRAFT_MODEL, prompt)
}

/* ── 3단계: 초안을 이미지와 대조 검증 ── */
async function verifyWithImage(
  imageBase64: string,
  draft: RawRow[],
  tableText: string,
  feedback?: string
): Promise<RawRow[] | null> {
  const prompt = `이 이미지는 병원 EMR 처방 통계/내역 화면입니다.
아래 '초안'은 OCR 텍스트에서 1차 추출한 데이터인데, 사진이 기울어져 있으면 행이 어긋난 오류가 있을 수 있습니다.
**이미지가 항상 우선입니다.** 초안은 참고만 하고, 이미지의 실제 값으로 검증·수정한 최종 결과를 출력하세요.

${COLUMN_SPEC}

검증 순서:
1. 이미지에서 테이블의 컬럼 헤더를 읽고 구조를 파악한다.
2. 각 데이터 행(제품명이 있는 행)에 대해 제품명과 같은 행에 있는 단가/총사용량/총금액을 읽는다.
3. 단가 × 총사용량 = 총금액 검산을 행마다 수행한다. 깨지면 그 행을 다시 읽는다.
4. 원외/원내를 판단한다 (행별 체크박스 또는 화면 상단 검색조건).
5. 초안과 다르면 이미지 기준으로 수정하고, 초안에 없는 데이터 행은 추가, 합계 행 등 데이터가 아닌 행은 제거한다.
${feedback ? `\n**이전 시도 검산 실패 — 반드시 수정할 것:**\n${feedback}\n` : ''}
초안:
${JSON.stringify(draft, null, 1)}

참고용 OCR 텍스트:
${tableText}

최종 JSON 배열만 출력 (설명 금지):
${ROW_FORMAT}`

  return callClaude(VERIFY_MODEL, [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
    { type: 'text', text: prompt },
  ])
}

/* ── 서버 측 검산: 단가×총사용량=총금액 ── */
function checksumFailures(rows: RawRow[]): string[] {
  const failures: string[] = []
  for (const r of rows) {
    const price = Number(r.단가) || 0
    const qty = Number(r.총사용량) || 0
    const total = Number(r.총금액) || 0
    if (total <= 0 || price <= 0 || qty <= 0) continue
    if (Math.abs(price * qty - total) > Math.max(1, total * 0.01)) {
      failures.push(`"${r.제품}": 단가 ${price} × 총사용량 ${qty} = ${price * qty} ≠ 총금액 ${total}`)
    }
  }
  return failures
}

/* 검산 실패 행 산술 보정: 총금액/단가가 정수로 떨어지면 총사용량 교정 */
function arithmeticFix(rows: RawRow[]): RawRow[] {
  return rows.map(r => {
    const price = Number(r.단가) || 0
    const qty = Number(r.총사용량) || 0
    const total = Number(r.총금액) || 0
    if (total <= 0 || price <= 0) return r
    if (Math.abs(price * qty - total) <= Math.max(1, total * 0.01)) return r

    const fixedQty = total / price
    if (Math.abs(fixedQty - Math.round(fixedQty)) < 0.02) {
      return { ...r, 총사용량: Math.round(fixedQty) }
    }
    if (qty > 0) {
      const fixedPrice = total / qty
      if (Math.abs(fixedPrice - Math.round(fixedPrice)) < 0.02) {
        return { ...r, 단가: Math.round(fixedPrice) }
      }
    }
    return r
  })
}

/* 같은 보험코드를 원외/원내로 합산 병합 */
function mergeRows(rawRows: RawRow[]): MergedRow[] {
  const ordered: string[] = []
  const map = new Map<string, MergedRow>()

  for (const row of rawRows) {
    const key = row.보험코드 || row.제품
    if (!map.has(key)) {
      ordered.push(key)
      map.set(key, {
        제조사: row.제조사,
        보험코드: row.보험코드,
        자체코드: row.자체코드 || '',
        제품: row.제품,
        급여: row.급여 || '급여',
        단가: row.단가,
        수량원외: 0,
        수량원내: 0,
      })
    }
    const m = map.get(key)!
    const qty = Number(row.총사용량) || 0
    if (row.원외) m.수량원외 += qty
    else m.수량원내 += qty
    if (row.단가) m.단가 = row.단가
  }

  return ordered.map(k => map.get(k)!)
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
    if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    // 1단계: Clova OCR
    const tableText = await runClovaOCR(imageBase64)

    // 2단계: 텍스트 초안
    let draft: RawRow[] | null = null
    if (tableText) {
      try {
        draft = await draftFromText(tableText)
      } catch {
        draft = null
      }
    }

    // 3단계: 이미지 대조 검증
    let finalRows = await verifyWithImage(imageBase64, draft ?? [], tableText)

    // 4단계: 서버 검산 — 실패 행이 있으면 피드백과 함께 1회 재검증
    if (finalRows) {
      const failures = checksumFailures(finalRows)
      if (failures.length > 0) {
        const retried = await verifyWithImage(imageBase64, finalRows, tableText, failures.join('\n'))
        if (retried) finalRows = retried
      }
      // 그래도 깨진 행은 산술 보정 (총금액÷단가로 수량 역산)
      finalRows = arithmeticFix(finalRows)
    }

    const source = finalRows ?? draft
    const rows = source ? mergeRows(source) : null

    return NextResponse.json({ text: tableText, rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
