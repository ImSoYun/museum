/**
 * chatApi.js — POST /chat SSE 클라이언트(round05a, spec §4·§12).
 *
 * EventSource는 POST를 못 쓰므로 fetch + ReadableStream으로 SSE를 직접 파싱한다.
 * parseSSE는 순수 함수로 분리해 단위 테스트한다. 미지의 event 이름은 무시한다
 * (향후 stage/이벤트 추가에 안전 — spec §12).
 */

import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

/** SSE 버퍼 → 완결 프레임 이벤트 목록 + 미완 꼬리(rest). 순수 함수. */
export function parseSSE(buffer) {
  const events = []
  const frames = buffer.split('\n\n')
  const rest = frames.pop() ?? '' // 마지막 조각은 미완일 수 있어 보존
  for (const frame of frames) {
    const lines = frame.split('\n')
    const evLine = lines.find((l) => l.startsWith('event: '))
    const dataLine = lines.find((l) => l.startsWith('data: '))
    if (!evLine || !dataLine) continue
    try {
      events.push({ event: evLine.slice(7), data: JSON.parse(dataLine.slice(6)) })
    } catch {
      // 깨진 프레임은 조용히 버린다 — 스트림 전체를 죽이지 않는다
    }
  }
  return { events, rest }
}

/**
 * POST /chat 스트림 소비. 콜백: onStatus(data)·onToken(t)·onCitations(list)·
 * onNotice(text)·onDone(data)·onError(notice, kind).
 *
 * onError의 2번째 인자 kind는 실패의 성격을 알린다(round06d 후속 #8 — 자동 재시도 판정용):
 *   'network' = fetch 자체 실패(연결 끊김 등)     → 일시적, 재시도 가치 있음
 *   'http'    = 응답이 4xx/5xx(429·422 등)         → 서버의 의도적 거절, 즉시 재시도 무의미
 *   'stream'  = 스트림 중 서버가 보낸 error 이벤트  → 백엔드가 그래프 예외를 흡수한 경로
 *               (api.py 참조: OpenRouter 하위 공급자 라우팅 간헐 실패가 여기로 온다) → 재시도 가치 있음
 * 호출부(ScenarioContext)가 이 kind로 재시도 여부를 정한다. kind를 무시해도 기존 동작과 같다.
 *
 * round06e Task6(spec R6E-2): mode("meta"|"ocr"|"both")를 searchApi.searchArtifacts와 같은
 * 방식으로 받는다 — 없으면 바디에 키를 넣지 않아 서버 기본값("meta")에 맡긴다.
 */
export async function postChatStream(
  { conversationId, message, searchQuery, mode },
  { onStatus, onToken, onCitations, onNotice, onDone, onError },
) {
  let res
  try {
    res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      credentials: 'include', // round06c 전면 게이트(spec §9.5) — 세션 쿠키를 실어 보낸다.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        message,
        ...(searchQuery ? { search_query: searchQuery } : {}),
        ...(mode ? { mode } : {}),
      }),
    })
  } catch {
    onError('네트워크 오류 — 잠시 후 다시 시도하세요', 'network')
    return
  }
  // 401만 좁게 판정해 AuthProvider에 통지한다(‼️ !res.ok 금지 — 아래의 !res.ok 분기는
  // 422/429 등 기존 'http' 에러 처리이며 이것과 별개다, spec §9.5·C-D2).
  if (res.status === 401) notifyUnauthorized()
  if (!res.ok) {
    let notice = '요청이 거절되었습니다'
    try { notice = (await res.json()).notice || notice } catch { /* keep default */ }
    onError(notice, 'http')
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = parseSSE(buffer)
    buffer = rest
    for (const { event, data } of events) {
      if (event === 'status') onStatus(data)
      else if (event === 'token') onToken(data.t)
      else if (event === 'citations') onCitations(data.citations)
      else if (event === 'notice') onNotice?.(data.notice)
      else if (event === 'done') onDone(data)
      else if (event === 'error') onError(data.notice, 'stream')
      // 그 외 이벤트는 무시(전방 호환)
    }
  }
}
