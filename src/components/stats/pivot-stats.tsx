'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileSpreadsheet } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

export interface GroupColumn {
  /** Header label */
  label: string
  /** Width class, optional */
  width?: string
  /** Returns the cell value for a prescription+item pair */
  value: (ctx: RowContext) => string
}

export interface RowContext {
  // prescription-level
  prescription_month: string
  customer_name: string
  business_number: string
  customer_type: string
  sales_manager_name: string
  cso_company_name: string
  cso2_company_name: string
  department1: string
  department2: string
  department3: string
  // item-level
  manufacturer_name: string
  insurance_code: string
  product_name: string
  specification: string
  product_group: string
  // metrics
  amount: number
  quantity: number
  contract_commission: number
  additional_commission: number
  charge_commission: number
  additional_charge: number
}

interface MonthMetrics {
  count: number
  amount: number
  contractCommission: number
  chargeCommission: number
}

interface PivotRow {
  keys: string[]
  byMonth: Record<string, MonthMetrics>
  total: MonthMetrics
}

const emptyMetrics = (): MonthMetrics => ({ count: 0, amount: 0, contractCommission: 0, chargeCommission: 0 })

export interface PivotStatsProps {
  title: string
  groupColumns: GroupColumn[]
  /** Default extra filter inputs to render */
  showManagerFilter?: boolean
  showProductFilter?: boolean
  showManufacturerFilter?: boolean
}

export function PivotStats({
  title,
  groupColumns,
  showManagerFilter = true,
  showProductFilter = false,
  showManufacturerFilter = false,
}: PivotStatsProps) {
  const supabase = createClient()
  const [rows, setRows] = useState<PivotRow[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    monthFrom: prevMonth,
    monthTo: currentMonth,
    manager: '',
    product: '',
    manufacturer: '',
  })

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setHasSearched(true)
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('*, items:prescription_items(*)')
      .eq('is_deleted', false)
      .gte('prescription_month', filters.monthFrom)
      .lte('prescription_month', filters.monthTo)

    const monthSet = new Set<string>()
    const pivot: Record<string, PivotRow> = {}
    // track distinct prescriptions per group+month for 처방건
    const seenPrescriptions: Record<string, Set<string>> = {}

    for (const p of prescriptions || []) {
      for (const item of (p.items || [])) {
        if (item.is_deleted) continue
        const ctx: RowContext = {
          prescription_month: p.prescription_month || '',
          customer_name: p.customer_name || '',
          business_number: p.business_number || '',
          customer_type: p.customer_type || '',
          sales_manager_name: p.sales_manager_name || '',
          cso_company_name: p.cso_company_name || '',
          cso2_company_name: p.cso2_company_name || '',
          department1: p.department1 || '',
          department2: p.department2 || '',
          department3: p.department3 || '',
          manufacturer_name: item.manufacturer_name || '',
          insurance_code: item.insurance_code || '',
          product_name: item.product_name || '',
          specification: item.specification || '',
          product_group: item.product_group || '',
          amount: item.amount || 0,
          quantity: item.quantity || 0,
          contract_commission: item.total_contract_commission || 0,
          additional_commission: item.additional_commission_rate || 0,
          charge_commission: item.total_charge_commission || 0,
          additional_charge: item.additional_charge_commission || 0,
        }

        // filters
        if (filters.manager && !ctx.sales_manager_name.includes(filters.manager)) continue
        if (filters.product && !ctx.product_name.includes(filters.product)) continue
        if (filters.manufacturer && !ctx.manufacturer_name.includes(filters.manufacturer)) continue

        const month = ctx.prescription_month
        monthSet.add(month)
        const keys = groupColumns.map(c => c.value(ctx))
        const rowKey = keys.join('|')
        if (!pivot[rowKey]) {
          pivot[rowKey] = { keys, byMonth: {}, total: emptyMetrics() }
          seenPrescriptions[rowKey] = new Set()
        }
        if (!pivot[rowKey].byMonth[month]) pivot[rowKey].byMonth[month] = emptyMetrics()
        const m = pivot[rowKey].byMonth[month]
        const t = pivot[rowKey].total

        // count distinct prescriptions per row
        const presKey = `${month}|${p.id}`
        if (!seenPrescriptions[rowKey].has(presKey)) {
          seenPrescriptions[rowKey].add(presKey)
          m.count += 1
          t.count += 1
        }
        m.amount += ctx.amount
        m.contractCommission += ctx.contract_commission
        m.chargeCommission += ctx.charge_commission
        t.amount += ctx.amount
        t.contractCommission += ctx.contract_commission
        t.chargeCommission += ctx.charge_commission
      }
    }

    const sortedMonths = Array.from(monthSet).sort()
    setMonths(sortedMonths)
    setRows(Object.values(pivot).sort((a, b) => a.keys.join().localeCompare(b.keys.join())))
    setLoading(false)
  }, [filters, supabase, groupColumns])

  // grand totals
  const grand = rows.reduce((acc, r) => ({
    count: acc.count + r.total.count,
    amount: acc.amount + r.total.amount,
    contractCommission: acc.contractCommission + r.total.contractCommission,
    chargeCommission: acc.chargeCommission + r.total.chargeCommission,
  }), emptyMetrics())

  const metricCols = ['처방건', '합계금액', '수수료(제약)', '수수료(담당)']

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-sm font-semibold text-gray-700 mr-1">{title}</span>
        <Input type="month" value={filters.monthFrom} onChange={(e) => setFilters(f => ({ ...f, monthFrom: e.target.value }))} className="h-7 text-xs w-32" />
        <span className="text-xs text-gray-400">~</span>
        <Input type="month" value={filters.monthTo} onChange={(e) => setFilters(f => ({ ...f, monthTo: e.target.value }))} className="h-7 text-xs w-32" />
        {showManagerFilter && (
          <Input placeholder="영업담당자" value={filters.manager} onChange={(e) => setFilters(f => ({ ...f, manager: e.target.value }))} className="h-7 text-xs w-24" />
        )}
        {showProductFilter && (
          <Input placeholder="제품명" value={filters.product} onChange={(e) => setFilters(f => ({ ...f, product: e.target.value }))} className="h-7 text-xs w-28" />
        )}
        {showManufacturerFilter && (
          <Input placeholder="제조사명" value={filters.manufacturer} onChange={(e) => setFilters(f => ({ ...f, manufacturer: e.target.value }))} className="h-7 text-xs w-28" />
        )}
        <Button size="sm" onClick={fetchStats} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Search className="h-3 w-3 mr-1" /> 조회
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 ml-auto">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="text-xs border-collapse w-max min-w-full">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {groupColumns.map((c, i) => (
                <th key={i} rowSpan={2} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap border-r border-gray-200 sticky left-0 bg-gray-50">{c.label}</th>
              ))}
              {months.map(m => (
                <th key={m} colSpan={metricCols.length} className="px-2 py-1 text-center text-gray-700 font-semibold border-r border-gray-300 bg-blue-50">{m}</th>
              ))}
              <th colSpan={metricCols.length} className="px-2 py-1 text-center text-gray-700 font-semibold bg-amber-50">합계</th>
            </tr>
            <tr className="border-b border-gray-200">
              {months.map(m => metricCols.map((mc, j) => (
                <th key={m + j} className="px-2 py-1 text-right text-gray-500 font-medium whitespace-nowrap bg-blue-50/50">{mc}</th>
              )))}
              {metricCols.map((mc, j) => (
                <th key={'t' + j} className="px-2 py-1 text-right text-gray-500 font-medium whitespace-nowrap bg-amber-50/50">{mc}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={groupColumns.length + (months.length + 1) * metricCols.length} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={groupColumns.length + 4} className="text-center py-8 text-gray-400">조회 버튼을 클릭하세요.</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={groupColumns.length + 4} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                {r.keys.map((k, j) => (
                  <td key={j} className="px-2 py-1 text-gray-800 whitespace-nowrap border-r border-gray-100 sticky left-0 bg-inherit">{k}</td>
                ))}
                {months.map(m => {
                  const mm = r.byMonth[m] || emptyMetrics()
                  return [
                    <td key={m + 'c'} className="px-2 py-1 text-right text-gray-600">{mm.count || ''}</td>,
                    <td key={m + 'a'} className="px-2 py-1 text-right text-gray-700">{mm.amount ? formatNumber(mm.amount) : ''}</td>,
                    <td key={m + 'p'} className="px-2 py-1 text-right text-blue-700">{mm.contractCommission ? formatNumber(mm.contractCommission) : ''}</td>,
                    <td key={m + 'g'} className="px-2 py-1 text-right text-green-700 border-r border-gray-200">{mm.chargeCommission ? formatNumber(mm.chargeCommission) : ''}</td>,
                  ]
                })}
                <td className="px-2 py-1 text-right text-gray-700 font-medium bg-amber-50/30">{r.total.count}</td>
                <td className="px-2 py-1 text-right text-gray-800 font-medium bg-amber-50/30">{formatNumber(r.total.amount)}</td>
                <td className="px-2 py-1 text-right text-blue-700 font-medium bg-amber-50/30">{formatNumber(r.total.contractCommission)}</td>
                <td className="px-2 py-1 text-right text-green-700 font-medium bg-amber-50/30">{formatNumber(r.total.chargeCommission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">총합계</span>
        <span>처방건: <strong>{grand.count.toLocaleString()}</strong></span>
        <span>합계금액: <strong>{formatNumber(grand.amount)}</strong></span>
        <span className="text-blue-600">제약수수료: <strong>{formatNumber(grand.contractCommission)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(grand.chargeCommission)}</strong></span>
        <span className="text-gray-400 ml-auto">{rows.length}개 그룹</span>
      </div>
    </div>
  )
}
