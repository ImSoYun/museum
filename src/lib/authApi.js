/**
 * authApi.js — 세션 무관 인증 API(round06c F3, spec §8.2 POST /auth/join).
 *
 * join은 로그인 전(비로그인) 상태에서 호출되고 AuthContext의 { user, status }를
 * 바꾸지 않으므로 AuthContext에 넣지 않는다(브리프 "방식 재량" — 세션 상태와
 * 무관한 API는 별도 lib로 뽑는 편이 AuthContext의 책임을 좁게 유지한다).
 *
 * login()(AuthContext.jsx)과 달리 이 함수는 throw하지 않는다 — 409(중복)는
 * 예외적 실패가 아니라 호출부가 분기해서 안내할 정상 응답이기 때문이다.
 * 네트워크 자체가 끊기는 경우(fetch가 reject)는 호출부가 try/catch로 받는다.
 */
const BASE = import.meta.env.VITE_API_BASE_URL

/**
 * POST /auth/join — 가입 신청. 성공 시 status='pending' 계정이 생성된다(승인은 /admin 몫).
 * payload는 백엔드 계약 그대로: { username, password, display_name, dept, role }(round10b
 * Task C — 사용자 결정 2026-09-17 "이메일관련은 다 빼": email을 이 계약에서 뺐다).
 * 반환값은 항상 { ...body, status } — 200/409 모두 여기서 정상 반환하고, 상태코드별
 * 분기는 호출부(Join.jsx)가 한다.
 *
 * ⚠️ status는 반드시 마지막에 스프레드한다(round06e-finishing Critical #1 회귀 가드).
 * join 성공 바디는 {"user": _summarize(user)}로 status가 user 안에 중첩돼 지금은
 * 충돌하지 않지만, changePasswordRequest처럼 바디 최상위에 status 필드가 생기는 순간
 * `{ status: res.status, ...body }` 순서였다면 HTTP 상태 숫자가 바디 값에 덮였을
 * 것이다 — 같은 사고를 막기 위해 두 함수 모두 `{ ...body, status: res.status }` 순서로
 * 통일한다.
 */
export async function joinRequest(payload) {
  const res = await fetch(`${BASE}/auth/join`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body = {}
  try { body = await res.json() } catch { /* 본문이 없거나 JSON이 아니면 무시 */ }
  return { ...body, status: res.status }
}

/**
 * POST /auth/password — 본인 비밀번호 변경(round06e §9.2). 로그인 세션이 필요하므로
 * credentials:'include'로 보낸다. 성공(200)·검증 실패(400)를 모두 여기서 정상 반환하고,
 * 분기는 호출부(Account.jsx)가 한다 — join()과 동일한 관례(throw하지 않는다).
 *
 * ⚠️ 성공 바디가 정확히 {"status": "ok"}다(museum/auth/routes.py:220). status를 먼저
 * 스프레드하던 예전 구현 `{ status: res.status, ...body }`는 이 바디의 문자열 "ok"가
 * 뒤에서 숫자 200을 덮어써 호출부의 `res.status === 200`이 항상 거짓이 되는 결함이
 * 있었다(round06e-finishing Critical #1) — 성공했는데 항상 "실패"로 표시됐다. body를
 * 먼저 스프레드하고 status를 마지막에 얹어(`{ ...body, status: res.status }`) HTTP
 * 상태 숫자가 항상 이긴다.
 */
export async function changePasswordRequest(payload) {
  const res = await fetch(`${BASE}/auth/password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body = {}
  try { body = await res.json() } catch { /* 본문이 없거나 JSON이 아니면 무시 */ }
  return { ...body, status: res.status }
}
