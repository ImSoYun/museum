// 역할-화면 접근 매트릭스 (spec T3-14). 데모 단계: 정의만 두고 라우트 가드는 미구현.
// area 분류로 경로를 묶어 역할별 허용 area 집합으로 판정한다.
//
// 역할 어휘의 정본은 workspace/app/schema.sql 의 users.role CHECK 다(round06d R6d-07).
// round06c-ext D1-1 — 구 area('admin'=시스템 전역, 'approve'=/approvals 계정관리)를
// 새 IA에 맞춰 둘로 재편한다: 'system-accounts'(시스템관리 > 계정·권한, 구 approve와
// 같은 권한 폭 — 관리자·통합관리자)와 'system-ops'(시스템관리 > 모니터링·노드관리·
// 이용로그, 구 admin과 같은 권한 폭 — 통합관리자 전용). 구 어휘는 D5 게이트상 코드에
// 남기지 않는다.
export const ROLES = ['사용자', '관리자', '통합관리자']

// 경로 prefix → area. '/system/accounts'가 '/system'보다 먼저 와야 한다 — 그렇지 않으면
// 계정·권한 탭이 '/system'에 먼저 걸려 system-ops로 분류되고, 관리자가 그 탭에서
// 튕겨난다(관리자는 system-accounts만 갖는다).
const AREA_BY_PREFIX = [
  { prefix: '/system/accounts', area: 'system-accounts' },
  { prefix: '/system', area: 'system-ops' },
  { prefix: '/manage', area: 'manage' },
  { prefix: '/account', area: 'account' },
  { prefix: '/library', area: 'library' },
  { prefix: '/search', area: 'search' },
]

export function areaOf(pathname) {
  const hit = AREA_BY_PREFIX.find((e) => pathname.startsWith(e.prefix) && e.prefix !== '/')
  if (hit) return hit.area
  return 'search' // 루트('/')·기타
}

// 역할별 허용 area
// 'system-accounts'(시스템관리 > 계정·권한, 구 approve)는 관리자·통합관리자에만 있다 —
// 사용자는 승인 주체가 될 수 없다(§0 R2.2, "엄격히 바로 위 1단계만" 승인).
// 'system-ops'(시스템관리 > 모니터링·노드관리·이용로그, 구 admin)는 통합관리자 전용이다
// — 관리자는 노출은 되지만 클릭 시 차단된다. root도 통합관리자 role이라 자동 포함.
// 'manage'(자료관리)는 세 역할 전부에 있다 — 자료관리 화면은 전부 "준비중"이라 열람
// 자체를 막을 이유가 없다(round06c-ext D1-1 §3.3 확정 — 개명 전에는 사용자가 제외였던
// 규칙을 여기서 의도적으로 넓혔다. 권한 재설계가 아니라 준비중 화면의 접근 완화다).
export const PERMISSION_MATRIX = {
  사용자: ['search', 'library', 'manage', 'account'],
  관리자: ['search', 'library', 'manage', 'account', 'system-accounts'],
  통합관리자: ['search', 'library', 'manage', 'account', 'system-accounts', 'system-ops'],
}

export function canAccess(role, pathname) {
  const allowed = PERMISSION_MATRIX[role]
  if (!allowed) return false
  return allowed.includes(areaOf(pathname))
}

// 차단 사유를 계산한다. null이면 정상 이동.
// 왜 두 갈래를 한 함수로 묶는가: LNB 항목이 "갈 수 있는가"를 물을 곳이 한 군데여야
// 호출부(Lnb)가 정책을 알 필요가 없다. 호출부는 사유 문자열을 셸에 그대로 넘기기만 한다.
// 순서에 의미가 있다 — 라우트가 아예 없으면(wip) 권한이 있어도 갈 곳이 없으므로 wip이 앞선다.
export function blockReasonOf(item, role) {
  if (item.status === 'wip') return 'wip'                                // 라우트 자체가 미구현
  if (item.requires && !canAccess(role, item.to)) return 'system_access' // 권한 미달
  return null
}

// round06c 최종 리뷰 must-fix I-1 — 시스템관리 LNB 항목은 목적지가 하나(/system/monitoring)
// 뿐이었는데 그 경로는 system-ops(통합관리자 전용)라, system-accounts만 가진 관리자는 LNB로
// 이 라운드가 만든 계정·권한 화면(/system/accounts)에 도달할 방법이 없었다(URL 직접입력 외).
// 계획 §3.3: "시스템관리 LNB: 관리자·통합관리자 접근(사용자는 노출하되 클릭 시 차단)".
//
// firstSystemEntry(role) 는 role이 실제로 들어갈 수 있는 첫 /system/* 경로를 돌려준다
// (없으면 null). 우선순위는 "더 넓은 권한부터" — 통합관리자는 두 area를 다 가지므로
// monitoring을 먼저 물어야 그쪽으로 간다. 관리자는 monitoring이 걸러지고 accounts에서
// 걸린다. 사용자는 둘 다 안 걸려 null(=차단).
//
// 이 함수를 permissions.js에 두는 이유: "role별로 어디가 첫 진입점인가"는 권한 정책이지
// LNB 컴포넌트의 표현이 아니다(이 파일의 blockReasonOf와 같은 원칙). Lnb는 이 값을 받아
// 항목의 to를 정할 뿐, role별 분기 자체를 갖지 않는다.
const SYSTEM_ENTRIES = ['/system/monitoring', '/system/accounts']

export function firstSystemEntry(role) {
  return SYSTEM_ENTRIES.find((p) => canAccess(role, p)) ?? null
}
