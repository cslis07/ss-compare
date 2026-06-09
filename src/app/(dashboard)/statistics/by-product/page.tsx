'use client'

import { PivotStats } from '@/components/stats/pivot-stats'

export default function ByProductPage() {
  return (
    <PivotStats
      title="제품별 처방내역 집계현황"
      showProductFilter
      showManufacturerFilter
      showManagerFilter={false}
      groupColumns={[
        { label: '보험코드', value: (c) => c.insurance_code },
        { label: '제품', value: (c) => c.product_name },
        { label: '규격/단위', value: (c) => c.specification },
        { label: '제조사', value: (c) => c.manufacturer_name },
      ]}
    />
  )
}
