'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet, Printer } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ReportRow {
  prescription_month: string
  settlement_month: string
  sc_code: string
  customer_name: string
  custom_code: string
  business_number: string
  cso_company_name: string
  cso2_company_name: string
  department1: string
  department2: string
  department3: string
  sales_manager_name: string
  manufacturer_name: string
  settlement_place: string
  insurance_code: string
  product_name: string
  quantity: number
  unit_price: number
  amount: number
  contract_commission_rate: number
  charge_commission_rate: number
  total_contract_commission: number
  total_charge_commission: number
}

export default function CommissionReportPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    prescriptionMonthFrom: prevMonth,
    prescriptionMonthTo: currentMonth,
    settlementMonthFrom: '',
    settlementMonthTo: '',
    salesManager: '',
    csoCompany: '',
    productName: '',
    manufacturerName: '',
    customerName: '',
    includeIncentive: true,
    groupByManufacturer: false,
    groupByCustomer: false,
  })

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('*, items:prescription_items(*)')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.prescriptionMonthFrom)
      .lte('prescription_month', filters.prescriptionMonthTo)

    const result: ReportRow[] = []

    for (const p of prescriptions || []) {
      if (filters.salesManager && !p.sales_manager_name?.includes(filters.salesManager)) continue
      if (filters.csoCompany && !p.cso_company_name?.includes(filters.csoCompany)) continue
      if (filters.customerName && !p.customer_name?.includes(filters.customerName)) continue

      for (const item of (p.items || [])) {
        if (item.is_deleted) continue
        if (filters.productName && !item.product_name?.includes(filters.productName)) continue
        if (filters.manufacturerName && !item.manufacturer_name?.includes(filters.manufacturerName)) continue

        result.push({
          prescription_month: p.prescription_month,
          settlement_month: p.settlement_month,
          sc_code: '',
          customer_name: p.customer_name || '',
          custom_code: '',
          business_number: p.business_number || '',
          cso_company_name: p.cso_company_name || '',
          cso2_company_name: p.cso2_company_name || '',
          department1: p.department1 || '',
          department2: p.department2 || '',
          department3: p.department3 || '',
          sales_manager_name: p.sales_manager_name || '',
          manufacturer_name: item.manufacturer_name || '',
          settlement_place: item.settlement_place || '',
          insurance_code: item.insurance_code || '',
          product_name: item.product_name || '',
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
          amount: item.amount || 0,
          contract_commission_rate: item.contract_commission_rate || 0,
          charge_commission_rate: item.charge_commission_rate || 0,
          total_contract_commission: item.total_contract_commission || 0,
          total_charge_commission: item.total_charge_commission || 0,
        })
      }
    }

    setRows(result)
    setLoading(false)
  }, [filters, supabase])

  const totals = rows.reduce((acc, r) => ({
    qty: acc.qty + r.quantity,
    amount: acc.amount + r.amount,
    contract: acc.contract + r.total_contract_commission,
    charge: acc.charge + r.total_charge_commission,
  }), { qty: 0, amount: 0, contract: 0, charge: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700 mr-1">수수료 정산 레포트</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">처방월</span>
            <Input type="month" value={filters.prescriptionMonthFrom} onChange={(e) => setFilters(f => ({ ...f, prescriptionMonthFrom: e.target.value }))} className="h-7 text-xs w-32" />
            <span className="text-xs text-gray-400">~</span>
            <Input type="month" value={filters.prescriptionMonthTo} onChange={(e) => setFilters(f => ({ ...f, prescriptionMonthTo: e.target.value }))} className="h-7 text-xs w-32" />
          </div>
          <Input placeholder="영업담당자" value={filters.salesManager} onChange={(e) => setFilters(f => ({ ...f, salesManager: e.target.value }))} className="h-7 text-xs w-24" />
          <Input placeholder="CSO업체" value={filters.csoCompany} onChange={(e) => setFilters(f => ({ ...f, csoCompany: e.target.value }))} className="h-7 text-xs w-24" />
          <Input placeholder="거래처명" value={filters.customerName} onChange={(e) => setFilters(f => ({ ...f, customerName: e.target.value }))} className="h-7 text-xs w-24" />
          <Input placeholder="제품명" value={filters.productName} onChange={(e) => setFilters(f => ({ ...f, productName: e.target.value }))} className="h-7 text-xs w-24" />
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={filters.includeIncentive} onChange={(e) => setFilters(f => ({ ...f, includeIncentive: e.target.checked }))} /> 인센티브 포함
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={filters.groupByManufacturer} onChange={(e) => setFilters(f => ({ ...f, groupByManufacturer: e.target.checked }))} /> 제조사별 소계
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={filters.groupByCustomer} onChange={(e) => setFilters(f => ({ ...f, groupByCustomer: e.target.checked }))} /> 거래처별 소계
            </label>
          </div>
          <Button size="sm" onClick={fetchReport} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">정산내역서</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2"><Printer className="h-3 w-3 mr-1" />수수료정산</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2"><FileSpreadsheet className="h-3 w-3 mr-1" />Excel</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['번', '처방월', '정산월', 'SC코드', '거래처', '자체코드', '사업자번호', 'CSO업체', 'CSO2업체', '부서1', '부서2', '부서3', '영업담당자', '제조사', '정산처', '보험코드', '제품명', '수량', '단가', '금액', '재약율%', '담당율%', '재약수수료', '담당수수료'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={24} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={24} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={cn('border-b border-gray-100 hover:bg-blue-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1 text-gray-600">{r.prescription_month}</td>
                <td className="px-2 py-1 text-gray-600">{r.settlement_month}</td>
                <td className="px-2 py-1 text-gray-400">{r.sc_code}</td>
                <td className="px-2 py-1 text-gray-800 font-medium">{r.customer_name}</td>
                <td className="px-2 py-1 text-gray-400">{r.custom_code}</td>
                <td className="px-2 py-1 text-gray-500">{r.business_number}</td>
                <td className="px-2 py-1 text-gray-500">{r.cso_company_name}</td>
                <td className="px-2 py-1 text-gray-400">{r.cso2_company_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.department1}</td>
                <td className="px-2 py-1 text-gray-400">{r.department2}</td>
                <td className="px-2 py-1 text-gray-400">{r.department3}</td>
                <td className="px-2 py-1 text-gray-700">{r.sales_manager_name}</td>
                <td className="px-2 py-1 text-gray-600">{r.manufacturer_name}</td>
                <td className="px-2 py-1 text-gray-500">{r.settlement_place}</td>
                <td className="px-2 py-1 text-gray-600 font-mono">{r.insurance_code}</td>
                <td className="px-2 py-1 text-gray-800">{r.product_name}</td>
                <td className="px-2 py-1 text-right text-gray-700">{r.quantity.toLocaleString()}</td>
                <td className="px-2 py-1 text-right text-gray-600">{formatNumber(r.unit_price)}</td>
                <td className="px-2 py-1 text-right text-gray-700 font-medium">{formatNumber(r.amount)}</td>
                <td className="px-2 py-1 text-right text-blue-500">{r.contract_commission_rate}%</td>
                <td className="px-2 py-1 text-right text-green-500">{r.charge_commission_rate}%</td>
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
        <span className="text-blue-600">재약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}건</span>
      </div>
    </div>
  )
}
