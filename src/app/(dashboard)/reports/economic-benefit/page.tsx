'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface BenefitRow {
  customer_name: string
  business_number: string
  manager: string
  prescriptionCount: number
  amount: number
  contractCommission: number
  chargeCommission: number
}

export default function EconomicBenefitPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<BenefitRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const yearStart = currentMonth.slice(0, 4) + '-01'
  const [filters, setFilters] = useState({ monthFrom: yearStart, monthTo: currentMonth, customer: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setHasSearched(true)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('customer_name, business_number, sales_manager_name, total_count, total_amount, total_contract_commission, total_charge_commission, prescription_month')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.monthFrom)
      .lte('prescription_month', filters.monthTo)

    const agg: Record<string, BenefitRow> = {}
    for (const p of prescriptions || []) {
      const name = p.customer_name || '(미지정)'
      if (filters.customer && !name.includes(filters.customer)) continue
      const key = p.business_number || name
      if (!agg[key]) agg[key] = { customer_name: name, business_number: p.business_number || '', manager: p.sales_manager_name || '', prescriptionCount: 0, amount: 0, contractCommission: 0, chargeCommission: 0 }
      agg[key].prescriptionCount += p.total_count || 0
      agg[key].amount += p.total_amount || 0
      agg[key].contractCommission += p.total_contract_commission || 0
      agg[key].chargeCommission += p.total_charge_commission || 0
    }
    setRows(Object.values(agg).sort((a, b) => b.amount - a.amount))
    setLoading(false)
  }, [filters, supabase])

  const totals = rows.reduce((acc, r) => ({
    count: acc.count + r.prescriptionCount,
    amount: acc.amount + r.amount,
    contract: acc.contract + r.contractCommission,
    charge: acc.charge + r.chargeCommission,
  }), { count: 0, amount: 0, contract: 0, charge: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">경제적이익보고서</span>
        <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
        <span className="text-xs text-gray-400">~</span>
        <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="거래처명" value={filters.customer} onChange={(e) => setFilters(f => ({ ...f, customer: e.target.value }))} className="h-7 text-xs w-28" />
        <Button size="sm" onClick={fetchData} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', '거래처', '사업자번호', '영업담당자', '처방건', '처방금액', '제약수수료', '담당수수료'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1 text-gray-800 font-medium">{r.customer_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.business_number}</td>
                <td className="px-2 py-1 text-gray-600">{r.manager}</td>
                <td className="px-2 py-1 text-right text-gray-700">{r.prescriptionCount.toLocaleString()}</td>
                <td className="px-2 py-1 text-right text-gray-700">{formatNumber(r.amount)}</td>
                <td className="px-2 py-1 text-right text-blue-700">{formatNumber(r.contractCommission)}</td>
                <td className="px-2 py-1 text-right text-green-700">{formatNumber(r.chargeCommission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span>처방건: <strong>{totals.count.toLocaleString()}</strong></span>
        <span>처방금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">제약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}건</span>
      </div>
    </div>
  )
}
