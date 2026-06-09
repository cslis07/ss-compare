'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Save, Trash2, FileSpreadsheet } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'

interface CommissionLimit {
  id: string
  manufacturer_code: string | null
  manufacturer_name: string
  start_month: string
  end_month: string
  limit_amount: number
  note: string | null
  is_deleted: boolean
  created_at: string
}

export default function CommissionLimitsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CommissionLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CommissionLimit | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [filters, setFilters] = useState({ manufacturer: '' })

  const currentMonth = new Date().toISOString().slice(0, 7)

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('commission_limits').select('*').eq('is_deleted', false).order('manufacturer_name')
    if (filters.manufacturer) q = q.ilike('manufacturer_name', `%${filters.manufacturer}%`)
    const { data, error } = await q.limit(300)
    if (error && error.code === '42P01') { setTableMissing(true); setRows([]); setLoading(false); return }
    setRows(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function openNew() {
    setSelected({
      id: '', manufacturer_code: '', manufacturer_name: '',
      start_month: currentMonth, end_month: '2999-12',
      limit_amount: 0, note: '', is_deleted: false, created_at: '',
    })
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.manufacturer_name) { alert('제조사명을 입력하세요.'); return }
    if (selected.id) {
      const { error } = await supabase.from('commission_limits').update(selected).eq('id', selected.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { id: _id, created_at: _c, ...rest } = selected
      const { data, error } = await supabase.from('commission_limits').insert(rest).select().single()
      if (error) { alert('저장 실패: ' + error.message); return }
      if (data) setSelected(data as CommissionLimit)
    }
    alert('저장되었습니다.')
    fetchData()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('commission_limits').update({ is_deleted: true }).eq('id', selected.id)
    setSelected(null)
    fetchData()
  }

  if (tableMissing) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <div className="max-w-md">
          <p className="text-gray-700 font-semibold mb-2">commission_limits 테이블이 아직 생성되지 않았습니다.</p>
          <p className="text-xs text-gray-500">Supabase SQL Editor에서 schema.sql의 commission_limits 테이블 생성 구문을 실행해 주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">제조사별 수수료제한 금액 관리</span>
          <Input placeholder="제조사명" value={filters.manufacturer} onChange={(e) => setFilters(f => ({ ...f, manufacturer: e.target.value }))} className="h-7 text-xs w-32" />
          <Button size="sm" onClick={fetchData} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
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
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', '제조사코드', '제조사명', '적용시작월', '적용종료월', '제한금액', '비고'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} onClick={() => setSelected(r)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === r.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono">{r.manufacturer_code}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{r.manufacturer_name}</td>
                  <td className="px-2 py-1 text-gray-600">{r.start_month}</td>
                  <td className="px-2 py-1 text-gray-600">{r.end_month}</td>
                  <td className="px-2 py-1 text-right text-blue-700 font-medium">{formatNumber(r.limit_amount)}</td>
                  <td className="px-2 py-1 text-gray-400">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{rows.length}건</div>
      </div>

      {selected && (
        <div className="w-64 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-gray-700 text-white">
            <span className="text-sm font-semibold">수수료제한 입력</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">제조사코드</label>
              <Input value={selected.manufacturer_code || ''} onChange={(e) => setSelected(s => s ? { ...s, manufacturer_code: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">제조사명</label>
              <Input value={selected.manufacturer_name} onChange={(e) => setSelected(s => s ? { ...s, manufacturer_name: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">적용시작월</label>
              <Input type="month" value={selected.start_month} onChange={(e) => setSelected(s => s ? { ...s, start_month: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">적용종료월</label>
              <Input value={selected.end_month} onChange={(e) => setSelected(s => s ? { ...s, end_month: e.target.value } : s)} className="h-7 text-xs flex-1" placeholder="2999-12" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">제한금액</label>
              <Input type="number" value={selected.limit_amount} onChange={(e) => setSelected(s => s ? { ...s, limit_amount: Number(e.target.value) } : s)} className="h-7 text-xs flex-1 text-right" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-24 shrink-0 text-right">비고</label>
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
