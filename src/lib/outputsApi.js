/**
 * outputsApi.js
 *
 * 산출물생성 화면의 백엔드 클라이언트(round07b) — 노드 그래프 + 산출물 CRUD.
 *
 * searchApi.js와 **서로 import하지 않는다**(lib/ 모듈 간 의존 금지 규약). BASE·
 * notifyUnauthorized 같은 공통 조각은 각자 갖는다 — 중복처럼 보이지만, lib/ 모듈이
 * 서로를 부르기 시작하면 순환이 생기고 테스트에서 한 모듈만 mock할 수 없게 된다.
 *
 * 실패 처리 관행은 downloadArtifactImage(searchApi.js)와 같다 — 예외를 던지지 않고
 * `{ ok:false, notice }`로 흡수해 호출부가 토스트로 안내한다. 401은
 * notifyUnauthorized()로 전역 세션만료 처리에 넘긴다.
 */

import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

export const isLive = () => Boolean(BASE)

/** 공통 실패 흡수 — 응답 본문의 detail을 사유로 끌어올린다. */
async function fail(res, fallback) {
  if (res.status === 401) notifyUnauthorized()
  let detail
  try {
    const body = await res.json()
    detail = typeof body?.detail === 'string' ? body.detail : undefined
  } catch { /* 본문이 없거나 JSON이 아니다 */ }
  return { ok: false, status: res.status, notice: detail || fallback }
}

async function requestJson(path, options, fallbackNotice) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, { credentials: 'include', ...options })
  } catch {
    // 네트워크 자체가 끊긴 경우. status가 없으므로 0으로 둔다.
    return { ok: false, status: 0, notice: '서버에 연결하지 못했습니다' }
  }
  if (!res.ok) return fail(res, fallbackNotice)
  return { ok: true, status: res.status, data: await res.json() }
}

const jsonBody = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/**
 * POST /output/graph — 검색 결과 200건을 주제 축으로 갈라 노드 그래프를 받는다.
 *
 * 재검색이 아니다 — 서버가 /search와 **같은 랭킹 캐시**를 읽으므로 클래스를 바꿔도
 * 결과 집합은 그대로다. 그래서 좌측 건수와 중앙 그래프가 언제나 같은 모집단을 말한다.
 */
export async function fetchOutputGraph(query, mode, selected) {
  return requestJson(
    '/output/graph',
    jsonBody('POST', { query, mode, selected: selected ?? null }),
    '노드 그래프를 불러오지 못했습니다',
  )
}

/**
 * POST /outputs — 고른 자료로 산출물을 만든다.
 *
 * payload를 그대로 실어 보낸다 — kind('exhibit'|'caption')·columns(exhibit 전용)·
 * format·timeline(caption 전용) 전부 호출부(OutputTab.jsx)가 채워 넣은 그대로
 * 나른다. 여기서 필드를 더하거나 기본값을 끼워 넣지 않는 이유는, 그렇게 하면
 * exhibit·caption 두 kind의 계약이 이 함수 안에서 섞이기 때문이다 — 서버
 * model_validator가 조합을 검사하므로(caption인데 format 없으면 422 등) 어떤
 * 필드를 실을지는 호출부가 kind별로 직접 결정해야 한다.
 */
export async function createOutput(payload) {
  return requestJson('/outputs', jsonBody('POST', payload), '산출물 생성에 실패했습니다')
}

/**
 * round10a A조 I-2(final-findings.md) — createOutput의 실패가 전부 「실패」는 아니다.
 * 실측: 175건 설명문 생성(73초)이 502 Proxy Error로 돌아왔는데, 그 직후 목록을
 * 조회하니 서버는 이미 만들어 저장해 둔 뒤였다 — 응답만 못 받은 것이지 생성이
 * 실패한 게 아니다(0은 위 requestJson 주석대로 네트워크 자체가 끊긴 경우).
 *
 * 원래 OutputTab.jsx 안의 모듈 상수였는데, 그 파일 밖에서는 import할 수 없어
 * 같은 createOutput·같은 status를 쓰는 ChatTab.jsx의 채팅 인라인 생성이 같은
 * 502에도 "실패했습니다"로 단정했다(final-findings.md I-2). status의 의미를
 * 아는 곳(이 파일)으로 판정을 올려 두 호출부가 같은 Set을 본다 — 어휘가 두 곳에
 * 생기면 갈라진다(R6F-15와 같은 이유).
 */
export const UNKNOWN_OUTCOME = new Set([0, 502, 503, 504])

/**
 * GET /outputs — 내 산출물 목록(최근순).
 *
 * round07g — `conversationId`를 주면 **그 대화에서 만든 것만** 온다. 안 주면
 * 지금까지처럼 전체다(서버 기본값이 그렇다 — 대화 개념이 없는 호출자를 깨지
 * 않기 위해서다). 산출물이 대화를 넘어 섞여 보이던 것이 이 라운드가 고치는 결함이다.
 *
 * round07g 수정 R1 (Minor-2) — 판정이 `!= null`인 것은 **서버(`is not None`)와
 * 같은 선을 긋기 위해서다.** truthy 판정(`if (conversationId)`)이면 `''`이 왔을 때
 * 서버는 「빈 문자열이라는 대화」로 좁히려는데 프론트만 조용히 파라미터를 빼
 * 「전체」로 넓어진다 — 두 계층이 다른 말을 하는 자리는 만들지 않는다.
 * 「대화를 모를 때 조회 자체를 막는」 판단은 이 전송 계층이 아니라 화면(OutputList·
 * SearchFlowLayout)의 몫이다. 여기서는 받은 것을 그대로 나른다.
 */
export async function listOutputs({ kind, q, conversationId, limit = 10, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (kind) params.set('kind', kind)
  if (q) params.set('q', q)
  if (conversationId != null) params.set('conversation_id', conversationId)
  return requestJson(`/outputs?${params}`, { method: 'GET' }, '산출물 목록을 불러오지 못했습니다')
}

/** GET /outputs/{id} — 상세(메타). */
export async function getOutput(outputId) {
  return requestJson(
    `/outputs/${encodeURIComponent(outputId)}`,
    { method: 'GET' },
    '산출물을 불러오지 못했습니다',
  )
}

/** PATCH /outputs/{id}/open — 「신규」 해제. 멱등이다. */
export async function markOutputOpened(outputId) {
  return requestJson(
    `/outputs/${encodeURIComponent(outputId)}/open`,
    { method: 'PATCH' },
    '열람 표시에 실패했습니다',
  )
}

/** DELETE /outputs — 다중 삭제. 반환 data.deleted가 실제로 지워진 수다. */
export async function deleteOutputs(ids) {
  return requestJson('/outputs', jsonBody('DELETE', { ids }), '삭제에 실패했습니다')
}

/**
 * GET /outputs/{id}/file — 파일 본문을 blob으로 받는다.
 *
 * `downloadArtifactImage`와 **같은 모양**(`{ ok, blob, filename }`)이라 호출부가
 * `triggerBrowserDownload(blob, filename)`을 그대로 쓸 수 있다.
 *
 * 파일명은 서버의 Content-Disposition을 우선한다 — 사용자가 친 한글 제목이라
 * RFC 5987 `filename*`로 실려 온다. 파싱에 실패하면 호출부가 준 이름으로 떨어진다.
 */
export async function downloadOutputFile(outputId, fallbackName = 'output.xlsx') {
  let res
  try {
    res = await fetch(`${BASE}/outputs/${encodeURIComponent(outputId)}/file`, {
      credentials: 'include',
    })
  } catch {
    return { ok: false, status: 0, notice: '서버에 연결하지 못했습니다' }
  }
  if (!res.ok) return fail(res, '다운로드에 실패했습니다')
  return {
    ok: true,
    blob: await res.blob(),
    filename: filenameFrom(res.headers.get('content-disposition')) || fallbackName,
  }
}

/**
 * GET /outputs/{id}/timeline — 설명문 타임라인의 **합친 모양**(round11a task-9).
 *
 * `{ version, edited, decades:[{decade,title,years:[{year_label,subtitle,
 * items:[…]}]}] }` 이 온다. `/doc` 과 층이 다르다 — doc 은 연도 하나로 묶인
 * 평면이고 이쪽은 **연대 › 연도 › 항목** 3층이며, 항목마다 유물(`idnbr`·
 * `name`·`subject_era`·`matched_by`)과 붙인 사건(`attached`)을 함께 들고 있다.
 * 뷰어는 본문(제목·부제·본문)은 `/doc` 에서, 타임라인은 여기서 읽는다.
 *
 * **설명문(caption) 전용**이다 — 다른 kind 는 422 다. 그리고 소유자 전용이라
 * 프로젝트 경유(공유 열람) 짝이 없다(서버에 그 라우트가 없다).
 *
 * 실패를 삼키지 않는 이유는 이 파일의 다른 함수들과 같다 — 호출부가 사유를
 * 보고 「옛 표 렌더로 떨어질지」를 정한다(OutputViewer.jsx).
 */
export async function getOutputTimeline(outputId) {
  return requestJson(
    `/outputs/${encodeURIComponent(outputId)}/timeline`,
    { method: 'GET' },
    '타임라인을 불러오지 못했습니다',
  )
}

/** GET /outputs/{id}/doc — 원문 뷰어용 구조화 사본. 404면 「미리보기 없음」 사유가 온다. */
export async function getOutputDoc(outputId) {
  return requestJson(
    `/outputs/${encodeURIComponent(outputId)}/doc`,
    { method: 'GET' },
    '이 산출물은 미리보기를 만들기 전에 생성되었습니다 — 다운로드로 확인해 주세요',
  )
}

/**
 * Content-Disposition에서 파일명을 뽑는다. `filename*=UTF-8''…`(RFC 5987)를 먼저
 * 보고, 없으면 ASCII `filename="…"`으로 떨어진다.
 *
 * export하는 이유는 테스트 때문이다 — 한글 파일명이 깨지는 건 헤더 파싱에서
 * 일어나는데, 그것만 따로 검증할 수 있어야 한다.
 */
export function filenameFrom(header) {
  if (!header) return null
  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim())
    } catch { /* 잘못 인코딩된 헤더 — ASCII 폴백으로 넘어간다 */ }
  }
  const plain = /filename="([^"]*)"/i.exec(header)
  return plain ? plain[1] : null
}
