import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

export function formatMonth(ym: string): string {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${y}년 ${parseInt(m)}월`
}
