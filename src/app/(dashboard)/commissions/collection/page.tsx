'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface CollectionRow {
  manager: string
  cso: string
  contractCommission: number
  chargeCommission: number
  collected: number
}

export default function CollectionPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CollectionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [filters, setFilters] = useState({ month: currentMonth, manager: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setHasSearched(true)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('sales_manager_name, cso_company_name, total_contract_commission, total_charge_commission, settlement_month, prescription_month')
      .eq('is_deleted', false)
      .eq('settlement_month', filters.month)

    const agg: Record<string, CollectionRow> = {}
    for (const p of prescriptions || []) {
      const manager = p.sales_manager_name || '(미지정)'
      if (filters.manager && !manager.includes(filters.manager)) continue
      const key = manager + '|' + (p.cso_company_name || '')
      if (!agg[key]) agg[key] = { manager, cso: p.cso_company_name || '', contractCommission: 0, chargeCommission: 0, collected: 0 }
      agg[key].contractCommission += p.total_contract_commission || 0
      agg[key].chargeCommission += p.total_charge_commission || 0
    }
    setRows(Object.values(agg).sort((a, b) => a.manager.localeCompare(b.manager)))
    setLoading(false)
  }, [filters, supabase])

  const totals = rows.reduce((acc, r) => ({
    contract: acc.contract + r.contractCommission,
    charge: acc.charge + r.chargeCommission,
    collected: acc.collected + r.collected,
  }), { contract: 0, charge: 0, collected: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">영업담당자 수금현황</span>
        <span className="text-xs text-gray-400">정산월</span>
        <Input type="month" value={filters.month} onChange={(e) => setFilters(f => ({ ...f, month: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="영업담당자" value={filters.manager} onChange={(e) => setFilters(f => ({ ...f, manager: e.target.value }))} className="h-7 text-xs w-24" />
        <Button size="sm" onClick={fetchData} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', '영업담당자', 'CSO업체', '제약수수료', '담당수수료', '수금액', '차이(담당)', '수금율(담당)'].map(h => (
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
            ) : rows.map((r, i) => {
              const diff = r.collected - r.chargeCommission
              const rate = r.chargeCommission ? (r.collected / r.chargeCommission * 100) : 0
              return (
                <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{r.manager}</td>
                  <td className="px-2 py-1 text-gray-500">{r.cso}</td>
                  <td className="px-2 py-1 text-right text-blue-700">{formatNumber(r.contractCommission)}</td>
                  <td className="px-2 py-1 text-right text-green-700">{formatNumber(r.chargeCommission)}</td>
                  <td className="px-2 py-1 text-right text-gray-700">{formatNumber(r.collected)}</td>
                  <td className={`px-2 py-1 text-right ${diff < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatNumber(diff)}</td>
                  <td className="px-2 py-1 text-right text-gray-600">{rate.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span className="text-blue-600">제약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span>수금액: <strong>{formatNumber(totals.collected)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}건</span>
      </div>
    </div>
  )
}
