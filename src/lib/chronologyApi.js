/**
 * chronologyApi.js
 *
 * 대한민국사 연표 조회 클라이언트(round11a task-10) — 읽기 전용이다.
 * 서버는 `museum/chronology/routes.py` 의 네 라우트이고, **전부 로그인 필요**다.
 *
 * outputsApi.js 와 **서로 import 하지 않는다**(lib/ 모듈 간 의존 금지 규약).
 * BASE·fail·requestJson 같은 공통 조각은 각자 갖는다 — 중복처럼 보이지만, lib/
 * 모듈이 서로를 부르기 시작하면 순환이 생기고 테스트에서 한 모듈만 mock 할 수
 * 없게 된다(outputsApi.js 머리 주석과 같은 근거).
 *
 * 실패 처리 관행도 outputsApi.js 와 같다 — 예외를 던지지 않고
 * `{ ok:false, notice }` 로 흡수해 호출부가 안내를 고른다. 401 은
 * notifyUnauthorized() 로 전역 세션만료 처리에 넘긴다.
 */

import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

/** 공통 실패 흡수 — 응답 본문의 detail 을 사유로 끌어올린다. */
async function fail(res, fallback) {
  if (res.status === 401) notifyUnauthorized()
  let detail
  try {
    const body = await res.json()
    detail = typeof body?.detail === 'string' ? body.detail : undefined
  } catch { /* 본문이 없거나 JSON 이 아니다 */ }
  return { ok: false, status: res.status, notice: detail || fallback }
}

async function requestJson(path, fallbackNotice) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, { method: 'GET', credentials: 'include' })
  } catch {
    // 네트워크 자체가 끊긴 경우. status 가 없으므로 0 으로 둔다.
    return { ok: false, status: 0, notice: '서버에 연결하지 못했습니다' }
  }
  if (!res.ok) return fail(res, fallbackNotice)
  return { ok: true, status: res.status, data: await res.json() }
}

/**
 * GET /chronology/volumes/{vol}/pages — 그 권의 **본문 쪽** 번호 목록.
 *
 * 사진·표지 쪽은 빠져 있다(spec §1.6). 뷰어의 쪽 넘기기가 이 목록 안에서만
 * 오가는 이유가 그것이다 — 쪽 번호를 +1 씩 세면 표지·사진 쪽에 떨어진다.
 */
export async function getVolumePages(vol) {
  return requestJson(
    `/chronology/volumes/${encodeURIComponent(vol)}/pages`,
    '연표 쪽 목록을 불러오지 못했습니다',
  )
}

/**
 * GET /chronology/pages/{vol}/{page}/events — 그 쪽의 사건 목록(seq 순).
 *
 * `bbox` 는 `[x0,y0,x1,y1]` 이고 **0.0~1.0 정규화**다(domain/models.py) —
 * 그리는 쪽이 원본 이미지 픽셀 크기를 몰라도 그대로 % 로 쓸 수 있다.
 */
export async function getPageEvents(vol, page) {
  return requestJson(
    `/chronology/pages/${encodeURIComponent(vol)}/${encodeURIComponent(page)}/events`,
    '연표 사건을 불러오지 못했습니다',
  )
}

/**
 * GET /chronology/locate?era=… — `subject_era` 로 쪽 찾기(spec §2.5).
 *
 * **`found:false` 를 오류로 만들지 않는다.** 서버는 400 대신
 * `{found:false, reason}` 을 **정상 응답**으로 준다 — 사용자가 친 값이 아니라
 * 자료의 원본 표기라 「요청 오류」가 아니기 때문이다(routes.locate 도크스트링).
 * 여기서 ok:false 로 바꾸면 화면이 「불러오지 못했습니다」를 띄우게 되어,
 * spec §2.5 가 요구하는 「뷰어는 안 움직이고 안내만」을 그릴 수 없다.
 *
 * `era` 가 비어도 **호출을 삼키지 않는다** — 빈 값에 대한 사유도 서버가
 * 들고 있고, 호출부가 조용히 아무 일도 안 하면 왜 안 열리는지 알 수 없다
 * (코딩표준 §6 침묵 실패 금지).
 */
export async function locateEra(era) {
  const params = new URLSearchParams({ era: era ?? '' })
  return requestJson(`/chronology/locate?${params}`, '연표에서 쪽을 찾지 못했습니다')
}

/**
 * GET /chronology/pages/{vol}/{page}/image 의 **URL 문자열**.
 *
 * fetch 하지 않는다 — `<img src>` 로 넘기면 브라우저가 같은 출처 쿠키를 함께
 * 보내 그대로 인증된다(routes.py 머리 주석). 여기서 blob 으로 받아 objectURL 을
 * 만들면 ETag 재검증·브라우저 캐시(private, max-age=86400)를 통째로 버리게 된다.
 *
 * 본문 없는 쪽(mock 프로파일·미업로드)은 **204** 가 온다 — 그리는 쪽이
 * 「이 쪽의 스캔 이미지가 없습니다」를 적어야 한다(침묵 실패 금지).
 */
export function pageImageUrl(vol, page) {
  return `${BASE}/chronology/pages/${encodeURIComponent(vol)}/${encodeURIComponent(page)}/image`
}
