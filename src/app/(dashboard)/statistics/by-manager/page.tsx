'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ManagerRow {
  sales_manager_name: string
  prescription_count: number
  total_amount: number
  additional_amount: number
  contract_commission: number
  additional_contract: number
  total_contract: number
  charge_commission: number
  additional_charge: number
  total_charge: number
}

export default function StatsByManagerPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<ManagerRow[]>([])
  const [loading, setLoading] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    monthFrom: prevMonth,
    monthTo: currentMonth,
    salesManager: '',
    includeDeleted: false,
  })

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('sales_manager_name, total_count, total_amount, total_contract_commission, total_charge_commission')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.monthFrom)
      .lte('prescription_month', filters.monthTo)

    const aggregated: Record<string, ManagerRow> = {}

    for (const p of prescriptions || []) {
      const key = p.sales_manager_name || '(미지정)'
      if (filters.salesManager && !key.includes(filters.salesManager)) continue
      if (!aggregated[key]) {
        aggregated[key] = {
          sales_manager_name: key,
          prescription_count: 0,
          total_amount: 0,
          additional_amount: 0,
          contract_commission: 0,
          additional_contract: 0,
          total_contract: 0,
          charge_commission: 0,
          additional_charge: 0,
          total_charge: 0,
        }
      }
      aggregated[key].prescription_count += p.total_count || 0
      aggregated[key].total_amount += p.total_amount || 0
      aggregated[key].contract_commission += p.total_contract_commission || 0
      aggregated[key].total_contract += p.total_contract_commission || 0
      aggregated[key].charge_commission += p.total_charge_commission || 0
      aggregated[key].total_charge += p.total_charge_commission || 0
    }

    setRows(Object.values(aggregated).sort((a, b) => a.sales_manager_name.localeCompare(b.sales_manager_name)))
    setLoading(false)
  }, [filters, supabase])

  const totals = rows.reduce((acc, r) => ({
    count: acc.count + r.prescription_count,
    amount: acc.amount + r.total_amount,
    contract: acc.contract + r.total_contract,
    charge: acc.charge + r.total_charge,
  }), { count: 0, amount: 0, contract: 0, charge: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">영업담당자별 처방집계현황</span>
        <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
        <span className="text-xs text-gray-400">~</span>
        <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="영업담당자" value={filters.salesManager} onChange={(e) => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-28" />
        <Button size="sm" onClick={fetchStats} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold w-8">번</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">영업담당자</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">처방건수</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">원외금액</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">합계금액</th>
              <th className="px-2 py-1.5 text-right text-blue-600 font-semibold">제약수수료</th>
              <th className="px-2 py-1.5 text-right text-blue-600 font-semibold">추가수수료</th>
              <th className="px-2 py-1.5 text-right text-blue-600 font-semibold">총제약수수료</th>
              <th className="px-2 py-1.5 text-right text-green-600 font-semibold">담당수수료</th>
              <th className="px-2 py-1.5 text-right text-green-600 font-semibold">추가수수료</th>
              <th className="px-2 py-1.5 text-right text-green-600 font-semibold">총담당수수료</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={cn('border-b border-gray-100 hover:bg-blue-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1 text-gray-800 font-medium">{r.sales_manager_name}</td>
                <td className="px-2 py-1 text-right text-gray-700">{r.prescription_count.toLocaleString()}</td>
                <td className="px-2 py-1 text-right text-gray-700">{formatNumber(r.total_amount)}</td>
                <td className="px-2 py-1 text-right text-gray-800 font-medium">{formatNumber(r.total_amount)}</td>
                <td className="px-2 py-1 text-right text-blue-700">{formatNumber(r.contract_commission)}</td>
                <td className="px-2 py-1 text-right text-blue-500">{formatNumber(r.additional_contract)}</td>
                <td className="px-2 py-1 text-right text-blue-800 font-semibold">{formatNumber(r.total_contract)}</td>
                <td className="px-2 py-1 text-right text-green-700">{formatNumber(r.charge_commission)}</td>
                <td className="px-2 py-1 text-right text-green-500">{formatNumber(r.additional_charge)}</td>
                <td className="px-2 py-1 text-right text-green-800 font-semibold">{formatNumber(r.total_charge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span>처방건수: <strong>{totals.count.toLocaleString()}</strong></span>
        <span>금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">제약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}명</span>
      </div>
    </div>
  )
}
