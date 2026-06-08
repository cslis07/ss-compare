'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Notice } from '@/lib/types'
import { Plus, Save, Trash2, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NoticesPage() {
  const supabase = createClient()
  const [notices, setNotices] = useState<Notice[]>([])
  const [selected, setSelected] = useState<Notice | null>(null)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('notices').select('*').eq('is_deleted', false)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100)
    setNotices(data || [])
  }, [supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() {
    setSelected({
      id: '', title: '', content: '', is_pinned: false,
      author_id: null, author_name: null, view_count: 0,
      is_deleted: false, created_at: '', updated_at: '',
    })
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.title) { alert('제목을 입력하세요.'); return }
    if (selected.id) {
      await supabase.from('notices').update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
    } else {
      const { id: _id, created_at: _c, updated_at: _u, view_count: _v, ...rest } = selected
      await supabase.from('notices').insert(rest)
    }
    setSelected(null)
    fetch()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('notices').update({ is_deleted: true }).eq('id', selected.id)
    setSelected(null)
    fetch()
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-gray-700">공지사항</span>
          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3 ml-auto" onClick={openNew}>
            <Plus className="h-3 w-3 mr-1" /> 새 공지
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-gray-600 font-semibold w-12">번호</th>
                <th className="px-3 py-2 text-left text-gray-600 font-semibold w-12">고정</th>
                <th className="px-3 py-2 text-left text-gray-600 font-semibold">제목</th>
                <th className="px-3 py-2 text-left text-gray-600 font-semibold w-24">작성자</th>
                <th className="px-3 py-2 text-left text-gray-600 font-semibold w-32">등록일</th>
                <th className="px-3 py-2 text-right text-gray-600 font-semibold w-16">조회수</th>
              </tr>
            </thead>
            <tbody>
              {notices.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">공지사항이 없습니다.</td></tr>
              ) : notices.map((n, i) => (
                <tr key={n.id} onClick={() => setSelected(n)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === n.id ? 'bg-blue-50' : n.is_pinned ? 'bg-yellow-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 text-center">
                    {n.is_pinned && <Pin className="h-3 w-3 text-red-500 mx-auto" />}
                  </td>
                  <td className="px-3 py-2 text-gray-800 font-medium">
                    {n.is_pinned && <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 h-4 mr-1.5">공지</Badge>}
                    {n.title}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{n.author_name}</td>
                  <td className="px-3 py-2 text-gray-500">{n.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{n.view_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-1/2 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-4 py-2 bg-gray-700 text-white flex items-center justify-between">
            <span className="text-sm font-semibold">{selected.id ? '공지사항 수정' : '새 공지사항'}</span>
          </div>
          <div className="flex-1 flex flex-col px-4 py-3 gap-3">
            <div className="flex items-center gap-2">
              <Input value={selected.title} onChange={(e) => setSelected(s => s ? { ...s, title: e.target.value } : s)}
                placeholder="제목을 입력하세요" className="flex-1 text-sm font-medium" />
              <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                <input type="checkbox" checked={selected.is_pinned} onChange={(e) => setSelected(s => s ? { ...s, is_pinned: e.target.checked } : s)} />
                상단 고정
              </label>
            </div>
            <textarea
              value={selected.content || ''}
              onChange={(e) => setSelected(s => s ? { ...s, content: e.target.value } : s)}
              className="flex-1 border border-gray-200 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-64"
              placeholder="내용을 입력하세요..."
            />
          </div>
          <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7 text-xs px-3" disabled={!selected.id}>
              <Trash2 className="h-3 w-3 mr-1" /> 삭제
            </Button>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setSelected(null)} className="h-7 text-xs px-3">취소</Button>
              <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
                <Save className="h-3 w-3 mr-1" /> 저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
