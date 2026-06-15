'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AppHeader({ userName }: { userName?: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-11 border-b border-slate-200 bg-white flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        <span>운영시간 09:00 ~ 17:00</span>
        <span className="inline-block w-px h-3 bg-slate-200" />
        <span>점심시간 11:30 ~ 12:30</span>
      </div>

      <div className="flex items-center gap-2">
        {userName && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[12px] text-slate-600">
            <User className="h-3 w-3 text-slate-400" />
            <span className="font-medium">{userName}</span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          로그아웃
        </button>
      </div>
    </header>
  )
}
