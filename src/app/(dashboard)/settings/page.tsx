'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Setting } from '@/lib/types'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('settings').select('*').order('gcode')
      setSettings(data || [])
      setLoading(false)
    }
    load()
  }, [supabase])

  function updateSetting(gcode: string, value: string) {
    setSettings(prev => prev.map(s => s.gcode === gcode ? { ...s, value } : s))
  }

  async function handleSave() {
    setSaving(true)
    for (const s of settings) {
      await supabase.from('settings').upsert({ ...s, updated_at: new Date().toISOString() }, { onConflict: 'gcode' })
    }
    setSaving(false)
    alert('저장되었습니다.')
  }

  const group1 = settings.filter(s => s.gcode.startsWith('3'))
  const group2 = settings.filter(s => s.gcode.startsWith('4'))

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-gray-700">프로그램 설정</span>
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
          <Save className="h-3 w-3 mr-1" /> {saving ? '저장 중...' : '저장'}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">로딩 중...</div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 mb-2 border-b pb-1">프로그램 설정 (30/31/32/33/34)</h3>
              <div className="space-y-1">
                {group1.map((s, i) => (
                  <div key={s.gcode} className="flex items-center gap-2 py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-400 w-4 text-right">{i + 1}</span>
                    <span className="text-gray-500 font-mono text-[10px] w-16">{s.gcode}</span>
                    <span className="flex-1 text-gray-700">{s.description}</span>
                    <Input value={s.value || ''} onChange={(e) => updateSetting(s.gcode, e.target.value)}
                      className="h-6 text-xs w-16 text-center" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 mb-2 border-b pb-1">처방전 설정 (40)</h3>
              <div className="space-y-1">
                {group2.map((s, i) => (
                  <div key={s.gcode} className="flex items-center gap-2 py-1 border-b border-gray-50 text-xs">
                    <span className="text-gray-400 w-4 text-right">{i + 1}</span>
                    <span className="text-gray-500 font-mono text-[10px] w-16">{s.gcode}</span>
                    <span className="flex-1 text-gray-700">{s.description}</span>
                    <Input value={s.value || ''} onChange={(e) => updateSetting(s.gcode, e.target.value)}
                      className="h-6 text-xs w-24 text-center" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
