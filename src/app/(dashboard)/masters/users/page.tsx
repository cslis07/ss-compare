'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { User } from '@/lib/types'
import { Search, Plus, Save, KeyRound, Trash2, Upload, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'

const USER_TYPES = ['시스템관리자', '영업관리자', '영업담당자', 'CSO담당자']
const BIZ_TYPES  = ['법인사업자', '개인사업자', '']

/* ── 엑셀 컬럼 헤더 (샘플 양식) ── */
const BULK_HEADERS = [
  '아이디(필수)', '이름(필수)', '사업자구분', '사업자번호',
  '부서1', '부서2', '부서3',
  '전화번호', '휴대전화', '팩스번호', '이메일', '비고',
  '수수료적용구분(ID)', '부서장', '중간관리자', '상태',
]

/* 부서장/중간관리자 → user_type 변환 */
function deriveUserType(
  isManager: boolean,
  isMidManager: boolean,
  explicitType?: string
): string {
  if (explicitType) return explicitType
  if (isManager || isMidManager) return '영업관리자'
  return '영업담당자'
}

/* ═══════════════════════════════════════ */
export default function UsersPage() {
  const supabase = createClient()
  const [users,    setUsers]    = useState<User[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [resetPw,  setResetPw]  = useState('')
  const [showResetPw, setShowResetPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState({ loginId:'', name:'', dept:'', isDeleted:false })

  /* ── 엑셀 일괄등록 ── */
  const [showBulk, setShowBulk] = useState(false)
  const [bulkRows, setBulkRows] = useState<any[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ok:number; skip:number} | null>(null)
  const bulkFileRef = useRef<HTMLInputElement>(null)

  const isNew = selected ? !selected.id : false

  /* ── 데이터 로드 ── */
  const loadUsers = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('users').select('*').order('department1').order('name')
    if (!filters.isDeleted) q = q.eq('is_active', true)
    if (filters.loginId) q = q.ilike('login_id', `%${filters.loginId}%`)
    if (filters.name)    q = q.ilike('name',     `%${filters.name}%`)
    if (filters.dept)    q = q.ilike('department1', `%${filters.dept}%`)
    const { data } = await q.limit(500)
    setUsers(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { loadUsers() }, [loadUsers])

  /* ── 신규 ── */
  function openNew() {
    setPassword(''); setResetPw(''); setShowResetPw(false)
    setSelected({
      id:'', auth_id:null, login_id:'', name:'',
      department1:'', department2:'', department3:'', department4:'',
      user_type:'영업담당자', commission_type:null,
      business_type:'법인사업자', patient_number:null,
      mobile:null, fax:null, email:null, note:null,
      is_active:true, cso_company_id:null, created_at:'', updated_at:'',
    })
  }

  function selectRow(u: User) {
    setPassword(''); setResetPw(''); setShowResetPw(false); setSelected(u)
  }

  /* ── 저장 ── */
  async function handleSave() {
    if (!selected) return
    if (!selected.login_id) { alert('아이디를 입력하세요.'); return }
    if (!selected.name)     { alert('이름을 입력하세요.'); return }
    if (isNew && !password) { alert('신규 사용자는 비밀번호를 입력하세요.'); return }
    if (isNew && password.length < 6) { alert('비밀번호는 6자 이상이어야 합니다.'); return }
    setSaving(true)
    try {
      if (selected.id) {
        const { error } = await supabase.from('users')
          .update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
        if (error) { alert('저장 실패: ' + error.message); return }
        alert('저장되었습니다.'); loadUsers()
      } else {
        const { id: _id, created_at: _c, updated_at: _u, ...rest } = selected
        const { data, error } = await supabase.from('users').insert(rest).select().single()
        if (error) {
          if (error.code === '23505') alert('이미 존재하는 아이디입니다: ' + selected.login_id)
          else alert('저장 실패: ' + error.message)
          return
        }
        const newUser = data as User
        setSelected(newUser)
        const res = await window.fetch('/api/users/create-auth', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ login_id: newUser.login_id, password, user_id: newUser.id }),
        })
        const json = await res.json()
        if (!res.ok) {
          alert(`사용자 저장은 완료됐지만 로그인 계정 생성 실패:\n${json.error}`)
          loadUsers(); return
        }
        setSelected(s => s ? { ...s, auth_id: json.auth_id } : s)
        alert('저장되었습니다. 로그인 계정도 생성되었습니다.'); loadUsers()
      }
    } finally { setSaving(false) }
  }

  /* ── 삭제 ── */
  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm(`'${selected.name}' 사용자를 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      if (selected.auth_id) {
        await window.fetch('/api/users/delete-auth', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ auth_id: selected.auth_id }),
        })
      }
      const { error } = await supabase.from('users').update({
        is_active: false,
        login_id: `${selected.login_id}__DELETED_${Date.now()}`,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id)
      if (error) { alert('삭제 실패: ' + error.message); return }
      alert('삭제되었습니다.'); setSelected(null); loadUsers()
    } finally { setSaving(false) }
  }

  /* ── 비밀번호 초기화 ── */
  async function handleResetPassword() {
    if (!selected?.auth_id) { alert('로그인 계정이 없습니다.'); return }
    if (!resetPw) { alert('새 비밀번호를 입력하세요.'); return }
    if (resetPw.length < 6) { alert('비밀번호는 6자 이상이어야 합니다.'); return }
    setSaving(true)
    try {
      const res = await window.fetch('/api/users/reset-password', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ auth_id: selected.auth_id, password: resetPw }),
      })
      const json = await res.json()
      if (!res.ok) { alert('비밀번호 변경 실패: ' + json.error); return }
      alert('비밀번호가 변경되었습니다.'); setResetPw(''); setShowResetPw(false)
    } finally { setSaving(false) }
  }

  /* ════════════════════════════════
     엑셀 일괄등록
  ════════════════════════════════ */

  /* 샘플 양식 다운로드 */
  function downloadSample() {
    const sample = [['testid','홍길동','법인사업자','123-45-67890','CSO1','','','02-0000-0000','010-0000-0000','','test@email.com','','','N','N','Y']]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([BULK_HEADERS, ...sample])
    ws['!cols'] = BULK_HEADERS.map((_,i)=>({wch: i < 2 ? 16 : 14}))
    XLSX.utils.book_append_sheet(wb, ws, '사용자')
    XLSX.writeFile(wb, '엑셀일괄등록_사용자_sample.xlsx')
  }

  /* 파일 불러오기 */
  function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const buf = ev.target?.result as ArrayBuffer
      const wb  = XLSX.read(buf, { type:'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header:1, defval:'' }) as any[][]
      const rows = raw.slice(1).filter(r => String(r[0]||'').trim() !== '')

      setBulkRows(rows.map(r => {
        const loginId  = String(r[0]||'').trim()
        const name     = String(r[1]||'').trim()
        const bizType  = String(r[2]||'').trim()
        const bizNum   = String(r[3]||'').trim()
        const dept1    = String(r[4]||'').trim()
        const dept2    = String(r[5]||'').trim()
        const dept3    = String(r[6]||'').trim()
        const mobile   = String(r[8]||'').trim()
        const fax      = String(r[9]||'').trim()
        const email    = String(r[10]||'').trim()
        const note     = String(r[11]||'').trim()
        const commType = String(r[12]||'').trim()
        const isManager= String(r[13]||'').toUpperCase() === 'Y'
        const isMidMgr = String(r[14]||'').toUpperCase() === 'Y'
        const isActive = String(r[15]||'').toUpperCase() !== 'N'
        const userType = deriveUserType(isManager, isMidMgr)

        const errors: string[] = []
        if (!loginId) errors.push('아이디 필수')
        if (!name)    errors.push('이름 필수')

        return { loginId, name, bizType, bizNum, dept1, dept2, dept3, mobile, fax, email, note, commType, isManager, isMidMgr, userType, isActive, errors }
      }))
      setBulkResult(null)
    }
    reader.readAsArrayBuffer(file)
    if (bulkFileRef.current) bulkFileRef.current.value = ''
  }

  /* 저장 */
  async function saveBulkUsers() {
    const validRows = bulkRows.filter(r => r.errors.length === 0)
    if (!validRows.length) { alert('저장 가능한 행이 없습니다. 오류를 확인하세요.'); return }
    if (!confirm(`${validRows.length}명을 저장하시겠습니까?\n※ 비밀번호는 개별 설정이 필요합니다.`)) return
    setBulkBusy(true)
    let ok = 0; let skip = 0
    try {
      const BATCH = 50
      for (let i = 0; i < validRows.length; i += BATCH) {
        const chunk = validRows.slice(i, i + BATCH).map(r => ({
          login_id:       r.loginId,
          name:           r.name,
          business_type:  r.bizType  || '',
          patient_number: r.bizNum   || null,
          department1:    r.dept1    || null,
          department2:    r.dept2    || null,
          department3:    r.dept3    || null,
          department4:    null,
          mobile:         r.mobile   || null,
          fax:            r.fax      || null,
          email:          r.email    || null,
          note:           r.note     || null,
          commission_type:r.commType || null,
          user_type:      r.userType,
          is_active:      r.isActive,
          cso_company_id: null,
          auth_id:        null,
        }))
        const { error } = await supabase
          .from('users')
          .upsert(chunk, { onConflict: 'login_id', ignoreDuplicates: false })
        if (error) { skip += chunk.length; console.error(error.message) }
        else ok += chunk.length
      }
      setBulkResult({ ok, skip })
      loadUsers()
    } finally { setBulkBusy(false) }
  }

  /* 결과 엑셀 */
  function downloadBulkResult() {
    if (!bulkRows.length) return
    const hdrs = ['아이디','이름','사업자구분','부서1','부서2','부서3','Mobile','이메일','사용자구분','상태','오류']
    const data = bulkRows.map(r=>[r.loginId,r.name,r.bizType,r.dept1,r.dept2,r.dept3,r.mobile,r.email,r.userType,r.isActive?'Y':'N',r.errors.join(', ')])
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ...data])
    XLSX.utils.book_append_sheet(wb, ws, '결과')
    XLSX.writeFile(wb, '사용자_일괄등록_결과.xlsx')
  }

  const validCount   = bulkRows.filter(r=>r.errors.length===0).length
  const invalidCount = bulkRows.filter(r=>r.errors.length>0).length

  /* ════════════════════════════════
     RENDER
  ════════════════════════════════ */
  return (
    <div className="flex h-full">
      {/* ── 목록 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 툴바 */}
        <div className="bg-white border-b px-3 py-1.5 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">사용자 관리</span>
          <Input placeholder="아이디" value={filters.loginId}
            onChange={e=>setFilters(f=>({...f,loginId:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&loadUsers()} className="h-7 text-xs w-24"/>
          <Input placeholder="이름" value={filters.name}
            onChange={e=>setFilters(f=>({...f,name:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&loadUsers()} className="h-7 text-xs w-24"/>
          <Input placeholder="부서" value={filters.dept}
            onChange={e=>setFilters(f=>({...f,dept:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&loadUsers()} className="h-7 text-xs w-20"/>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={filters.isDeleted}
              onChange={e=>setFilters(f=>({...f,isDeleted:e.target.checked}))}/>
            삭제건포함조회
          </label>
          <Button size="sm" onClick={loadUsers} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1"/>조회
          </Button>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1"/>신규입력
            </Button>
            <Button size="sm" variant="outline"
              className="h-7 text-xs px-2.5 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={()=>{setBulkRows([]);setBulkResult(null);setShowBulk(true)}}>
              <Upload className="h-3 w-3 mr-1"/>엑셀일괄등록
            </Button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번','아이디','부서1','부서2','이름','사용자구분','수수료적용구분','사업자구분','Mobile','이메일','비고','로그인'].map(h=>(
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : users.length===0 ? (
                <tr><td colSpan={12} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : users.map((u,i)=>(
                <tr key={u.id} onClick={()=>selectRow(u)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id===u.id?'bg-yellow-50':i%2===0?'bg-white':'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i+1}</td>
                  <td className="px-2 py-1 text-blue-600 font-medium">{u.login_id}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department1}</td>
                  <td className="px-2 py-1 text-gray-500">{u.department2}</td>
                  <td className="px-2 py-1 font-medium text-gray-800">{u.name}</td>
                  <td className="px-2 py-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{u.user_type}</Badge>
                  </td>
                  <td className="px-2 py-1 text-gray-500 text-[10px]">{u.commission_type}</td>
                  <td className="px-2 py-1 text-gray-500 text-[10px]">{u.business_type}</td>
                  <td className="px-2 py-1 text-gray-500">{u.mobile}</td>
                  <td className="px-2 py-1 text-gray-500">{u.email}</td>
                  <td className="px-2 py-1 text-gray-400 text-[10px] max-w-[80px] truncate">{u.note}</td>
                  <td className="px-2 py-1 text-center">
                    {u.auth_id
                      ? <span className="text-green-600 font-bold">●</span>
                      : <span className="text-gray-300">○</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t px-4 py-1 text-xs text-gray-400">{users.length}건 조회</div>
      </div>

      {/* ── 사용자 입력 패널 ── */}
      {selected && (
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-gray-700 text-white flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold">사용자입력</span>
            {!isNew && (
              <span className={cn('text-[10px]', selected.auth_id ? 'text-green-400' : 'text-yellow-400')}>
                {selected.auth_id ? '로그인계정 연결됨' : '로그인계정 없음'}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-xs">
            {/* 아이디 */}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">아이디</label>
              <Input value={selected.login_id}
                onChange={e=>setSelected(s=>s?{...s,login_id:e.target.value}:s)}
                className="h-7 text-xs flex-1" disabled={!!selected.id}/>
            </div>
            {/* 이름 */}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">이름</label>
              <Input value={selected.name}
                onChange={e=>setSelected(s=>s?{...s,name:e.target.value}:s)}
                className="h-7 text-xs flex-1"/>
            </div>
            {/* 신규 비밀번호 */}
            {isNew && (
              <div className="flex items-center gap-2">
                <label className="text-gray-500 w-20 shrink-0 text-right">비밀번호</label>
                <Input type="password" placeholder="6자 이상" value={password}
                  onChange={e=>setPassword(e.target.value)} className="h-7 text-xs flex-1" autoComplete="new-password"/>
              </div>
            )}
            {/* 사용자구분 */}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">사용자구분</label>
              <Select value={selected.user_type??''} onValueChange={v=>setSelected(s=>s?{...s,user_type:v}:s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue/></SelectTrigger>
                <SelectContent>{USER_TYPES.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 사업자구분 */}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">사업자구분</label>
              <Select value={selected.business_type??''} onValueChange={v=>setSelected(s=>s?{...s,business_type:v}:s)}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue/></SelectTrigger>
                <SelectContent>{BIZ_TYPES.map(v=><SelectItem key={v||'(없음)'} value={v} className="text-xs">{v||'(없음)'}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 나머지 필드 */}
            {([
              ['부서1','department1'],['부서2','department2'],['부서3','department3'],
              ['Mobile','mobile'],['Fax','fax'],['이메일','email'],['비고','note'],
            ] as [string, keyof User][]).map(([label,field])=>(
              <div key={field} className="flex items-center gap-2">
                <label className="text-gray-500 w-20 shrink-0 text-right">{label}</label>
                <Input value={(selected[field] as string)||''}
                  onChange={e=>setSelected(s=>s?{...s,[field]:e.target.value||null}:s)}
                  className="h-7 text-xs flex-1"/>
              </div>
            ))}
            {/* 사용여부 */}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">사용여부</label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!selected.is_active}
                  onChange={e=>setSelected(s=>s?{...s,is_active:e.target.checked}:s)} className="w-4 h-4"/>
                <span className="text-gray-600">활성</span>
              </label>
            </div>
            {/* 비밀번호 초기화 */}
            {!isNew && (
              <div className="border-t pt-2 mt-1">
                {showResetPw ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-gray-500 w-20 shrink-0 text-right">새 비밀번호</label>
                      <Input type="password" placeholder="6자 이상" value={resetPw}
                        onChange={e=>setResetPw(e.target.value)} className="h-7 text-xs flex-1" autoComplete="new-password"/>
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={()=>{setShowResetPw(false);setResetPw('')}} className="h-6 text-[10px] px-2">취소</Button>
                      <Button size="sm" onClick={handleResetPassword} disabled={saving} className="h-6 text-[10px] px-2 bg-orange-500 hover:bg-orange-600 text-white">변경확인</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={()=>setShowResetPw(true)}
                    className="h-6 text-[10px] w-full border-orange-300 text-orange-600 hover:bg-orange-50">
                    <KeyRound className="h-3 w-3 mr-1"/>비밀번호 초기화
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="border-t px-3 py-2 flex items-center justify-between gap-2 shrink-0">
            {selected.id ? (
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={saving} className="h-7 text-xs px-3">
                <Trash2 className="h-3 w-3 mr-1"/>삭제
              </Button>
            ) : <div/>}
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
              <Save className="h-3 w-3 mr-1"/>{saving?'처리중...':'저장(F5)'}
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          엑셀 일괄등록 모달
      ══════════════════════════════════════ */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl flex flex-col" style={{width:'92vw', maxWidth:980, maxHeight:'88vh'}}>

            {/* 헤더 */}
            <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap shrink-0">
              <span className="text-sm font-bold text-gray-800 mr-2">엑셀 일괄등록(사용자)</span>
              <button onClick={downloadSample}
                className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">
                샘플양식
              </button>
              <button onClick={()=>bulkFileRef.current?.click()}
                className="h-7 px-3 text-xs border border-blue-300 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium">
                불러오기
              </button>
              <input ref={bulkFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBulkFile}/>
              <button onClick={saveBulkUsers} disabled={bulkBusy || validCount===0}
                className={cn('h-7 px-4 text-xs rounded font-medium text-white',
                  validCount>0&&!bulkBusy?'bg-blue-600 hover:bg-blue-700':'bg-gray-300 cursor-not-allowed')}>
                저장(F5)
              </button>
              {bulkRows.length>0 && (
                <button onClick={downloadBulkResult}
                  className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">
                  <Download className="h-3 w-3 inline mr-1"/>결과엑셀
                </button>
              )}
              {/* 요약 */}
              {bulkRows.length>0 && (
                <span className="text-xs text-gray-500 ml-1">
                  총 {bulkRows.length}명
                  {validCount>0 && <> · <span className="text-blue-600">저장가능 {validCount}</span></>}
                  {invalidCount>0 && <> · <span className="text-red-500">오류 {invalidCount}</span></>}
                </span>
              )}
              {bulkResult && (
                <span className="text-xs text-green-600 font-medium ml-2">
                  ✅ 저장완료 {bulkResult.ok}명 {bulkResult.skip>0?`/ 실패 ${bulkResult.skip}명`:''}
                </span>
              )}
              <button onClick={()=>{setShowBulk(false);setBulkRows([]);setBulkResult(null)}} className="ml-auto">
                <X className="h-5 w-5 text-gray-400 hover:text-gray-700"/>
              </button>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-auto">
              {bulkBusy ? (
                <div className="flex items-center justify-center h-32 text-gray-400">저장 중...</div>
              ) : bulkRows.length===0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                  <Upload className="h-8 w-8 opacity-40"/>
                  <p className="text-sm">
                    <button onClick={downloadSample} className="text-blue-500 underline">샘플양식</button>을 다운로드 후 작성하여
                    &nbsp;<strong className="text-blue-600">불러오기</strong>를 눌러주세요
                  </p>
                  <p className="text-[10px] text-gray-300">※ 비밀번호는 일괄등록 이후 개별 설정이 필요합니다</p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr className="border-b border-gray-300">
                      {['순번','아이디','이름','사업자구분','부서1','부서2','부서3','Mobile','이메일','비고','사용자구분','상태','오류'].map((h,i)=>(
                        <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap border-r border-gray-200 last:border-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r,i)=>(
                      <tr key={i} className={cn('border-b border-gray-100',
                        r.errors.length>0?'bg-red-50/70':'bg-white hover:bg-blue-50')}>
                        <td className="px-2 py-1 text-gray-400 border-r">{i+1}</td>
                        <td className="px-2 py-1 font-medium text-blue-700 border-r">{r.loginId}</td>
                        <td className="px-2 py-1 font-medium border-r">{r.name}</td>
                        <td className="px-2 py-1 text-gray-500 border-r">{r.bizType}</td>
                        <td className="px-2 py-1 border-r">{r.dept1}</td>
                        <td className="px-2 py-1 border-r">{r.dept2}</td>
                        <td className="px-2 py-1 border-r">{r.dept3}</td>
                        <td className="px-2 py-1 border-r">{r.mobile}</td>
                        <td className="px-2 py-1 border-r">{r.email}</td>
                        <td className="px-2 py-1 text-gray-400 border-r max-w-[80px] truncate">{r.note}</td>
                        <td className="px-2 py-1 border-r">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{r.userType}</Badge>
                        </td>
                        <td className="px-2 py-1 text-center border-r">
                          <span className={r.isActive?'text-green-600':'text-red-400'}>{r.isActive?'Y':'N'}</span>
                        </td>
                        <td className="px-2 py-1 text-red-500 text-[10px]">{r.errors.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 하단 안내 */}
            <div className="border-t px-4 py-1.5 bg-gray-50 text-[10px] text-gray-400 shrink-0">
              ※ 아이디가 이미 존재하면 해당 사용자 정보를 업데이트합니다. 비밀번호(로그인 계정)는 일괄등록 후 개별 설정이 필요합니다.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
