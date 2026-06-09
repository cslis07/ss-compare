'use client'

import { PivotStats } from '@/components/stats/pivot-stats'

export default function CustomerManagerPage() {
  return (
    <PivotStats
      title="거래처별 영업담당자별 처방집계현황"
      groupColumns={[
        { label: '거래처', value: (c) => c.customer_name },
        { label: '사업자번호', value: (c) => c.business_number },
        { label: '영업담당자', value: (c) => c.sales_manager_name },
      ]}
    />
  )
}
