'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface StatusRow {
  sc_code: string
  business_number: string
  customer_name: string
  department1: string
  department2: string
  department3: string
  sales_manager_name: string
  cso_company_name: string
  cso2_company_name: string
  prescription_count: number
  receipt_amount: number
  external_amount: number
  total_amount: number
  contract_commission: number
  charge_commission: number
  settled_count: number
}

export default function PrescriptionStatusPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    monthFrom: prevMonth,
    monthTo: currentMonth,
    salesManager: '',
    csoCompany: '',
    includeDeleted: false,
    receiptRate: 0,
    chargeRate: 0,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.monthFrom)
      .lte('prescription_month', filters.monthTo)

    const aggregated: Record<string, StatusRow> = {}

    for (const p of data || []) {
      if (filters.salesManager && !p.sales_manager_name?.includes(filters.salesManager)) continue
      if (filters.csoCompany && !p.cso_company_name?.includes(filters.csoCompany)) continue

      const key = `${p.business_number}|${p.sales_manager_name}`
      if (!aggregated[key]) {
        aggregated[key] = {
          sc_code: '',
          business_number: p.business_number || '',
          customer_name: p.customer_name || '',
          department1: p.department1 || '',
          department2: p.department2 || '',
          department3: p.department3 || '',
          sales_manager_name: p.sales_manager_name || '',
          cso_company_name: p.cso_company_name || '',
          cso2_company_name: p.cso2_company_name || '',
          prescription_count: 0,
          receipt_amount: 0,
          external_amount: 0,
          total_amount: 0,
          contract_commission: 0,
          charge_commission: 0,
          settled_count: 0,
        }
      }
      aggregated[key].prescription_count += p.total_count || 0
      aggregated[key].total_amount += p.total_amount || 0
      aggregated[key].contract_commission += p.total_contract_commission || 0
      aggregated[key].charge_commission += p.total_charge_commission || 0
      if (p.is_settled) aggregated[key].settled_count++
    }

    setRows(Object.values(aggregated).sort((a, b) => a.customer_name.localeCompare(b.customer_name)))
    setLoading(false)
  }, [filters, supabase])

  const totals = rows.reduce((acc, r) => ({
    count: acc.count + r.prescription_count,
    amount: acc.amount + r.total_amount,
    contract: acc.contract + r.contract_commission,
    charge: acc.charge + r.charge_commission,
  }), { count: 0, amount: 0, contract: 0, charge: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">처방전 등록 현황</span>
        <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
        <span className="text-xs text-gray-400">~</span>
        <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="영업담당자" value={filters.salesManager} onChange={(e) => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-24" />
        <Input placeholder="CSO업체" value={filters.csoCompany} onChange={(e) => setFilters(f => ({ ...f, csoCompany: e.target.value }))} className="h-7 text-xs w-24" />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>수령율</span>
          <Input type="number" value={filters.receiptRate} onChange={(e) => setFilters(f => ({ ...f, receiptRate: Number(e.target.value) }))} className="h-7 text-xs w-14 text-center" />
          <span>%</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>금액점검</span>
          <Input type="number" value={filters.chargeRate} onChange={(e) => setFilters(f => ({ ...f, chargeRate: Number(e.target.value) }))} className="h-7 text-xs w-14 text-center" />
          <span>%</span>
        </div>
        <Button size="sm" onClick={fetchData} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', 'SC코드', '사업자번호', '거래처', '부서1', '부서2', '부서3', '영업담당자', 'CSO업체', 'CSO2업체', '처방건수', '수령금액', '원외금액', '합계금액', '수수료(재약)', '수수료(담당)'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={16} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={cn('border-b border-gray-100 hover:bg-blue-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1 text-gray-400">{r.sc_code}</td>
                <td className="px-2 py-1 text-gray-500">{r.business_number}</td>
                <td className="px-2 py-1 text-gray-800 font-medium">{r.customer_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.department1}</td>
                <td className="px-2 py-1 text-gray-400">{r.department2}</td>
                <td className="px-2 py-1 text-gray-400">{r.department3}</td>
                <td className="px-2 py-1 text-gray-700">{r.sales_manager_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.cso_company_name}</td>
                <td className="px-2 py-1 text-gray-400">{r.cso2_company_name}</td>
                <td className="px-2 py-1 text-right text-gray-700">{r.prescription_count.toLocaleString()}</td>
                <td className="px-2 py-1 text-right text-gray-600">{formatNumber(r.receipt_amount)}</td>
                <td className="px-2 py-1 text-right text-gray-600">{formatNumber(r.external_amount)}</td>
                <td className="px-2 py-1 text-right text-gray-800 font-medium">{formatNumber(r.total_amount)}</td>
                <td className="px-2 py-1 text-right text-blue-700 font-medium">{formatNumber(r.contract_commission)}</td>
                <td className="px-2 py-1 text-right text-green-700 font-medium">{formatNumber(r.charge_commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span>처방건수: <strong>{totals.count.toLocaleString()}</strong></span>
        <span>금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">재약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}건</span>
      </div>
    </div>
  )
}
