'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { Prescription } from '@/lib/types'

export default function PrescriptionsReceivedPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [filters, setFilters] = useState({ month: currentMonth, customer: '', manager: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setHasSearched(true)
    let q = supabase.from('prescriptions').select('*').eq('is_deleted', false)
      .eq('prescription_month', filters.month)
      .order('created_at', { ascending: false })
    if (filters.customer) q = q.ilike('customer_name', `%${filters.customer}%`)
    if (filters.manager) q = q.ilike('sales_manager_name', `%${filters.manager}%`)
    const { data } = await q.limit(500)
    setRows(data || [])
    setLoading(false)
  }, [filters, supabase])

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">처방전 수신 내역</span>
        <Input type="month" value={filters.month} onChange={(e) => setFilters(f => ({ ...f, month: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="거래처명" value={filters.customer} onChange={(e) => setFilters(f => ({ ...f, customer: e.target.value }))} className="h-7 text-xs w-28" />
        <Input placeholder="영업담당자" value={filters.manager} onChange={(e) => setFilters(f => ({ ...f, manager: e.target.value }))} className="h-7 text-xs w-24" />
        <Button size="sm" onClick={fetchData} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', '처방월', '정산월', '처방/조제', '상태', '거래처', '사업자번호', '영업담당자', 'CSO업체', '처방건', '합계금액', '제약수수료', '담당수수료'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={13} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-8 text-gray-400">수신된 처방전이 없습니다.</td></tr>
            ) : rows.map((p, i) => (
              <tr key={p.id} className={`border-b border-gray-100 hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1 text-gray-700">{p.prescription_month}</td>
                <td className="px-2 py-1 text-gray-700">{p.settlement_month}</td>
                <td className="px-2 py-1 text-gray-600">{p.prescription_type}</td>
                <td className="px-2 py-1">
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{p.registration_status}</Badge>
                </td>
                <td className="px-2 py-1 text-gray-800 font-medium">{p.customer_name}</td>
                <td className="px-2 py-1 text-gray-500">{p.business_number}</td>
                <td className="px-2 py-1 text-gray-600">{p.sales_manager_name}</td>
                <td className="px-2 py-1 text-gray-500">{p.cso_company_name}</td>
                <td className="px-2 py-1 text-right text-gray-700">{p.total_count}</td>
                <td className="px-2 py-1 text-right text-gray-700">{formatNumber(p.total_amount)}</td>
                <td className="px-2 py-1 text-right text-blue-700">{formatNumber(p.total_contract_commission)}</td>
                <td className="px-2 py-1 text-right text-green-700">{formatNumber(p.total_charge_commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{rows.length}건</div>
    </div>
  )
}
