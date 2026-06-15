import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const ENV_PATH = 'C:/Users/GB/Documents/ss-compare/.env.local'
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf-8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const MENU_LIST = [
  '거래처 기간내 인센티브 관리', '거래처 등록 요청', '거래처 제품별 인센티브 관리',
  '거래처 제품별 담당/재단 날짜 조회', '거래처관리', '거래처별 보건약관리',
  '거래처별 영업담당자별 처방집계현황', '거래처별 인센티브 관리', '거래처별 CSO업체 연결 관리',
  '관련품 제품', '공지사항', '구분별 처방집계현황', '기초요인 제출 일람현황',
  '단기관 제품설명회', '단일기간 제품설명회', '부서관리', '사용자관리',
  '성분별 거래처별 처방집계현황', '수수료 정산 리포트', '수정이력 조회', '수금이력 조회',
  '영업담당자 목표 관리', '영업담당자별 목표대비 실적 현황',
  '영업담당자별 제조사별 제품별 처방집계현황', '영업담당자별 처방집계현황',
  '품절 수수료율 관리', '제조사별 수수료율 항목 관리', '제조사별 인센티브 금액 관리',
  '제조사별 제품별 처방집계현황', '제품관리', '제품별 단가단위 관리', '제품별 처방집계현황',
  '제품수수료율 역설등록', '재한관리(제조사/제품)', '제한품목 관리', '처방등록 현황',
  '처방건 전송처 관리', '처방전 건별 재 제품 관리', '처방전관리', '처방전 진료과별 관리',
  '처방집계등록', '처방집계설정등록', '처방집계현황', '프로그램 설정관리',
  '품출 라포트(판별)', '품출 라포트(제품별)', '품출 라포트(지역별)',
  'CSO업체 등록 요청', 'CSO업체관리', 'CSO업체별 인센티브 관리', 'CSO대외약처 관리',
]

const INCENTIVES = [
  { name: '거래처별 제품별 인센티브', priority: 5 },
  { name: 'CSO업체별 인센티브', priority: 3 },
  { name: '신규거래처 제품별 인센티브', priority: 4 },
  { name: '거래처 인센티브', priority: 2 },
  { name: '제조사별 인센티브', priority: 1 },
  { name: '제품별 인센티브', priority: 6 },
  { name: 'CSO업체 제품그룹별 인센티브', priority: 7 },
]

const MENU_PERMS = MENU_LIST.map((name, i) => ({
  id: i + 1, name, sv: false, sc: false, mv: true, mc: true,
}))

const NEW_SETTINGS = [
  { gcode: '30060002', description: '원외 처방만 입력 (원내 처방 비활성)', value: 'Y' },
  { gcode: '30080005', description: '영업담당자 제약 수수료 표시', value: 'N' },
  { gcode: '30080007', description: '영업담당자 동기화(SS-CHART)', value: 'N' },
  { gcode: '30080008', description: '영업담당자 담당 수수료 표시', value: 'N' },
  { gcode: '30080009', description: '처방전등록시 단가 변경 가능', value: 'N' },
  { gcode: '30090001', description: '부가세 별도 합계금액 표시 여부', value: 'N' },
  { gcode: '30100002', description: '처방전 수신 시 자체코드 매칭(Y/N)', value: 'Y' },
  { gcode: '31100001', description: '영업담당자 CSO업체 항목 숨김(Y/N)', value: 'Y' },
  { gcode: '31100002', description: '영업담당자 CSO2업체 항목 숨김(Y/N)', value: 'Y' },
  { gcode: '31100003', description: '처방전 등록시 제품 중복 등록 가능(Y/N)', value: 'Y' },
  { gcode: '31100005', description: '처방전 복사시 비고 복사(Y/N)', value: 'N' },
  { gcode: '31100006', description: '거래처 등록 요청 시 기등록 거래처 요청 가능 여부(Y/N)', value: 'Y' },
  { gcode: '31100007', description: '거래처 영업사원 맵핑기준 (1=담당자, 2=CSO, 3=CSC담당자)', value: '1' },
  { gcode: '31110004', description: '처방전 등록시 제품 최종 단가 고정(Y/N)', value: 'Y' },
  { gcode: 'COMM_ITEM', description: '수수료 적용 항목 (합계금액/제품단가)', value: '합계금액' },
  { gcode: 'COMM_TAX', description: '수수료 부가세 포함 여부 (부가세포함/부가세별도)', value: '부가세포함' },
  { gcode: 'COMM_BASE_AMOUNT', description: '수수료 적용 기준금액', value: '-10000000' },
  { gcode: 'COMM_GRACE_MONTHS', description: '기준금액 적용 유예기간(개월)', value: '' },
  { gcode: 'INCENT_PRIORITY_ON', description: '인센티브 우선순위 적용 여부 (Y/N)', value: 'N' },
  { gcode: 'INCENT_ORDER', description: '인센티브 우선순위 설정(JSON)', value: JSON.stringify(INCENTIVES) },
  { gcode: 'CODE_CUSTOMER', description: '거래처 자체코드 부여 방식 (자동부여/수동부여)', value: '수동부여' },
  { gcode: 'CODE_USER', description: '사용자 아이디 부여 방식 (자동부여/수동부여)', value: '자동부여' },
  { gcode: 'CODE_USER_PREFIX', description: '사용자 아이디 자동부여 접두사', value: 'histobio' },
  { gcode: 'MENU_PERMISSIONS', description: '메뉴 권한 설정(JSON)', value: JSON.stringify(MENU_PERMS) },
]

console.log(`설정 ${NEW_SETTINGS.length}건 upsert 중...`)
const { error } = await supabase
  .from('settings')
  .upsert(NEW_SETTINGS.map(s => ({ ...s, updated_at: new Date().toISOString() })), { onConflict: 'gcode', ignoreDuplicates: true })

if (error) console.error('❌ 오류:', error.message)
else console.log('✅ 완료')
