'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <header className="h-10 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>운영시간 09:00 ~ 17:00</span>
        <span className="text-gray-300">|</span>
        <span>정심시간 11:30 ~ 12:30</span>
      </div>
      <div className="flex items-center gap-3">
        {userName && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <User className="h-3.5 w-3.5" />
            <span>{userName}</span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-7 text-xs text-gray-500">
          <LogOut className="h-3.5 w-3.5 mr-1" />
          로그아웃
        </Button>
      </div>
    </header>
  )
}
