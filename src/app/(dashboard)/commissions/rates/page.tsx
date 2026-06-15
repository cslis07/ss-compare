'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { CommissionRate, Product, Customer } from '@/lib/types'
import { Search, X, FileSpreadsheet, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductSearchDialog } from '@/components/search/product-search-dialog'
import { CustomerSearchDialog } from '@/components/search/customer-search-dialog'

const FL = 'h-6 text-[11px] border border-gray-300 rounded px-1.5 w-full'
const LB = 'text-[11px] text-gray-600 whitespace-nowrap shrink-0'
const RC = 'flex items-center gap-1'

interface PInfo {
  product_name: string
  specification: string | null
  manufacturer_name: string
  insurance_type: string
  ingredient_code: string | null
  ingredient_name: string | null
  dosage_form: string | null
  sale_price: number | null
  final_price_date: string | null
  drug_type: string | null
  ingredient_category: string | null
}

interface XRow {
  no: number; status: string; start_month: string; end_month: string
  customer_seq: string; manager_id: string; insurance_code: string; product_name: string
  contract_rate: number; add_contract_rate: number; charge_rate: number; add_charge_rate: number
  matched: boolean
}

/* ══════════════════════════════════════════════ 메인 페이지 ══ */
export default function CommissionRatesPage() {
  const supabase = createClient()
  const [rates, setRates] = useState<CommissionRate[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CommissionRate | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  const [pinfo, setPinfo] = useState<PInfo | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [xrows, setXrows] = useState<XRow[]>([])
  const [downloading, setDownloading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [filters, setFilters] = useState({ salesManager: '', insuranceCode: '' })

  const loadRates = useCallback(async () => {
    setLoading(true); setDbError(null)
    let q = supabase.from('commission_rates').select('*')
      .neq('is_deleted', true)
      .order('prescription_start_month', { ascending: false })
    if (filters.salesManager) q = q.ilike('product_name', `%${filters.salesManager}%`)
    if (filters.insuranceCode) q = q.ilike('insurance_code', `%${filters.insuranceCode}%`)
    const { data, error } = await q.limit(500)
    if (error) setDbError(error.message)
    setRates((data || []) as CommissionRate[])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { loadRates() }, [loadRates])

  async function lookupProduct(code: string) {
    if (!code || code.length < 5) { setPinfo(null); return }
    const { data } = await supabase.from('products').select('*')
      .eq('insurance_code', code).eq('is_deleted', false).limit(1)
    if (data && data.length > 0) applyProduct(data[0] as Product)
    else setPinfo(null)
  }

  function applyProduct(p: Product) {
    setPinfo({
      product_name: p.product_name, specification: p.specification,
      manufacturer_name: p.manufacturer_name,
      insurance_type: p.has_insurance ? '급여' : (p.is_non_covered ? '비급여' : '-'),
      ingredient_code: p.ingredient_code, ingredient_name: p.ingredient_name,
      dosage_form: p.dosage_form, sale_price: p.final_price,
      final_price_date: p.final_price_date, drug_type: p.drug_type,
      ingredient_category: p.ingredient_category,
    })
    setSelected(s => s ? {
      ...s, insurance_code: p.insurance_code,
      product_name: p.product_name, manufacturer_name: p.manufacturer_name,
    } : s)
  }

  function applyCustomer(c: Customer) {
    setSelected(s => s ? {
      ...s, customer_id: c.id,
      customer_seq: c.sc_code ? parseInt(c.sc_code) : null,
    } : s)
    setSelectedCustomerName(c.name)
  }

  function openNew() {
    setSelected({
      id: '', prescription_start_month: currentMonth, prescription_end_month: '2999-12',
      rate_type: 'BASIC', sales_manager_id: null, department1: null, department2: null,
      department3: null, customer_id: null, customer_seq: null, insurance_code: null,
      product_name: null, manufacturer_name: null, contract_commission_rate: 0,
      additional_commission_rate: 0, charge_commission_rate: 0,
      additional_charge_commission: 0, note: null, is_deleted: false, created_at: '', updated_at: '',
    })
    setPinfo(null); setSelectedCustomerName('')
  }

  async function handleSave() {
    if (!selected) return
    const { sales_manager: _sm, customer: _cu, ...clean } = selected as never as Record<string, unknown>
    if (selected.id) {
      const { error } = await supabase.from('commission_rates')
        .update({ ...clean, updated_at: new Date().toISOString() }).eq('id', selected.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } =
        clean as { id: unknown; created_at: unknown; updated_at: unknown; [k: string]: unknown }
      const { data, error } = await supabase.from('commission_rates').insert(rest).select().single()
      if (error) { alert('저장 실패: ' + error.message); return }
      if (data) setSelected(data as CommissionRate)
    }
    alert('저장되었습니다.')
    loadRates()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('commission_rates').update({ is_deleted: true }).eq('id', selected.id)
    setSelected(null); setPinfo(null); setSelectedCustomerName(''); loadRates()
  }

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const XLSX = await import('xlsx-js-style')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]
    setXrows(rows.map((r, i) => ({
      no: i + 1, status: '신규',
      start_month: String(r['적용시작월(필수)'] ?? r['적용시작월'] ?? ''),
      end_month: String(r['적용종료월(필수)'] ?? r['적용종료월'] ?? ''),
      customer_seq: String(r['거래처Seq'] ?? ''),
      manager_id: String(r['영업담당자ID'] ?? ''),
      insurance_code: String(r['보험코드(필수)'] ?? r['보험코드'] ?? ''),
      product_name: String(r['제품명'] ?? ''),
      contract_rate: Number(r['수수료율(제약)'] ?? 0),
      add_contract_rate: Number(r['추가수수료율(제약)'] ?? 0),
      charge_rate: Number(r['수수료율(담당)'] ?? 0),
      add_charge_rate: Number(r['추가수수료율(담당)'] ?? 0),
      matched: true,
    })))
    e.target.value = ''
  }

  async function handleExcelSave() {
    const rows = xrows.filter(r => r.matched)
    if (rows.length === 0) { alert('저장할 데이터가 없습니다.'); return }
    const { error } = await supabase.from('commission_rates').insert(rows.map(r => ({
      prescription_start_month: r.start_month, prescription_end_month: r.end_month,
      customer_seq: r.customer_seq ? Number(r.customer_seq) : null,
      rate_type: r.manager_id.toUpperCase() === 'BASIC' ? 'BASIC' : '제품별',
      insurance_code: r.insurance_code || null, product_name: r.product_name || null,
      contract_commission_rate: r.contract_rate, additional_commission_rate: r.add_contract_rate,
      charge_commission_rate: r.charge_rate, additional_charge_commission: r.add_charge_rate,
      is_deleted: false,
    })))
    if (error) { alert('저장 실패: ' + error.message); return }
    alert(`${rows.length}건 저장되었습니다.`)
    setShowModal(false); setXrows([]); loadRates()
  }

  function downloadSample() {
    import('xlsx-js-style').then(XLSX => {
      const headers = ['적용시작월(필수)', '적용종료월(필수)', '거래처Seq', '영업담당자ID', '보험코드(필수)', '제품명', '수수료율(제약)', '추가수수료율(제약)', '수수료율(담당)', '추가수수료율(담당)']
      const ws = XLSX.utils.aoa_to_sheet([headers, ['2026-06', '2999-12', '', 'BASIC', '073001740', '건스모틴정5밀리그램', 55, 5, 55, 0]])
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }))
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      XLSX.writeFile(wb, '엑셀일괄등록_제품수수료율_sample.xlsx')
    })
  }

  function downloadUnmatched() {
    const um = xrows.filter(r => !r.matched)
    if (um.length === 0) { alert('미매칭 데이터가 없습니다.'); return }
    import('xlsx-js-style').then(XLSX => {
      const h = ['순번', '적용시작월', '적용종료월', '거래처Seq', '영업담당자ID', '보험코드', '제품명', '수수료율(제약)', '추가수수료율(제약)', '수수료율(담당)', '추가수수료율(담당)']
      const ws = XLSX.utils.aoa_to_sheet([h, ...um.map(r => [r.no, r.start_month, r.end_month, r.customer_seq, r.manager_id, r.insurance_code, r.product_name, r.contract_rate, r.add_contract_rate, r.charge_rate, r.add_charge_rate])])
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '미매칭')
      XLSX.writeFile(wb, '미매칭_수수료율.xlsx')
    })
  }

  function downloadExcel() {
    import('xlsx-js-style').then(XLSX => {
      const h = ['순번', '적용시작월', '적용종료월', '거래처Seq', '영업담당자ID', '보험코드', '제품명', '수수료율(제약)', '추가수수료율(제약)', '수수료율(담당)', '추가수수료율(담당)']
      const ws = XLSX.utils.aoa_to_sheet([h, ...xrows.map(r => [r.no, r.start_month, r.end_month, r.customer_seq, r.manager_id, r.insurance_code, r.product_name, r.contract_rate, r.add_contract_rate, r.charge_rate, r.add_charge_rate])])
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      XLSX.writeFile(wb, '수수료율일괄등록.xlsx')
    })
  }

  /* 조회 목록 엑셀 다운로드 (필터 적용 전체, 거래처명 포함) */
  async function downloadList() {
    setDownloading(true)
    try {
      const all: CommissionRate[] = []
      let from = 0
      for (;;) {
        let q = supabase.from('commission_rates').select('*')
          .neq('is_deleted', true)
          .order('prescription_start_month', { ascending: false })
        if (filters.salesManager) q = q.ilike('product_name', `%${filters.salesManager}%`)
        if (filters.insuranceCode) q = q.ilike('insurance_code', `%${filters.insuranceCode}%`)
        const { data } = await q.range(from, from + 999)
        const chunk = (data || []) as CommissionRate[]
        all.push(...chunk)
        if (chunk.length < 1000) break
        from += 1000
      }
      if (all.length === 0) { alert('다운로드할 데이터가 없습니다.'); return }

      /* 거래처Seq → 거래처명 매핑 (customer_seq = sc_code 정수값) */
      const seqs = [...new Set(all.map(r => r.customer_seq).filter((v): v is number => !!v))]
      const seqName: Record<number, string> = {}
      for (let i = 0; i < seqs.length; i += 500) {
        const batch = seqs.slice(i, i + 500).map(String)
        const { data } = await supabase.from('customers').select('sc_code,name').in('sc_code', batch)
        ;(data || []).forEach((c: { sc_code: string | null; name: string }) => {
          if (c.sc_code) seqName[Number(c.sc_code)] = c.name
        })
      }

      const XLSX = await import('xlsx-js-style')
      const headers = ['적용시작월', '적용종료월', '구분', '거래처Seq', '거래처', '보험코드', '제품명', '제조사', '제약수수료율', '제약추가', '제약합계', '담당수수료율', '담당추가', '담당합계', '비고']
      const aoa: (string | number | null)[][] = [headers, ...all.map(r => [
        r.prescription_start_month, r.prescription_end_month, r.rate_type, r.customer_seq,
        r.customer_seq ? (seqName[r.customer_seq] || '') : '',
        r.insurance_code, r.product_name, r.manufacturer_name,
        r.contract_commission_rate, r.additional_commission_rate,
        Number((r.contract_commission_rate + r.additional_commission_rate).toFixed(2)),
        r.charge_commission_rate, r.additional_charge_commission,
        Number((r.charge_commission_rate + r.additional_charge_commission).toFixed(2)),
        r.note || '',
      ])]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [10, 10, 8, 10, 24, 14, 28, 16, 11, 9, 10, 11, 9, 10, 16].map(w => ({ wch: w }))
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '월별수수료율')
      XLSX.writeFile(wb, `월별수수료율_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setDownloading(false)
    }
  }

  const SET = (field: keyof CommissionRate, val: unknown) =>
    setSelected(s => s ? { ...s, [field]: val } : s)

  return (
    <div className="flex h-full">

      {/* ── 목록 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">월별 수수료율 관리</span>
          <Input placeholder="제품명" value={filters.salesManager} onChange={e => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-28" onKeyDown={e => e.key === 'Enter' && loadRates()} />
          <Input placeholder="보험코드" value={filters.insuranceCode} onChange={e => setFilters(f => ({ ...f, insuranceCode: e.target.value }))} className="h-7 text-xs w-28" onKeyDown={e => e.key === 'Enter' && loadRates()} />
          <button onClick={loadRates} className="h-7 px-3 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
            <Search className="h-3 w-3" /> 조회
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={openNew} className="h-7 px-3 text-xs rounded bg-green-600 text-white hover:bg-green-700">신규입력</button>
            <button onClick={() => setShowModal(true)} className="h-7 px-3 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" /> Excel등록
            </button>
            <button onClick={downloadList} disabled={downloading} className="h-7 px-3 text-xs rounded border border-green-600 text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 flex items-center gap-1">
              <Download className="h-3 w-3" /> {downloading ? '다운로드 중...' : 'Excel다운로드'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', '적용시작월', '적용종료월', '구분', '거래처Seq', '거래처', '보험코드', '제품명', '제조사', '제약수수료율', '추가', '제약합계', '담당수수료율', '추가', '담당합계', '비고'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : dbError ? (
                <tr><td colSpan={16} className="text-center py-8 text-red-500">오류: {dbError}</td></tr>
              ) : rates.length === 0 ? (
                <tr><td colSpan={16} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : rates.map((r, i) => (
                <tr key={r.id}
                  onClick={() => {
                    setSelected(r)
                    setSelectedCustomerName((r as never as Record<string, Record<string, string>>).customer?.name || '')
                    if (r.insurance_code) lookupProduct(r.insurance_code)
                    else setPinfo(null)
                  }}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === r.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1">{r.prescription_start_month}</td>
                  <td className="px-2 py-1">{r.prescription_end_month}</td>
                  <td className="px-2 py-1 text-gray-500">{r.rate_type}</td>
                  <td className="px-2 py-1">{r.customer_seq}</td>
                  <td className="px-2 py-1">{(r as never as Record<string, Record<string, string>>).customer?.name || ''}</td>
                  <td className="px-2 py-1 font-mono">{r.insurance_code}</td>
                  <td className="px-2 py-1 max-w-[140px] truncate">{r.product_name}</td>
                  <td className="px-2 py-1">{r.manufacturer_name}</td>
                  <td className="px-2 py-1 text-right text-blue-600">{r.contract_commission_rate}%</td>
                  <td className="px-2 py-1 text-right text-blue-400">{r.additional_commission_rate}%</td>
                  <td className="px-2 py-1 text-right text-blue-700 font-medium">{(r.contract_commission_rate + r.additional_commission_rate).toFixed(2)}%</td>
                  <td className="px-2 py-1 text-right text-green-600">{r.charge_commission_rate}%</td>
                  <td className="px-2 py-1 text-right text-green-400">{r.additional_charge_commission}%</td>
                  <td className="px-2 py-1 text-right text-green-700 font-medium">{(r.charge_commission_rate + r.additional_charge_commission).toFixed(2)}%</td>
                  <td className="px-2 py-1 text-gray-400">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{rates.length}건 조회</div>
      </div>

      {/* ── 입력 패널 ── */}
      {selected && (
        <div className="w-[530px] border-l border-gray-200 bg-white flex flex-col shrink-0 text-[11px]">
          <div className="px-3 py-1.5 bg-[#1a3a6b] text-white flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold tracking-wide">제품정보 - 수수료율 입력</span>
            <button onClick={() => { setSelected(null); setPinfo(null); setSelectedCustomerName('') }}
              className="text-white/60 hover:text-white text-base leading-none">&gt;&gt;</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {/* 적용기간 + 영업담당자 */}
            <div className={RC}>
              <label className={cn(LB, 'w-[64px]')}>적용 기 간</label>
              <Input type="month" value={selected.prescription_start_month}
                onChange={e => SET('prescription_start_month', e.target.value)}
                className={cn(FL, 'w-[110px]')} />
              <span className="text-gray-400 px-0.5">~</span>
              <Input type="month" value={selected.prescription_end_month}
                onChange={e => SET('prescription_end_month', e.target.value)}
                className={cn(FL, 'w-[110px]')} />
              <span className="flex-1" />
              <label className={cn(LB, 'w-[60px] text-right')}>영업담당자</label>
              <input className={cn(FL, 'w-[80px]')} placeholder="기본수수료" readOnly />
              <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" />
            </div>

            <div className="border-t border-gray-100" />

            {/* 보험코드 / 제품자체코드 */}
            <div className="grid grid-cols-2 gap-x-2">
              <div className={RC}>
                <label className={cn(LB, 'w-[56px]')}>보 험 코 드</label>
                <div className="flex-1 flex items-center gap-0.5">
                  <input className={cn(FL, 'flex-1')}
                    value={selected.insurance_code || ''}
                    onChange={e => { SET('insurance_code', e.target.value); lookupProduct(e.target.value) }} />
                  {selected.insurance_code && (
                    <X className="h-3 w-3 text-gray-400 cursor-pointer shrink-0"
                      onClick={() => { SET('insurance_code', null); SET('product_name', null); SET('manufacturer_name', null); setPinfo(null) }} />
                  )}
                  <Search className="h-3.5 w-3.5 text-blue-500 cursor-pointer shrink-0"
                    onClick={() => setShowProductSearch(true)} />
                </div>
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[68px]')}>제품자체코드</label>
                <input className={cn(FL, 'flex-1')} />
              </div>
            </div>

            {/* 제품 / 거래처 */}
            <div className="grid grid-cols-2 gap-x-2">
              <div className={RC}>
                <label className={cn(LB, 'w-[56px]')}>제 품</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.product_name || selected.product_name || ''} readOnly />
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[68px]')}>거 래 처</label>
                <input className={cn(FL, 'flex-1')} value={selectedCustomerName} readOnly />
                <Search className="h-3.5 w-3.5 text-blue-500 cursor-pointer shrink-0"
                  onClick={() => setShowCustomerSearch(true)} />
              </div>
            </div>

            {/* 규격/단위 / 제형구분 */}
            <div className="grid grid-cols-2 gap-x-2">
              <div className={RC}>
                <label className={cn(LB, 'w-[56px]')}>규격/단위</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.specification || ''} readOnly />
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[68px]')}>제 형 구 분</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.dosage_form || ''} readOnly />
              </div>
            </div>

            {/* 제조사 / 매출금액 */}
            <div className="grid grid-cols-2 gap-x-2">
              <div className={RC}>
                <label className={cn(LB, 'w-[56px]')}>제 조 사</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.manufacturer_name || selected.manufacturer_name || ''} readOnly />
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[68px]')}>매 출 금 액</label>
                <input className={cn(FL, 'flex-1 bg-gray-50 text-right')} value={pinfo?.sale_price?.toLocaleString() ?? ''} readOnly />
              </div>
            </div>

            {/* 급여구분 / 약품구분 */}
            <div className="grid grid-cols-2 gap-x-2">
              <div className={RC}>
                <label className={cn(LB, 'w-[56px]')}>급 여 구 분</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.insurance_type || ''} readOnly />
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[68px]')}>약 품 구 분</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.drug_type || ''} readOnly />
              </div>
            </div>

            {/* 성분코드 / 성분분류명 */}
            <div className="grid grid-cols-2 gap-x-2">
              <div className={RC}>
                <label className={cn(LB, 'w-[56px]')}>성 분 코 드</label>
                <input className={cn(FL, 'flex-1 bg-gray-50 font-mono')} value={pinfo?.ingredient_code || ''} readOnly />
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[68px]')}>성분분류명</label>
                <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.ingredient_category || ''} readOnly />
              </div>
            </div>

            {/* 성분명 */}
            <div className={RC}>
              <label className={cn(LB, 'w-[56px]')}>성 분 명</label>
              <input className={cn(FL, 'flex-1 bg-gray-50')} value={pinfo?.ingredient_name || ''} readOnly />
            </div>

            {/* 보험약가 변경내역 */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 border-b border-gray-200">보험약가 변경내역</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-2 py-0.5 text-left font-semibold text-gray-600 w-24">적용일자</th>
                    <th className="px-2 py-0.5 text-left font-semibold text-gray-600 w-16">급여구분</th>
                    <th className="px-2 py-0.5 text-right font-semibold text-gray-600">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {pinfo?.sale_price ? (
                    <tr>
                      <td className="px-2 py-0.5">{pinfo.final_price_date || '-'}</td>
                      <td className="px-2 py-0.5">{pinfo.insurance_type}</td>
                      <td className="px-2 py-0.5 text-right">{pinfo.sale_price.toLocaleString()}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={3} className="px-2 py-2 text-center text-gray-300 text-[10px]">-</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 수수료율 */}
            <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div className={RC}>
                <label className={cn(LB, 'w-[64px]')}>제약 수수료율</label>
                <input type="number" step="0.01" className={cn(FL, 'w-[56px] text-right')}
                  value={selected.contract_commission_rate}
                  onChange={e => SET('contract_commission_rate', Number(e.target.value))} />
              </div>
              <div className={RC}>
                <span className="text-blue-600 font-bold">▶</span>
                <label className={cn(LB, 'w-[64px]')}>추가수수료율</label>
                <input type="number" step="0.01" className={cn(FL, 'w-[56px] text-right')}
                  value={selected.additional_commission_rate}
                  onChange={e => SET('additional_commission_rate', Number(e.target.value))} />
              </div>
              <div className={RC}>
                <label className={cn(LB, 'w-[64px]')}>담당 수수료율</label>
                <input type="number" step="0.01" className={cn(FL, 'w-[56px] text-right')}
                  value={selected.charge_commission_rate}
                  onChange={e => SET('charge_commission_rate', Number(e.target.value))} />
              </div>
              <div className={RC}>
                <span className="text-blue-600 font-bold">▶</span>
                <label className={cn(LB, 'w-[64px]')}>추가수수료율</label>
                <input type="number" step="0.01" className={cn(FL, 'w-[56px] text-right')}
                  value={selected.additional_charge_commission}
                  onChange={e => SET('additional_charge_commission', Number(e.target.value))} />
              </div>
            </div>

            {/* 비고 */}
            <div className={cn(RC, 'pt-0.5')}>
              <label className={cn(LB, 'w-[56px]')}>비 고</label>
              <input className={cn(FL, 'flex-1')} value={selected.note || ''}
                onChange={e => SET('note', e.target.value)} />
            </div>
          </div>

          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-center gap-2 shrink-0">
            <button onClick={openNew} className="h-7 px-5 text-xs border border-gray-400 rounded bg-[#f0f0f0] hover:bg-gray-200">신규입력</button>
            <button onClick={handleSave} className="h-7 px-5 text-xs border border-gray-400 rounded bg-[#f0f0f0] hover:bg-gray-200">저장(F5)</button>
            <button onClick={handleDelete} className="h-7 px-5 text-xs border border-gray-400 rounded bg-[#f0f0f0] hover:bg-gray-200">삭제</button>
          </div>
        </div>
      )}

      {/* ── 보험코드/제품 검색 팝업 (공용) ── */}
      <ProductSearchDialog
        open={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelect={ps => { if (ps[0]) applyProduct(ps[0]); setShowProductSearch(false) }}
      />

      {/* ── 거래처 검색 팝업 (공용) ── */}
      <CustomerSearchDialog
        open={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={c => { applyCustomer(c); setShowCustomerSearch(false) }}
      />

      {/* ── Excel 일괄등록 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/30">
          <div className="bg-white shadow-2xl flex flex-col border border-gray-300" style={{ width: 960, maxHeight: 'calc(100vh - 64px)' }}>
            <div className="px-3 py-1.5 bg-[#1a3a6b] text-white flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold tracking-wide">수수료율 엑셀 일괄등록</span>
              <button onClick={() => { setShowModal(false); setXrows([]) }} className="text-white/60 hover:text-white text-base leading-none">×</button>
            </div>
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-1 shrink-0">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">수수료율 엑셀 일괄등록</span>
            </div>
            <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2 shrink-0">
              <button onClick={downloadSample} className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">샘플양식</button>
              <button onClick={() => fileRef.current?.click()} className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">불러오기</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileLoad} />
              <button onClick={handleExcelSave} disabled={xrows.length === 0} className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40">저장(F5)</button>
              <button onClick={downloadExcel} disabled={xrows.length === 0} className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40">Excel</button>
              <button onClick={downloadUnmatched} className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">미매칭엑셀</button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-200">
                    {['순번', '구분', '적용시작월(엑셀)', '적용종료월(엑셀)', '거래처Seq(엑셀)', '영업담당자ID(엑셀)', '보험코드(엑셀)', '제품(엑셀)', '수수료율(제약)', '추가수수료율(제약)', '수수료율(담당)', '추가수수료율(담당)'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap border-r border-gray-100 last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {xrows.length === 0 ? (
                    <tr><td colSpan={12} className="text-center py-10 text-gray-400">엑셀 파일을 불러오세요.</td></tr>
                  ) : xrows.map(r => (
                    <tr key={r.no} className={cn('border-b border-gray-100', !r.matched ? 'bg-red-50' : r.no % 2 === 0 ? 'bg-gray-50/40' : '')}>
                      <td className="px-2 py-1 text-gray-400">{r.no}</td>
                      <td className="px-2 py-1">{r.status}</td>
                      <td className="px-2 py-1">{r.start_month}</td>
                      <td className="px-2 py-1">{r.end_month}</td>
                      <td className="px-2 py-1">{r.customer_seq}</td>
                      <td className="px-2 py-1">{r.manager_id}</td>
                      <td className="px-2 py-1 font-mono">{r.insurance_code}</td>
                      <td className="px-2 py-1 max-w-[160px] truncate">{r.product_name}</td>
                      <td className="px-2 py-1 text-right">{r.contract_rate}</td>
                      <td className="px-2 py-1 text-right">{r.add_contract_rate}</td>
                      <td className="px-2 py-1 text-right">{r.charge_rate}</td>
                      <td className="px-2 py-1 text-right">{r.add_charge_rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
