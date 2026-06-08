'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Prescription, PrescriptionItem, Customer, User, CSOCompany } from '@/lib/types'
import { Plus, Trash2, Search, Save } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSave: () => void
  prescription: Prescription | null
}

const emptyItem = (): Partial<PrescriptionItem> => ({
  manufacturer_name: '',
  settlement_place: '',
  insurance_code: '',
  product_name: '',
  specification: '',
  product_group: '',
  quantity: 1,
  unit_price: 0,
  amount: 0,
  contract_commission_rate: 0,
  additional_commission_rate: 0,
  total_contract_commission: 0,
  charge_commission_rate: 0,
  additional_charge_commission: 0,
  total_charge_commission: 0,
})

export function PrescriptionFormDialog({ open, onClose, onSave, prescription }: Props) {
  const supabase = createClient()
  const isEdit = !!prescription?.id

  const currentMonth = new Date().toISOString().slice(0, 7)

  const [form, setForm] = useState({
    prescription_month: prescription?.prescription_month || currentMonth,
    settlement_month: prescription?.settlement_month || currentMonth,
    prescription_type: prescription?.prescription_type || '처방(EDI)',
    registration_status: prescription?.registration_status || '등록',
    customer_id: prescription?.customer_id || '',
    customer_name: prescription?.customer_name || '',
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
  })

  const [items, setItems] = useState<Partial<PrescriptionItem>[]>(
    prescription?.items?.length ? prescription.items : [emptyItem()]
  )
  const [saving, setSaving] = useState(false)

  // Customer search popup state
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)

  useEffect(() => {
    if (!showCustomerSearch || customerSearch.length < 1) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('is_deleted', false)
        .ilike('name', `%${customerSearch}%`)
        .limit(20)
      setCustomerResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch, showCustomerSearch, supabase])

  function selectCustomer(c: Customer) {
    setForm((f) => ({
      ...f,
      customer_id: c.id,
      customer_name: c.name,
      business_number: c.business_number || '',
      customer_type: c.customer_type,
      department1: c.department1 || '',
      department2: c.department2 || '',
      department3: c.department3 || '',
    }))
    setShowCustomerSearch(false)
    setCustomerSearch('')
  }

  function updateItem(idx: number, field: string, value: string | number) {
    setItems((prev) => {
      const next = [...prev]
      const item = { ...next[idx], [field]: value }
      // Auto-calc amount
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : (item.quantity ?? 0)
        const price = field === 'unit_price' ? Number(value) : (item.unit_price ?? 0)
        item.amount = qty * price
      }
      // Auto-calc commissions
      const amount = item.amount ?? 0
      const cRate = (item.contract_commission_rate ?? 0) + (item.additional_commission_rate ?? 0)
      const dRate = (item.charge_commission_rate ?? 0) + (item.additional_charge_commission ?? 0)
      item.total_contract_commission = Math.round(amount * cRate / 100)
      item.total_charge_commission = Math.round(amount * dRate / 100)
      next[idx] = item
      return next
    })
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]) }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)) }

  const totals = items.reduce(
    (acc: { count: number; amount: number; contract: number; charge: number }, item) => ({
      count: acc.count + (item.quantity ?? 0),
      amount: acc.amount + (item.amount ?? 0),
      contract: acc.contract + (item.total_contract_commission ?? 0),
      charge: acc.charge + (item.total_charge_commission ?? 0),
    }),
    { count: 0, amount: 0, contract: 0, charge: 0 }
  )

  async function handleSave() {
    if (!form.customer_name) { alert('거래처를 선택하세요.'); return }
    setSaving(true)

    const prescriptionData = {
      ...form,
      total_count: items.length,
      total_amount: totals.amount,
      total_contract_commission: totals.contract,
      total_charge_commission: totals.charge,
    }

    let prescriptionId = prescription?.id

    if (isEdit) {
      await supabase.from('prescriptions').update(prescriptionData).eq('id', prescriptionId!)
      await supabase.from('prescription_items').delete().eq('prescription_id', prescriptionId!)
    } else {
      const { data } = await supabase.from('prescriptions').insert(prescriptionData).select('id').single()
      prescriptionId = data?.id
    }

    if (prescriptionId && items.length > 0) {
      const itemsToInsert = items.map((item, i) => ({
        ...item,
        prescription_id: prescriptionId,
        sort_order: i,
        is_deleted: false,
      }))
      await supabase.from('prescription_items').insert(itemsToInsert)
    }

    setSaving(false)
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-2 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-gray-800">
              {isEdit ? '처방전 수정' : '처방전 신규 등록'}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={handleSave} disabled={saving}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
                <Save className="h-3 w-3 mr-1" /> {saving ? '저장 중...' : '저장(F5)'}
              </Button>
              <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs px-3">
                닫기
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Header Fields */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">차 월</label>
              <Input type="month" value={form.prescription_month}
                onChange={(e) => setForm((f) => ({ ...f, prescription_month: e.target.value }))}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">정산월</label>
              <Input type="month" value={form.settlement_month}
                onChange={(e) => setForm((f) => ({ ...f, settlement_month: e.target.value }))}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">처방/조제</label>
              <Select value={form.prescription_type} onValueChange={(v) => setForm((f) => ({ ...f, prescription_type: v }))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['처방(EDI)', '조제(EDI)', '직접입력'].map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">인상태</label>
              <Select value={form.registration_status} onValueChange={(v) => setForm((f) => ({ ...f, registration_status: v }))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['등록', '확정', '정산'].map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Row 2 */}
            <div className="flex items-center gap-1.5 relative">
              <label className="text-gray-500 whitespace-nowrap w-16">거래처</label>
              <div className="flex flex-1 gap-0.5">
                <Input value={form.customer_name} readOnly placeholder="거래처 선택"
                  className="h-7 text-xs flex-1 cursor-pointer bg-white"
                  onClick={() => setShowCustomerSearch(true)} />
                <Button size="sm" variant="outline" onClick={() => setShowCustomerSearch(true)}
                  className="h-7 w-7 p-0 shrink-0">
                  <Search className="h-3 w-3" />
                </Button>
              </div>
              {showCustomerSearch && (
                <div className="absolute top-8 left-16 z-50 bg-white border border-gray-200 rounded shadow-lg w-80">
                  <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="거래처명 검색..." autoFocus className="h-7 text-xs m-1 w-[calc(100%-8px)]" />
                  <div className="max-h-48 overflow-y-auto">
                    {customerResults.map((c) => (
                      <div key={c.id} onClick={() => selectCustomer(c)}
                        className="px-3 py-1.5 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-50">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-gray-400">{c.business_number} · {c.customer_type}</div>
                      </div>
                    ))}
                    {customerSearch.length > 0 && customerResults.length === 0 && (
                      <div className="px-3 py-3 text-xs text-gray-400 text-center">검색 결과 없음</div>
                    )}
                  </div>
                  <div className="p-1 border-t border-gray-100">
                    <Button size="sm" variant="ghost" onClick={() => setShowCustomerSearch(false)} className="h-6 text-xs w-full">닫기</Button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">사업자번호</label>
              <Input value={form.business_number} readOnly className="h-7 text-xs flex-1 bg-gray-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">증빙자료</label>
              <Select value={form.evidence_type} onValueChange={(v) => setForm((f) => ({ ...f, evidence_type: v }))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['전체', '처방전', '조제내역서', '수령증', '기타'].map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">거래처구분</label>
              <Input value={form.customer_type} readOnly className="h-7 text-xs flex-1 bg-gray-100" />
            </div>
            {/* Row 3 */}
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">영업담당자</label>
              <Input value={form.sales_manager_name}
                onChange={(e) => setForm((f) => ({ ...f, sales_manager_name: e.target.value }))}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">CSO업체</label>
              <Input value={form.cso_company_name}
                onChange={(e) => setForm((f) => ({ ...f, cso_company_name: e.target.value }))}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">CSO2업체</label>
              <Input value={form.cso2_company_name}
                onChange={(e) => setForm((f) => ({ ...f, cso2_company_name: e.target.value }))}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500 whitespace-nowrap w-16">부서</label>
              <Input value={form.department1}
                onChange={(e) => setForm((f) => ({ ...f, department1: e.target.value }))}
                className="h-7 text-xs flex-1" placeholder="부서1" />
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-xs border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="w-8 px-1 py-1.5 text-center text-gray-500">번</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">제조사</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">정산처</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">보험코드</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">제품명</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">규격</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">수량</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">단가</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">금액</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">재약율%</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">재약수수료</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">담당율%</th>
                <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">담당수수료</th>
                <th className="w-8 px-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/30">
                  <td className="px-1 py-0.5 text-center text-gray-400">{idx + 1}</td>
                  <td className="px-1 py-0.5">
                    <Input value={item.manufacturer_name || ''} onChange={(e) => updateItem(idx, 'manufacturer_name', e.target.value)} className="h-6 text-xs px-1" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input value={item.settlement_place || ''} onChange={(e) => updateItem(idx, 'settlement_place', e.target.value)} className="h-6 text-xs px-1" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input value={item.insurance_code || ''} onChange={(e) => updateItem(idx, 'insurance_code', e.target.value)} className="h-6 text-xs px-1 font-mono" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input value={item.product_name || ''} onChange={(e) => updateItem(idx, 'product_name', e.target.value)} className="h-6 text-xs px-1 min-w-40" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input value={item.specification || ''} onChange={(e) => updateItem(idx, 'specification', e.target.value)} className="h-6 text-xs px-1 w-20" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input type="number" value={item.quantity ?? ''} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className="h-6 text-xs px-1 w-14 text-right" />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input type="number" value={item.unit_price ?? ''} onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))} className="h-6 text-xs px-1 w-20 text-right" />
                  </td>
                  <td className="px-2 py-0.5 text-right text-gray-700 w-24 font-medium">{formatNumber(item.amount)}</td>
                  <td className="px-1 py-0.5">
                    <Input type="number" step="0.01" value={item.contract_commission_rate ?? ''} onChange={(e) => updateItem(idx, 'contract_commission_rate', Number(e.target.value))} className="h-6 text-xs px-1 w-16 text-right" />
                  </td>
                  <td className="px-2 py-0.5 text-right text-blue-700 w-24">{formatNumber(item.total_contract_commission)}</td>
                  <td className="px-1 py-0.5">
                    <Input type="number" step="0.01" value={item.charge_commission_rate ?? ''} onChange={(e) => updateItem(idx, 'charge_commission_rate', Number(e.target.value))} className="h-6 text-xs px-1 w-16 text-right" />
                  </td>
                  <td className="px-2 py-0.5 text-right text-green-700 w-24">{formatNumber(item.total_charge_commission)}</td>
                  <td className="px-1 py-0.5 text-center">
                    <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between shrink-0">
          <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs px-3">
            <Plus className="h-3 w-3 mr-1" /> 행 추가
          </Button>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500">합계금액: <strong className="text-gray-800">{formatNumber(totals.amount)}</strong></span>
            <span className="text-blue-600">재약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
            <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
