'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Prescription, PrescriptionItem } from '@/lib/types'
import { Search, FileSpreadsheet, X } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'
import { PrescriptionFormDialog } from '@/components/prescriptions/prescription-form-dialog'
import { DataPagination } from '@/components/ui/data-pagination'

const PAGE_SIZE = 30

type ViewMode = '처방전별' | '품목별'

interface FlatItem {
  prescription: Prescription
  item: PrescriptionItem
  rowIdx: number
}

const PRESC_TYPES = ['전체', '처방(EDI)', '조제(EDI)', '직접입력']
const EVIDENCE_TYPES = ['전체', '처방전', '조제내역서', '수령증', '기타']
const STATUS_TYPES = ['전체선택', '등록', '확정', '정산']

/* ── 수금관리 모달 ── */
function CollectionModal({
  prescriptions, selected, onClose
}: {
  prescriptions: Prescription[]
  selected: Set<string>
  onClose: () => void
}) {
  const supabase = createClient()
  const rows = prescriptions.filter(p => selected.has(p.id))
  const [collectionAmounts, setCollectionAmounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const handleCopy = () => {
    const next: Record<string, number> = {}
    rows.forEach(p => { next[p.id] = p.total_contract_commission })
    setCollectionAmounts(next)
  }

  const handleSave = async () => {
    setSaving(true)
    // Store collection amounts in note JSON
    for (const p of rows) {
      const amt = collectionAmounts[p.id] ?? 0
      if (amt !== 0) {
        await supabase.from('prescriptions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', p.id)
      }
    }
    setSaving(false)
    alert('저장되었습니다.')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded shadow-xl flex flex-col" style={{ width: 900, maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">처방전 수금 등록</span>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleCopy}>수금액 복사</Button>
            <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>저장</Button>
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={onClose}>닫기</Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-gray-100 sticky top-0">
                {['순번','묶음번호','처방월','거래처','사업자번호','영업담당자','제약수수료율','제약수수료','담당수수료율','담당수수료','제약 수금액'].map(h => (
                  <th key={h} className="px-2 py-1 text-center text-gray-600 border-r border-gray-200 whitespace-nowrap font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="py-6 text-center text-gray-400">선택된 처방전이 없습니다</td></tr>
              ) : rows.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50">
                  <td className="px-2 py-1 text-center">{i + 1}</td>
                  <td className="px-2 py-1 text-center">1</td>
                  <td className="px-2 py-1">{p.prescription_month}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{p.customer_name}</td>
                  <td className="px-2 py-1">{p.business_number}</td>
                  <td className="px-2 py-1">{p.sales_manager_name}</td>
                  <td className="px-2 py-1 text-right">-</td>
                  <td className="px-2 py-1 text-right">{formatNumber(p.total_contract_commission)}</td>
                  <td className="px-2 py-1 text-right">-</td>
                  <td className="px-2 py-1 text-right">{formatNumber(p.total_charge_commission)}</td>
                  <td className="px-1 py-0.5">
                    <Input type="number" className="h-6 text-xs text-right w-28"
                      value={collectionAmounts[p.id] ?? ''}
                      onChange={e => setCollectionAmounts(prev => ({ ...prev, [p.id]: Number(e.target.value) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── 증빙자료 모달 ── */
function EvidenceModal({ prescriptions, selected, onClose }: { prescriptions: Prescription[]; selected: Set<string>; onClose: () => void }) {
  const rows = prescriptions.filter(p => selected.has(p.id))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileSelections, setFileSelections] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    alert('증빙자료 저장 기능은 추후 구현 예정입니다.')
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded shadow-xl flex flex-col" style={{ width: 1000, maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-700">처방전 증빙자료 등록</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="destructive" className="h-6 text-xs">기등록 삭제</Button>
            <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>저장</Button>
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={onClose}>닫기</Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-gray-100 sticky top-0">
                {['순번','묶음번호','처방월','처방전상태','거래처','자체코드','사업자번호','품목수','합계금액','기등록 증빙파일','신규 등록 증빙파일','파일 선택'].map(h => (
                  <th key={h} className="px-2 py-1 text-center text-gray-600 border-r border-gray-200 whitespace-nowrap font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={12} className="py-6 text-center text-gray-400">선택된 처방전이 없습니다</td></tr>
              ) : rows.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50">
                  <td className="px-2 py-1 text-center">{i + 1}</td>
                  <td className="px-2 py-1 text-center">1</td>
                  <td className="px-2 py-1">{p.prescription_month}</td>
                  <td className="px-2 py-1 text-center">{p.registration_status}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{p.customer_name}</td>
                  <td className="px-2 py-1 text-center">-</td>
                  <td className="px-2 py-1">{p.business_number}</td>
                  <td className="px-2 py-1 text-right">{p.total_count}</td>
                  <td className="px-2 py-1 text-right">{formatNumber(p.total_amount)}</td>
                  <td className="px-2 py-1 text-center text-gray-400 text-[10px]">-</td>
                  <td className="px-2 py-1 text-center text-[10px] text-blue-600">
                    {fileSelections[p.id]?.name ?? '-'}
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <button className="text-xs text-blue-600 underline hover:text-blue-800"
                      onClick={() => { fileInputRef.current?.click() }}>
                      파일 선택
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0] ?? null
                        setFileSelections(prev => ({ ...prev, [p.id]: f }))
                        e.target.value = ''
                      }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ MAIN ═══════════════════════════════════════════════ */
export default function PrescriptionsPage() {
  const supabase = createClient()

  /* ── 상태 ── */
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [flatItems, setFlatItems] = useState<FlatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('처방전별')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activePrescription, setActivePrescription] = useState<Prescription | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showCollection, setShowCollection] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

  const [filters, setFilters] = useState({
    prescriptionMonthFrom: prevMonth,
    prescriptionMonthTo: currentMonth,
    prescriptionType: '전체',
    prescriptionNote: '',
    evidenceType: '전체',
    statusFilter: '전체선택',
    customerName: '',
    csoName: '',
    productName: '',
    registeredBy: '',
    useSettlementMonth: false,
    settlementMonthFrom: currentMonth,
    settlementMonthTo: currentMonth,
    managerName: '',
    cso2Name: '',
    manufacturerName: '',
    modifiedBy: '',
  })
  const setF = (k: keyof typeof filters, v: string | boolean) =>
    setFilters(p => ({ ...p, [k]: v }))

  /* ── 데이터 로드 (p: 0-indexed 페이지) ── */
  const doLoad = useCallback(async (p: number) => {
    setLoading(true)
    const needItems = viewMode === '품목별' || !!filters.productName || !!filters.manufacturerName

    let q = supabase
      .from('prescriptions')
      .select(needItems ? '*, items:prescription_items(*)' : '*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('prescription_month', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.prescriptionMonthFrom) q = q.gte('prescription_month', filters.prescriptionMonthFrom)
    if (filters.prescriptionMonthTo)   q = q.lte('prescription_month', filters.prescriptionMonthTo)
    if (filters.useSettlementMonth) {
      q = q.gte('settlement_month', filters.settlementMonthFrom)
           .lte('settlement_month', filters.settlementMonthTo)
    }
    if (filters.prescriptionType !== '전체') q = q.eq('prescription_type', filters.prescriptionType)
    if (filters.evidenceType !== '전체')     q = q.eq('evidence_type', filters.evidenceType)
    if (filters.statusFilter !== '전체선택') q = q.eq('registration_status', filters.statusFilter)
    if (filters.customerName)  q = q.ilike('customer_name',      `%${filters.customerName}%`)
    if (filters.csoName)       q = q.ilike('cso_company_name',   `%${filters.csoName}%`)
    if (filters.cso2Name)      q = q.ilike('cso2_company_name',  `%${filters.cso2Name}%`)
    if (filters.managerName)   q = q.ilike('sales_manager_name', `%${filters.managerName}%`)

    // 품목 필터 없으면 서버 페이지네이션, 있으면 최대 500건 클라이언트 필터
    if (!filters.productName && !filters.manufacturerName) {
      q = (q as any).range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
    } else {
      q = (q as any).limit(500)
    }

    const { data, error, count } = await (q as any)
    if (error) { console.error(error); setLoading(false); return }

    let rows = (data ?? []) as unknown as Prescription[]

    if (filters.productName) {
      rows = rows.filter(pr => pr.items?.some(it => it.product_name?.includes(filters.productName)))
    }
    if (filters.manufacturerName) {
      rows = rows.filter(pr => pr.items?.some(it => it.manufacturer_name?.includes(filters.manufacturerName)))
    }

    setTotalCount((!filters.productName && !filters.manufacturerName) ? (count ?? 0) : rows.length)
    setPrescriptions(rows)

    if (needItems) {
      const flat: FlatItem[] = []
      rows.forEach((pr, pi) => {
        ;(pr.items ?? []).filter(it => !it.is_deleted).forEach(item => {
          flat.push({ prescription: pr, item, rowIdx: pi })
        })
      })
      setFlatItems(flat)
    }

    setLoading(false)
  }, [filters, viewMode, supabase])

  // 필터/뷰모드 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(0)
    doLoad(0)
  }, [doLoad])

  /* ── 선택 ── */
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    if (selected.size === prescriptions.length) setSelected(new Set())
    else setSelected(new Set(prescriptions.map(p => p.id)))
  }

  /* ── 상태 변경 ── */
  const changeStatus = async (status: string) => {
    if (selected.size === 0) { alert('처방전을 선택하세요.'); return }
    await supabase.from('prescriptions')
      .update({ registration_status: status, updated_at: new Date().toISOString() })
      .in('id', [...selected])
    setSelected(new Set())
    doLoad(page)
  }

  /* ── 삭제 ── */
  const handleDelete = async () => {
    if (selected.size === 0) { alert('처방전을 선택하세요.'); return }
    if (!confirm(`${selected.size}건을 삭제하시겠습니까?`)) return
    await supabase.from('prescriptions').update({ is_deleted: true }).in('id', [...selected])
    setSelected(new Set())
    setPage(0)
    doLoad(0)
  }

  /* ── Excel ── */
  const exportExcel = () => {
    const rows = prescriptions.map((p, i) => ({
      '순번': i + 1, '처방월': p.prescription_month, '정산월': p.settlement_month,
      '처방/조제': p.prescription_type, '처방전상태': p.registration_status,
      '거래처': p.customer_name, '거래처구분': p.customer_type,
      '품목수': p.total_count, '합계금액': p.total_amount,
      '제약수수료': p.total_contract_commission, '담당수수료': p.total_charge_commission,
      '사업자번호': p.business_number, '부서1': p.department1, '부서2': p.department2, '부서3': p.department3,
      '영업담당자': p.sales_manager_name, 'CSO업체': p.cso_company_name, 'CSO2업체': p.cso2_company_name,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '처방전관리')
    XLSX.writeFile(wb, '처방전관리.xlsx')
  }

  /* ── 합계 ── */
  const totals = prescriptions.reduce(
    (a, p) => ({ count: a.count + p.total_count, amount: a.amount + p.total_amount, contract: a.contract + p.total_contract_commission, charge: a.charge + p.total_charge_commission }),
    { count: 0, amount: 0, contract: 0, charge: 0 }
  )

  const FILTER_INPUT_CLS = 'h-6 text-xs'
  const FILTER_LABEL_CLS = 'text-xs text-gray-500 whitespace-nowrap shrink-0'

  /* ── 처방전별 테이블 헤더 ── */
  const PRESC_HEADERS = ['순번','처방월','정산월','처방/조제','처방전상태','거래처','거래처구분','품목수','합계금액','제약수수료','담당수수료','사업자번호','자체코드','부서1','부서2','부서3','영업담당자','CSO업체','CSO2업체']
  /* ── 품목별 테이블 헤더 ── */
  const ITEM_HEADERS = ['순번','처방월','정산월','처방/조제','처방전상태','거래처','거래처구분','사업자번호','자체코드','부서1','부서2','부서3','영업담당자','CSO업체','CSO2업체','처방전비고','제조사','정산처','보험코드','제품','급여','제품그룹','단가','제약수수료율','담당수수료율','수량(원외)','합계금액','제약수수료','담당수수료']

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── 툴바 ── */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300" onClick={() => { if (selected.size === 0) { alert('처방전을 선택하세요.') } else setShowCollection(true) }}>수금관리</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300" onClick={() => { if (selected.size === 0) { alert('처방전을 선택하세요.') } else setShowEvidence(true) }}>증빙자료</Button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300"
            onClick={() => { setActivePrescription(null); setShowForm(true) }}>등록(F2)</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300"
            onClick={() => changeStatus('확정')}>확정(F3)</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300"
            onClick={() => changeStatus('정산')}>정산(F4)</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300">전송요청</Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => { setPage(0); doLoad(0) }}>조회(F1)</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => { setActivePrescription(null); setShowForm(true) }}>신규등록</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => {
              if (selected.size !== 1) { alert('처방전을 하나 선택하세요.'); return }
              const p = prescriptions.find(x => selected.has(x.id))
              if (p) { setActivePrescription(p); setShowForm(true) }
            }}>수정</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => {
              if (selected.size !== 1) { alert('처방전을 하나 선택하세요.'); return }
              const p = prescriptions.find(x => selected.has(x.id))
              if (p) { setActivePrescription({ ...p, id: '' }); setShowForm(true) }
            }}>복사</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportExcel}>
            <FileSpreadsheet className="h-3 w-3 mr-1" />Excel
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDelete}>삭제</Button>
        </div>
      </div>

      {/* ── 필터 ── */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5 space-y-1 shrink-0">
        {/* Row 1 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-12')}>처 방 월</label>
            <Input type="month" className={cn(FILTER_INPUT_CLS, 'w-32')} value={filters.prescriptionMonthFrom} onChange={e => setF('prescriptionMonthFrom', e.target.value)} />
            <span className="text-xs text-gray-400">~</span>
            <Input type="month" className={cn(FILTER_INPUT_CLS, 'w-32')} value={filters.prescriptionMonthTo} onChange={e => setF('prescriptionMonthTo', e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-20')}>처방/조제구분</label>
            <Select value={filters.prescriptionType} onValueChange={v => setF('prescriptionType', v)}>
              <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{PRESC_TYPES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-16')}>처방전비고</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-24')} value={filters.prescriptionNote} onChange={e => setF('prescriptionNote', e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-12')}>증빙자료</label>
            <Select value={filters.evidenceType} onValueChange={v => setF('evidenceType', v)}>
              <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{EVIDENCE_TYPES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-20')}>확정/정산구분</label>
            <Select value={filters.statusFilter} onValueChange={v => setF('statusFilter', v)}>
              <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_TYPES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {/* Row 2 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-16')}>거 래 처 명</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.customerName} onChange={e => setF('customerName', e.target.value)} onKeyDown={e => e.key === 'Enter' && doLoad(0)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" onClick={() => doLoad(0)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-20')}>C S O 업체명</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.csoName} onChange={e => setF('csoName', e.target.value)} onKeyDown={e => e.key === 'Enter' && doLoad(0)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" onClick={() => doLoad(0)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-12')}>제 품 명</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.productName} onChange={e => setF('productName', e.target.value)} onKeyDown={e => e.key === 'Enter' && doLoad(0)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" onClick={() => doLoad(0)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-12')}>등 록 자</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-24')} value={filters.registeredBy} onChange={e => setF('registeredBy', e.target.value)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 ml-2">
            <input type="checkbox" checked={filters.useSettlementMonth}
              onChange={e => setF('useSettlementMonth', e.target.checked)} className="h-3 w-3" />
            <label className="text-xs text-gray-600 cursor-pointer" onClick={() => setF('useSettlementMonth', !filters.useSettlementMonth)}>정산월</label>
            <Input type="month" className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.settlementMonthFrom}
              onChange={e => setF('settlementMonthFrom', e.target.value)} disabled={!filters.useSettlementMonth} />
            <span className="text-xs text-gray-400">~</span>
            <Input type="month" className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.settlementMonthTo}
              onChange={e => setF('settlementMonthTo', e.target.value)} disabled={!filters.useSettlementMonth} />
          </div>
        </div>
        {/* Row 3 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-20')}>영업담당자명</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.managerName} onChange={e => setF('managerName', e.target.value)} onKeyDown={e => e.key === 'Enter' && doLoad(0)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" onClick={() => doLoad(0)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-20')}>C S O 2업체명</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.cso2Name} onChange={e => setF('cso2Name', e.target.value)} onKeyDown={e => e.key === 'Enter' && doLoad(0)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" onClick={() => doLoad(0)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-16')}>제 조 사 명</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-28')} value={filters.manufacturerName} onChange={e => setF('manufacturerName', e.target.value)} onKeyDown={e => e.key === 'Enter' && doLoad(0)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" onClick={() => doLoad(0)} />
          </div>
          <div className="flex items-center gap-1">
            <label className={cn(FILTER_LABEL_CLS, 'w-12')}>수 정 자</label>
            <Input className={cn(FILTER_INPUT_CLS, 'w-24')} value={filters.modifiedBy} onChange={e => setF('modifiedBy', e.target.value)} />
            <Search className="h-3.5 w-3.5 text-gray-400 cursor-pointer" />
          </div>
        </div>
        {/* Radio */}
        <div className="flex items-center gap-4 pt-0.5">
          {(['처방전별', '품목별'] as ViewMode[]).map(m => (
            <label key={m} className="flex items-center gap-1 cursor-pointer text-xs">
              <input type="radio" name="viewMode" value={m} checked={viewMode === m}
                onChange={() => setViewMode(m)} className="h-3 w-3" />
              <span className={viewMode === m ? 'text-blue-700 font-medium' : 'text-gray-600'}>{m}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── 테이블 ── */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">조회 중...</div>
        ) : viewMode === '처방전별' ? (
          /* 처방전별 */
          <table className="text-xs border-collapse min-w-max w-full">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr className="border-b border-gray-300">
                <th className="w-8 px-2 py-1 text-center border-r border-gray-200">
                  <input type="checkbox" className="h-3 w-3"
                    checked={selected.size === prescriptions.length && prescriptions.length > 0}
                    onChange={toggleAll} />
                </th>
                {PRESC_HEADERS.map(h => (
                  <th key={h} className="px-2 py-1 text-center font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prescriptions.length === 0 ? (
                <tr><td colSpan={PRESC_HEADERS.length + 1} className="py-10 text-center text-gray-400">데이터가 없습니다</td></tr>
              ) : prescriptions.map((p, i) => (
                <tr
                  key={p.id}
                  onDoubleClick={() => { setActivePrescription(p); setShowForm(true) }}
                  onClick={() => toggleSelect(p.id)}
                  className={cn(
                    'border-b border-gray-100 cursor-pointer',
                    selected.has(p.id) ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/40 hover:bg-blue-50'
                  )}
                >
                  <td className="px-2 py-0.5 text-center border-r border-gray-100" onClick={e => toggleSelect(p.id, e)}>
                    <input type="checkbox" className="h-3 w-3" checked={selected.has(p.id)} readOnly />
                  </td>
                  <td className="px-1 py-0.5 text-center text-gray-400 border-r border-gray-100">{i + 1}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.prescription_month}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.settlement_month}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-blue-700">{p.prescription_type}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                    <span className={cn('px-1 rounded text-[10px]',
                      p.registration_status === '확정' ? 'bg-green-100 text-green-700' :
                      p.registration_status === '정산' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600')}>
                      {p.registration_status}
                    </span>
                  </td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-medium">{p.customer_name}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.customer_type}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 text-right">{p.total_count.toLocaleString()}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 text-right">{formatNumber(p.total_amount)}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 text-right text-blue-700">{formatNumber(p.total_contract_commission)}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 text-right text-green-700">{formatNumber(p.total_charge_commission)}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100">{p.business_number}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 text-center text-gray-400">-</td>
                  <td className="px-2 py-0.5 border-r border-gray-100">{p.department1}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100">{p.department2}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100">{p.department3}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.sales_manager_name}</td>
                  <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.cso_company_name}</td>
                  <td className="px-2 py-0.5 whitespace-nowrap">{p.cso2_company_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* 품목별 */
          <table className="text-xs border-collapse min-w-max w-full">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr className="border-b border-gray-300">
                <th className="w-8 px-2 py-1 text-center border-r border-gray-200">
                  <input type="checkbox" className="h-3 w-3" readOnly />
                </th>
                {ITEM_HEADERS.map(h => (
                  <th key={h} className="px-2 py-1 text-center font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatItems.length === 0 ? (
                <tr><td colSpan={ITEM_HEADERS.length + 1} className="py-10 text-center text-gray-400">데이터가 없습니다</td></tr>
              ) : flatItems.map((fi, idx) => {
                const p = fi.prescription; const it = fi.item
                const pid = p.id
                return (
                  <tr key={`${pid}-${it.id}`}
                    onDoubleClick={() => { setActivePrescription(p); setShowForm(true) }}
                    onClick={() => toggleSelect(pid)}
                    className={cn('border-b border-gray-100 cursor-pointer',
                      selected.has(pid) ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/40 hover:bg-blue-50'
                    )}>
                    <td className="px-2 py-0.5 text-center border-r border-gray-100">
                      <input type="checkbox" className="h-3 w-3" checked={selected.has(pid)} readOnly />
                    </td>
                    <td className="px-1 py-0.5 text-center text-gray-400 border-r border-gray-100">{idx + 1}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.prescription_month}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.settlement_month}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-blue-700 whitespace-nowrap">{p.prescription_type}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">
                      <span className={cn('px-1 rounded text-[10px]',
                        p.registration_status === '확정' ? 'bg-green-100 text-green-700' :
                        p.registration_status === '정산' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600')}>
                        {p.registration_status}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-medium">{p.customer_name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">{p.customer_type}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">{p.business_number}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-center text-gray-400">-</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">{p.department1}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">{p.department2}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">{p.department3}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.sales_manager_name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.cso_company_name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{p.cso2_company_name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-center text-gray-400">-</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{it.manufacturer_name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">{it.settlement_place}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 font-mono">{it.insurance_code}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 max-w-[180px] truncate">{it.product_name}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-center">{it.specification}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100">{it.product_group}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-right">{formatNumber(it.unit_price)}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-right">{it.contract_commission_rate}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-right">{it.charge_commission_rate}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-right">{it.quantity?.toLocaleString()}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-right">{formatNumber(it.amount)}</td>
                    <td className="px-2 py-0.5 border-r border-gray-100 text-right text-blue-700">{formatNumber(it.total_contract_commission)}</td>
                    <td className="px-2 py-0.5 text-right text-green-700">{formatNumber(it.total_charge_commission)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 합계 + 페이지네이션 ── */}
      <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-1 flex items-center gap-6 text-xs">
        <span className="font-semibold text-gray-600">합계</span>
        <span className="text-gray-600">품목수: <strong>{totals.count.toLocaleString()}</strong></span>
        <span className="text-gray-700">합계금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">제약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
      </div>
      <DataPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={totalCount}
        onChange={p => { setPage(p); doLoad(p) }}
      />

      {/* ── 모달들 ── */}
      {showForm && (
        <PrescriptionFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setActivePrescription(null) }}
          onSave={() => { setShowForm(false); setActivePrescription(null); doLoad(page) }}
          prescription={activePrescription}
        />
      )}
      {showCollection && (
        <CollectionModal prescriptions={prescriptions} selected={selected} onClose={() => setShowCollection(false)} />
      )}
      {showEvidence && (
        <EvidenceModal prescriptions={prescriptions} selected={selected} onClose={() => setShowEvidence(false)} />
      )}
    </div>
  )
}
