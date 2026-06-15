'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/lib/types'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  /** 거래처명 초기 검색어 */
  initialQuery?: string
  onClose: () => void
  onSelect: (customer: Customer) => void
}

interface Filters {
  name: string
  businessNumber: string
  address: string
  customCode: string
  managerName: string
  csoName: string
}

const EMPTY_FILTERS: Filters = { name: '', businessNumber: '', address: '', customCode: '', managerName: '', csoName: '' }

/** 영업담당자·CSO 이름을 조인으로 포함한 거래처 행 */
type CustomerRow = Customer & {
  sales_manager?: { name: string } | null
  cso_company?: { name: string } | null
  cso2_company?: { name: string } | null
}

/** 영업담당자/CSO 필터 시 inner 조인으로 해당 거래처만 조회 */
function buildSelect(filterManager: boolean, filterCso: boolean): string {
  return (
    `*, sales_manager:users!sales_manager_id${filterManager ? '!inner' : ''}(name), ` +
    `cso_company:cso_companies!cso_company_id${filterCso ? '!inner' : ''}(name), ` +
    `cso2_company:cso_companies!cso2_company_id(name)`
  )
}

/** EMR 스타일 거래처 검색 팝업 — 거래처명/사업자번호/주소/자체코드/영업담당자/CSO 검색 */
export function CustomerSearchDialog({ open, initialQuery = '', onClose, onSelect }: Props) {
  const supabase = createClient()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const setFl = (k: keyof Filters, v: string) => setFilters(p => ({ ...p, [k]: v }))

  const doSearch = useCallback(async (f: Filters) => {
    setLoading(true)
    setSearched(true)
    const mgr = f.managerName.trim()
    const cso = f.csoName.trim()
    let req = supabase.from('customers').select(buildSelect(!!mgr, !!cso)).eq('is_deleted', false).order('name').limit(300)
    if (f.name.trim()) req = req.ilike('name', `%${f.name.trim()}%`)
    if (f.businessNumber.trim()) req = req.ilike('business_number', `%${f.businessNumber.trim()}%`)
    if (f.address.trim()) req = req.or(`road_address.ilike.%${f.address.trim()}%,address.ilike.%${f.address.trim()}%,detail_address.ilike.%${f.address.trim()}%`)
    if (f.customCode.trim()) req = req.ilike('custom_code', `%${f.customCode.trim()}%`)
    if (mgr) req = req.ilike('sales_manager.name', `%${mgr}%`)
    if (cso) req = req.ilike('cso_company.name', `%${cso}%`)
    const { data } = await req
    setRows((data || []) as unknown as CustomerRow[])
    setLoading(false)
  }, [supabase])

  /* 열릴 때 초기화 + 초기 검색어 자동 조회 */
  useEffect(() => {
    if (!open) return
    const init = { ...EMPTY_FILTERS, name: initialQuery }
    setFilters(init)
    setRows([])
    setFocusedId(null)
    setSearched(false)
    setTimeout(() => nameRef.current?.focus(), 50)
    if (initialQuery.trim()) doSearch(init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery])

  /* F1 = 조회 단축키 */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); doSearch(filters) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filters, doSearch, onClose])

  const applySelection = () => {
    const sel = rows.find(r => r.id === focusedId)
    if (!sel) { alert('거래처를 선택하세요.'); return }
    onSelect(sel)
  }

  if (!open) return null

  const TH = 'px-2 py-1 text-center text-gray-600 font-medium border border-gray-300 bg-gray-100 whitespace-nowrap'
  const TD = 'px-2 py-0.5 border border-gray-200 whitespace-nowrap'
  const FL = 'h-7 text-xs border border-gray-300 rounded px-2'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white shadow-2xl border border-gray-400 flex flex-col rounded"
        style={{ width: 1400, maxWidth: '96vw', height: 600, maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>

        {/* 타이틀바 */}
        <div className="px-3 py-1.5 bg-[#1a3a6b] text-white flex items-center justify-between shrink-0 rounded-t">
          <span className="text-xs font-semibold">거래처 검색</span>
          <button onClick={onClose} className="text-white/70 hover:text-white text-base leading-none">×</button>
        </div>

        {/* 검색조건 2행 */}
        <div className="px-3 py-2 border-b border-gray-300 bg-blue-50/40 shrink-0">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-600 w-16 shrink-0">거래처명</label>
              <input ref={nameRef} value={filters.name} onChange={e => setFl('name', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(filters)} className={cn(FL, 'w-44')} />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-600 w-16 shrink-0">사업자번호</label>
              <input value={filters.businessNumber} onChange={e => setFl('businessNumber', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(filters)} className={cn(FL, 'w-32')} />
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <label className="text-xs text-gray-600 w-8 shrink-0">주소</label>
              <input value={filters.address} onChange={e => setFl('address', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(filters)} className={cn(FL, 'flex-1 max-w-xs')} />
            </div>
            <button onClick={() => doSearch(filters)}
              className="h-7 px-4 text-xs border border-gray-400 rounded bg-white hover:bg-gray-100 flex items-center gap-1 shrink-0">
              <Search className="h-3 w-3" /> 조회(F1)
            </button>
            <button onClick={applySelection}
              className="h-7 px-4 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 shrink-0">
              선택적용
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-600 w-16 shrink-0">자체코드</label>
              <input value={filters.customCode} onChange={e => setFl('customCode', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(filters)} className={cn(FL, 'w-44')} />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-600 w-20 shrink-0">영업담당자명</label>
              <input value={filters.managerName} onChange={e => setFl('managerName', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(filters)} className={cn(FL, 'w-28')} />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-600 w-16 shrink-0">CSO업체명</label>
              <input value={filters.csoName} onChange={e => setFl('csoName', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(filters)} className={cn(FL, 'w-28')} />
            </div>
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="text-[11px] border-collapse min-w-max w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={cn(TH, 'w-10')}>순번</th>
                <th className={cn(TH, 'w-20')}>SC코드</th>
                <th className={cn(TH, 'w-28')}>사업자번호</th>
                <th className={cn(TH, 'w-20')}>자체코드</th>
                <th className={cn(TH, 'min-w-[160px]')}>거래처</th>
                <th className={cn(TH, 'w-20')}>대표자명</th>
                <th className={cn(TH, 'w-20')}>거래처종류</th>
                <th className={cn(TH, 'w-16')}>부서1</th>
                <th className={cn(TH, 'w-16')}>부서2</th>
                <th className={cn(TH, 'w-16')}>부서3</th>
                <th className={cn(TH, 'w-24')}>영업담당자</th>
                <th className={cn(TH, 'w-24')}>CSO업체</th>
                <th className={cn(TH, 'w-24')}>CSO2업체</th>
                <th className={cn(TH, 'min-w-[180px]')}>도로명주소</th>
                <th className={cn(TH, 'min-w-[120px]')}>상세주소</th>
                <th className={cn(TH, 'w-28')}>전화번호</th>
                <th className={cn(TH, 'w-20')}>병상규모</th>
                <th className={cn(TH, 'w-24')}>표시과목</th>
                <th className={cn(TH, 'w-24')}>거래시작일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={19} className="text-center py-8 text-gray-400 text-xs">조회 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={19} className="text-center py-8 text-gray-400 text-xs">
                  {searched ? '검색 결과가 없습니다.' : '검색어 입력 후 조회(F1)를 누르세요.'}
                </td></tr>
              ) : rows.map((c, i) => (
                <tr key={c.id}
                  onClick={() => setFocusedId(c.id)}
                  onDoubleClick={() => onSelect(c)}
                  className={cn('cursor-pointer border-b border-gray-100',
                    focusedId === c.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                    'hover:bg-blue-50/60')}>
                  <td className={cn(TD, 'text-center text-gray-400')}>{i + 1}</td>
                  <td className={cn(TD, 'font-mono text-blue-700')}>{c.sc_code || ''}</td>
                  <td className={cn(TD, 'font-mono')}>{c.business_number || ''}</td>
                  <td className={cn(TD, 'font-mono text-gray-500')}>{c.custom_code || ''}</td>
                  <td className={cn(TD, 'font-medium')}>{c.name}</td>
                  <td className={TD}>{c.representative || ''}</td>
                  <td className={cn(TD, 'text-center')}>{c.customer_type}</td>
                  <td className={cn(TD, 'text-center')}>{c.department1 || ''}</td>
                  <td className={cn(TD, 'text-center')}>{c.department2 || ''}</td>
                  <td className={cn(TD, 'text-center')}>{c.department3 || ''}</td>
                  <td className={TD}>{c.sales_manager?.name || ''}</td>
                  <td className={TD}>{c.cso_company?.name || ''}</td>
                  <td className={TD}>{c.cso2_company?.name || ''}</td>
                  <td className={cn(TD, 'max-w-[220px] truncate')}>{c.road_address || c.address || ''}</td>
                  <td className={cn(TD, 'max-w-[150px] truncate')}>{c.detail_address || ''}</td>
                  <td className={TD}>{c.phone || ''}</td>
                  <td className={cn(TD, 'text-center')}>{c.bed_scale || ''}</td>
                  <td className={cn(TD, 'text-center')}>{c.display_subject || ''}</td>
                  <td className={cn(TD, 'text-center')}>{c.prescription_start_date || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 푸터 */}
        <div className="px-3 py-1.5 border-t border-gray-300 text-[11px] text-gray-400 shrink-0 flex items-center">
          <span>{rows.length}건</span>
          <span className="ml-auto">더블클릭=바로 선택 · 행 클릭 후 선택적용</span>
        </div>
      </div>
    </div>
  )
}
