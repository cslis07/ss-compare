import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const ENV_PATH = 'C:/Users/GB/Documents/ss-compare/.env.local'
const env = Object.fromEntries(
  readFileSync(ENV_PATH,'utf-8').split('\n')
    .filter(l=>l.includes('='))
    .map(l=>{ const [k,...v]=l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g,'')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const GROUPS = [
  'CTC바이오','JW신약(중외신약)','KMS제약','건일바이오팜','경동제약','경보제약',
  '고려제약','광동제약','구주제약','국제약품','뉴젠팜','다산제약','대우제약',
  '대웅바이오','대원바이오텍상품','대원바이오텍제품','대원제약','대한뉴팜',
  '대화제약','동광제약','동구바이오[안과]','동구바이오제약','동국제약','동성제약',
  '라이트팜텍(비만)','로하스메디','마더스제약','맥널티제약','메디카코리아',
  '명문제약','바스칸바이오','바이넥스','보령바이오파마','보령제약','비보존[안과]',
  '비보존제약','삼성제약','삼익제약','새한제약','서울제약','셀트리온','신일제약',
  '씨엠지제약','아이큐어','아주약품','안국뉴팜','안국약품','알리코제약',
  '에이치엘비제약','에이프로젠제약','엘앤씨바이오','영일제약','영진약품',
  '오스코리아','오스틴제약','옵투스제약(DHP코리아)','위더스제약','유니메드제약',
  '유앤생명과학','유영제약','유유제약','이든파마','인트로바이오[안과]',
  '일성아이에스(주)','일화','제뉴원사이언스(한국콜마)','제일[파트너스단독]',
  '제일약품','중외제약','중헌제약','지엘파마','진양제약','초당약품','코오롱제약',
  '킵스바이오파마(한국글로벌)','테라젠이텍스','파마사이언스',
  '팜젠사이언스(우리들제약)','한국애보트 유한회사','한국파마',
  '한국파비스(에이치알팜)','한국파비스제약','한국프라임제약','한국피엠지제약',
  '한국휴텍스제약','한올바이오파마','한풍제약','한화제약','한화트레이딩',
  '화이트생명과학','휴비스트제약','휴온스','휴온스메디텍(메디케어)','휴온스생명과학',
]

console.log(`삽입 예정: ${GROUPS.length}건`)

// 기존 데이터 전체 삭제
const { error: delErr } = await supabase.from('product_groups')
  .delete().neq('id','00000000-0000-0000-0000-000000000000')
if (delErr) console.log('삭제 오류(무시):', delErr.message)
else console.log('기존 데이터 삭제 완료')

const rows = GROUPS.map((name, i) => ({ name, sort_order: i + 1, is_deleted: false }))

// 배치 삽입
const BATCH = 50
let total = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH)
  const { error } = await supabase.from('product_groups').insert(chunk)
  if (error) console.error(`❌ 오류:`, error.message)
  else { total += chunk.length; process.stdout.write(`\r  ${total}/${rows.length}건...`) }
}
console.log(`\n✅ 제품그룹 ${total}건 삽입 완료`)
