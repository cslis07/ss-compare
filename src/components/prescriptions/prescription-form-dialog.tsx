'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Prescription, PrescriptionItem, Customer, User, CSOCompany, Product } from '@/lib/types'
import { Search, X, ChevronUp, ChevronDown, Trash2, Camera, Loader2 } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ProductSearchDialog } from '@/components/search/product-search-dialog'
import { CustomerSearchDialog } from '@/components/search/customer-search-dialog'

interface Props {
  open: boolean
  onClose: () => void
  onSave: () => void
  prescription: Prescription | null
}

/* UI 전용 필드 포함 아이템 상태 */
interface ItemState extends Partial<PrescriptionItem> {
  _custom_code?: string
  _monthly_count?: string
  _inpatient_qty?: string
  _item_note?: string
  _daily_match?: string
}

interface OcrRow {
  제조사: string
  보험코드: string
  자체코드: string
  제품: string
  급여: string
  단가: number
  수량원외: number
  수량원내: number
}

const INSURANCE_STATUS = ['급여', '비급여', '']
const PRESC_TYPES = ['처방(EDI)', '조제(EDI)', '직접입력']

function emptyItem(): ItemState {
  return {
    manufacturer_name: '', settlement_place: '', insurance_code: '', product_name: '',
    specification: '급여', product_group: '',
    quantity: 0, unit_price: 0, amount: 0,
    contract_commission_rate: 0, additional_commission_rate: 0, total_contract_commission: 0,
    charge_commission_rate: 0, additional_charge_commission: 0, total_charge_commission: 0,
    sort_order: 0, is_deleted: false,
    _custom_code: '', _monthly_count: '0', _inpatient_qty: '0', _item_note: '', _daily_match: 'N',
  }
}

export function PrescriptionFormDialog({ open, onClose, onSave, prescription }: Props) {
  const supabase = createClient()
  const isEdit = !!prescription?.id

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [form, setForm] = useState({
    prescription_month: prescription?.prescription_month || currentMonth,
    settlement_month: prescription?.settlement_month || currentMonth,
    prescription_type: prescription?.prescription_type || '처방(EDI)',
    registration_status: prescription?.registration_status || '등록',
    customer_id: prescription?.customer_id || '',
    customer_name: prescription?.customer_name || '',
    customer_note: '',
    business_number: prescription?.business_number || '',
    customer_type: prescription?.customer_type || '',
    evidence_type: prescription?.evidence_type || '전체',
    sales_manager_id: prescription?.sales_manager_id || '',
    sales_manager_name: prescription?.sales_manager_name || '',
    cso_company_id: prescription?.cso_company_id || '',
    cso_company_name: prescription?.cso_company_name || '',
    cso2_company_id: prescription?.cso2_company_id || '',
    cso2_company_name: prescription?.cso2_company_name || '',
    department1: prescription?.department1 || '',
    department2: prescription?.department2 || '',
    department3: prescription?.department3 || '',
    prescription_note: '',
    apply_contract: true,
    apply_charge: true,
  })
  const setF = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const [items, setItems] = useState<ItemState[]>([emptyItem()])
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrRows, setOcrRows] = useState<OcrRow[] | null>(null)
  const [showOcrPreview, setShowOcrPreview] = useState(false)
  const ocrInputRef = useRef<HTMLInputElement>(null)

  /* 거래처 검색 다이얼로그 */
  const [custDialogOpen, setCustDialogOpen] = useState(false)

  /* 영업담당자 검색 */
  const [showMgrSearch, setShowMgrSearch] = useState(false)
  const [mgrQuery, setMgrQuery] = useState('')
  const [mgrResults, setMgrResults] = useState<User[]>([])

  /* CSO 검색 */
  const [showCsoSearch, setShowCsoSearch] = useState(false)
  const [csoQuery, setCsoQuery] = useState('')
  const [csoResults, setCsoResults] = useState<CSOCompany[]>([])

  /* 제품 검색 다이얼로그 */
  const [prodDialog, setProdDialog] = useState<{ idx: number; query: string } | null>(null)

  /* items 로드 (수정시) */
  useEffect(() => {
    if (!open) return
    if (isEdit && prescription?.id) {
      supabase.from('prescription_items')
        .select('*')
        .eq('prescription_id', prescription.id)
        .eq('is_deleted', false)
        .order('sort_order')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setItems(data.map(it => ({
              ...it,
              _custom_code: '', _monthly_count: '0', _inpatient_qty: '0', _item_note: '', _daily_match: 'N',
            })))
          } else {
            setItems([emptyItem()])
          }
        })
    } else {
      setItems(prescription?.items?.length
        ? prescription.items.map(it => ({ ...it, _custom_code: '', _monthly_count: '0', _inpatient_qty: '0', _item_note: '', _daily_match: 'N' }))
        : [emptyItem()])
    }
  }, [open, isEdit, prescription, supabase])

  /* 영업담당자 검색 */
  useEffect(() => {
    if (!showMgrSearch) return
    supabase.from('users').select('*').eq('is_active', true).ilike('name', `%${mgrQuery}%`).limit(20)
      .then(({ data }) => setMgrResults(data || []))
  }, [mgrQuery, showMgrSearch, supabase])

  /* CSO 검색 */
  useEffect(() => {
    if (!showCsoSearch) return
    supabase.from('cso_companies').select('*').eq('is_deleted', false).ilike('name', `%${csoQuery}%`).limit(20)
      .then(({ data }) => setCsoResults(data || []))
  }, [csoQuery, showCsoSearch, supabase])

  /* 거래처 선택 */
  /* ── 월별 수수료율 조회 ──
     보험코드 + 처방월(적용기간 내) 로 commission_rates 매칭.
     거래처/영업담당자가 지정된 수수료율을 우선 적용하고, 없으면 일반(공통) 수수료율 사용 */
  type RateVals = { c: number; ac: number; ch: number; ach: number }
  const lookupRatesMap = useCallback(async (
    codes: string[],
    custId: string = form.customer_id,
    mgrId: string = form.sales_manager_id,
  ): Promise<Record<string, RateVals>> => {
    const uniq = [...new Set(codes.filter(Boolean))]
    if (uniq.length === 0) return {}
    const month = form.prescription_month
    const { data } = await supabase.from('commission_rates')
      .select('insurance_code, customer_id, sales_manager_id, manufacturer_name, contract_commission_rate, additional_commission_rate, charge_commission_rate, additional_charge_commission')
      .in('insurance_code', uniq)
      .lte('prescription_start_month', month)
      .gte('prescription_end_month', month)
      .eq('is_deleted', false)

    const byCode: Record<string, typeof data> = {}
    for (const r of data ?? []) {
      if (!r.insurance_code) continue
      ;(byCode[r.insurance_code] ??= []).push(r)
    }

    const result: Record<string, RateVals> = {}
    for (const code of uniq) {
      const cands = byCode[code] ?? []
      let best: (typeof cands)[number] | null = null
      let bestScore = -1
      for (const r of cands) {
        // 거래처/담당자 지정 수수료율인데 현재 처방과 다르면 제외
        if (r.customer_id && r.customer_id !== custId) continue
        if (r.sales_manager_id && r.sales_manager_id !== mgrId) continue
        let score = 0
        if (r.customer_id && r.customer_id === custId) score += 4
        if (r.sales_manager_id && r.sales_manager_id === mgrId) score += 2
        if (r.manufacturer_name) score += 1
        if (score > bestScore) { bestScore = score; best = r }
      }
      if (best) result[code] = {
        c: best.contract_commission_rate ?? 0,
        ac: best.additional_commission_rate ?? 0,
        ch: best.charge_commission_rate ?? 0,
        ach: best.additional_charge_commission ?? 0,
      }
    }
    return result
  }, [supabase, form.prescription_month, form.customer_id, form.sales_manager_id])

  /* 수수료율 적용 + 수수료액 재계산 */
  const withRate = (item: ItemState, rate?: RateVals): ItemState => {
    const next = { ...item }
    if (rate) {
      next.contract_commission_rate = rate.c
      next.additional_commission_rate = rate.ac
      next.charge_commission_rate = rate.ch
      next.additional_charge_commission = rate.ach
    }
    const amount = next.amount ?? 0
    next.total_contract_commission = form.apply_contract
      ? Math.round(amount * ((next.contract_commission_rate ?? 0) + (next.additional_commission_rate ?? 0)) / 100) : 0
    next.total_charge_commission = form.apply_charge
      ? Math.round(amount * ((next.charge_commission_rate ?? 0) + (next.additional_charge_commission ?? 0)) / 100) : 0
    return next
  }

  const selectCustomer = async (c: Customer) => {
    setF('customer_id', c.id)
    setF('customer_name', c.name)
    setF('business_number', c.business_number || '')
    setF('customer_type', c.customer_type)
    setF('customer_note', c.note || '')
    setF('department1', c.department1 || '')
    setF('department2', c.department2 || '')
    setF('department3', c.department3 || '')
    setCustDialogOpen(false)
    // 거래처가 바뀌면 입력된 품목들의 수수료율 재조회
    const codes = items.map(it => it.insurance_code || '').filter(Boolean)
    if (codes.length > 0) {
      const rateMap = await lookupRatesMap(codes, c.id, form.sales_manager_id)
      setItems(prev => prev.map(it => {
        const r = rateMap[it.insurance_code || '']
        return r ? withRate(it, r) : it
      }))
    }
  }

  /* 제품 → 아이템 채우기 (금액·수수료 재계산 포함) */
  const productToItem = (base: ItemState, p: Product): ItemState => {
    const merged: ItemState = {
      ...base,
      manufacturer_name: p.manufacturer_name || '',
      settlement_place: p.settlement_place || '',
      insurance_code: p.insurance_code || '',
      product_name: p.product_name || '',
      product_group: p.product_group || '',
      specification: p.is_non_covered ? '비급여' : '급여',
      unit_price: p.final_price ?? 0,
      _custom_code: p.custom_code || '',
    }
    const amount = (merged.quantity ?? 0) * (merged.unit_price ?? 0)
    merged.amount = amount
    merged.total_contract_commission = form.apply_contract
      ? Math.round(amount * ((merged.contract_commission_rate ?? 0) + (merged.additional_commission_rate ?? 0)) / 100) : 0
    merged.total_charge_commission = form.apply_charge
      ? Math.round(amount * ((merged.charge_commission_rate ?? 0) + (merged.additional_charge_commission ?? 0)) / 100) : 0
    return merged
  }

  /* 제품 검색 선택 적용: 첫 건은 현재 행, 나머지는 아래에 추가 + 수수료율 자동 조회 */
  const applyProducts = async (products: Product[]) => {
    if (!prodDialog || products.length === 0) { setProdDialog(null); return }
    const { idx } = prodDialog
    const rateMap = await lookupRatesMap(products.map(p => p.insurance_code || ''))
    setItems(prev => {
      const next = [...prev]
      next[idx] = withRate(productToItem(next[idx], products[0]), rateMap[products[0].insurance_code || ''])
      const extra = products.slice(1).map(p => withRate(productToItem(emptyItem(), p), rateMap[p.insurance_code || '']))
      next.splice(idx + 1, 0, ...extra)
      return next
    })
    setProdDialog(null)
  }

  /* 보험코드 직접 입력 시(검색팝업 미사용) 수수료율 자동 조회 */
  const lookupRateForRow = async (idx: number) => {
    const code = items[idx]?.insurance_code
    if (!code) return
    const rateMap = await lookupRatesMap([code])
    const r = rateMap[code]
    if (!r) return
    setItems(prev => prev.map((it, i) => (i === idx ? withRate(it, r) : it)))
  }

  /* 아이템 업데이트 */
  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : (item.quantity ?? 0)
        const price = field === 'unit_price' ? Number(value) : (item.unit_price ?? 0)
        item.amount = qty * price
      }
      const amount = item.amount ?? 0
      if (form.apply_contract) {
        const r = (item.contract_commission_rate ?? 0) + (item.additional_commission_rate ?? 0)
        item.total_contract_commission = Math.round(amount * r / 100)
      } else {
        item.total_contract_commission = 0
      }
      if (form.apply_charge) {
        const r = (item.charge_commission_rate ?? 0) + (item.additional_charge_commission ?? 0)
        item.total_charge_commission = Math.round(amount * r / 100)
      } else {
        item.total_charge_commission = 0
      }
      next[idx] = item
      return next
    })
  }

  /* 수수료 적용 체크박스 변경시 재계산 */
  const recalcAll = (applyContract: boolean, applyCharge: boolean) => {
    setItems(prev => prev.map(item => {
      const amount = item.amount ?? 0
      const cr = applyContract ? Math.round(amount * ((item.contract_commission_rate ?? 0) + (item.additional_commission_rate ?? 0)) / 100) : 0
      const dr = applyCharge ? Math.round(amount * ((item.charge_commission_rate ?? 0) + (item.additional_charge_commission ?? 0)) / 100) : 0
      return { ...item, total_contract_commission: cr, total_charge_commission: dr }
    }))
  }

  const addItem = () => {
    setItems(prev => [...prev, { ...emptyItem(), sort_order: prev.length }])
    setSelectedItemIdx(items.length)
  }

  const insertItem = () => {
    if (selectedItemIdx === null) { addItem(); return }
    setItems(prev => {
      const next = [...prev]
      next.splice(selectedItemIdx, 0, { ...emptyItem(), sort_order: selectedItemIdx })
      return next
    })
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    if (selectedItemIdx === idx) setSelectedItemIdx(null)
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    setItems(prev => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
    setSelectedItemIdx(target)
  }

  /* 합계 */
  const totals = items.reduce<{ monthly: number; outQty: number; inQty: number; amount: number; contract: number; charge: number }>(
    (a, it) => ({
      monthly: a.monthly + Number(it._monthly_count || 0),
      outQty: a.outQty + (it.quantity ?? 0),
      inQty: a.inQty + Number(it._inpatient_qty || 0),
      amount: a.amount + (it.amount ?? 0),
      contract: a.contract + (it.total_contract_commission ?? 0),
      charge: a.charge + (it.total_charge_commission ?? 0),
    }),
    { monthly: 0, outQty: 0, inQty: 0, amount: 0, contract: 0, charge: 0 }
  )

  /* OCR */
  const imgToJpeg = (file: File): Promise<string> =>
    new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 2048
        let w = img.naturalWidth, h = img.naturalHeight
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        const ctx = cv.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(cv.toDataURL('image/jpeg', 0.92).split(',')[1])
      }
      img.src = url
    })

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setOcrLoading(true)
    try {
      const imageBase64 = await imgToJpeg(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'OCR 실패')
      if (data.rows && data.rows.length > 0) {
        setOcrRows(data.rows)
        setShowOcrPreview(true)
      } else {
        alert('처방전 내용을 인식하지 못했습니다.\n\nOCR 텍스트:\n' + (data.text || '없음'))
      }
    } catch (err) {
      alert('OCR 오류: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setOcrLoading(false)
    }
  }

  const applyOcrRows = async () => {
    if (!ocrRows) return
    const rateMap = await lookupRatesMap(ocrRows.map(r => r.보험코드 || ''))
    const newItems: ItemState[] = ocrRows.map((row, i) => {
      const qty = (row.수량원외 ?? 0) + (row.수량원내 ?? 0)
      const amount = qty * (row.단가 ?? 0)
      const base: ItemState = {
        ...emptyItem(),
        sort_order: i,
        manufacturer_name: row.제조사 || '',
        insurance_code: row.보험코드 || '',
        _custom_code: row.자체코드 || '',
        product_name: row.제품 || '',
        specification: row.급여 || '급여',
        unit_price: row.단가 ?? 0,
        quantity: qty,
        _inpatient_qty: String(row.수량원내 ?? 0),
        amount,
      }
      return withRate(base, rateMap[row.보험코드 || ''])
    })
    setItems(newItems)
    setShowOcrPreview(false)
    setOcrRows(null)
  }

  /* 저장 */
  const handleSave = async () => {
    if (!form.customer_name) { alert('거래처를 선택하세요.'); return }
    setSaving(true)

    const prescData = {
      prescription_month: form.prescription_month,
      settlement_month: form.settlement_month,
      prescription_type: form.prescription_type,
      registration_status: form.registration_status,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      business_number: form.business_number,
      customer_type: form.customer_type,
      evidence_type: form.evidence_type,
      sales_manager_id: form.sales_manager_id || null,
      sales_manager_name: form.sales_manager_name,
      cso_company_id: form.cso_company_id || null,
      cso_company_name: form.cso_company_name,
      cso2_company_id: form.cso2_company_id || null,
      cso2_company_name: form.cso2_company_name,
      department1: form.department1,
      department2: form.department2,
      department3: form.department3,
      total_count: items.length,
      total_amount: totals.amount,
      total_contract_commission: totals.contract,
      total_charge_commission: totals.charge,
      updated_at: new Date().toISOString(),
    }

    let prescId = prescription?.id

    if (isEdit && prescId) {
      await supabase.from('prescriptions').update(prescData).eq('id', prescId)
      await supabase.from('prescription_items').delete().eq('prescription_id', prescId)
    } else {
      const { data } = await supabase.from('prescriptions').insert({ ...prescData, is_deleted: false }).select('id').single()
      prescId = data?.id
    }

    if (prescId) {
      const itemsToSave = items.map((it, i) => ({
        prescription_id: prescId,
        manufacturer_name: it.manufacturer_name || '',
        settlement_place: it.settlement_place || '',
        insurance_code: it.insurance_code || '',
        product_name: it.product_name || '',
        specification: it.specification || '',
        product_group: it.product_group || '',
        quantity: it.quantity ?? 0,
        unit_price: it.unit_price ?? 0,
        amount: it.amount ?? 0,
        contract_commission_rate: it.contract_commission_rate ?? 0,
        additional_commission_rate: it.additional_commission_rate ?? 0,
        total_contract_commission: it.total_contract_commission ?? 0,
        charge_commission_rate: it.charge_commission_rate ?? 0,
        additional_charge_commission: it.additional_charge_commission ?? 0,
        total_charge_commission: it.total_charge_commission ?? 0,
        sort_order: i,
        is_deleted: false,
      }))
      await supabase.from('prescription_items').insert(itemsToSave)
    }

    setSaving(false)
    onSave()
  }

  /* 삭제 */
  const handleDelete = async () => {
    if (!isEdit || !prescription?.id) { onClose(); return }
    if (!confirm('이 처방전을 삭제하시겠습니까?')) return
    await supabase.from('prescriptions').update({ is_deleted: true }).eq('id', prescription.id)
    onSave()
  }

  if (!open) return null

  const TH = 'px-1.5 py-1 text-center text-gray-600 font-medium border-r border-gray-200 whitespace-nowrap bg-gray-100 text-[10px]'
  const TD = 'px-0.5 py-0.5 border-r border-gray-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded shadow-2xl flex flex-col" style={{ width: '95vw', height: '90vh', maxWidth: 1600 }}>

        {/* 타이틀바 */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700">처방전입력</span>
          </div>
          <div className="flex items-center gap-1">
            <input ref={ocrInputRef} type="file" accept="image/*" className="hidden" onChange={handleOcrFile} />
            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-green-700 border-green-400 hover:bg-green-50"
              onClick={() => ocrInputRef.current?.click()} disabled={ocrLoading}>
              {ocrLoading ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> : <Camera className="h-3 w-3 mr-0.5" />}
              이미지로 등록하기
            </Button>
            <div className="w-px h-4 bg-gray-300 mx-0.5" />
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => selectedItemIdx !== null && moveItem(selectedItemIdx, -1)}>
              <ChevronUp className="h-3 w-3 mr-0.5" />위로
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => selectedItemIdx !== null && moveItem(selectedItemIdx, 1)}>
              <ChevronDown className="h-3 w-3 mr-0.5" />아래로
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={insertItem}>끼워넣기</Button>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2">문전약국</Button>
            <div className="w-px h-4 bg-gray-300 mx-0.5" />
            <Button size="sm" className="h-6 text-xs px-3 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장(F5)'}
            </Button>
            <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={handleDelete}>삭제</Button>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 헤더 폼 */}
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
          {/* Row 1 */}
          <div className="flex items-center gap-4 mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 w-14 shrink-0">처 방 월</label>
              <Input type="month" value={form.prescription_month}
                onChange={e => setF('prescription_month', e.target.value)}
                className="h-6 text-xs w-30" />
            </div>
            {/* 거래처명 */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 w-16 shrink-0">거 래 처 명</label>
              <div className="flex items-center gap-0.5">
                <Input value={form.customer_name} placeholder="이름 입력 후 Enter"
                  onChange={e => setF('customer_name', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setCustDialogOpen(true)}
                  className="h-6 text-xs w-44 bg-white" />
                {form.customer_name && (
                  <button onClick={() => { setF('customer_name', ''); setF('customer_id', ''); setF('customer_note', '') }}
                    className="text-gray-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                )}
                <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setCustDialogOpen(true)}>
                  <Search className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 w-20 shrink-0">처방/조제구분</label>
              <Select value={form.prescription_type} onValueChange={v => setF('prescription_type', v)}>
                <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{PRESC_TYPES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 w-16 shrink-0">거래처비고</label>
              <Input value={form.customer_note} readOnly className="h-6 text-xs w-32 bg-gray-100" />
            </div>
            <div className="flex items-center gap-3 ml-2">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={form.apply_contract}
                  onChange={e => { setF('apply_contract', e.target.checked); recalcAll(e.target.checked, form.apply_charge) }} />
                <span>제약수수료 적용</span>
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={form.apply_charge}
                  onChange={e => { setF('apply_charge', e.target.checked); recalcAll(form.apply_contract, e.target.checked) }} />
                <span>담당수수료 적용</span>
              </label>
            </div>
          </div>
          {/* Row 2 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 w-14 shrink-0">정 산 월</label>
              <Input type="month" value={form.settlement_month}
                onChange={e => setF('settlement_month', e.target.value)}
                className="h-6 text-xs w-30" />
            </div>
            {/* 영업담당자 */}
            <div className="flex items-center gap-1.5 relative">
              <label className="text-xs text-gray-500 w-16 shrink-0">영업담당자명</label>
              <div className="flex items-center gap-0.5">
                <Input value={form.sales_manager_name} onChange={e => setF('sales_manager_name', e.target.value)}
                  className="h-6 text-xs w-28" onFocus={() => setShowMgrSearch(true)} />
                {form.sales_manager_name && (
                  <button onClick={() => { setF('sales_manager_name', ''); setF('sales_manager_id', '') }}
                    className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                )}
                <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setShowMgrSearch(true)}>
                  <Search className="h-3 w-3" />
                </Button>
              </div>
              {showMgrSearch && (
                <div className="absolute top-7 left-16 z-50 bg-white border border-gray-300 rounded shadow-lg w-52">
                  <Input value={mgrQuery} onChange={e => setMgrQuery(e.target.value)}
                    placeholder="이름 검색..." autoFocus className="h-6 text-xs m-1 w-[calc(100%-8px)]" />
                  <div className="max-h-40 overflow-y-auto">
                    {mgrResults.map(u => (
                      <div key={u.id} onClick={() => { setF('sales_manager_id', u.id); setF('sales_manager_name', u.name); setShowMgrSearch(false); setMgrQuery('') }}
                        className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-50">{u.name}</div>
                    ))}
                  </div>
                  <div className="border-t p-1">
                    <Button size="sm" variant="ghost" onClick={() => setShowMgrSearch(false)} className="h-5 text-xs w-full">닫기</Button>
                  </div>
                </div>
              )}
            </div>
            {/* CSO */}
            <div className="flex items-center gap-1.5 relative">
              <label className="text-xs text-gray-500 w-16 shrink-0">C S O 업체명</label>
              <div className="flex items-center gap-0.5">
                <Input value={form.cso_company_name} onChange={e => setF('cso_company_name', e.target.value)}
                  className="h-6 text-xs w-28" onFocus={() => setShowCsoSearch(true)} />
                <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setShowCsoSearch(true)}>
                  <Search className="h-3 w-3" />
                </Button>
              </div>
              {showCsoSearch && (
                <div className="absolute top-7 left-16 z-50 bg-white border border-gray-300 rounded shadow-lg w-52">
                  <Input value={csoQuery} onChange={e => setCsoQuery(e.target.value)}
                    placeholder="업체명 검색..." autoFocus className="h-6 text-xs m-1 w-[calc(100%-8px)]" />
                  <div className="max-h-40 overflow-y-auto">
                    {csoResults.map(c => (
                      <div key={c.id} onClick={() => { setF('cso_company_id', c.id); setF('cso_company_name', c.name); setShowCsoSearch(false); setCsoQuery('') }}
                        className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-50">{c.name}</div>
                    ))}
                  </div>
                  <div className="border-t p-1">
                    <Button size="sm" variant="ghost" onClick={() => setShowCsoSearch(false)} className="h-5 text-xs w-full">닫기</Button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 w-16 shrink-0">처방전비고</label>
              <Input value={form.prescription_note} onChange={e => setF('prescription_note', e.target.value)}
                className="h-6 text-xs w-40" />
            </div>
          </div>
        </div>

        {/* 아이템 테이블 */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="text-[11px] border-collapse min-w-max w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-300">
                <th className={cn(TH, 'w-8')}>순번</th>
                <th className={cn(TH, 'min-w-[100px]')}>제조사</th>
                <th className={cn(TH, 'min-w-[100px]')}>정산처</th>
                <th className={cn(TH, 'w-24')}>보험코드</th>
                <th className={cn(TH, 'w-20')}>자체코드</th>
                <th className={cn(TH, 'min-w-[160px]')}>제품</th>
                <th className={cn(TH, 'w-16')}>급여</th>
                <th className={cn(TH, 'w-20')}>단가</th>
                <th className={cn(TH, 'w-16')}>제약<br/>수수료율</th>
                <th className={cn(TH, 'w-14')}>제약수수료율<br/>(추가)</th>
                <th className={cn(TH, 'w-16')}>담당<br/>수수료율</th>
                <th className={cn(TH, 'w-14')}>담당수수료율<br/>(추가)</th>
                <th className={cn(TH, 'w-18')}>전월수량</th>
                <th className={cn(TH, 'w-20')}>수량(원외)</th>
                <th className={cn(TH, 'w-18')}>수량(원내)</th>
                <th className={cn(TH, 'w-24')}>합계금액</th>
                <th className={cn(TH, 'w-24')}>제약수수료</th>
                <th className={cn(TH, 'w-24')}>담당수수료</th>
                <th className={cn(TH, 'min-w-[100px]')}>처방전 상세 비고</th>
                <th className={cn(TH, 'w-14')}>일별<br/>일치여부</th>
                <th className="px-1 py-1 bg-gray-100 w-6" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isSel = selectedItemIdx === idx
                return (
                  <tr key={idx}
                    onClick={() => setSelectedItemIdx(idx)}
                    className={cn('border-b border-gray-100', isSel ? 'bg-blue-50 outline outline-1 outline-blue-400' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30', 'hover:bg-blue-50/50 cursor-pointer')}>
                    <td className={cn(TD, 'text-center text-gray-400 select-none')}>{idx + 1}</td>
                    {/* 제조사 */}
                    <td className={TD}><Input value={item.manufacturer_name || ''} onChange={e => updateItem(idx, 'manufacturer_name', e.target.value)} className="h-6 text-[11px] px-1 w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300" /></td>
                    {/* 정산처 */}
                    <td className={TD}><Input value={item.settlement_place || ''} onChange={e => updateItem(idx, 'settlement_place', e.target.value)} className="h-6 text-[11px] px-1 w-full border-0 bg-transparent focus:bg-white" /></td>
                    {/* 보험코드 — Enter로 제품 검색 */}
                    <td className={TD}>
                      <Input value={item.insurance_code || ''}
                        onChange={e => updateItem(idx, 'insurance_code', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setProdDialog({ idx, query: item.insurance_code || '' }) } }}
                        onBlur={() => lookupRateForRow(idx)}
                        className="h-6 text-[11px] px-1 w-full border-0 bg-transparent focus:bg-white font-mono" />
                    </td>
                    {/* 자체코드 */}
                    <td className={TD}><Input value={item._custom_code || ''} onChange={e => setItems(prev => { const n=[...prev]; n[idx]={...n[idx],_custom_code:e.target.value}; return n })} className="h-6 text-[11px] px-1 w-full border-0 bg-transparent focus:bg-white" /></td>
                    {/* 제품 — Enter로 제품 검색 */}
                    <td className={TD}><Input value={item.product_name || ''}
                      onChange={e => updateItem(idx, 'product_name', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setProdDialog({ idx, query: item.product_name || '' }) } }}
                      placeholder="이름 입력 후 Enter"
                      className="h-6 text-[11px] px-1 w-full border-0 bg-transparent focus:bg-white min-w-[140px]" /></td>
                    {/* 급여 */}
                    <td className={TD}>
                      <Select value={item.specification || '급여'} onValueChange={v => updateItem(idx, 'specification', v)}>
                        <SelectTrigger className="h-6 text-[11px] border-0 bg-transparent w-16 px-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{INSURANCE_STATUS.map(v => <SelectItem key={v} value={v || 'none'} className="text-[11px]">{v || '-'}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    {/* 단가 */}
                    <td className={TD}><Input type="number" value={item.unit_price ?? ''} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} className="h-6 text-[11px] px-1 text-right w-20 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 제약율 */}
                    <td className={TD}><Input type="number" step="0.01" value={item.contract_commission_rate ?? ''} onChange={e => updateItem(idx, 'contract_commission_rate', Number(e.target.value))} className="h-6 text-[11px] px-1 text-right w-16 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 제약 추가 */}
                    <td className={TD}><Input type="number" step="0.01" value={item.additional_commission_rate ?? ''} onChange={e => updateItem(idx, 'additional_commission_rate', Number(e.target.value))} className="h-6 text-[11px] px-1 text-right w-14 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 담당율 */}
                    <td className={TD}><Input type="number" step="0.01" value={item.charge_commission_rate ?? ''} onChange={e => updateItem(idx, 'charge_commission_rate', Number(e.target.value))} className="h-6 text-[11px] px-1 text-right w-16 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 담당 추가 */}
                    <td className={TD}><Input type="number" step="0.01" value={item.additional_charge_commission ?? ''} onChange={e => updateItem(idx, 'additional_charge_commission', Number(e.target.value))} className="h-6 text-[11px] px-1 text-right w-14 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 전월수량 (UI only) */}
                    <td className={TD}><Input type="number" value={item._monthly_count ?? '0'} onChange={e => setItems(prev => { const n=[...prev]; n[idx]={...n[idx],_monthly_count:e.target.value}; return n })} className="h-6 text-[11px] px-1 text-right w-18 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 수량(원외) */}
                    <td className={TD}><Input type="number" value={item.quantity ?? ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="h-6 text-[11px] px-1 text-right w-20 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 수량(원내) (UI only) */}
                    <td className={TD}><Input type="number" value={item._inpatient_qty ?? '0'} onChange={e => setItems(prev => { const n=[...prev]; n[idx]={...n[idx],_inpatient_qty:e.target.value}; return n })} className="h-6 text-[11px] px-1 text-right w-18 border-0 bg-transparent focus:bg-white" /></td>
                    {/* 합계금액 */}
                    <td className={cn(TD, 'text-right font-medium pr-2')}>{formatNumber(item.amount)}</td>
                    {/* 제약수수료 */}
                    <td className={cn(TD, 'text-right text-blue-700 pr-2')}>{formatNumber(item.total_contract_commission)}</td>
                    {/* 담당수수료 */}
                    <td className={cn(TD, 'text-right text-green-700 pr-2')}>{formatNumber(item.total_charge_commission)}</td>
                    {/* 처방전상세비고 (UI only) */}
                    <td className={TD}><Input value={item._item_note || ''} onChange={e => setItems(prev => { const n=[...prev]; n[idx]={...n[idx],_item_note:e.target.value}; return n })} className="h-6 text-[11px] px-1 w-full border-0 bg-transparent focus:bg-white min-w-[80px]" /></td>
                    {/* 일별일치 (UI only) */}
                    <td className={cn(TD, 'text-center')}>
                      <Select value={item._daily_match || 'N'} onValueChange={v => setItems(prev => { const n=[...prev]; n[idx]={...n[idx],_daily_match:v}; return n })}>
                        <SelectTrigger className="h-6 text-[11px] border-0 bg-transparent w-12 px-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Y" className="text-[11px]">Y</SelectItem>
                          <SelectItem value="N" className="text-[11px]">N</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <button onClick={e => { e.stopPropagation(); removeItem(idx) }} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {/* 빈 행 추가 영역 */}
              <tr className="border-b border-gray-100 cursor-pointer hover:bg-gray-50" onDoubleClick={addItem}>
                <td colSpan={21} className="px-3 py-1 text-[10px] text-gray-300 select-none">더블클릭하여 행 추가</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 합계 푸터 */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-3 py-1">
          <div className="flex items-center text-[11px]">
            <span className="font-semibold text-gray-600 w-8 text-center">합계</span>
            <span className="text-gray-400 ml-auto mr-2">전월수량 <strong className="text-gray-700">{totals.monthly.toLocaleString()}</strong></span>
            <span className="text-gray-600 mr-2">수량(원외) <strong>{totals.outQty.toLocaleString()}</strong></span>
            <span className="text-gray-400 mr-4">수량(원내) <strong className="text-gray-700">{totals.inQty.toLocaleString()}</strong></span>
            <span className="text-gray-700 mr-4">합계금액 <strong>{formatNumber(totals.amount)}</strong></span>
            <span className="text-blue-600 mr-4">제약수수료 <strong>{formatNumber(totals.contract)}</strong></span>
            <span className="text-green-600">담당수수료 <strong>{formatNumber(totals.charge)}</strong></span>
          </div>
        </div>
      </div>

      {/* 팝업 닫기 오버레이 */}
      {(showMgrSearch || showCsoSearch) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowMgrSearch(false); setShowCsoSearch(false) }} />
      )}

      {/* 거래처 검색 다이얼로그 */}
      <CustomerSearchDialog
        open={custDialogOpen}
        initialQuery={form.customer_id ? '' : form.customer_name}
        onClose={() => setCustDialogOpen(false)}
        onSelect={selectCustomer}
      />

      {/* 제품 검색 다이얼로그 */}
      <ProductSearchDialog
        open={prodDialog !== null}
        initialQuery={prodDialog?.query || ''}
        multi
        onClose={() => setProdDialog(null)}
        onSelect={applyProducts}
      />

      {/* OCR 미리보기 모달 */}
      {showOcrPreview && ocrRows && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded shadow-2xl flex flex-col" style={{ width: 780, maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
              <span className="text-sm font-semibold text-gray-700">OCR 인식 결과 ({ocrRows.length}개 품목)</span>
              <button onClick={() => { setShowOcrPreview(false); setOcrRows(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="text-xs border-collapse w-full">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    {['#', '제조사', '보험코드', '자체코드', '제품명', '급여', '단가', '수량(원외)', '수량(원내)', '합계금액'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-center font-medium text-gray-600 border-b border-r border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ocrRows.map((row, i) => {
                    const qty = (row.수량원외 ?? 0) + (row.수량원내 ?? 0)
                    const amt = qty * (row.단가 ?? 0)
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 text-center text-gray-400 border-r border-gray-100">{i + 1}</td>
                        <td className="px-2 py-1 border-r border-gray-100">{row.제조사}</td>
                        <td className="px-2 py-1 border-r border-gray-100 font-mono">{row.보험코드}</td>
                        <td className="px-2 py-1 border-r border-gray-100 font-mono text-gray-400">{row.자체코드}</td>
                        <td className="px-2 py-1 border-r border-gray-100">{row.제품}</td>
                        <td className="px-2 py-1 border-r border-gray-100 text-center">{row.급여}</td>
                        <td className="px-2 py-1 border-r border-gray-100 text-right">{(row.단가 ?? 0).toLocaleString()}</td>
                        <td className="px-2 py-1 border-r border-gray-100 text-center">{row.수량원외 ?? 0}</td>
                        <td className="px-2 py-1 border-r border-gray-100 text-center">{row.수량원내 ?? 0}</td>
                        <td className="px-2 py-1 text-right font-medium">{amt.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-200 bg-gray-50 shrink-0">
              <span className="text-xs text-gray-400 mr-auto">인식 결과를 확인 후 적용하세요. 기존 입력 내용은 대체됩니다.</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowOcrPreview(false); setOcrRows(null) }}>취소</Button>
              <Button size="sm" className="h-7 text-xs px-4 bg-green-600 hover:bg-green-700" onClick={applyOcrRows}>적용하기</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
