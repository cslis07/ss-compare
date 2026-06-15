'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Department } from '@/lib/types'
import { Plus, Save, ChevronRight, ChevronDown, Building2, FileSpreadsheet, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ParsedRow = { d1: string; d2: string; d3: string }

export default function DepartmentsPage() {
  const supabase = createClient()
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<{ id:string;login_id:string;name:string;department1:string|null;department2:string|null;user_type:string;mobile:string|null;fax:string|null;email:string|null;note:string|null;is_active:boolean;commission_type:string|null }[]>([])
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [deptUsers, setDeptUsers] = useState<typeof users>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 엑셀 일괄등록 modal
  const [showBulk, setShowBulk] = useState(false)
  const [bulkRows, setBulkRows] = useState<ParsedRow[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAll = useCallback(async () => {
    const [{ data: depts }, { data: usersData }] = await Promise.all([
      supabase.from('departments').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('users').select('id,login_id,name,department1,department2,user_type,mobile,fax,email,note,is_active,commission_type').eq('is_active', true).order('name'),
    ])
    setDepartments(depts || [])
    setUsers(usersData || [])
  }, [supabase])

  useEffect(() => { loadAll() }, [loadAll])

  function buildTree(depts: Department[], parentId: string | null = null): Department[] {
    return depts
      .filter(d => d.parent_id === parentId)
      .map(d => ({ ...d, children: buildTree(depts, d.id) }))
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function selectDept(d: Department) {
    setSelectedDept(d)
    setDeptUsers(users.filter(u => u.department1 === d.name || u.department2 === d.name))
  }

  async function handleSave() {
    if (!selectedDept) return
    const { children: _ch, ...clean } = selectedDept as any
    if (selectedDept.id) {
      const { error } = await supabase.from('departments').update(clean).eq('id', selectedDept.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { id: _id, created_at: _c, ...rest } = clean
      const { data, error } = await supabase.from('departments').insert(rest).select().single()
      if (error) { alert('저장 실패: ' + error.message); return }
      if (data) setSelectedDept(data as Department)
    }
    alert('저장되었습니다.')
    loadAll()
  }

  function openNew() {
    setSelectedDept({ id:'', parent_id:selectedDept?.id||null, name:'', code:null, sort_order:0, is_active:true, created_at:'' })
  }

  /* ── 샘플 양식 다운로드 ── */
  async function downloadSample() {
    const XLSX = (await import('xlsx-js-style')).default
    const ws = XLSX.utils.aoa_to_sheet([
      ['부서1','부서2','부서3'],
      ['CSO1','영업1팀',''],
      ['CSO1','영업2팀',''],
      ['CSO2','영업3팀',''],
      ['CSO3','',''],
    ])
    ws['A1'].s = ws['B1'].s = ws['C1'].s = { font:{bold:true}, fill:{fgColor:{rgb:'DBEAFE'}} }
    ws['!cols'] = [{wch:16},{wch:16},{wch:16}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '부서')
    XLSX.writeFile(wb, '엑셀 일괄등록(부서)_샘플.xlsx')
  }

  /* ── 파일 파싱 ── */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const XLSX = (await import('xlsx-js-style')).default
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' }) as string[][]
    const rows: ParsedRow[] = raw.slice(1)
      .filter(r => r.some(c => String(c).trim()))
      .map(r => ({
        d1: String(r[0]||'').trim(),
        d2: String(r[1]||'').trim(),
        d3: String(r[2]||'').trim(),
      }))
    setBulkRows(rows)
  }

  /* ── 일괄 저장 ── */
  async function saveBulk() {
    if (bulkRows.length === 0) { alert('불러온 데이터가 없습니다.'); return }
    setBulkSaving(true)

    // 현재 부서 목록 로드
    const { data: existing } = await supabase.from('departments').select('id,name,parent_id,sort_order').eq('is_active', true)
    const depts = existing || []

    const findDept = (name: string, parentId: string | null) =>
      depts.find(d => d.name === name && d.parent_id === parentId)

    const getOrCreate = async (name: string, parentId: string | null, sortOrder: number): Promise<string | null> => {
      if (!name) return null
      const found = findDept(name, parentId)
      if (found) return found.id
      const { data, error } = await supabase.from('departments')
        .insert({ name, parent_id: parentId, sort_order: sortOrder, is_active: true, code: name })
        .select('id,name,parent_id,sort_order').single()
      if (error || !data) { console.error('insert error', error); return null }
      depts.push(data)
      return data.id
    }

    let added = 0
    let idx = 0
    for (const row of bulkRows) {
      if (!row.d1) continue
      const d1Id = await getOrCreate(row.d1, null, idx++)
      if (row.d2 && d1Id) await getOrCreate(row.d2, d1Id, idx++)
      if (row.d3 && d1Id && row.d2) {
        const d2 = depts.find(d => d.name === row.d2 && d.parent_id === d1Id)
        if (d2) await getOrCreate(row.d3, d2.id, idx++)
      }
      added++
    }

    setBulkSaving(false)
    alert(`완료: ${added}건 처리`)
    setShowBulk(false)
    setBulkRows([])
    loadAll()
  }

  const tree = buildTree(departments)

  function DeptNode({ d, depth = 0 }: { d: Department; depth?: number }) {
    const hasChildren = d.children && d.children.length > 0
    const isExpanded = expandedIds.has(d.id)
    return (
      <div>
        <div onClick={() => selectDept(d)}
          className={cn('flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-blue-50 rounded text-xs',
            selectedDept?.id === d.id ? 'bg-blue-100 text-blue-800' : 'text-gray-700')}
          style={{ paddingLeft: `${8 + depth * 16}px` }}>
          {hasChildren ? (
            <button onClick={e => { e.stopPropagation(); toggleExpand(d.id) }} className="text-gray-400 hover:text-gray-600">
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
    <div className="flex h-full relative">
      {/* ── 왼쪽: 부서 트리 ── */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-700 flex-1">부서 관리</span>
          <Button size="sm" className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 px-2 whitespace-nowrap"
            onClick={() => { setBulkRows([]); setShowBulk(true) }}>
            <FileSpreadsheet className="h-2.5 w-2.5 mr-0.5" />엑셀일괄등록
          </Button>
          <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 px-2" onClick={openNew}>
            <Plus className="h-2.5 w-2.5 mr-0.5" />추가
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {tree.map(d => <DeptNode key={d.id} d={d} />)}
          {tree.length === 0 && <div className="text-xs text-gray-400 text-center py-4">부서가 없습니다.</div>}
        </div>
      </div>

      {/* ── 가운데: 소속 사용자 목록 ── */}
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
                {['번','부서명','부서장','아이디','이름','사용자구분','전화번호','Mobile','Fax','이메일','비고','사용','폼코드'].map(h => (
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
                <tr key={u.id} className={cn('border-b border-gray-100', i%2===0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i+1}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department1}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department2}</td>
                  <td className="px-2 py-1 text-blue-600">{u.login_id}</td>
                  <td className="px-2 py-1 font-medium text-gray-800">{u.name}</td>
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

      {/* ── 오른쪽: 부서 편집 패널 ── */}
      {selectedDept && !showBulk && (
        <div className="w-56 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-gray-700 text-white">
            <span className="text-sm font-semibold">부서 정보</span>
          </div>
          <div className="flex-1 px-3 py-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-16 shrink-0 text-right">부서명</label>
              <Input value={selectedDept.name}
                onChange={e => setSelectedDept(s => s ? {...s, name: e.target.value} : s)}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-16 shrink-0 text-right">코드</label>
              <Input value={selectedDept.code || ''}
                onChange={e => setSelectedDept(s => s ? {...s, code: e.target.value} : s)}
                className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-16 shrink-0 text-right">순서</label>
              <Input type="number" value={selectedDept.sort_order}
                onChange={e => setSelectedDept(s => s ? {...s, sort_order: Number(e.target.value)} : s)}
                className="h-7 text-xs flex-1" />
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2">
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 w-full px-3">
              <Save className="h-3 w-3 mr-1" />저장
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          엑셀 일괄등록 모달 오버레이
      ══════════════════════════════════════════ */}
      {showBulk && (
        <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/30 pt-8">
          <div className="bg-white rounded shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 bg-blue-700 text-white rounded-t">
              <span className="text-sm font-bold">엑셀 일괄등록 (부서)</span>
              <button onClick={() => { setShowBulk(false); setBulkRows([]) }}
                className="hover:text-white/70"><X className="h-4 w-4" /></button>
            </div>

            {/* 버튼 행 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <Button size="sm" variant="outline" onClick={downloadSample}
                className="h-7 text-xs px-3">
                <FileSpreadsheet className="h-3 w-3 mr-1 text-green-600" />샘플양식
              </Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
                <Upload className="h-3 w-3 mr-1" />불러오기
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <span className="text-xs text-gray-400 ml-1">
                {bulkRows.length > 0 ? `${bulkRows.length}행 로드됨` : 'xlsx 파일을 선택하세요'}
              </span>
              <div className="ml-auto">
                <Button size="sm" onClick={saveBulk} disabled={bulkSaving || bulkRows.length === 0}
                  className="h-7 text-xs bg-green-600 hover:bg-green-700 px-4 disabled:opacity-50">
                  <Save className="h-3 w-3 mr-1" />{bulkSaving ? '저장 중...' : '저장(F5)'}
                </Button>
              </div>
            </div>

            {/* 안내 */}
            <div className="px-4 py-2 text-[11px] text-gray-500 bg-blue-50 border-b border-blue-100">
              컬럼 구성: <strong>부서1</strong> (최상위) → <strong>부서2</strong> (하위) → <strong>부서3</strong> (하위) 계층 구조. 이미 존재하는 부서명은 건너뜁니다.
            </div>

            {/* 미리보기 테이블 */}
            <div className="flex-1 overflow-auto">
              {bulkRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-gray-300" />
                  <p className="text-sm">샘플양식을 다운로드하거나 엑셀 파일을 불러오세요.</p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-3 py-1.5 text-gray-600 w-8">번</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-gray-600 text-left">부서1</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-gray-600 text-left">부서2</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-gray-600 text-left">부서3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-200 px-3 py-1 text-center text-gray-400">{i+1}</td>
                        <td className="border border-gray-200 px-3 py-1 font-medium text-gray-800">{r.d1}</td>
                        <td className="border border-gray-200 px-3 py-1 text-gray-700 pl-6">{r.d2}</td>
                        <td className="border border-gray-200 px-3 py-1 text-gray-600 pl-10">{r.d3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
