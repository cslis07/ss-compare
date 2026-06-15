'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PriceHistory {
  id: string
  applied_date: string | null
  billing_type: string | null
  price: number | null
}

interface Props {
  open: boolean
  /** 제품명/보험코드 초기 검색어 */
  initialQuery?: string
  /** true면 체크박스로 여러 제품 선택 가능 */
  multi?: boolean
  onClose: () => void
  /** 선택된 제품 배열 (단일 선택도 배열로 전달) */
  onSelect: (products: Product[]) => void
}

/** EMR 스타일 제품 검색 팝업 — 제조사명/제품명 검색, 가격 적용이력 패널, 선택적용 */
export function ProductSearchDialog({ open, initialQuery = '', multi = false, onClose, onSelect }: Props) {
  const supabase = createClient()
  const [manufacturer, setManufacturer] = useState('')
  const [query, setQuery] = useState(initialQuery)
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [history, setHistory] = useState<PriceHistory[]>([])
  const queryRef = useRef<HTMLInputElement>(null)

  const doSearch = useCallback(async (mf: string, q: string) => {
    setLoading(true)
    setSearched(true)
    let req = supabase.from('products').select('*').eq('is_deleted', false).order('product_name').limit(300)
    if (mf.trim()) req = req.ilike('manufacturer_name', `%${mf.trim()}%`)
    if (q.trim()) req = req.or(`product_name.ilike.%${q.trim()}%,insurance_code.ilike.%${q.trim()}%,custom_code.ilike.%${q.trim()}%`)
    const { data } = await req
    setRows((data || []) as Product[])
    setLoading(false)
  }, [supabase])

  /* 열릴 때 초기화 + 초기 검색어 있으면 자동 조회 */
  useEffect(() => {
    if (!open) return
    setManufacturer('')
    setQuery(initialQuery)
    setChecked(new Set())
    setFocusedId(null)
    setHistory([])
    setRows([])
    setSearched(false)
    setTimeout(() => queryRef.current?.focus(), 50)
    if (initialQuery.trim()) doSearch('', initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery])

  /* F1 = 조회 단축키 */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); doSearch(manufacturer, query) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, manufacturer, query, doSearch, onClose])

  /* 행 클릭 → 가격 적용이력 로드 */
  const focusRow = async (p: Product) => {
    setFocusedId(p.id)
    const { data } = await supabase.from('product_price_history')
      .select('id, applied_date, billing_type, price')
      .eq('product_id', p.id)
      .order('applied_date', { ascending: false })
      .limit(20)
    setHistory((data || []) as PriceHistory[])
  }

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        if (!multi) next.clear()
        next.add(id)
      }
      return next
    })
  }

  const applySelection = () => {
    let selected = rows.filter(r => checked.has(r.id))
    if (selected.length === 0 && focusedId) selected = rows.filter(r => r.id === focusedId)
    if (selected.length === 0) { alert('제품을 선택하세요.'); return }
    onSelect(selected)
  }

  if (!open) return null

  const TH = 'px-2 py-1 text-center text-gray-600 font-medium border border-gray-300 bg-gray-100 whitespace-nowrap'
  const TD = 'px-2 py-0.5 border border-gray-200 whitespace-nowrap'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white shadow-2xl border border-gray-400 flex flex-col rounded"
        style={{ width: 1080, maxWidth: '95vw', height: 560, maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}>

        {/* 타이틀바 */}
        <div className="px-3 py-1.5 bg-[#1a3a6b] text-white flex items-center justify-between shrink-0 rounded-t">
          <span className="text-xs font-semibold">제품 검색</span>
          <button onClick={onClose} className="text-white/70 hover:text-white text-base leading-none">×</button>
        </div>

        {/* 검색조건 */}
        <div className="px-3 py-2 border-b border-gray-300 bg-blue-50/40 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-600 shrink-0">제조사명</label>
            <input value={manufacturer} onChange={e => setManufacturer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(manufacturer, query)}
              className="h-7 text-xs border border-gray-300 rounded px-2 w-36" />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <label className="text-xs text-gray-600 shrink-0">제 품 명</label>
            <input ref={queryRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(manufacturer, query)}
              placeholder="제품명 / 보험코드 / 자체코드"
              className="h-7 text-xs border border-gray-300 rounded px-2 flex-1 max-w-md" />
          </div>
          <button onClick={() => doSearch(manufacturer, query)}
            className="h-7 px-4 text-xs border border-gray-400 rounded bg-white hover:bg-gray-100 flex items-center gap-1 shrink-0">
            <Search className="h-3 w-3" /> 조회(F1)
          </button>
          <button onClick={applySelection}
            className="h-7 px-4 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 shrink-0">
            선택적용
          </button>
        </div>

        {/* 본문: 결과 테이블 + 가격이력 패널 */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 overflow-auto">
            <table className="text-[11px] border-collapse w-full min-w-max">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={cn(TH, 'w-10')}>순번</th>
                  <th className={cn(TH, 'w-8')}>
                    <input type="checkbox" disabled={!multi}
                      checked={multi && rows.length > 0 && checked.size === rows.length}
                      onChange={e => setChecked(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} />
                  </th>
                  <th className={cn(TH, 'min-w-[90px]')}>제조사</th>
                  <th className={cn(TH, 'min-w-[90px]')}>정산처</th>
                  <th className={cn(TH, 'w-24')}>보험코드</th>
                  <th className={cn(TH, 'w-20')}>자체코드</th>
                  <th className={cn(TH, 'min-w-[230px]')}>제품</th>
                  <th className={cn(TH, 'w-16')}>제형</th>
                  <th className={cn(TH, 'w-14')}>급여</th>
                  <th className={cn(TH, 'w-20')}>보험가</th>
                  <th className={cn(TH, 'min-w-[70px]')}>비고</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-xs">조회 중...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-xs">
                    {searched ? '검색 결과가 없습니다.' : '검색어 입력 후 조회(F1)를 누르세요.'}
                  </td></tr>
                ) : rows.map((p, i) => (
                  <tr key={p.id}
                    onClick={() => focusRow(p)}
                    onDoubleClick={() => onSelect([p])}
                    className={cn('cursor-pointer border-b border-gray-100',
                      focusedId === p.id ? 'bg-yellow-50' : checked.has(p.id) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                      'hover:bg-blue-50/60')}>
                    <td className={cn(TD, 'text-center text-gray-400')}>{i + 1}</td>
                    <td className={cn(TD, 'text-center')} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggleCheck(p.id)} />
                    </td>
                    <td className={TD}>{p.manufacturer_name}</td>
                    <td className={TD}>{p.settlement_place || ''}</td>
                    <td className={cn(TD, 'font-mono text-blue-700')}>{p.insurance_code}</td>
                    <td className={cn(TD, 'font-mono text-gray-500')}>{p.custom_code || ''}</td>
                    <td className={cn(TD, 'max-w-[280px] truncate')}>{p.product_name}</td>
                    <td className={cn(TD, 'text-center')}>{p.dosage_form || ''}</td>
                    <td className={cn(TD, 'text-center')}>{p.has_insurance ? '급여' : p.is_non_covered ? '비급여' : '-'}</td>
                    <td className={cn(TD, 'text-right')}>{p.final_price?.toLocaleString() ?? ''}</td>
                    <td className={cn(TD, 'max-w-[100px] truncate text-gray-400')}>{p.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 가격 적용이력 */}
          <div className="w-48 border-l border-gray-300 shrink-0 overflow-auto bg-gray-50/30">
            <table className="text-[11px] border-collapse w-full">
              <thead className="sticky top-0">
                <tr>
                  <th className={TH}>적용일자</th>
                  <th className={TH}>금액</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={2} className="text-center py-4 text-gray-300 text-[10px]">
                    {focusedId ? '이력 없음' : '제품 클릭 시 표시'}
                  </td></tr>
                ) : history.map(h => (
                  <tr key={h.id} className="bg-white">
                    <td className={cn(TD, 'text-center')}>{h.applied_date || ''}</td>
                    <td className={cn(TD, 'text-right')}>{h.price?.toLocaleString() ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-3 py-1.5 border-t border-gray-300 text-[11px] text-gray-400 shrink-0 flex items-center">
          <span>{rows.length}건</span>
          <span className="ml-auto">더블클릭=바로 선택 · {multi ? '체크 후 선택적용=여러 건 추가' : '행 클릭 후 선택적용'}</span>
        </div>
      </div>
    </div>
  )
}
