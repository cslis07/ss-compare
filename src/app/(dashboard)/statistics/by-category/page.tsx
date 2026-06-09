'use client'

import { PivotStats } from '@/components/stats/pivot-stats'

export default function ByCategoryPage() {
  return (
    <PivotStats
      title="구분별 처방집계현황"
      showManagerFilter={false}
      groupColumns={[
        { label: '거래처구분', value: (c) => c.customer_type || '기타' },
      ]}
    />
  )
}
