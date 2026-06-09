'use client'

import { PivotStats } from '@/components/stats/pivot-stats'

export default function ManagerManufacturerPage() {
  return (
    <PivotStats
      title="담당자별 제조사별 처방집계현황"
      showManufacturerFilter
      groupColumns={[
        { label: '영업담당자', value: (c) => c.sales_manager_name },
        { label: '제조사', value: (c) => c.manufacturer_name },
        { label: '제품명', value: (c) => c.product_name },
      ]}
    />
  )
}
