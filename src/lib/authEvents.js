/**
 * authEvents.js — API 클라이언트 ↔ AuthProvider 간 401 통지 채널(round06c F1, spec §9.5).
 *
 * searchApi.js·chatApi.js는 AuthContext.jsx를 몰라야 한다(계층 역전 방지 — lib은 하위,
 * context는 상위). 그래서 직접 import 대신 이 작은 모듈 레벨 핸들러 슬롯을 사이에 둔다:
 *   - lib(searchApi/chatApi)이 res.status===401을 만나면 notifyUnauthorized()를 부른다.
 *   - AuthProvider가 부팅 시 registerUnauthorizedHandler(fn)로 자신을 등록해 anon 전환을 받는다.
 *
 * 슬롯은 하나뿐이다(앱에 AuthProvider가 하나뿐이므로 충분 — 다중 Provider가 필요해지면
 * 리스너 배열로 바꾼다). register는 등록 해제 함수를 돌려주어 effect cleanup에 바로 쓸 수 있다.
 */
let handler = null

/** AuthProvider가 마운트 시 호출해 401 통지를 받을 콜백을 등록한다. 반환값은 해제 함수. */
export function registerUnauthorizedHandler(fn) {
  handler = fn
  return () => {
    if (handler === fn) handler = null
  }
}

/** API 클라이언트가 res.status===401을 만났을 때 부른다. 등록된 핸들러가 없으면 조용히 무시. */
export function notifyUnauthorized() {
  handler?.()
}
