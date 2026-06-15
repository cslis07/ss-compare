'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet, Phone, LifeBuoy } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { DataPagination } from '@/components/ui/data-pagination'

const PAGE_SIZE = 30

interface PrescRow {
  department1: string | null
  sales_manager_name: string | null
  cso_company_name: string | null
  customer_name: string | null
  business_number: string | null
  prescription_month: string | null
  settlement_month: string | null
  registration_status: string | null
  is_deleted: boolean | null
  items: Array<{
    manufacturer_name: string | null
    settlement_place: string | null
    insurance_code: string | null
    product_name: string | null
    amount: number | null
    contract_commission_rate: number | null
    total_contract_commission: number | null
    charge_commission_rate: number | null
    total_charge_commission: number | null
    is_deleted: boolean | null
  }>
}

interface CollRow {
  dept: string
  manager: string
  cso: string
  sc_code: string
  customer: string
  biz_no: string
  manufacturer: string
  settlement_place: string
  insurance_code: string
  product_name: string
  pres_month: string
  settle_month: string
  vat: number
  contract_rate: number
  contract_fee: number
  contract_total: number
  charge_rate: number
  charge_fee: number
  charge_total: number
  collected: number
  contract_diff: number
  contract_collect_rate: number
  charge_diff: number
  charge_collect_rate: number
}

export default function CollectionPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CollRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [dbError, setDbError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultMonth = prevMonth.toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    presMonth: defaultMonth,
    manufacturerName: '',
    productName: '',
    managerName: '',
    csoName: '',
    includeDeleted: false,
    includeIncentive: true,
    applyLimit: true,
    excludeZero: true,
    st_registered: true,
    st_confirmed: true,
    st_settled: true,
    st_subtotal: false,
  })

  const set = (k: string, v: unknown) => setFilters(f => ({ ...f, [k]: v }))

  const doLoad = useCallback(async () => {
    setLoading(true)
    setPage(0)
    setDbError(null)

    // ── Step 1: 처방전 목록 조회 (아이템 embed 없이) ──────────────────────────
    type PresBasic = {
      id: string
      department1: string | null
      sales_manager_name: string | null
      cso_company_name: string | null
      customer_name: string | null
      business_number: string | null
      prescription_month: string | null
      settlement_month: string | null
    }

    let presQuery = supabase
      .from('prescriptions')
      .select('id, department1, sales_manager_name, cso_company_name, customer_name, business_number, prescription_month, settlement_month')
      .neq('is_deleted', true)
      .eq('prescription_month', filters.presMonth)

    const statuses: string[] = []
    if (filters.st_registered) statuses.push('등록')
    if (filters.st_confirmed) statuses.push('확정')
    if (filters.st_settled) statuses.push('정산')
    if (statuses.length > 0) presQuery = presQuery.in('registration_status', statuses)
    if (filters.managerName) presQuery = presQuery.ilike('sales_manager_name', `%${filters.managerName}%`)
    if (filters.csoName) presQuery = presQuery.ilike('cso_company_name', `%${filters.csoName}%`)

    const { data: presData, error: presError } = await presQuery.limit(2000)
    if (presError) { setDbError(presError.message); setLoading(false); return }

    const prescriptions = (presData ?? []) as unknown as PresBasic[]
    if (prescriptions.length === 0) { setRows([]); setHasSearched(true); setLoading(false); return }

    // ── Step 2: 처방전 IDs로 아이템 일괄 조회 ──────────────────────────────
    const ids = prescriptions.map(p => p.id)
    const presMap = Object.fromEntries(prescriptions.map(p => [p.id, p]))

    type ItemRow = {
      prescription_id: string
      manufacturer_name: string | null
      settlement_place: string | null
      insurance_code: string | null
      product_name: string | null
      amount: number | null
      contract_commission_rate: number | null
      total_contract_commission: number | null
      charge_commission_rate: number | null
      total_charge_commission: number | null
      is_deleted: boolean | null
    }

    // 배치 처리 (IN 절 최대 500개)
    const allItems: ItemRow[] = []
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500)
      const { data: itemData, error: itemError } = await supabase
        .from('prescription_items')
        .select('prescription_id, manufacturer_name, settlement_place, insurance_code, product_name, amount, contract_commission_rate, total_contract_commission, charge_commission_rate, total_charge_commission, is_deleted')
        .in('prescription_id', batch)
        .neq('is_deleted', true)
        .limit(10000)
      if (itemError) { setDbError(itemError.message); setLoading(false); return }
      allItems.push(...((itemData ?? []) as unknown as ItemRow[]))
    }

    // ── Step 3: 클라이언트 사이드 필터 + 조합 ────────────────────────────────
    const result: CollRow[] = []
    for (const item of allItems) {
      const p = presMap[item.prescription_id]
      if (!p) continue
      if (filters.productName && !(item.product_name ?? '').includes(filters.productName)) continue
      if (filters.manufacturerName && !(item.manufacturer_name ?? '').includes(filters.manufacturerName)) continue

      const contractFee = item.total_contract_commission || 0
      const chargeFee = item.total_charge_commission || 0
      if (filters.excludeZero && contractFee === 0 && chargeFee === 0) continue

      const collected = 0
      result.push({
        dept: p.department1 ?? '',
        manager: p.sales_manager_name ?? '',
        cso: p.cso_company_name ?? '',
        sc_code: '',
        customer: p.customer_name ?? '',
        biz_no: p.business_number ?? '',
        manufacturer: item.manufacturer_name ?? '',
        settlement_place: item.settlement_place ?? '',
        insurance_code: item.insurance_code ?? '',
        product_name: item.product_name ?? '',
        pres_month: p.prescription_month ?? '',
        settle_month: p.settlement_month ?? '',
        vat: item.amount || 0,
        contract_rate: item.contract_commission_rate || 0,
        contract_fee: contractFee,
        contract_total: contractFee,
        charge_rate: item.charge_commission_rate || 0,
        charge_fee: chargeFee,
        charge_total: chargeFee,
        collected,
        contract_diff: collected - contractFee,
        contract_collect_rate: contractFee ? (collected / contractFee * 100) : 0,
        charge_diff: collected - chargeFee,
        charge_collect_rate: chargeFee ? (collected / chargeFee * 100) : 0,
      })
    }

    setRows(result)
    setHasSearched(true)
    setLoading(false)
  }, [filters, supabase])

  // 마운트 시 자동 조회
  useEffect(() => {
    doLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); doLoad() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doLoad])

  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totals = rows.reduce(
    (acc, r) => ({
      vat: acc.vat + r.vat,
      contract: acc.contract + r.contract_fee,
      charge: acc.charge + r.charge_fee,
      collected: acc.collected + r.collected,
      contract_diff: acc.contract_diff + r.contract_diff,
      charge_diff: acc.charge_diff + r.charge_diff,
    }),
    { vat: 0, contract: 0, charge: 0, collected: 0, contract_diff: 0, charge_diff: 0 }
  )

  function exportExcel() {
    import('xlsx-js-style').then((XLSX) => {
      const headers = [
        '순번', '부서', '영업담당자', 'CSO업체', 'SC코드', '거래처', '사업자번호',
        '제조사', '정산처', '보험코드', '제품명', '처방월', '정산월', '부가세',
        '제약수수료율', '제약수수료',
        '거래처/제품(제약)', 'CSO업체(제약)', '신규거래처(제약)', '거래처(제약)', '제조사(제약)', '제품(제약)', '제약수수료합계',
        '담당수수료율', '담당수수료',
        '거래처/제품(담당)', 'CSO업체(담당)', '신규거래처(담당)', '거래처(담당)', '제조사(담당)', '제품(담당)', '담당수수료합계',
        '수금액', '차이(제약)', '수금율(제약)', '차이(담당)', '수금율(담당)',
      ]
      const data = rows.map((r, i) => [
        i + 1, r.dept, r.manager, r.cso, r.sc_code, r.customer, r.biz_no,
        r.manufacturer, r.settlement_place, r.insurance_code, r.product_name, r.pres_month, r.settle_month, r.vat,
        r.contract_rate, r.contract_fee,
        0, 0, 0, 0, 0, 0, r.contract_total,
        r.charge_rate, r.charge_fee,
        0, 0, 0, 0, 0, 0, r.charge_total,
        r.collected, r.contract_diff, r.contract_collect_rate.toFixed(1) + '%', r.charge_diff, r.charge_collect_rate.toFixed(1) + '%',
      ])
      const ws = (XLSX.utils as { aoa_to_sheet: (data: unknown[]) => unknown }).aoa_to_sheet([headers, ...data])
      const wb = (XLSX.utils as { book_new: () => unknown }).book_new()
      ;(XLSX.utils as { book_append_sheet: (wb: unknown, ws: unknown, name: string) => void }).book_append_sheet(wb, ws, '수금현황')
      ;(XLSX as { writeFile: (wb: unknown, name: string) => void }).writeFile(wb, `영업담당자수금현황_${filters.presMonth}.xlsx`)
    })
  }

  const COLS = [36,60,70,70,60,100,90,80,70,80,120,60,60,70,62,75,80,70,80,70,70,65,80,62,75,80,70,80,70,70,65,80,70,75,68,75,68]
  const HEADERS = [
    '순번','부서','영업담당자','CSO업체','SC코드','거래처','사업자번호',
    '제조사','정산처','보험코드','제품명','처방월','정산월','부가세',
    '제약\n수수료율','제약\n수수료',
    '거래처/제품\n(제약)','CSO업체\n(제약)','신규거래처\n(제약)','거래처\n(제약)','제조사\n(제약)','제품\n(제약)','제약수수료\n합계',
    '담당\n수수료율','담당\n수수료',
    '거래처/제품\n(담당)','CSO업체\n(담당)','신규거래처\n(담당)','거래처\n(담당)','제조사\n(담당)','제품\n(담당)','담당수수료\n합계',
    '수금액','차이\n(제약)','수금율\n(제약)','차이\n(담당)','수금율\n(담당)',
  ]
  const COL_COUNT = COLS.length // 37

  return (
    <div className="flex flex-col h-full">
      {/* ── 필터 패널 ── */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 shrink-0 space-y-1.5">
        {/* 1행 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 whitespace-nowrap">처방월</span>
          <Input type="month" value={filters.presMonth}
            onChange={e => set('presMonth', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLoad()}
            className="h-7 text-xs w-32" />
          <span className="text-xs text-gray-500 whitespace-nowrap">제조사명</span>
          <Input placeholder="제조사명" value={filters.manufacturerName}
            onChange={e => set('manufacturerName', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLoad()}
            className="h-7 text-xs w-32" />
          <span className="text-xs text-gray-500 whitespace-nowrap">CSO업체명</span>
          <Input placeholder="CSO업체명" value={filters.csoName}
            onChange={e => set('csoName', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLoad()}
            className="h-7 text-xs w-32" />

          <div className="flex items-center gap-2 ml-2 flex-wrap text-[11px]">
            {[
              ['includeDeleted', '삭제된 거래처 포함'],
              ['includeIncentive', '인센티브 포함'],
              ['applyLimit', '제조사 월 제한금액 적용'],
              ['excludeZero', '수수료0인건 제외'],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox"
                  checked={filters[k as keyof typeof filters] as boolean}
                  onChange={e => set(k, e.target.checked)}
                  className="h-3 w-3" />
                <span className="text-gray-600">{label}</span>
              </label>
            ))}
            <span className="w-px h-4 bg-gray-200 mx-1" />
            {[
              ['st_registered', '등록(미확정)'],
              ['st_confirmed', '확정'],
              ['st_settled', '정산'],
              ['st_subtotal', '소계'],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox"
                  checked={filters[k as keyof typeof filters] as boolean}
                  onChange={e => set(k, e.target.checked)}
                  className="h-3 w-3" />
                <span className="text-gray-600">{label}</span>
              </label>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" onClick={doLoad}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
              <Search className="h-3 w-3 mr-1" /> 조회(F1)
            </Button>
            <Button size="sm" variant="outline" onClick={exportExcel} className="h-7 text-xs px-2">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
            </Button>
            <button className="h-7 px-2 text-[11px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1">
              <LifeBuoy className="h-3 w-3" /> 원격지원
            </button>
            <button className="h-7 px-2 text-[11px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1">
              <Phone className="h-3 w-3" /> 02-3443-7337
            </button>
          </div>
        </div>

        {/* 2행 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">제품명</span>
          <Input placeholder="제품명" value={filters.productName}
            onChange={e => set('productName', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLoad()}
            className="h-7 text-xs w-36" />
          <span className="text-xs text-gray-500 whitespace-nowrap">영업담당자명</span>
          <Input placeholder="영업담당자명" value={filters.managerName}
            onChange={e => set('managerName', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLoad()}
            className="h-7 text-xs w-32" />
        </div>

        {dbError && (
          <div className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">오류: {dbError}</div>
        )}
      </div>

      {/* ── 테이블 ── */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="text-[11px] border-collapse" style={{ minWidth: COLS.reduce((a, b) => a + b, 0) + 'px' }}>
          <colgroup>
            {COLS.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#1a3a6b' }}>
            <tr>
              {HEADERS.map((h, i) => (
                <th key={i}
                  className="px-1 py-1 text-center text-white font-medium border-r border-blue-800 leading-tight"
                  style={{ fontSize: 10, verticalAlign: 'middle', whiteSpace: 'pre-line' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COL_COUNT} className="text-center py-10 text-gray-400">조회 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={COL_COUNT} className="text-center py-10 text-gray-400 text-sm">{hasSearched ? '데이터가 없습니다.' : '조회 버튼을 클릭하세요.'}</td></tr>
            ) : pageRows.map((r, i) => {
              const no = page * PAGE_SIZE + i + 1
              const bg = i % 2 === 0 ? 'bg-white' : 'bg-blue-50/20'
              return (
                <tr key={i} className={`border-b border-gray-100 hover:bg-yellow-50 ${bg}`}>
                  <td className="px-1 py-0.5 text-center text-gray-400">{no}</td>
                  <td className="px-1 py-0.5 text-gray-600 truncate">{r.dept}</td>
                  <td className="px-1 py-0.5 text-gray-800 font-medium truncate">{r.manager}</td>
                  <td className="px-1 py-0.5 text-gray-600 truncate">{r.cso}</td>
                  <td className="px-1 py-0.5 text-gray-500 font-mono">{r.sc_code}</td>
                  <td className="px-1 py-0.5 text-gray-800 truncate">{r.customer}</td>
                  <td className="px-1 py-0.5 text-gray-500 font-mono">{r.biz_no}</td>
                  <td className="px-1 py-0.5 text-gray-600 truncate">{r.manufacturer}</td>
                  <td className="px-1 py-0.5 text-gray-600 truncate">{r.settlement_place}</td>
                  <td className="px-1 py-0.5 text-gray-600 font-mono">{r.insurance_code}</td>
                  <td className="px-1 py-0.5 text-gray-800 truncate">{r.product_name}</td>
                  <td className="px-1 py-0.5 text-center text-gray-600 font-mono">{r.pres_month}</td>
                  <td className="px-1 py-0.5 text-center text-gray-600 font-mono">{r.settle_month}</td>
                  <td className="px-1 py-0.5 text-right text-gray-700">{formatNumber(r.vat)}</td>
                  <td className="px-1 py-0.5 text-right text-gray-700">{r.contract_rate.toFixed(2)}</td>
                  <td className="px-1 py-0.5 text-right text-blue-700 font-medium">{formatNumber(r.contract_fee)}</td>
                  {/* 제약 breakdown — 모두 0 */}
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-blue-700 font-medium">{formatNumber(r.contract_total)}</td>
                  <td className="px-1 py-0.5 text-right text-gray-700">{r.charge_rate.toFixed(2)}</td>
                  <td className="px-1 py-0.5 text-right text-green-700 font-medium">{formatNumber(r.charge_fee)}</td>
                  {/* 담당 breakdown — 모두 0 */}
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-gray-400">0</td>
                  <td className="px-1 py-0.5 text-right text-green-700 font-medium">{formatNumber(r.charge_total)}</td>
                  <td className="px-1 py-0.5 text-right text-gray-700">{formatNumber(r.collected)}</td>
                  <td className={`px-1 py-0.5 text-right font-medium ${r.contract_diff < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatNumber(r.contract_diff)}</td>
                  <td className="px-1 py-0.5 text-right text-gray-600">{r.contract_collect_rate.toFixed(1)}%</td>
                  <td className={`px-1 py-0.5 text-right font-medium ${r.charge_diff < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatNumber(r.charge_diff)}</td>
                  <td className="px-1 py-0.5 text-right text-gray-600">{r.charge_collect_rate.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-300 bg-gray-100 font-semibold">
              <tr>
                <td className="px-1 py-1 text-center text-gray-600 whitespace-nowrap" colSpan={13}>
                  합 계 ({rows.length.toLocaleString()}건)
                </td>
                <td className="px-1 py-1 text-right text-gray-700">{formatNumber(totals.vat)}</td>
                <td className="px-1 py-1" />
                <td className="px-1 py-1 text-right text-blue-700">{formatNumber(totals.contract)}</td>
                <td colSpan={6} />
                <td className="px-1 py-1 text-right text-blue-700">{formatNumber(totals.contract)}</td>
                <td className="px-1 py-1" />
                <td className="px-1 py-1 text-right text-green-700">{formatNumber(totals.charge)}</td>
                <td colSpan={6} />
                <td className="px-1 py-1 text-right text-green-700">{formatNumber(totals.charge)}</td>
                <td className="px-1 py-1 text-right text-gray-700">{formatNumber(totals.collected)}</td>
                <td className="px-1 py-1 text-right text-red-600">{formatNumber(totals.contract_diff)}</td>
                <td className="px-1 py-1" />
                <td className="px-1 py-1 text-right text-red-600">{formatNumber(totals.charge_diff)}</td>
                <td className="px-1 py-1" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <DataPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows.length}
        onChange={setPage}
      />
    </div>
  )
}
