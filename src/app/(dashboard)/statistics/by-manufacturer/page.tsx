'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Row {
  manufacturer_name: string
  ingredient_code: string
  product_name: string
  specification: string
  department1: string
  department2: string
  department3: string
  sales_manager_name: string
  total_amount: number
  contract_commission: number
  charge_commission: number
}

export default function StatsByManufacturerPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)
  const [filters, setFilters] = useState({ monthFrom: prevMonth, monthTo: currentMonth, manufacturerName: '', salesManager: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('*, items:prescription_items(*)')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.monthFrom)
      .lte('prescription_month', filters.monthTo)

    const aggregated: Record<string, Row> = {}
    for (const p of prescriptions || []) {
      if (filters.salesManager && !p.sales_manager_name?.includes(filters.salesManager)) continue
      for (const item of (p.items || [])) {
        if (item.is_deleted) continue
        if (filters.manufacturerName && !item.manufacturer_name?.includes(filters.manufacturerName)) continue
        const key = `${item.manufacturer_name}|${item.insurance_code}|${p.sales_manager_name}`
        if (!aggregated[key]) {
          aggregated[key] = {
            manufacturer_name: item.manufacturer_name || '',
            ingredient_code: item.insurance_code || '',
            product_name: item.product_name || '',
            specification: item.specification || '',
            department1: p.department1 || '',
            department2: p.department2 || '',
            department3: p.department3 || '',
            sales_manager_name: p.sales_manager_name || '',
            total_amount: 0,
            contract_commission: 0,
            charge_commission: 0,
          }
        }
        aggregated[key].total_amount += item.amount || 0
        aggregated[key].contract_commission += item.total_contract_commission || 0
        aggregated[key].charge_commission += item.total_charge_commission || 0
      }
    }
    setRows(Object.values(aggregated).sort((a, b) => a.manufacturer_name.localeCompare(b.manufacturer_name)))
    setLoading(false)
  }, [filters, supabase])

  const totals = rows.reduce((acc, r) => ({ amount: acc.amount + r.total_amount, contract: acc.contract + r.contract_commission, charge: acc.charge + r.charge_commission }), { amount: 0, contract: 0, charge: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">제조사별 제품별 처방집계현황</span>
        <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
        <span className="text-xs text-gray-400">~</span>
        <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="제조사명" value={filters.manufacturerName} onChange={(e) => setFilters(f => ({ ...f, manufacturerName: e.target.value }))} className="h-7 text-xs w-28" />
        <Input placeholder="영업담당자" value={filters.salesManager} onChange={(e) => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-24" />
        <Button size="sm" onClick={fetchData} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3"><Search className="h-3 w-3 mr-1" /> 조회</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto"><FileSpreadsheet className="h-3 w-3 mr-1" /> Excel</Button>
      </div>
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', '제조사', '성분코드', '제품명', '규격/단위', '부서1', '부서2', '부서3', '영업담당자', '처방금액', '재약수수료', '담당수수료'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={12} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={12} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
              : rows.map((r, i) => (
                <tr key={i} className={cn('border-b border-gray-100 hover:bg-blue-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-700 font-medium">{r.manufacturer_name}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono">{r.ingredient_code}</td>
                  <td className="px-2 py-1 text-gray-800">{r.product_name}</td>
                  <td className="px-2 py-1 text-gray-500">{r.specification}</td>
                  <td className="px-2 py-1 text-gray-500">{r.department1}</td>
                  <td className="px-2 py-1 text-gray-400">{r.department2}</td>
                  <td className="px-2 py-1 text-gray-400">{r.department3}</td>
                  <td className="px-2 py-1 text-gray-600">{r.sales_manager_name}</td>
                  <td className="px-2 py-1 text-right text-gray-700 font-medium">{formatNumber(r.total_amount)}</td>
                  <td className="px-2 py-1 text-right text-blue-700 font-medium">{formatNumber(r.contract_commission)}</td>
                  <td className="px-2 py-1 text-right text-green-700 font-medium">{formatNumber(r.charge_commission)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span>금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">재약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}건</span>
      </div>
    </div>
  )
}
