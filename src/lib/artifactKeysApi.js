/**
 * artifactKeysApi.js
 *
 * round07h Task 7 — 자료번호 목록 → 이름·시대연도·공개여부(POST /artifacts/keys,
 * 백엔드는 Task 4).
 *
 * 산출물 노드 목록이 자료번호 대신 유물 이름을 보여주려고 쓴다. 산출물의 doc
 * 모양이 아니라 selection.idnbrs 만 보므로 전시자료·설명문 양쪽에서 똑같이
 * 동작하고, 옛 산출물에서도 된다(doc 파싱으로 갔으면 전시자료에서만 이름이
 * 나왔을 것이다).
 *
 * lib/ 모듈은 서로 import 하지 않는다(레포 규약) — BASE 와 fetch 옵션을 여기서
 * 정한다. searchApi.js·outputsApi.js 와 같은 값(VITE_API_BASE_URL·
 * credentials:'include')을 쓴다 — 오리진이 어긋나면 라이브 백엔드가 아니라
 * 프론트 자기 자신으로 요청이 나가 조용히 실패한다.
 *
 * round07h 리뷰 수정(Important) — /artifacts/keys 는 require_user 게이트가 걸린
 * 인증 필수 엔드포인트다(api.py:1685, round06c 전면 게이트 규약 spec §9.5). 다른
 * 모든 lib 파일(searchApi.js·outputsApi.js·chatApi.js·conversationsApi.js·
 * adminApi.js)이 예외 없이 401만 좁게 판정해 notifyUnauthorized() 로 전역
 * 세션만료 처리에 넘긴다 — 이 파일만 예외로 두면, 세션 만료 후 노드 칩을
 * 클릭했을 때 다른 화면과 달리 조용히 "자료번호 폴백"으로 흡수돼 사용자가
 * 세션 만료를 알아채지 못한다. authEvents.js 를 통하는 이유(직접
 * AuthContext.jsx 를 import 하지 않는 이유)는 searchApi.js 상단 주석과 같다 —
 * lib 은 하위 계층이라 상위(context)를 몰라야 한다.
 */
import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

/**
 * @param {string[]} idnbrs
 * @returns {Promise<{ok: boolean, keys: Record<string, {name: string|null, subject_year: number|null, is_public: boolean|null}>}>}
 *
 * 실패해도 throw 하지 않는다 — 호출부가 자료번호로 폴백해 목록을 그대로 열어야
 * 한다. 이름을 못 얻은 것이 목록을 못 여는 이유가 되면 안 된다.
 */
export async function fetchDisplayKeys(idnbrs) {
  if (!idnbrs?.length) return { ok: true, keys: {} }
  try {
    const res = await fetch(`${BASE}/artifacts/keys`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idnbrs }),
    })
    // 401만 좁게 판정한다(‼️ !res.ok 금지 — 500·네트워크 오류까지 로그아웃시킨다, spec §9.5·C-D2).
    if (res.status === 401) notifyUnauthorized()
    if (!res.ok) return { ok: false, keys: {} }
    const data = await res.json()
    return { ok: true, keys: data.keys ?? {} }
  } catch {
    return { ok: false, keys: {} }
  }
}
