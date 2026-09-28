/**
 * conversationsApi.js
 *
 * "나의 기록" — 대화 목록·재개·삭제 클라이언트(round06c Task E2).
 * isLive()는 searchApi.js의 정본을 재사용한다(BASE 판정 이중화 방지).
 * 401은 authEvents.js의 notifyUnauthorized()로 좁게 통지한다(!res.ok 아님, spec §9.5·C-D2).
 *
 * ★ 백엔드 계약(C3에서 확정 — E5·이 파일의 소비처가 정렬할 기준):
 * - GET /conversations 목록: 각 행은 5필드 화이트리스트
 *   {id, search_query, created_at, last_turn_at, turn_count}(user_id 미노출),
 *   COALESCE(last_turn_at, created_at) DESC 정렬.
 * - GET /conversations/{id} 재개: 위 필드 + messages[] — 턴 1개당
 *   {"role":"user","content":질문} + {"role":"assistant","content":답변,
 *   "grounded_docs":[...],"rewritten_queries":[...]}.
 *   체크포인트 없는(검색만 한) 행은 messages: [].
 *   ‼️ citations 필드는 절대 없다 — 소비처(ScenarioContext.resumeConversation)가
 *   grounded_docs를 라이브 채팅과 같은 citations 형태({n, idnbr, name, image_url})로
 *   변환한다(round06c 리뷰 F1). rewritten_queries는 프론트 소비처가 없다.
 * - DELETE /conversations/{id}: 행+체크포인트 스레드 삭제.
 * - PATCH /conversations/{id} body:{title}(1~100자): 표시명만 갱신(round06f R6F-25,
 *   백엔드 c9271c6). search_query는 그대로 둔다 — 재개 검색·브리핑 캐시 키가 흔들리지
 *   않도록 표시명 축을 분리한 것(spec R6F-25). 목록/조회 응답의 title(null 가능)과
 *   합쳐 소비처(LnbHistory)가 `title ?? search_query`로 표시명을 계산한다.
 * - 모두 credentials:'include', 401만 좁게 판정(res.status===401 → notifyUnauthorized).
 *
 * ★ round06c 리뷰 F3 — getConversation은 status를 동봉한다(deleteConversation과 대칭).
 *   이전엔 {detail}만 resolve해 404(대화 없음)·403(타인 소유)에서도 호출부가 실패를
 *   분간하지 못했다(HTTP status를 삼킴) — 그 결과 실패한 재개가 search_query=''로 진행돼
 *   서버에 빈 질의 conversations 행을 만들었다. 지금은 라이브 응답에 `status: res.status`를
 *   항상 실어(200이든 404/403이든) 반환하고, 더미(!isLive) 응답에도 `status: 200`을 동봉해
 *   두 경로의 반환 shape을 맞춘다 — 소비처(ScenarioContext)가 `isLive()`로만 가드를
 *   나누고 status 필드 자체는 항상 읽을 수 있게 한다.
 */
import { isLive } from './searchApi.js'
import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

const DEMO_CONVERSATIONS = [
  { id: 'c-demo-1', search_query: '민주화운동에 관련된 자료 찾아줘', created_at: '2026-07-23T10:00:00Z', last_turn_at: '2026-07-23T10:05:00Z', turn_count: 3 },
  { id: 'c-demo-2', search_query: '88서울올림픽 포스터', created_at: '2026-07-22T09:00:00Z', last_turn_at: null, turn_count: 0 },
]

// round06c 리뷰 F5 — c-demo-1(turn_count:3)의 재개 데모 메시지. 이전엔 getConversation이
// 항상 messages:[]를 돌려줘 "3턴 대화"가 빈 스레드로 열리는 자기부정합이 있었다. 서버 계약
// 형태(위 docstring) 그대로 3턴(user+assistant 쌍 3개=6항목)을 채운다 — search_query
// ('민주화운동에 관련된 자료 찾아줘')에 자연스럽게 이어지는 짧은 데모 대화이며, 자료
// idnbr·name은 근거 없는 발명을 피해 검색 결과 표기 관례(PS-접두 + 순번)만 빌린다.
// c-demo-2(turn_count:0)는 messages:[] 그대로 유지한다(대상 없음 — F5 범위 아님).
const DEMO_MESSAGES = {
  'c-demo-1': [
    { role: 'user', content: '가장 대표적인 사진 자료부터 보여줘' },
    {
      role: 'assistant',
      content: '민주화운동 관련 자료 중 6월항쟁 시위 현장을 담은 사진이 가장 대표적입니다. [1] 참고해 주세요.',
      grounded_docs: [{ n: 1, idnbr: 'PS-1001', name: '6월항쟁 시위 사진' }],
      rewritten_queries: ['민주화운동 대표 사진 자료'],
    },
    { role: 'user', content: '이 시위는 언제 일어난 거야?' },
    {
      role: 'assistant',
      content: '해당 사진은 1987년 6월 민주항쟁 당시 기록된 자료입니다.',
      grounded_docs: [{ n: 1, idnbr: 'PS-1001', name: '6월항쟁 시위 사진' }],
      rewritten_queries: ['6월항쟁 시위 시기'],
    },
    { role: 'user', content: '관련 포스터 자료도 있어?' },
    {
      role: 'assistant',
      content: '네, 민주화 선언을 알리는 포스터 자료도 함께 확인할 수 있습니다. [2] 참고해 주세요.',
      grounded_docs: [{ n: 2, idnbr: 'PS-1002', name: '민주화 선언 포스터' }],
      rewritten_queries: ['민주화운동 포스터 자료'],
    },
  ],
}

export async function listConversations({ limit = 10, offset = 0 } = {}) {
  if (!isLive()) {
    const page = DEMO_CONVERSATIONS.slice(offset, offset + limit).map((c) => ({ ...c }))
    return { conversations: page, has_more: offset + limit < DEMO_CONVERSATIONS.length }
  }
  const res = await fetch(`${BASE}/conversations?limit=${limit}&offset=${offset}`, {
    credentials: 'include',
  })
  if (res.status === 401) notifyUnauthorized()
  return res.json()
}

export async function getConversation(id) {
  if (!isLive()) {
    const found = DEMO_CONVERSATIONS.find((c) => c.id === id)
    const messages = (DEMO_MESSAGES[id] || []).map((m) => ({ ...m }))
    return { ...(found ?? { id, search_query: '' }), messages, status: 200 }
  }
  const res = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, { credentials: 'include' })
  if (res.status === 401) notifyUnauthorized()
  const body = await res.json()
  return { ...body, status: res.status }
}

export async function deleteConversation(id) {
  if (!isLive()) return { status: 200 }
  const res = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
  if (res.status === 401) notifyUnauthorized()
  return { status: res.status }
}

// round06f R6F-25 — "나의 기록" 이름 바꾸기. 더미 모드는 deleteConversation과 대칭으로
// status:200만 반환한다(DEMO_CONVERSATIONS를 실제로 갱신하지 않는다 — deleteConversation도
// 데모 배열을 실제로 지우지 않는 것과 같은 관행). 라이브는 getConversation과 대칭으로
// 응답 본문 + status를 함께 반환해, 호출측이 status===200으로 성공/실패를 분간한다.
export async function renameConversation(id, title) {
  if (!isLive()) return { status: 200 }
  const res = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (res.status === 401) notifyUnauthorized()
  const body = await res.json()
  return { ...body, status: res.status }
}
