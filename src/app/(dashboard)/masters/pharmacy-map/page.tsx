'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Customer, User, CSOCompany } from '@/lib/types'
import { Search, FileSpreadsheet, X, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'

/* ── 약국 링크 파싱 ── */
interface PharmacyLink { id: string; name: string; sc_code: string; business_number: string; address: string }

function parsePharmacyLinks(note: string | null): PharmacyLink[] {
  if (!note) return []
  try {
    const parsed = JSON.parse(note)
    return Array.isArray(parsed.pharmacy_links) ? parsed.pharmacy_links : []
  } catch { return [] }
}

function serializeNote(existing: string | null, links: PharmacyLink[]): string {
  try {
    const base = existing ? JSON.parse(existing) : {}
    return JSON.stringify({ ...base, pharmacy_links: links })
  } catch {
    return JSON.stringify({ pharmacy_links: links })
  }
}

/* ════════════ MAIN ════════════ */
export default function PharmacyMapPage() {
  const supabase = createClient()

  /* 데이터 */
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pharmacies, setPharmacies] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [csoList, setCsoList] = useState<CSOCompany[]>([])
  const [loading, setLoading] = useState(true)

  /* 선택 */
  const [selected, setSelected] = useState<Customer | null>(null)

  /* 필터 */
  const [filters, setFilters] = useState({
    name: '', address: '', managerName: '', businessNumber: '',
    customCode: '', csoName: '', onlyWithPharmacy: false,
  })

  /* 문전약국 모달 */
  const [showModal, setShowModal] = useState(false)
  const [modalLinks, setModalLinks] = useState<PharmacyLink[]>([])
  const [pharmSearch, setPharmSearch] = useState('')
  const [saving, setSaving] = useState(false)

  /* 영업담당자 검색 팝업 */
  const [showManagerSearch, setShowManagerSearch] = useState(false)
  const [managerQuery, setManagerQuery] = useState('')

  /* CSO 검색 팝업 */
  const [showCsoSearch, setShowCsoSearch] = useState(false)
  const [csoQuery, setCsoQuery] = useState('')

  /* ── 초기 로드 ── */
  useEffect(() => {
    const load = async () => {
      const [{ data: u }, { data: c }, { data: pharm }] = await Promise.all([
        supabase.from('users').select('*').eq('is_active', true).order('name'),
        supabase.from('cso_companies').select('*').eq('is_deleted', false).order('name'),
        supabase.from('customers').select('*').eq('is_deleted', false).eq('customer_type', '약국').order('name'),
      ])
      setUsers(u ?? [])
      setCsoList(c ?? [])
      setPharmacies(pharm ?? [])
      await loadCustomers(filters)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCustomers = useCallback(async (f: typeof filters) => {
    setLoading(true)
    let q = supabase.from('customers').select('*').eq('is_deleted', false).order('name')
    if (f.name)           q = q.ilike('name',            `%${f.name}%`)
    if (f.businessNumber) q = q.ilike('business_number', `%${f.businessNumber}%`)
    if (f.customCode)     q = q.ilike('custom_code',     `%${f.customCode}%`)
    if (f.address)        q = q.or(`road_address.ilike.%${f.address}%,detail_address.ilike.%${f.address}%`)
    const { data } = await q
    let rows = data ?? []
    if (f.managerName) {
      const uid = users.filter(u => u.name.includes(f.managerName)).map(u => u.id)
      rows = rows.filter(r => uid.includes(r.sales_manager_id ?? ''))
    }
    if (f.csoName) {
      const cids = csoList.filter(c => c.name.includes(f.csoName)).map(c => c.id)
      rows = rows.filter(r => cids.includes(r.cso_company_id ?? ''))
    }
    if (f.onlyWithPharmacy) {
      rows = rows.filter(r => parsePharmacyLinks(r.note).length > 0)
    }
    setCustomers(rows)
    setLoading(false)
  }, [supabase, users, csoList])

  const handleSearch = () => loadCustomers(filters)

  /* ── 문전약국 모달 오픈 ── */
  const openModal = () => {
    if (!selected) return
    setModalLinks(parsePharmacyLinks(selected.note))
    setPharmSearch('')
    setShowModal(true)
  }

  /* ── 약국 추가 ── */
  const addPharmacy = (p: Customer) => {
    if (modalLinks.some(l => l.id === p.id)) return
    setModalLinks(prev => [...prev, {
      id: p.id,
      name: p.name,
      sc_code: p.sc_code ?? '',
      business_number: p.business_number ?? '',
      address: [p.road_address, p.detail_address].filter(Boolean).join(' '),
    }])
  }

  /* ── 약국 제거 ── */
  const removePharmacy = (id: string) => setModalLinks(prev => prev.filter(l => l.id !== id))

  /* ── 저장 ── */
  const saveLinks = async () => {
    if (!selected) return
    setSaving(true)
    const newNote = serializeNote(selected.note, modalLinks)
    const { error } = await supabase
      .from('customers')
      .update({ note: newNote, updated_at: new Date().toISOString() })
      .eq('id', selected.id)
    setSaving(false)
    if (error) { alert('저장 실패: ' + error.message); return }
    setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, note: newNote } : c))
    setSelected(prev => prev ? { ...prev, note: newNote } : null)
    setShowModal(false)
  }

  /* ── Excel 내보내기 ── */
  const exportExcel = () => {
    const rows = customers.map((c, i) => {
      const links = parsePharmacyLinks(c.note)
      const mgr = users.find(u => u.id === c.sales_manager_id)
      const cso = csoList.find(cc => cc.id === c.cso_company_id)
      const row: Record<string, string> = {
        '순번': String(i + 1),
        '문전약국': links[0]?.name ?? '',
        'SC코드': c.sc_code ?? '',
        '사업자번호': c.business_number ?? '',
        '자체코드': c.custom_code ?? '',
        '거래처': c.name,
        '우편번호': c.postal_code ?? '',
        '도로명주소': c.road_address ?? '',
        '상세주소': c.detail_address ?? '',
        '거래처종류': c.customer_type,
        '병상규모': c.bed_scale ?? '',
        '영업담당자': mgr?.name ?? '',
        'CSO업체': cso?.name ?? '',
        '휴폐업구분': c.closure_type ?? '',
        '폐업일자': c.closure_date ?? '',
      }
      for (let n = 1; n <= 10; n++) {
        const lk = links[n - 1]
        row[`문전약국${n}`] = lk?.name ?? ''
        row[`문전약국${n}주소`] = lk?.address ?? ''
      }
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '거래처별문전약국')
    XLSX.writeFile(wb, '거래처별_문전약국_관리.xlsx')
  }

  /* ── 필터된 약국 목록 ── */
  const filteredPharmacies = pharmacies.filter(p =>
    !pharmSearch || p.name.includes(pharmSearch) ||
    (p.sc_code ?? '').includes(pharmSearch) ||
    (p.business_number ?? '').includes(pharmSearch)
  )

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          <h1 className="text-sm font-semibold text-gray-800">거래처별 문전약국 관리</h1>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSearch}>
            조회(F1)
          </Button>
          <Button
            size="sm" variant="outline" className="h-7 text-xs border-blue-400 text-blue-700 hover:bg-blue-50"
            onClick={openModal} disabled={!selected}
          >
            문전약국
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportExcel}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* 검색 영역 */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
          {/* Row 1 */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap w-16 shrink-0">거 래 처 명</label>
            <Input className="h-6 text-xs" value={filters.name}
              onChange={e => setFilters(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap w-8 shrink-0">주 소</label>
            <Input className="h-6 text-xs" value={filters.address}
              onChange={e => setFilters(p => ({ ...p, address: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          {/* 영업담당자명 */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap w-20 shrink-0">영업담당자명</label>
            <div className="relative flex-1">
              <Input className="h-6 text-xs pr-6" value={filters.managerName}
                onChange={e => setFilters(p => ({ ...p, managerName: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                onFocus={() => setShowManagerSearch(true)} />
              <Search className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 cursor-pointer"
                onClick={() => setShowManagerSearch(true)} />
              {showManagerSearch && (
                <div className="absolute z-50 top-7 left-0 w-48 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-1 border-b">
                    <Input className="h-5 text-xs" placeholder="검색..." value={managerQuery}
                      onChange={e => setManagerQuery(e.target.value)} autoFocus />
                  </div>
                  {users.filter(u => !managerQuery || u.name.includes(managerQuery)).map(u => (
                    <div key={u.id} className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer"
                      onClick={() => { setFilters(p => ({ ...p, managerName: u.name })); setShowManagerSearch(false); setManagerQuery('') }}>
                      {u.name}
                    </div>
                  ))}
                  <div className="border-t p-1">
                    <Button size="sm" variant="ghost" className="h-5 text-xs w-full"
                      onClick={() => { setFilters(p => ({ ...p, managerName: '' })); setShowManagerSearch(false) }}>
                      초기화
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* 체크박스 */}
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={filters.onlyWithPharmacy}
                onChange={e => setFilters(p => ({ ...p, onlyWithPharmacy: e.target.checked }))} />
              <span>문전약국 등록 거래처만</span>
            </label>
          </div>

          {/* Row 2 */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap w-16 shrink-0">사업자번호</label>
            <Input className="h-6 text-xs" value={filters.businessNumber}
              onChange={e => setFilters(p => ({ ...p, businessNumber: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap w-8 shrink-0">자체코드</label>
            <Input className="h-6 text-xs" value={filters.customCode}
              onChange={e => setFilters(p => ({ ...p, customCode: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          {/* CSO업체명 */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap w-20 shrink-0">C S O업체명</label>
            <div className="relative flex-1">
              <Input className="h-6 text-xs pr-6" value={filters.csoName}
                onChange={e => setFilters(p => ({ ...p, csoName: e.target.value }))}
                onFocus={() => setShowCsoSearch(true)} />
              <Search className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 cursor-pointer"
                onClick={() => setShowCsoSearch(true)} />
              {showCsoSearch && (
                <div className="absolute z-50 top-7 left-0 w-48 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-1 border-b">
                    <Input className="h-5 text-xs" placeholder="검색..." value={csoQuery}
                      onChange={e => setCsoQuery(e.target.value)} autoFocus />
                  </div>
                  {csoList.filter(c => !csoQuery || c.name.includes(csoQuery)).map(c => (
                    <div key={c.id} className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer"
                      onClick={() => { setFilters(p => ({ ...p, csoName: c.name })); setShowCsoSearch(false); setCsoQuery('') }}>
                      {c.name}
                    </div>
                  ))}
                  <div className="border-t p-1">
                    <Button size="sm" variant="ghost" className="h-5 text-xs w-full"
                      onClick={() => { setFilters(p => ({ ...p, csoName: '' })); setShowCsoSearch(false) }}>
                      초기화
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div /> {/* 빈 셀 */}
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">로딩 중...</div>
        ) : (
          <table className="text-xs border-collapse min-w-max w-full">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 sticky top-0 z-10">
                {['순번','문전약국','SC코드','사업자번호','자체코드','거래처','우편번호','도로명주소','상세주소','거래처종류','병상규모','영업담당자','CSO업체','휴폐업구분','폐업일자',
                  '문전약국1','문전약국1주소','문전약국2','문전약국2주소','문전약국3','문전약국3주소',
                  '문전약국4','문전약국4주소','문전약국5','문전약국5주소','문전약국6','문전약국6주소',
                  '문전약국7','문전약국7주소','문전약국8','문전약국8주소','문전약국9','문전약국9주소',
                  '문전약국10','문전약국10주소'].map(col => (
                  <th key={col} className="px-2 py-1 text-center font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={35} className="py-8 text-center text-gray-400">데이터가 없습니다</td></tr>
              ) : customers.map((c, i) => {
                const links = parsePharmacyLinks(c.note)
                const mgr = users.find(u => u.id === c.sales_manager_id)
                const cso = csoList.find(cc => cc.id === c.cso_company_id)
                const isSelected = selected?.id === c.id
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={cn(
                      'border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                      isSelected && 'bg-blue-100'
                    )}
                  >
                    <td className="px-2 py-0.5 text-center border-r border-gray-100 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-blue-700 font-medium">
                      {links[0]?.name ?? ''}
                    </td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.sc_code}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.business_number}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.custom_code}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-medium">{c.name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.postal_code}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 max-w-[180px] truncate">{c.road_address}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 max-w-[120px] truncate">{c.detail_address}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.customer_type}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.bed_scale}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{mgr?.name ?? ''}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{cso?.name ?? ''}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.closure_type}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{c.closure_date}</td>
                    {Array.from({ length: 10 }, (_, n) => {
                      const lk = links[n]
                      return [
                        <td key={`n${n}`} className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-blue-600">
                          {lk?.name ?? ''}
                        </td>,
                        <td key={`a${n}`} className="px-2 py-0.5 border-r border-gray-100 max-w-[140px] truncate text-gray-500">
                          {lk?.address ?? ''}
                        </td>,
                      ]
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 상태바 */}
      <div className="shrink-0 px-4 py-1 border-t border-gray-200 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
        <span>총 {customers.length}건</span>
        {selected && <span className="text-blue-600">선택: {selected.name}</span>}
      </div>

      {/* ── 문전약국 관리 모달 ── */}
      {showModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-800">
                문전약국 관리 — <span className="text-blue-600">{selected.name}</span>
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 gap-0">
              {/* 왼쪽: 약국 검색 */}
              <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col">
                <div className="p-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-1.5">약국 검색</p>
                  <div className="relative">
                    <Input className="h-6 text-xs pr-6" placeholder="약국명/코드/사업자번호"
                      value={pharmSearch} onChange={e => setPharmSearch(e.target.value)} />
                    <Search className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredPharmacies.map(p => (
                    <div
                      key={p.id}
                      onClick={() => addPharmacy(p)}
                      className={cn(
                        'px-2 py-1.5 cursor-pointer hover:bg-blue-50 border-b border-gray-50',
                        modalLinks.some(l => l.id === p.id) && 'bg-green-50'
                      )}
                    >
                      <div className="text-xs font-medium text-gray-800">{p.name}</div>
                      <div className="text-[10px] text-gray-400">{p.sc_code} {p.business_number}</div>
                    </div>
                  ))}
                  {filteredPharmacies.length === 0 && (
                    <div className="p-4 text-xs text-gray-400 text-center">결과 없음</div>
                  )}
                </div>
              </div>

              {/* 오른쪽: 등록된 문전약국 */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-600">
                    등록된 문전약국 <span className="text-blue-600">({modalLinks.length}개)</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {modalLinks.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">왼쪽에서 약국을 선택하세요</div>
                  ) : modalLinks.map((lk, idx) => (
                    <div key={lk.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-200">
                      <span className="text-[10px] text-gray-400 w-4 text-center">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{lk.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{lk.address || '주소 없음'}</div>
                      </div>
                      <button onClick={() => removePharmacy(lk.id)}
                        className="text-gray-300 hover:text-red-500 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-400">왼쪽 목록 클릭 → 추가, 우측 × 클릭 → 제거</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowModal(false)}>
                  취소
                </Button>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={saveLinks} disabled={saving}>
                  {saving ? '저장 중...' : '저장(F5)'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 팝업 닫기 오버레이 */}
      {(showManagerSearch || showCsoSearch) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowManagerSearch(false); setShowCsoSearch(false) }} />
      )}
    </div>
  )
}
