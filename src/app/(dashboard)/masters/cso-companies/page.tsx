'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CSOCompany } from '@/lib/types'
import { Search, Plus, Save, Trash2, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CSOCompaniesPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<CSOCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CSOCompany | null>(null)
  const [filters, setFilters] = useState({ name: '', businessNumber: '', contractType: '전체', isDeleted: false })

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('cso_companies').select('*').eq('is_deleted', filters.isDeleted).order('name')
    if (filters.name) q = q.ilike('name', `%${filters.name}%`)
    if (filters.businessNumber) q = q.ilike('business_number', `%${filters.businessNumber}%`)
    if (filters.contractType !== '전체') q = q.eq('contract_type', filters.contractType)
    const { data } = await q.limit(200)
    setCompanies(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() {
    setSelected({
      id: '', cso_code: '', name: '', custom_code: '',
      contract_type: '본사와 직접 계약', report_number: '',
      business_number: '', resident_number: '',
      business_type: '개인사업자', status: '정상',
      representative: '', postal_code: '', road_address: '',
      detail_address: '', phone: '', fax: '', mobile: '',
      contract_start_date: null, contract_end_date: '2999-12-31',
      email: '', commission_email: '', bank_name: '',
      account_number: '', note: '', is_deleted: false,
      created_at: '', updated_at: '',
    })
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.name) { alert('CSO업체명을 입력하세요.'); return }
    if (selected.id) {
      const { error } = await supabase.from('cso_companies').update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = selected
      const { data, error } = await supabase.from('cso_companies').insert(rest).select().single()
      if (error) { alert('저장 실패: ' + error.message); return }
      if (data) setSelected(data as CSOCompany)
    }
    alert('저장되었습니다.')
    fetch()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('cso_companies').update({ is_deleted: true }).eq('id', selected.id)
    setSelected(null)
    fetch()
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">CSO업체 관리</span>
          <Input placeholder="CSO업체명" value={filters.name} onChange={(e) => setFilters(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs w-32" />
          <Input placeholder="사업자번호" value={filters.businessNumber} onChange={(e) => setFilters(f => ({ ...f, businessNumber: e.target.value }))} className="h-7 text-xs w-28" />
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input type="checkbox" checked={filters.isDeleted} onChange={(e) => setFilters(f => ({ ...f, isDeleted: e.target.checked }))} />
            삭제건포함조회
          </label>
          <Button size="sm" onClick={fetch} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1" /> 신규입력
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', 'CSO업체코드', 'CSO업체', '계약처여부', '신고번호', '사업자번호', '주민번호', '자체코드', '사업자구분', '휴폐업구분', '대표자명'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : companies.map((c, i) => (
                <tr key={c.id} onClick={() => setSelected(c)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === c.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono text-[10px]">{c.cso_code}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{c.name}</td>
                  <td className="px-2 py-1 text-gray-600">{c.contract_type}</td>
                  <td className="px-2 py-1 text-gray-500">{c.report_number}</td>
                  <td className="px-2 py-1 text-gray-600">{c.business_number}</td>
                  <td className="px-2 py-1 text-gray-500">{c.resident_number}</td>
                  <td className="px-2 py-1 text-gray-500">{c.custom_code}</td>
                  <td className="px-2 py-1"><Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{c.business_type}</Badge></td>
                  <td className="px-2 py-1 text-gray-500">{c.status}</td>
                  <td className="px-2 py-1 text-gray-600">{c.representative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{companies.length}건 조회</div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-blue-600 text-white flex items-center justify-between">
            <span className="text-sm font-semibold">거래처입력 [ CSO ]</span>
            <span className="text-xs">&gt;&gt;</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-xs">
            {([
              ['CSO 업체', 'name'],
              ['사업자번호', 'business_number'],
              ['자체 코드', 'custom_code'],
              ['대표 자명', 'representative'],
              ['우편번호', 'postal_code'],
              ['도로명주소', 'road_address'],
              ['상세 주소', 'detail_address'],
              ['전화번호', 'phone'],
              ['팩스번호', 'fax'],
              ['휴대폰번호', 'mobile'],
              ['E-MAIL', 'email'],
              ['수수료E-MAIL', 'commission_email'],
              ['은행명', 'bank_name'],
              ['계좌번호', 'account_number'],
              ['신고번호', 'report_number'],
              ['주민번호', 'resident_number'],
              ['비고', 'note'],
            ] as [string, keyof CSOCompany][]).map(([label, field]) => (
              <div key={field} className="flex items-center gap-2">
                <label className="text-gray-500 w-24 shrink-0 text-right">{label}</label>
                <Input value={(selected[field] as string) || ''} onChange={(e) => setSelected(s => s ? { ...s, [field]: e.target.value } : s)} className="h-7 text-xs flex-1" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">사업자구분</label>
              <Select value={selected.business_type ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, business_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['개인사업자', '법인사업자'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">계약처여부</label>
              <Select value={selected.contract_type ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, contract_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['본사와 직접 계약', '재위탁계약', '기타'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">계약 일자</label>
              <Input type="date" value={selected.contract_start_date || ''} onChange={(e) => setSelected(s => s ? { ...s, contract_start_date: e.target.value } : s)} className="h-7 text-xs flex-1" />
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
