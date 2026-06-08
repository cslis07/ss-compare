'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Customer } from '@/lib/types'
import { Search, Plus, Trash2, Save, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

const CUSTOMER_TYPES = ['전체선택', '의원', '병원', '약국', '한의원', '치과', '종합병원', '기타']

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [filters, setFilters] = useState({ name: '', businessNumber: '', customerType: '전체선택', isDeleted: false })

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('customers').select('*').eq('is_deleted', filters.isDeleted).order('name')
    if (filters.name) q = q.ilike('name', `%${filters.name}%`)
    if (filters.businessNumber) q = q.ilike('business_number', `%${filters.businessNumber}%`)
    if (filters.customerType !== '전체선택') q = q.eq('customer_type', filters.customerType)
    const { data } = await q.limit(200)
    setCustomers(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() {
    setSelected({
      id: '', sc_code: '', business_number: '', custom_code: '', name: '',
      representative: '', address: '', postal_code: '', customer_type: '의원',
      prescription_start_date: null, manufacturer_restriction: '전체허용',
      department1: '', department2: '', department3: '',
      sales_manager_id: null, cso_company_id: null, cso2_company_id: null,
      final_cso_company_id: null, billing_type: '처방', phone: '', fax: '',
      note: '', is_deleted: false, created_at: '', updated_at: '',
    })
    setShowPanel(true)
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.name) { alert('거래처명을 입력하세요.'); return }
    if (selected.id) {
      await supabase.from('customers').update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
    } else {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = selected
      await supabase.from('customers').insert(rest)
    }
    setShowPanel(false)
    fetch()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('customers').update({ is_deleted: true }).eq('id', selected.id)
    setShowPanel(false)
    fetch()
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">거래처 관리</span>
          <Input placeholder="거래처명" value={filters.name} onChange={(e) => setFilters(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs w-28" />
          <Input placeholder="사업자번호" value={filters.businessNumber} onChange={(e) => setFilters(f => ({ ...f, businessNumber: e.target.value }))} className="h-7 text-xs w-28" />
          <Select value={filters.customerType} onValueChange={(v) => setFilters(f => ({ ...f, customerType: v ?? '전체선택' }))}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{CUSTOMER_TYPES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={fetch} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1" /> 신규등록
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="px-2 py-1.5 text-left text-gray-600 w-8 font-semibold">번</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">SC코드</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">사업자번호</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">자체코드</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">거래처명</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">처방시작일</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">대표자명</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">거래처종류</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">허용구분</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">부서1</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">부서2</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">영업담당자</th>
                <th className="px-2 py-1.5 text-left text-gray-600 font-semibold">CSO업체</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : customers.map((c, i) => (
                <tr key={c.id} onClick={() => { setSelected(c); setShowPanel(true) }}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === c.id ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono text-[10px]">{c.sc_code}</td>
                  <td className="px-2 py-1 text-gray-600">{c.business_number}</td>
                  <td className="px-2 py-1 text-gray-500">{c.custom_code}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{c.name}</td>
                  <td className="px-2 py-1 text-gray-500">{c.prescription_start_date}</td>
                  <td className="px-2 py-1 text-gray-600">{c.representative}</td>
                  <td className="px-2 py-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{c.customer_type}</Badge>
                  </td>
                  <td className="px-2 py-1 text-gray-500">{c.manufacturer_restriction}</td>
                  <td className="px-2 py-1 text-gray-500">{c.department1}</td>
                  <td className="px-2 py-1 text-gray-500">{c.department2}</td>
                  <td className="px-2 py-1 text-gray-600">{(c as any).sales_manager?.name || ''}</td>
                  <td className="px-2 py-1 text-gray-500">{(c as any).cso_company?.name || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{customers.length}건 조회</div>
      </div>

      {/* Detail panel */}
      {showPanel && selected && (
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-blue-600 text-white flex items-center justify-between">
            <span className="text-sm font-semibold">거래처입력 [ 거래처 ]</span>
            <span className="text-xs">&gt;&gt;</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {([
              ['거래처명', 'name', 'text', false],
              ['사업자번호', 'business_number', 'text', false],
              ['자체코드', 'custom_code', 'text', false],
              ['SC코드', 'sc_code', 'text', false],
              ['대표자명', 'representative', 'text', false],
              ['전화번호', 'phone', 'text', false],
              ['팩스', 'fax', 'text', false],
              ['주소', 'address', 'text', false],
              ['처방시작일', 'prescription_start_date', 'date', false],
            ] as [string, keyof Customer, string, boolean][]).map(([label, field, type]) => (
              <div key={field} className="flex items-center gap-2 text-xs">
                <label className="text-gray-500 w-20 shrink-0 text-right">{label}</label>
                <Input
                  type={type}
                  value={(selected[field] as string) || ''}
                  onChange={(e) => setSelected(s => s ? { ...s, [field]: e.target.value } : s)}
                  className="h-7 text-xs flex-1"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-500 w-20 shrink-0 text-right">거래처종류</label>
              <Select value={selected.customer_type ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, customer_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.slice(1).map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-500 w-20 shrink-0 text-right">처방/조제</label>
              <Select value={selected.billing_type ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, billing_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['처방', '조제'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-500 w-20 shrink-0 text-right">허용구분</label>
              <Select value={selected.manufacturer_restriction ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, manufacturer_restriction: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['전체허용', '제조사제한', '제품제한'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-500 w-20 shrink-0 text-right">부서1</label>
              <Input value={selected.department1 || ''} onChange={(e) => setSelected(s => s ? { ...s, department1: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-500 w-20 shrink-0 text-right">부서2</label>
              <Input value={selected.department2 || ''} onChange={(e) => setSelected(s => s ? { ...s, department2: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-gray-500 w-20 shrink-0 text-right">비고</label>
              <Input value={selected.note || ''} onChange={(e) => setSelected(s => s ? { ...s, note: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7 text-xs px-3">
              <Trash2 className="h-3 w-3 mr-1" /> 삭제
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
              <Save className="h-3 w-3 mr-1" /> 저장(F5)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
