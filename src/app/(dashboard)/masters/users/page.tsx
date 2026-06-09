'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { User } from '@/lib/types'
import { Search, Plus, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function UsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<User | null>(null)
  const [filters, setFilters] = useState({ loginId: '', name: '', isDeleted: false })

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('users').select('*').eq('is_active', !filters.isDeleted).order('name')
    if (filters.loginId) q = q.ilike('login_id', `%${filters.loginId}%`)
    if (filters.name) q = q.ilike('name', `%${filters.name}%`)
    const { data } = await q.limit(200)
    setUsers(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() {
    setSelected({
      id: '', auth_id: null, login_id: '', name: '',
      department1: '', department2: '', department3: '', department4: '',
      user_type: '영업담당자', commission_type: null,
      business_type: '법인사업자', patient_number: null,
      mobile: null, fax: null, email: null, note: null,
      is_active: true, cso_company_id: null,
      created_at: '', updated_at: '',
    })
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.login_id) { alert('아이디를 입력하세요.'); return }
    if (!selected.name) { alert('이름을 입력하세요.'); return }
    if (selected.id) {
      const { error } = await supabase.from('users').update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = selected
      const { data, error } = await supabase.from('users').insert(rest).select().single()
      if (error) {
        if (error.code === '23505') alert('이미 존재하는 아이디입니다: ' + selected.login_id)
        else alert('저장 실패: ' + error.message)
        return
      }
      if (data) setSelected(data as User)
    }
    alert('저장되었습니다.')
    fetch()
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">사용자 관리</span>
          <Input placeholder="아이디" value={filters.loginId} onChange={(e) => setFilters(f => ({ ...f, loginId: e.target.value }))} className="h-7 text-xs w-24" />
          <Input placeholder="이름" value={filters.name} onChange={(e) => setFilters(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs w-24" />
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input type="checkbox" checked={filters.isDeleted} onChange={(e) => setFilters(f => ({ ...f, isDeleted: e.target.checked }))} />
            삭제건포함조회
          </label>
          <Button size="sm" onClick={fetch} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3 ml-auto" onClick={openNew}>
            <Plus className="h-3 w-3 mr-1" /> 신규입력
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', '아이디', '부서1', '부서2', '이름', '사용자구분', '수수료적용구분', '사업자구분', 'Mobile', 'Fax', '이메일'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : users.map((u, i) => (
                <tr key={u.id} onClick={() => setSelected(u)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === u.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-blue-600 font-medium">{u.login_id}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department1}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department2}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{u.name}</td>
                  <td className="px-2 py-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{u.user_type}</Badge>
                  </td>
                  <td className="px-2 py-1 text-gray-500">{u.commission_type}</td>
                  <td className="px-2 py-1 text-gray-500">{u.business_type}</td>
                  <td className="px-2 py-1 text-gray-500">{u.mobile}</td>
                  <td className="px-2 py-1 text-gray-500">{u.fax}</td>
                  <td className="px-2 py-1 text-gray-500">{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{users.length}건 조회</div>
      </div>

      {selected && (
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-gray-700 text-white">
            <span className="text-sm font-semibold">사용자입력</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">아이디</label>
              <Input value={selected.login_id} onChange={(e) => setSelected(s => s ? { ...s, login_id: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">이름</label>
              <Input value={selected.name} onChange={(e) => setSelected(s => s ? { ...s, name: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">사용자구분</label>
              <Select value={selected.user_type ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, user_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['시스템관리자', '영업관리자', '영업담당자', 'CSO담당자'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {([['부서1', 'department1'], ['부서2', 'department2'], ['부서3', 'department3'], ['Mobile', 'mobile'], ['Fax', 'fax'], ['이메일', 'email'], ['비고', 'note']] as [string, keyof User][]).map(([label, field]) => (
              <div key={field} className="flex items-center gap-2">
                <label className="text-gray-500 w-20 shrink-0 text-right">{label}</label>
                <Input value={(selected[field] as string) || ''} onChange={(e) => setSelected(s => s ? { ...s, [field]: e.target.value } : s)} className="h-7 text-xs flex-1" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">사업자구분</label>
              <Select value={selected.business_type ?? ''} onValueChange={(v) => setSelected(s => s ? { ...s, business_type: v } : s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['법인사업자', '개인사업자'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-end gap-2">
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
              <Save className="h-3 w-3 mr-1" /> 저장(F5)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
