'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Copy, FileSpreadsheet, CheckSquare, Trash2, RefreshCw } from 'lucide-react'
import { Prescription } from '@/lib/types'
import { PrescriptionFormDialog } from '@/components/prescriptions/prescription-form-dialog'
import { cn, formatNumber, formatMonth } from '@/lib/utils'

const PAGE_SIZE = 50

export default function PrescriptionsPage() {
  const supabase = createClient()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Prescription | null>(null)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [filters, setFilters] = useState({
    prescriptionMonthFrom: prevMonth,
    prescriptionMonthTo: currentMonth,
    evidenceType: '전체',
    customerName: '',
    salesManager: '',
    csoCompany: '',
    isDeleted: false,
  })

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('prescriptions')
      .select('*')
      .eq('is_deleted', filters.isDeleted)
      .gte('prescription_month', filters.prescriptionMonthFrom)
      .lte('prescription_month', filters.prescriptionMonthTo)
      .order('prescription_month', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (filters.customerName) {
      query = query.ilike('customer_name', `%${filters.customerName}%`)
    }
    if (filters.salesManager) {
      query = query.ilike('sales_manager_name', `%${filters.salesManager}%`)
    }
    if (filters.csoCompany) {
      query = query.ilike('cso_company_name', `%${filters.csoCompany}%`)
    }
    if (filters.evidenceType !== '전체') {
      query = query.eq('evidence_type', filters.evidenceType)
    }

    const { data } = await query
    setPrescriptions(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetchPrescriptions() }, [fetchPrescriptions])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === prescriptions.length) setSelected(new Set())
    else setSelected(new Set(prescriptions.map((p) => p.id)))
  }

  async function handleDelete() {
    if (selected.size === 0) return
    if (!confirm(`${selected.size}건을 삭제하시겠습니까?`)) return
    await supabase.from('prescriptions').update({ is_deleted: true }).in('id', [...selected])
    setSelected(new Set())
    fetchPrescriptions()
  }

  const totals = prescriptions.reduce(
    (acc, p) => ({
      count: acc.count + p.total_count,
      amount: acc.amount + p.total_amount,
      contract: acc.contract + p.total_contract_commission,
      charge: acc.charge + p.total_charge_commission,
    }),
    { count: 0, amount: 0, contract: 0, charge: 0 }
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-700 mr-1">처방전 관리</span>
          <Input
            type="month"
            value={filters.prescriptionMonthFrom}
            onChange={(e) => setFilters((f) => ({ ...f, prescriptionMonthFrom: e.target.value }))}
            className="h-7 text-xs w-32"
          />
          <span className="text-xs text-gray-400">~</span>
          <Input
            type="month"
            value={filters.prescriptionMonthTo}
            onChange={(e) => setFilters((f) => ({ ...f, prescriptionMonthTo: e.target.value }))}
            className="h-7 text-xs w-32"
          />
          <Select value={filters.evidenceType} onValueChange={(v) => setFilters((f) => ({ ...f, evidenceType: v }))}>
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['전체', '처방(EDI)', '조제(EDI)', '직접입력'].map((v) => (
                <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="거래처명"
            value={filters.customerName}
            onChange={(e) => setFilters((f) => ({ ...f, customerName: e.target.value }))}
            className="h-7 text-xs w-28"
          />
          <Input
            placeholder="영업담당자"
            value={filters.salesManager}
            onChange={(e) => setFilters((f) => ({ ...f, salesManager: e.target.value }))}
            className="h-7 text-xs w-24"
          />
          <Input
            placeholder="CSO업체"
            value={filters.csoCompany}
            onChange={(e) => setFilters((f) => ({ ...f, csoCompany: e.target.value }))}
            className="h-7 text-xs w-24"
          />
          <Button size="sm" onClick={fetchPrescriptions} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => fetchPrescriptions()} className="h-7 text-xs px-2">
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3"
            onClick={() => { setEditTarget(null); setShowForm(true) }}>
            <Plus className="h-3 w-3 mr-1" /> 신규등록
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2"
            onClick={() => { if (selected.size === 1) { const p = prescriptions.find(x => selected.has(x.id)); setEditTarget(p || null); setShowForm(true) } }}>
            <Copy className="h-3 w-3 mr-1" /> 복사
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2">
            <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2">
            <CheckSquare className="h-3 w-3 mr-1" /> 확정
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={handleDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> 삭제
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="w-8 px-2 py-1.5 text-center">
                <input type="checkbox" checked={selected.size === prescriptions.length && prescriptions.length > 0}
                  onChange={toggleAll} className="h-3 w-3" />
              </th>
              <th className="w-6 px-1 py-1.5 text-center text-gray-500">번</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">차월</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">정산월</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">처방/조제</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">처방전인상태</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">거래처</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">거래처구분</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">등록수</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">입계금액</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">재약수수료</th>
              <th className="px-2 py-1.5 text-right text-gray-600 font-semibold">담당수수료</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">사업자번호</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">부서</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">영업담당자</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">CSO업체</th>
              <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">CSO2업체</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={17} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : prescriptions.length === 0 ? (
              <tr><td colSpan={17} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
            ) : (
              prescriptions.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => { setEditTarget(p); setShowForm(true) }}
                  className={cn(
                    'border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors',
                    selected.has(p.id) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  )}
                >
                  <td className="px-2 py-1 text-center" onClick={(e) => { e.stopPropagation(); toggleSelect(p.id) }}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="h-3 w-3" />
                  </td>
                  <td className="px-1 py-1 text-center text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-700">{p.prescription_month}</td>
                  <td className="px-2 py-1 text-gray-700">{p.settlement_month}</td>
                  <td className="px-2 py-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-300 text-blue-600">
                      {p.prescription_type}
                    </Badge>
                  </td>
                  <td className="px-2 py-1">
                    <Badge className={cn('text-[10px] px-1 py-0 h-4',
                      p.registration_status === '확정' ? 'bg-green-100 text-green-700' :
                      p.registration_status === '정산' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600')}>
                      {p.registration_status}
                    </Badge>
                  </td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{p.customer_name}</td>
                  <td className="px-2 py-1 text-gray-600">{p.customer_type}</td>
                  <td className="px-2 py-1 text-right text-gray-700">{p.total_count.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right text-gray-700">{formatNumber(p.total_amount)}</td>
                  <td className="px-2 py-1 text-right text-blue-700 font-medium">{formatNumber(p.total_contract_commission)}</td>
                  <td className="px-2 py-1 text-right text-green-700 font-medium">{formatNumber(p.total_charge_commission)}</td>
                  <td className="px-2 py-1 text-gray-500">{p.business_number}</td>
                  <td className="px-2 py-1 text-gray-600">{p.department1}</td>
                  <td className="px-2 py-1 text-gray-700">{p.sales_manager_name}</td>
                  <td className="px-2 py-1 text-gray-600">{p.cso_company_name}</td>
                  <td className="px-2 py-1 text-gray-600">{p.cso2_company_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer totals */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center gap-6 text-xs shrink-0">
        <span className="font-semibold text-gray-600">합계</span>
        <span className="text-gray-600">등록수: <strong>{totals.count.toLocaleString()}</strong></span>
        <span className="text-gray-600">입계금액: <strong>{formatNumber(totals.amount)}</strong></span>
        <span className="text-blue-600">재약수수료: <strong>{formatNumber(totals.contract)}</strong></span>
        <span className="text-green-600">담당수수료: <strong>{formatNumber(totals.charge)}</strong></span>
        <span className="text-gray-400 ml-auto">{prescriptions.length}건 조회</span>
      </div>

      {showForm && (
        <PrescriptionFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSave={() => { setShowForm(false); setEditTarget(null); fetchPrescriptions() }}
          prescription={editTarget}
        />
      )}
    </div>
  )
}
