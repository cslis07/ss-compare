'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CommissionRate } from '@/lib/types'
import { Search, Plus, Save, Trash2, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CommissionRatesPage() {
  const supabase = createClient()
  const [rates, setRates] = useState<CommissionRate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CommissionRate | null>(null)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    monthFrom: prevMonth,
    monthTo: '2999-12',
    rateType: 'BASIC',
    salesManager: '',
  })

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('commission_rates').select('*').eq('is_deleted', false)
      .gte('prescription_start_month', filters.monthFrom)
      .order('prescription_start_month', { ascending: false })
    if (filters.salesManager) q = q.ilike('sales_manager_name' as any, `%${filters.salesManager}%`)
    const { data } = await q.limit(200)
    setRates(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() {
    setSelected({
      id: '',
      prescription_start_month: currentMonth,
      prescription_end_month: '2999-12',
      rate_type: 'BASIC',
      sales_manager_id: null,
      department1: null,
      department2: null,
      department3: null,
      customer_id: null,
      customer_seq: null,
      insurance_code: null,
      product_name: null,
      manufacturer_name: null,
      contract_commission_rate: 0,
      additional_commission_rate: 0,
      charge_commission_rate: 0,
      additional_charge_commission: 0,
      note: null,
      is_deleted: false,
      created_at: '',
      updated_at: '',
    })
  }

  async function handleSave() {
    if (!selected) return
    if (selected.id) {
      await supabase.from('commission_rates').update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
    } else {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = selected
      await supabase.from('commission_rates').insert(rest)
    }
    fetch()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('commission_rates').update({ is_deleted: true }).eq('id', selected.id)
    setSelected(null)
    fetch()
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">월별 수수료율 관리</span>
          <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
          <span className="text-xs text-gray-400">~</span>
          <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
          <Input placeholder="영업담당자" value={filters.salesManager} onChange={(e) => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-24" />
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <label className="flex items-center gap-1">
              <input type="checkbox" /> 기본 최종 수수료
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" /> BASIC 수수료 조회
            </label>
          </div>
          <Button size="sm" onClick={fetch} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1" /> 신규입력
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel등록
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
              일괄변경
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', '적용시작월', '적용종료월', '영업담당자', '부서1', '부서2', '부서3', '거래처Seq', '거래처', '보험코드', '제품명', '제조사', '정산처', '재약수수료율', '추가수수료율', '재약합계율', '담당수수료율', '추가담당율', '담당합계율', '비고'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={20} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : rates.length === 0 ? (
                <tr><td colSpan={20} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : rates.map((r, i) => (
                <tr key={r.id} onClick={() => setSelected(r)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === r.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-700">{r.prescription_start_month}</td>
                  <td className="px-2 py-1 text-gray-700">{r.prescription_end_month}</td>
                  <td className="px-2 py-1 text-gray-600">{(r as any).sales_manager?.name || ''}</td>
                  <td className="px-2 py-1 text-gray-500">{r.department1}</td>
                  <td className="px-2 py-1 text-gray-500">{r.department2}</td>
                  <td className="px-2 py-1 text-gray-500">{r.department3}</td>
                  <td className="px-2 py-1 text-gray-500">{r.customer_seq}</td>
                  <td className="px-2 py-1 text-gray-600">{(r as any).customer?.name || ''}</td>
                  <td className="px-2 py-1 text-gray-600 font-mono">{r.insurance_code}</td>
                  <td className="px-2 py-1 text-gray-700">{r.product_name}</td>
                  <td className="px-2 py-1 text-gray-500">{r.manufacturer_name}</td>
                  <td className="px-2 py-1 text-gray-500">{r.rate_type}</td>
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

      {selected && (
        <div className="w-64 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-blue-700 text-white">
            <span className="text-sm font-semibold">수수료율 입력</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">적용 기간</label>
              <Input type="month" value={selected.prescription_start_month} onChange={(e) => setSelected(s => s ? { ...s, prescription_start_month: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">종료 기간</label>
              <Input type="month" value={selected.prescription_end_month} onChange={(e) => setSelected(s => s ? { ...s, prescription_end_month: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">정산처(rate)</label>
              <Select value={selected.rate_type ?? 'BASIC'} onValueChange={(v) => setSelected(s => s ? { ...s, rate_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['BASIC', '기본수수료', '제품별'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {([['보험코드', 'insurance_code'], ['제품명', 'product_name'], ['제조사', 'manufacturer_name'], ['비고', 'note']] as [string, keyof CommissionRate][]).map(([label, field]) => (
              <div key={field} className="flex items-center gap-2">
                <label className="text-gray-500 w-24 shrink-0 text-right">{label}</label>
                <Input value={(selected[field] as string) || ''} onChange={(e) => setSelected(s => s ? { ...s, [field]: e.target.value } : s)} className="h-7 text-xs flex-1" />
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2">
              <p className="text-gray-400 font-medium mb-1.5">재약 수수료</p>
              <div className="flex items-center gap-2">
                <label className="text-gray-500 w-24 shrink-0 text-right">재약 수수료율</label>
                <Input type="number" step="0.01" value={selected.contract_commission_rate} onChange={(e) => setSelected(s => s ? { ...s, contract_commission_rate: Number(e.target.value) } : s)} className="h-7 text-xs flex-1 text-right" />
                <span className="text-gray-400">%</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <label className="text-gray-500 w-24 shrink-0 text-right">추가수수료율</label>
                <Input type="number" step="0.01" value={selected.additional_commission_rate} onChange={(e) => setSelected(s => s ? { ...s, additional_commission_rate: Number(e.target.value) } : s)} className="h-7 text-xs flex-1 text-right" />
                <span className="text-gray-400">%</span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <p className="text-gray-400 font-medium mb-1.5">담당 수수료</p>
              <div className="flex items-center gap-2">
                <label className="text-gray-500 w-24 shrink-0 text-right">담당 수수료율</label>
                <Input type="number" step="0.01" value={selected.charge_commission_rate} onChange={(e) => setSelected(s => s ? { ...s, charge_commission_rate: Number(e.target.value) } : s)} className="h-7 text-xs flex-1 text-right" />
                <span className="text-gray-400">%</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <label className="text-gray-500 w-24 shrink-0 text-right">추가담당율</label>
                <Input type="number" step="0.01" value={selected.additional_charge_commission} onChange={(e) => setSelected(s => s ? { ...s, additional_charge_commission: Number(e.target.value) } : s)} className="h-7 text-xs flex-1 text-right" />
                <span className="text-gray-400">%</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7 text-xs px-3">
              <Trash2 className="h-3 w-3 mr-1" /> 삭제
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
              <Save className="h-3 w-3 mr-1" /> 저장(F5)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
