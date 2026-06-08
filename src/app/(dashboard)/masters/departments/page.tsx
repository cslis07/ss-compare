'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Department, User } from '@/lib/types'
import { Plus, Save, ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DepartmentsPage() {
  const supabase = createClient()
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [deptUsers, setDeptUsers] = useState<User[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const fetch = useCallback(async () => {
    const [{ data: depts }, { data: usersData }] = await Promise.all([
      supabase.from('departments').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('users').select('*').eq('is_active', true).order('name'),
    ])
    setDepartments(depts || [])
    setUsers(usersData || [])
  }, [supabase])

  useEffect(() => { fetch() }, [fetch])

  function buildTree(depts: Department[], parentId: string | null = null): Department[] {
    return depts
      .filter(d => d.parent_id === parentId)
      .map(d => ({ ...d, children: buildTree(depts, d.id) }))
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectDept(d: Department) {
    setSelectedDept(d)
    const dUsers = users.filter(u => u.department1 === d.name || u.department2 === d.name)
    setDeptUsers(dUsers)
  }

  async function handleSave() {
    if (!selectedDept) return
    if (selectedDept.id) {
      await supabase.from('departments').update(selectedDept).eq('id', selectedDept.id)
    } else {
      const { id: _id, created_at: _c, ...rest } = selectedDept
      await supabase.from('departments').insert(rest)
    }
    fetch()
  }

  function openNew() {
    setSelectedDept({ id: '', parent_id: selectedDept?.id || null, name: '', code: null, sort_order: 0, is_active: true, created_at: '' })
  }

  const tree = buildTree(departments)

  function DeptNode({ d, depth = 0 }: { d: Department; depth?: number }) {
    const hasChildren = d.children && d.children.length > 0
    const isExpanded = expandedIds.has(d.id)
    return (
      <div>
        <div
          onClick={() => selectDept(d)}
          className={cn('flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-blue-50 rounded text-xs',
            selectedDept?.id === d.id ? 'bg-blue-100 text-blue-800' : 'text-gray-700')}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleExpand(d.id) }} className="text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <Building2 className="h-3 w-3 text-gray-300" />
          )}
          <span className="font-medium">{d.name}</span>
          {d.code && <span className="text-gray-400 text-[10px] ml-1">({d.code})</span>}
        </div>
        {hasChildren && isExpanded && d.children!.map(child => (
          <DeptNode key={child.id} d={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Tree panel */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">부서 관리</span>
          <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 px-2" onClick={openNew}>
            <Plus className="h-2.5 w-2.5 mr-0.5" /> 추가
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {tree.map(d => <DeptNode key={d.id} d={d} />)}
          {tree.length === 0 && <div className="text-xs text-gray-400 text-center py-4">부서가 없습니다.</div>}
        </div>
      </div>

      {/* Users list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
          <span className="text-xs font-semibold text-gray-600">
            {selectedDept ? `[${selectedDept.name}] 소속 영업담당자` : '부서를 선택하세요'}
          </span>
        </div>
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', '부서명', '부서장', '아이디', '이름', '사용자구분', '전화번호', 'Mobile', 'Fax', '이메일', '비고', '사용', '폼코드'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deptUsers.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">
                  {selectedDept ? '소속 사용자가 없습니다.' : '부서를 선택하세요.'}
                </td></tr>
              ) : deptUsers.map((u, i) => (
                <tr key={u.id} className={cn('border-b border-gray-100', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department1}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department2}</td>
                  <td className="px-2 py-1 text-blue-600">{u.login_id}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{u.name}</td>
                  <td className="px-2 py-1 text-gray-500">{u.user_type}</td>
                  <td className="px-2 py-1 text-gray-500">{u.fax}</td>
                  <td className="px-2 py-1 text-gray-500">{u.mobile}</td>
                  <td className="px-2 py-1 text-gray-500">{u.fax}</td>
                  <td className="px-2 py-1 text-gray-500">{u.email}</td>
                  <td className="px-2 py-1 text-gray-400">{u.note}</td>
                  <td className="px-2 py-1 text-center">{u.is_active ? '✓' : ''}</td>
                  <td className="px-2 py-1 text-gray-400">{u.commission_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit panel */}
      {selectedDept && (
        <div className="w-56 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-gray-700 text-white">
            <span className="text-sm font-semibold">부서 정보</span>
          </div>
          <div className="flex-1 px-3 py-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-16 shrink-0 text-right">부서명</label>
              <Input value={selectedDept.name} onChange={(e) => setSelectedDept(s => s ? { ...s, name: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-16 shrink-0 text-right">코드</label>
              <Input value={selectedDept.code || ''} onChange={(e) => setSelectedDept(s => s ? { ...s, code: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-16 shrink-0 text-right">순서</label>
              <Input type="number" value={selectedDept.sort_order} onChange={(e) => setSelectedDept(s => s ? { ...s, sort_order: Number(e.target.value) } : s)} className="h-7 text-xs flex-1" />
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2">
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 w-full px-3">
              <Save className="h-3 w-3 mr-1" /> 저장
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
