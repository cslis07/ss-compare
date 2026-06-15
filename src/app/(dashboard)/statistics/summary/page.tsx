'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { DataPagination } from '@/components/ui/data-pagination'

const STAT_PAGE_SIZE = 30

interface StatRow {
  business_number: string
  custom_code: string
  customer_name: string
  manufacturer_name: string
  cso_company_name: string
  insurance_code: string
  product_name: string
  specification: string
  sales_manager_name: string
  total_quantity: number
  total_amount: number
  total_contract_commission: number
  total_charge_commission: number
}

export default function StatsSummaryPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<StatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [statPage, setStatPage] = useState(0)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    monthFrom: prevMonth,
    monthTo: currentMonth,
    salesManager: '',
    csoCompany: '',
    productName: '',
    manufacturerName: '',
    includeDeleted: false,
    statusFilter: '등록+확정',
  })

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setStatPage(0)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('*, items:prescription_items(*)')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.monthFrom)
      .lte('prescription_month', filters.monthTo)
      .limit(3000)  // 대용량 방지 안전장치

    const aggregated: Record<string, StatRow> = {}

    for (const p of prescriptions || []) {
      for (const item of (p.items || [])) {
        if (item.is_deleted) continue
        const key = `${p.business_number}|${item.insurance_code}|${item.product_name}|${p.sales_manager_name}`
        if (!aggregated[key]) {
          aggregated[key] = {
            business_number: p.business_number || '',
            custom_code: '',
            customer_name: p.customer_name || '',
            manufacturer_name: item.manufacturer_name || '',
            cso_company_name: p.cso_company_name || '',
            insurance_code: item.insurance_code || '',
            product_name: item.product_name || '',
            specification: item.specification || '',
            sales_manager_name: p.sales_manager_name || '',
            total_quantity: 0,
            total_amount: 0,
            total_contract_commission: 0,
            total_charge_commission: 0,
          }
        }
        aggregated[key].total_quantity += item.quantity || 0
        aggregated[key].total_amount += item.amount || 0
        aggregated[key].total_contract_commission += item.total_contract_commission || 0
        aggregated[key].total_charge_commission += item.total_charge_commission || 0
      }
    }

    let result = Object.values(aggregated)
    if (filters.salesManager) result = result.filter(r => r.sales_manager_name.includes(filters.salesManager))
    if (filters.productName) result = result.filter(r => r.product_name.includes(filters.productName))
    if (filters.manufacturerName) result = result.filter(r => r.manufacturer_name.includes(filters.manufacturerName))

    setRows(result.sort((a, b) => a.customer_name.localeCompare(b.customer_name)))
    setLoading(false)
  }, [filters, supabase])

  const pageRows = rows.slice(statPage * STAT_PAGE_SIZE, (statPage + 1) * STAT_PAGE_SIZE)

  const totals = rows.reduce((acc, r) => ({
    qty: acc.qty + r.total_quantity,
    amount: acc.amount + r.total_amount,
    contract: acc.contract + r.total_contract_commission,
    charge: acc.charge + r.total_charge_commission,
  }), { qty: 0, amount: 0, contract: 0, charge: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">처방집계현황</span>
        <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
        <span className="text-xs text-gray-400">~</span>
        <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
        <Input placeholder="영업담당자" value={filters.salesManager} onChange={(e) => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-24" />
        <Input placeholder="제품명" value={filters.productName} onChange={(e) => setFilters(f => ({ ...f, productName: e.target.value }))} className="h-7 text-xs w-28" />
        <Input placeholder="제조사명" value={filters.manufacturerName} onChange={(e) => setFilters(f => ({ ...f, manufacturerName: e.target.value }))} className="h-7 text-xs w-28" />
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <label className="flex items-center gap-1">
            <input type="radio" name="status" checked={filters.statusFilter === '등록+확정'} onChange={() => setFilters(f => ({ ...f, statusFilter: '등록+확정' }))} /> 등록+확정
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="status" checked={filters.statusFilter === '확정'} onChange={() => setFilters(f => ({ ...f, statusFilter: '확정' }))} /> 확정
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="status" checked={filters.statusFilter === '정산'} onChange={() => setFilters(f => ({ ...f, statusFilter: '정산' }))} /> 정산
          </label>
        </div>
        <Button size="sm" onClick={fetchStats} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', '사업자번호', '자체코드', '거래처', '제조사', 'CSO업체', '보험코드', '제품명', '규격/단위', '영업담당자', '수량', '합계금액', '제약수수료', '담당수수료'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className="px-2 py-1 text-gray-400">{statPage * STAT_PAGE_SIZE + i + 1}</td>
                <td className="px-2 py-1 text-gray-500">{r.business_number}</td>
                <td className="px-2 py-1 text-gray-500">{r.custom_code}</td>
                <td className="px-2 py-1 text-gray-800 font-medium">{r.customer_name}</td>
                <td className="px-2 py-1 text-gray-600">{r.manufacturer_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.cso_company_name}</td>
                <td className="px-2 py-1 text-gray-600 font-mono">{r.insurance_code}</td>
                <td className="px-2 py-1 text-gray-800">{r.product_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.specification}</td>
                <td className="px-2 py-1 text-gray-600">{r.sales_manager_name}</td>
                <td className="px-2 py-1 text-right text-gray-700">{r.total_quantity.toLocaleString()}</td>
                <td className="px-2 py-1 text-right text-gray-700">{formatNumber(r.total_amount)}</td>
                <td className="px-2 py-1 text-right text-blue-700 font-medium">{formatNumber(r.total_contract_commission)}</td>
                <td className="px-2 py-1 text-right text-green-700 font-medium">{formatNumber(r.total_charge_commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span>수량: <strong>{totals.qty.toLocaleString()}</strong></span>
        <span>금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">제약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
      </div>
      <DataPagination
        page={statPage}
        pageSize={STAT_PAGE_SIZE}
        total={rows.length}
        onChange={setStatPage}
      />
    </div>
  )
}
