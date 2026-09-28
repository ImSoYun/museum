/**
 * adminApi.js — 티어 계정관리(/admin/*) API 클라이언트(round06c F3b, spec §0 R2.5).
 *
 * 관리자/통합관리자/root가 자기 **직속 하위 티어** 계정을 승인·거부·차단·비밀번호
 * 재설정한다(museum/admin/routes.py). 스코프 판정(누가 누구를 관리할 수 있는가)은
 * 전부 백엔드가 한다 — 이 클라이언트는 판단을 하지 않고 그대로 호출·전달만 한다.
 * 대상이 직속 하위가 아니면 백엔드가 403을 돌려주고, 호출부(Accounts.jsx — 구
 * AccountApprovals는 round06c-ext Task E4로 교체됐다)가 그 실패를 사용자에게 안내한다.
 *
 * 두 가지 반환 계약을 섞어 쓴다(둘 다 기존 lib 관행을 그대로 따른 것 — 새 계약을
 * 만들지 않는다):
 *   - listUsers: searchApi.searchArtifacts처럼 파싱된 바디를 그대로 반환한다(200만
 *     기대되는 조회라 분기가 필요 없다 — 401만 notifyUnauthorized로 통지).
 *   - approve/reject/disable/resetPassword: authApi.joinRequest와 같은 계약,
 *     항상 { status, ...body }를 반환해 호출부가 200/403/404를 분기한다(승인·거부·
 *     차단·재설정은 대상이 직속 하위가 아닐 때 403이 "정상적으로 있을 수 있는" 응답이라
 *     joinRequest가 409를 다루듯 호출부 분기로 넘긴다).
 *
 * !isLive()(테스트·백엔드 없는 데모/프리뷰)면 네트워크를 전혀 타지 않고 고정 데모
 * 데이터로 응답한다 — 화면이 서버 없이 렌더·클릭(승인/거부/차단/비번초기화)까지
 * 시연 가능해야 한다(브리프 §2). isLive() 자체는 새로 만들지 않고 searchApi.js의
 * 것을 그대로 쓴다(AuthContext.jsx·ScenarioContext.jsx와 동일 관행 — 정본은 하나).
 */
import { isLive } from './searchApi.js'
import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

// 데모 데이터 — 직속 하위 티어 계정 몇 건(승인 대기 2 · 활성 2).
// 기본 데모 사용자(AuthContext.DEMO_MOCK_USER)는 통합관리자(is_root:false)이므로
// 직속 하위 티어는 '관리자'다(§0 R2.2) — role을 그에 맞춰 둔다.
// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 데모 데이터의
// email 필드를 뺐다(실서버 응답 계약에 더 이상 그 키가 없다 — admin/routes.py
// :_summarize와 데모가 어긋나지 않게 짝을 맞춘다).
const DEMO_USERS = [
  { id: 301, username: 'kim_do', display_name: '김도윤', role: '관리자', status: 'pending', dept: '전시기획팀' },
  { id: 302, username: 'park_seo', display_name: '박서연', role: '관리자', status: 'pending', dept: '유물관리팀' },
  { id: 303, username: 'lee_ha', display_name: '이하준', role: '관리자', status: 'approved', dept: '학예연구실' },
  { id: 304, username: 'choi_ji', display_name: '최지우', role: '관리자', status: 'approved', dept: '자료보존팀' },
]

// 데모 전용 고정 임시 비밀번호. 실서버는 secrets.token_urlsafe(8)로 매번 다르게
// 발급하지만(museum/admin/routes.py), 데모는 화면·테스트가 값을 예측할 수 있어야
// 하므로 고정 문자열로 둔다 — 화면에 "1회만 표시"하는 동작만 시연 대상이다.
export const DEMO_TEMP_PASSWORD = 'Demo-Temp7f3a'

// DEMO_USERS(301-304)에서 온 행인지 판별하는 id 집합 — listUsers는 이 집합에 속한
// 행만 보여준다(demoStore는 두 목록을 합쳐 두지만 listUsers/listAccounts는 각자의
// 원래 목록만 본다, 아래 store() 참조).
const DEMO_USER_IDS = new Set(DEMO_USERS.map((u) => u.id))

/**
 * round06c-ext D2d 리뷰(E4가 flag) — 이전엔 DEMO_USERS·DEMO_ACCOUNTS가 매 호출마다
 * 그대로(불변) 사본만 내주는 "죽은" 데모 데이터였다. Accounts.jsx는 액션 성공 후
 * load()로 재조회해 반영하는 정직한 패턴을 쓰는데, 데모 분기가 불변이라 승인·거절·
 * 차단·차단해제·삭제를 눌러도 성공 토스트만 뜨고 행이 그대로였다(성공한 척 — 이
 * 라운드의 정직성 원칙 위반). 아래 지연 복사 store가 그 갭을 없앤다: 원본 DEMO_USERS·
 * DEMO_ACCOUNTS는 여전히 불변으로 두고(재-import·재사용 시 오염되지 않도록), 첫 접근
 * 시 한 번만 두 목록을 합쳐 얕은 사본을 뜨고 그 사본을 모듈 수명 동안 재사용·변이한다.
 * 테스트에서 초기 상태로 되돌려야 할 때는 아래 __resetDemoStore()를 쓴다.
 */
let demoStore = null
const store = () => (demoStore ??= [...DEMO_USERS, ...DEMO_ACCOUNTS].map((u) => ({ ...u })))

/**
 * 테스트 전용 — 모듈 스코프의 demoStore를 지워 다음 접근 시 원본 데모 데이터로
 * 다시 채워지게 한다. 프로덕션 코드는 이 함수를 호출하지 않는다(데모 세션 중 상태가
 * 유지되는 것이 의도다 — 새로고침 전까지는 승인/차단 등이 화면에 남아 있어야
 * 시연이 정직하다). adminApi.test.js가 데모 describe의 beforeEach에서만 쓴다.
 */
export function __resetDemoStore() {
  demoStore = null
}

/**
 * store()에서 id로 찾아 patch를 얹어 그 자리에서 변이하고, 변이된 사본을 반환한다
 * (round06c 리뷰 F4 — DEMO_USERS(301-304)·DEMO_ACCOUNTS(401-404) 두 출처를 모두
 * 뒤진다. 같은 id가 두 목록에 겹치지 않으므로 순서는 결과에 영향 없음).
 * id를 못 찾으면(알 수 없는 대상) store를 건드리지 않고 빈 껍데기만 반환한다 —
 * 기존 동작(불변 사본 시절의 폴백)과 동일하게 유지한다.
 */
function demoSummary(id, patch) {
  const list = store()
  const idx = list.findIndex((u) => u.id === id)
  if (idx === -1) {
    return { id, username: '', display_name: '', role: '', status: 'approved', dept: '', ...patch }
  }
  list[idx] = { ...list[idx], ...patch }
  return { ...list[idx] }
}

// 계정·권한 화면(E) 데모 데이터 — 3상태(pending/approved/disabled) · 다티어(관리자/사용자) ·
// 시각·최근접속 포함. listUsers/DEMO_USERS(승인 화면용, 필드가 얕음)와는 별도 정본이다 —
// 계정·권한 화면은 생성/승인/차단/해제 시각과 last_seen_at까지 표시해야 하므로 필드가 더 넓다.
const DEMO_ACCOUNTS = [
  { id: 401, username: 'kim_do', display_name: '김도윤', role: '관리자', status: 'pending', dept: '전시기획팀', is_root: false, created_at: '2026-07-22T09:00:00Z', approved_at: null, blocked_at: null, unblocked_at: null, last_seen_at: null },
  { id: 402, username: 'lee_ha', display_name: '이하준', role: '관리자', status: 'approved', dept: '학예연구실', is_root: false, created_at: '2026-06-01T09:00:00Z', approved_at: '2026-06-02T10:00:00Z', blocked_at: null, unblocked_at: null, last_seen_at: '2026-07-23T18:40:00Z' },
  { id: 403, username: 'park_su', display_name: '박수영', role: '관리자', status: 'disabled', dept: '전시운영팀', is_root: false, created_at: '2026-05-10T09:00:00Z', approved_at: '2026-05-11T10:00:00Z', blocked_at: '2026-07-20T14:00:00Z', unblocked_at: null, last_seen_at: '2026-07-19T11:00:00Z' },
  // round06c 리뷰 F9 — 실서버 unblock(adapters/postgres/auth.py:221-226)은 status만
  // 'approved'로 바꾸고 unblocked_at을 채울 뿐 blocked_at은 지우지 않는다. 그래서
  // "차단 이력이 있다가 해제된" 계정은 항상 blocked_at(차단 시각) < unblocked_at(해제 시각)
  // 조합만 존재하고 blocked_at:null + unblocked_at:설정 조합은 실데이터에 없다 — 시각을
  // 정합화한다(해제 시각보다 이른 차단 시각을 채움).
  { id: 404, username: 'choi_ji', display_name: '최지우', role: '사용자', status: 'approved', dept: '자료보존팀', is_root: false, created_at: '2026-06-05T09:00:00Z', approved_at: '2026-06-06T10:00:00Z', blocked_at: '2026-07-10T09:00:00Z', unblocked_at: '2026-07-15T09:00:00Z', last_seen_at: '2026-07-24T08:10:00Z' },
]

/**
 * 역할 티어의 "모든" 하위 티어를 나열한다(museum/admin/roles.py 미러). 화면에서
 * 필터 옵션·버튼 노출 판정에만 쓰고, 실제 스코프 강제는 항상 백엔드가 한다(이중 방어의
 * 프론트 쪽 — 백엔드가 최종권위).
 */
export function subordinateRolesAll(role, isRoot) {
  if (role === '통합관리자') return isRoot ? ['통합관리자', '관리자', '사용자'] : ['관리자', '사용자']
  if (role === '관리자') return ['사용자']
  return []
}

/** 역할 티어의 "직속" 하위 티어 하나를 반환한다(승인 대상 필터 등에 사용). */
export function directSubordinateRole(role, isRoot) {
  if (role === '통합관리자') return isRoot ? '통합관리자' : '관리자'
  if (role === '관리자') return '사용자'
  return null
}

/** GET /admin/users?status= — 호출자 직속 하위 티어 목록(백엔드가 스코프, §0 R2.5). */
export async function listUsers(status) {
  if (!isLive()) {
    const all = store().filter((u) => DEMO_USER_IDS.has(u.id))
    const users = status ? all.filter((u) => u.status === status) : all
    return { users: users.map((u) => ({ ...u })) }
  }
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await fetch(`${BASE}/admin/users${qs}`, { credentials: 'include' })
  // 401만 좁게 판정한다(‼️ !res.ok 금지 — searchApi.js와 동일 관행, spec §9.5·C-D2).
  if (res.status === 401) notifyUnauthorized()
  return res.json()
}

/**
 * GET /admin/users?status=&role= — 계정·권한 화면(E) 전용 목록 조회. listUsers와 달리
 * status·role을 둘 다(옵션으로) 받는다 — 스코프 강제는 여전히 백엔드가 한다.
 */
export async function listAccounts({ status, role } = {}) {
  if (!isLive()) {
    const users = store().filter(
      (u) => !DEMO_USER_IDS.has(u.id) && (!status || u.status === status) && (!role || u.role === role),
    )
    return { users: users.map((u) => ({ ...u })) }
  }
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (role) params.set('role', role)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${BASE}/admin/users${qs}`, { credentials: 'include' })
  if (res.status === 401) notifyUnauthorized()
  return res.json()
}

/** POST /admin/users/{id}/{path} 공통 호출부 — approve/reject/disable/reset-password가 공유. */
async function postAction(path, id) {
  const res = await fetch(`${BASE}/admin/users/${id}/${path}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (res.status === 401) notifyUnauthorized()
  let body = {}
  try { body = await res.json() } catch { /* 본문이 없거나 JSON이 아니면 무시 */ }
  return { status: res.status, ...body }
}

/** POST /admin/users/{id}/approve — 대상이 직속 하위가 아니면 백엔드가 403. */
export async function approveUser(id) {
  if (!isLive()) {
    return { status: 200, user: demoSummary(id, { status: 'approved', approved_at: new Date().toISOString() }) }
  }
  return postAction('approve', id)
}

/**
 * POST /admin/users/{id}/reject — 삭제 시맨틱(B6). 백엔드가 해당 행을 DELETE하므로
 * 갱신된 user를 돌려주지 않는다(더 이상 존재하지 않는 행이라 돌려줄 것이 없다) — 이전
 * 라운드의 "user 반환" 계약을 여기서 깬다. 소비처(E4)는 응답 body가 아니라 목록에서
 * 해당 행을 제거하는 쪽으로 처리한다. 라이브 분기는 postAction 관행 그대로 유지하되
 * 응답 바디에 user가 없다는 사실을 그대로 반환한다(postAction이 body를 그대로 펼친다).
 * 데모 분기도 같은 삭제 시맨틱을 store에서 실제로 수행한다 — 그래야 다음 재조회
 * (listUsers/listAccounts)에서 행이 정말로 사라진다(round06c-ext D2d, 정직성 원칙).
 */
export async function rejectUser(id) {
  if (!isLive()) {
    const list = store()
    const idx = list.findIndex((u) => u.id === id)
    if (idx !== -1) list.splice(idx, 1)
    return { status: 200 }
  }
  return postAction('reject', id)
}

/** POST /admin/users/{id}/unblock — 차단 해제(대상이 직속 하위가 아니면 백엔드가 403).
 * 실서버 unblock(adapters/postgres/auth.py:221-226)은 status·unblocked_at만 갱신하고
 * blocked_at은 지우지 않는다 — 데모도 같은 시맨틱을 지킨다(blocked_at 유지, F9 참고). */
export async function unblockUser(id) {
  if (!isLive()) {
    return { status: 200, user: demoSummary(id, { status: 'approved', unblocked_at: new Date().toISOString() }) }
  }
  return postAction('unblock', id)
}

/** DELETE /admin/users/{id} — 행 삭제(대상이 직속 하위가 아니면 백엔드가 403). */
export async function deleteUser(id) {
  if (!isLive()) {
    const list = store()
    const idx = list.findIndex((u) => u.id === id)
    if (idx !== -1) list.splice(idx, 1)
    return { status: 200 }
  }
  const res = await fetch(`${BASE}/admin/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.status === 401) notifyUnauthorized()
  let body = {}
  try { body = await res.json() } catch { /* 본문이 없거나 JSON이 아니면 무시 */ }
  return { status: res.status, ...body }
}

/** POST /admin/users/{id}/disable — 백엔드가 해당 유저 세션을 즉시 전삭제한다(D7). */
export async function disableUser(id) {
  if (!isLive()) {
    return { status: 200, user: demoSummary(id, { status: 'disabled', blocked_at: new Date().toISOString() }) }
  }
  return postAction('disable', id)
}

/**
 * POST /admin/users/{id}/reset-password — 임시 비번은 응답에 **1회만** 실린다.
 * 호출부가 화면에 즉시 표출하고 나면 어디에도 남지 않는다(서버도 영속화하지 않음, §0 R2.4).
 */
export async function resetPassword(id) {
  if (!isLive()) {
    return { status: 200, user: demoSummary(id, {}), temporary_password: DEMO_TEMP_PASSWORD }
  }
  return postAction('reset-password', id)
}
