'use client'

import { PivotStats } from '@/components/stats/pivot-stats'

export default function ByDepartmentPage() {
  return (
    <PivotStats
      title="부서별 처방집계현황"
      groupColumns={[
        { label: '부서레벨1', value: (c) => c.department1 || 'CSO' },
        { label: '부서레벨2', value: (c) => c.department2 || '부서정보없음' },
        { label: '부서레벨3', value: (c) => c.department3 || '부서정보없음' },
        { label: '영업담당자', value: (c) => c.sales_manager_name },
      ]}
    />
  )
}
