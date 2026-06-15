export interface NavItem {
  title: string
  href?: string
  icon?: string
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  {
    title: '기초정보',
    children: [
      { title: '거래처 관리', href: '/masters/customers' },
      { title: '제품 관리', href: '/masters/products' },
      { title: 'CSO업체 관리', href: '/masters/cso-companies' },
      { title: '거래처별 문전약국 관리', href: '/masters/pharmacy-map' },
      { title: '부서 관리', href: '/masters/departments' },
      { title: '사용자 관리', href: '/masters/users' },
    ],
  },
  {
    title: '처방전 관리',
    children: [
      { title: '처방전 입력/관리', href: '/prescriptions' },
      { title: '처방전 수신 내역', href: '/prescriptions/received' },
    ],
  },
  {
    title: '수수료 관리',
    children: [
      { title: '월별 수수료율 관리', href: '/commissions/rates' },
      { title: '영업담당자 수금현황', href: '/commissions/collection' },
    ],
  },
  {
    title: '처방통계',
    children: [
      { title: '처방집계현황', href: '/statistics/summary' },
      { title: '처방전 등록 현황', href: '/prescriptions/status' },
      { title: '영업담당자별', href: '/statistics/by-manager' },
      { title: '제조사별 제품별', href: '/statistics/by-manufacturer' },
      { title: '부서별', href: '/statistics/by-department' },
      { title: '구분별', href: '/statistics/by-category' },
      { title: '담당자별 제조사별', href: '/statistics/manager-manufacturer' },
      { title: '거래처별 담당자별', href: '/statistics/customer-manager' },
      { title: '제품별 처방내역', href: '/statistics/by-product' },
    ],
  },
  {
    title: '경제적이익보고서',
    href: '/reports/economic-benefit',
  },
  {
    title: '공지사항',
    href: '/notices',
  },
  {
    title: '프로그램 설정',
    href: '/settings',
  },
]
