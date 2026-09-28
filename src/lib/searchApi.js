/**
 * searchApi.js
 *
 * round4 백엔드(POST /search)와 통신하는 얇은 클라이언트.
 * VITE_API_BASE_URL이 설정된 경우에만 "라이브 모드"로 동작한다(isLive()).
 * 미설정 시(프로토타입 기본값) 호출측은 기존 더미 시나리오 매칭을 그대로 쓴다.
 */

import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

// 라이브 백엔드 연동 여부. BASE가 비어있으면(undefined/'') false — 더미 모드.
export const isLive = () => Boolean(BASE)

/**
 * 백엔드가 내려주는 상대경로(예: "/images/{idnbr}")를 절대 URL로 접두한다.
 * 프론트(Vercel 등)와 백엔드(Node A)가 서로 다른 오리진일 때, 상대경로를 그대로 쓰면
 * 브라우저가 프론트 오리진에서 리소스를 찾아 404가 난다(DoD #1: 썸네일 표시).
 * 이미 절대 URL(http/https)이면 그대로 반환한다 — page_url 등 원본 절대 URL을 실수로
 * 다시 접두하지 않기 위함이기도 하다.
 */
export const toAbsolute = (u) => {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  return `${BASE || ''}${u}`
}

/**
 * 백엔드 category 문자열을 프로토타입 유형(사진/영상/음성/도서)으로 파생한다.
 * 부분매칭(포함) 기준이며, 어느 것도 매칭되지 않으면 '사진'으로 폴백한다.
 */
export function deriveType(category) {
  const c = String(category || '')
  if (c.includes('사진') || c.includes('포스터')) return '사진'
  if (c.includes('영상')) return '영상'
  if (c.includes('음성')) return '음성'
  if (c.includes('도서') || c.includes('서적')) return '도서'
  return '사진'
}

/**
 * 백엔드 검색 결과(result) 1건을 프로토타입 MaterialCard가 쓰는 material shape으로 매핑한다.
 * MaterialCard(T18)는 material의 title·image·type·id를 쓴다(name 아님).
 */
export function mapResult(r) {
  return {
    id: r.idnbr,
    title: r.name,
    image: toAbsolute(r.image_url),
    type: deriveType(r.category),
    category: r.category,
    // round07d — 카드 배지가 읽는 축이 주제로 옮겼다. 서버가 항목마다 실어 주는
    // 값을 그대로 나르고 프론트는 파생하지 않는다(R6F-15 — 어휘가 두 곳에
    // 생기면 갈라진다. 실제로 갈라진 것이 이 라운드의 원인이다).
    //
    // 없으면 **빈 배열**이다. null 로 두면 배지 렌더가 undefined 를 map 한다.
    subject: Array.isArray(r.subject) ? r.subject : [],
    // round07h 후속 — 카드가 보여줄 시대를 "만들어진 때"(year_info/era, 자료 생산일)에서
    // "자료가 다루는 시대"(subject_year/subject_era)로 바꾼다. **정렬(SortSelect)이 이미
    // subject_year 축으로 도는데, 카드는 다른 축(year_info)을 찍어 정렬과 카드 순서가
    // 어긋나 보였다** — 실측: 「하멜의 난파 기록」이 subject_era=1653(다루는 시대)인데
    // 카드엔 year_info 파생값 "2010년대"가 찍혔다(2010년대에 디지털화한 1653년 이야기라는
    // 뜻이다). year_info·era 는 이 카드가 더는 읽지 않을 뿐 응답에서 빼지 않는다 — 다른
    // 화면(NodeModal 「시기」·「연도」 행 등)이 여전히 쓴다.
    //
    // 필드 이름을 era 에서 eraText 로 바꾼 이유도 같다 — 옛 이름 그대로 값만 바꾸면
    // 다음에 이 필드를 만지는 사람이 또 "만들어진 때"로 오해한다. MaterialModal.jsx의
    // 상세 뷰어가 이미 같은 뜻으로 쓰는 지역변수 이름(eraText)을 그대로 맞췄다.
    //
    // subject_year(정규화된 4자리 정수)가 있으면 "YYYY년"으로 찍는다(91.8%) — 4열
    // 그리드에서 원본 그대로("2020.11.6." 같은 전체 날짜, subject_era 원본의 68.6%가
    // 이 모양이다)를 늘어놓으면 카드 폭이 들쭉날쭉해진다. subject_year 가 없고
    // subject_era 원본은 있는 2,025건(0.7%, "일제강점기"·"19세기 후반" 등)은 "미상"이
    // 아니라 시대를 아는데 4자리 숫자로 못 담는 것이다 — 원본 그대로 보여준다("시대
    // 미상"으로 덮으면 아는 정보를 버린다). 정확한 원본은 상세 뷰어의 "시대" 행이
    // 어차피 detail.subject_era 로 보여준다(카드는 훑어보는 자리라 정규화가 우선).
    // 둘 다 없으면(22,378건, 7.5%) "시대 미상".
    eraText: r.subject_year != null
      ? `${r.subject_year}년`
      : (r.subject_era || '시대 미상'),
    pageUrl: r.page_url,
    score: r.score,
    // round06e R6E-10 — 다운로드 버튼 활성/비활성 판정. 명시 필드로만 판정한다
    // (material.image truthy 재사용 금지 — 더미 85건이 전부 image:''라 부호가 역전된다).
    hasImage: Boolean(r.has_image),
    // round07h — 공개/미공개 뱃지와 필터가 쓴다. **Boolean() 을 쓰지 않는다** —
    // 세 상태(공개·미공개·모름)를 구분해야 하는데 Boolean(null) 은 false 가 되어
    // 「모른다」가 「미공개다」로 둔갑한다. hasImage 와 다른 이유가 이것이다.
    isPublic: r.is_public ?? null,
    // round07m — 카드 종류 뱃지(이미지·영상·음원·도서·기타). 문화유산은 서버가 null 을
    // 준다(원천에 매체 칸이 없다). isPublic 과 같이 ?? null — 「없음」을 빈 문자열로
    // 바꾸지 않는다. 소장처(holder)는 카드가 쓰지 않아 싣지 않는다(목록은 facets 가 그린다).
    mediaType: r.media_type ?? null,
  }
}

/**
 * GET /artifacts/{idnbr} — 상세 전체(설명·재질·크기·국적/시대·OCR·is_public)를 조회한다.
 * 검색 응답엔 없는 상세를 결과 카드 클릭 시 불러와 상세 모달에 표출한다.
 *
 * round07b-ext task-6 — 반환 계약을 `{ ok, detail }`로 바꿨다. 서버(`get_artifact`)는
 * 무접속/미존재를 `{ idnbr, found:false }` 200으로 흡수하는데, 이전 구현은 `found`를
 * 최상위 필드로 흘려보내기만 해서 호출부가 매번 `d.found`를 직접 들여다봐야 했다.
 * NodeModal(task-6)이 `res.ok ? res.detail : null`로 소비하도록 설계돼 있어(브리프·
 * 계획서 §Task 6 인터페이스), found를 ok로 승격하고 나머지를 detail로 감싼다 —
 * 이 함수를 부르는 모든 곳이 같은 모양을 보게 하기 위함이다(MaterialModal.jsx도 함께
 * 갱신, 아래 참조). image(절대경로)는 기존 호출부(MaterialModal.jsx) 호환을 위해
 * detail 안에 그대로 유지한다 — image_url(상대경로)은 새 호출부(NodeModal)가 필요할 때
 * 직접 toAbsolute로 접두한다.
 * credentials:'include'(round06c 전면 게이트, spec §9.5) — 세션 쿠키를 실어 보낸다.
 */
export async function fetchArtifactDetail(idnbr) {
  const res = await fetch(`${BASE}/artifacts/${encodeURIComponent(idnbr)}`, {
    credentials: 'include',
  })
  // 401만 좁게 판정한다(‼️ !res.ok 금지 — .ok/.status 없는 기존 mock을 전부 오탐시킨다, spec §9.5·C-D2).
  if (res.status === 401) notifyUnauthorized()
  const { found, ...rest } = await res.json()
  return { ok: Boolean(found), detail: { ...rest, image: toAbsolute(rest.image_url) } }
}

/**
 * POST /search — 서버 페이지네이션(round04) 계약으로 호출한다.
 * body는 기본 { query, page }만 보낸다 — page_size는 서버 기본(20)에 맡겨 프론트에 상수를
 * 중복 하드코딩하지 않는다(양쪽 중 한쪽만 바뀌어 어긋나는 사고 방지).
 * 응답의 total(≤200)·page·page_size를 camelCase(total/page/pageSize)로 매핑해 반환한다.
 * results는 서버가 랭킹 캐시에서 잘라 준 "현재 페이지 분량"이며, 클라이언트는 추가 슬라이싱하지 않는다.
 * notice는 백엔드가 degraded/error 시 내려주는 사용자 안내문(정상 시 없을 수 있음).
 * credentials:'include'(round06c 전면 게이트, spec §9.5) — 세션 쿠키를 실어 보낸다.
 * conversationId: round06c C1b(spec §8.5·계획 C-D1) — 서버가 매 /search 호출마다 발급하는
 * conversation_id(uuid)를 camelCase로 노출한다. 응답에 없으면(구버전 mock 등) null —
 * 호출부(ScenarioContext)가 로컬 폴백(newConversationId)으로 대체한다.
 *
 * round06c E3(계획 Task E3 Step3): 위치인자(query, page)와 객체 인자({query,page,conversationId})
 * 겸용 시그니처 — 기존 위치인자 호출부(및 그 테스트)를 깨지 않으면서, ScenarioContext의
 * changePage/resumeConversation이 보유 conversationId를 실어 보내 "페이지 이동·재개마다
 * 새 conversations 행이 생기는" 문제를 해소한다(C4의 /search conversation_id 옵션 소비).
 * conversationId가 없으면(신규 검색) body에 conversation_id 키 자체를 넣지 않는다.
 *
 * round06e Task6(spec R6E-2): mode("meta"|"ocr"|"both")를 백엔드(Task4)의 /search 계약에
 * 실어 보낸다. mode가 없으면(구 호출부·이 함수를 위치인자로 부르는 곳 등) 키 자체를 넣지
 * 않는다 — 서버 기본값("meta")에 맡겨 기존 호출부·테스트의 바디 형태를 바꾸지 않는다.
 *
 * round07h — sort("relevance"|"recent"|"past")·visibility("all"|"public"|"private")를
 * museum/search/sorting.py(SortOrder·Visibility)의 /search 계약에 싣는다. mode·subjects와
 * 달리 **항상 보낸다** — 서버 기본값과 같아도 조건부로 뺐다 넣었다 하면 "안 보냄"과
 * "기본값을 보냄"이 서로 다른 경로가 되어, 그 경계에서 조용히 갈라지는 버그를 만든다.
 */
export async function searchArtifacts(queryOrOpts, page = 1) {
  const opts = (queryOrOpts && typeof queryOrOpts === 'object')
    ? queryOrOpts
    : { query: queryOrOpts, page }
  const { query, page: p = 1, conversationId, mode, subjects, sort = 'relevance', visibility = 'all', mediaType, holder, recordHistory } = opts
  const body = { query, page: p }
  if (conversationId) body.conversation_id = conversationId
  // round10 — 읽기 전용 복원용 검색만 기록을 끈다. **false 일 때만** 싣는다(서버 기본값이
  // true) — 늘 보내면 기존 호출부의 페이로드 모양이 바뀌어 회귀 위험만 생긴다.
  if (recordHistory === false) body.record_history = false
  if (mode) body.mode = mode
  // round06f 갈래 D(§9.4) → round07d 축 전환 — 비어 있지 않을 때만 싣는다. mode·conversationId
  // 와 같은 관행이며, 필터 미선택 경로의 body 형태를 바꾸지 않아 기존 호출부·테스트에
  // 회귀가 없다. 빈 배열은 보내지 않는다 — 서버가 '없거나 빈 리스트 = 필터 없음'으로
  // 읽고(R6F-16), 페이로드에서도 뜻 없는 키가 사라진다.
  if (Array.isArray(subjects) && subjects.length > 0) body.subjects = subjects
  // round07h — 정렬·등록유형. 서버 기본값과 같으면 굳이 안 보내도 되지만
  // 늘 보낸다 — 「안 보냄」과 「기본값」이 갈리는 경로를 만들지 않는 편이 낫다.
  body.sort = sort
  body.visibility = visibility
  // round07m — 종류·소장처. subjects 와 같이 값이 있을 때만 싣는다 — 서버가 「없음 = 필터
  // 없음」으로 읽는다. sort·visibility 처럼 늘 보내지 않는 이유: 두 값의 「기본값」은
  // 문자열이 아니라 「없음」이라, 늘 보내려면 null 을 실어야 하고 그러면 서버 Enum 검증과
  // 「키 없음」 두 경로가 같은 뜻이 된다 — 하나로 둔다.
  if (mediaType) body.media_type = mediaType
  if (holder) body.holder = holder
  const res = await fetch(`${BASE}/search`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // 401만 좁게 판정한다(‼️ !res.ok 금지 — .ok/.status 없는 기존 mock을 전부 오탐시킨다, spec §9.5·C-D2).
  if (res.status === 401) notifyUnauthorized()
  const data = await res.json()
  const results = Array.isArray(data.results) ? data.results.map(mapResult) : []
  return {
    status: data.status,
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    rewritten: data.rewritten,
    notice: data.notice,
    results,
    conversationId: data.conversation_id ?? null,
    // round06f R6F-16 — facets 는 서버가 **항상** 내려준다(빈 결과·에러여도 빈 배열).
    // 그래도 여기서 폴백을 두는 이유는 구 mock 응답과 429 조기반환 body 를 만나는
    // 테스트·과도기 배포에서 DropdownCheckBox 가 undefined 를 받지 않게 하기 위함이다.
    // round07d — 파셋 축이 subject 로 옮겼으므로 폴백 모양도 함께 맞춘다.
    facets: data.facets ?? { subject: [], media_type: [], holder: [] },
    // round06f R6F-12 — 만족도 제출(POST /feedback)의 request_id 는 NOT NULL 이라
    // 프론트가 값을 갖고 있어야 한다. 헤더(X-Request-ID)가 아니라 body 로 받는 이유는
    // CORS 노출 헤더 설정에 의존하지 않기 위함이다(dev 는 Vercel↔Railway 크로스 오리진).
    requestId: data.request_id ?? null,
  }
}

/**
 * GET /artifacts/{idnbr}/download — 의도적 다운로드 전용(R6E-9). /images(공개 프록시)와
 * 별도 엔드포인트라 require_user 게이트가 걸린다. 실패(401 세션 만료·404 이미지 없음/
 * MinIO 실패)는 모두 여기서 { ok:false }로 흡수해 호출부가 토스트로 안내하게 한다 —
 * 204를 성공으로 오인해 <a download>가 0바이트를 저장하는 침묵 실패를 피한다(코딩표준 §6).
 */
export async function downloadArtifactImage(idnbr) {
  const res = await fetch(`${BASE}/artifacts/${encodeURIComponent(idnbr)}/download`, {
    credentials: 'include',
  })
  if (res.status === 401) notifyUnauthorized()
  if (res.status !== 200) {
    let detail
    try { detail = (await res.json()).detail } catch { /* 본문이 없거나 JSON 아님 */ }
    return { ok: false, status: res.status, notice: detail || '다운로드에 실패했습니다' }
  }
  const blob = await res.blob()
  return { ok: true, blob, filename: `${idnbr}.jpg` }
}

/**
 * POST /search/brief/stream — 검색 결과 AI 브리핑을 SSE 토큰 스트림으로 소비한다
 * (round06f R6F-24, spec §7.3a "프론트 계약").
 *
 * EventSource는 POST를 못 쓰므로 chatApi.js의 postChatStream과 같은 방식으로
 * fetch + ReadableStream을 직접 파싱한다(파서·버퍼링·이벤트 분기 관행을 그대로
 * 미러). chatApi.js를 import해 재사용하지 않는 이유: lib/의 각 API 모듈은
 * 자기완결이 관행이다(레포 전반의 "각 파일이 스스로 완결된다" 원칙 — tests/가
 * 평면 구조로 파일 간 import를 피하는 것과 같은 이유. 검색 도메인 모듈이
 * 채팅 도메인 모듈에 결합되면 한쪽만 바뀌어도 다른 쪽이 조용히 어긋난다).
 *
 * 의미론은 §7.3(JSON fetchSearchBrief)과 동일하고 전달 방식만 다르다 — meta는
 * 항상 첫 이벤트({status,cached,model,result_count,notice?}), status==="ok"일
 * 때만 token({text})이 오고(캐시 히트는 전문을 단일 token 1회, 미스는 조각마다),
 * done({brief_len})으로 정상 종료, 스트림 도중 실패는 error({notice})로 알린다.
 *
 * 콜백: onMeta(meta) · onToken(text) · onDone(data) · onError(notice).
 * 401 → notifyUnauthorized() + onError(JSON 계약과 같은 좁은 판정, ‼️ !res.ok 금지
 * — 그 분기는 4xx 전반의 별개 처리다). mode가 없으면 body에 키를 넣지 않는다
 * (fetchSearchBrief·searchArtifacts와 같은 관행 — 서버 기본값 SearchMode.META 위임).
 */
export async function streamSearchBrief({ query, mode }, { onMeta, onToken, onDone, onError }) {
  const body = { query }
  if (mode) body.mode = mode
  let res
  try {
    res = await fetch(`${BASE}/search/brief/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    onError('네트워크 오류 — 잠시 후 다시 시도하세요')
    return
  }
  // 401만 좁게 판정해 AuthProvider에 통지한다(‼️ !res.ok 금지 — chatApi.js와 같은 이유:
  // 아래 !res.ok 분기는 429 등 서버의 의도적 거절이며 이것과 별개다).
  if (res.status === 401) notifyUnauthorized()
  if (!res.ok) {
    let notice = '요청이 거절되었습니다'
    try { notice = (await res.json()).notice || notice } catch { /* keep default */ }
    onError(notice)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? '' // 마지막 조각은 미완일 수 있어 보존(chatApi.js parseSSE와 동일)
    for (const frame of frames) {
      const lines = frame.split('\n')
      const evLine = lines.find((l) => l.startsWith('event: '))
      const dataLine = lines.find((l) => l.startsWith('data: '))
      if (!evLine || !dataLine) continue
      let data
      try { data = JSON.parse(dataLine.slice(6)) } catch { continue } // 깨진 프레임은 조용히 버린다
      const event = evLine.slice(7)
      if (event === 'meta') onMeta?.(data)
      else if (event === 'token') onToken?.(data.text)
      else if (event === 'done') onDone?.(data)
      else if (event === 'error') onError?.(data.notice)
      // 그 외 이벤트는 무시(전방 호환)
    }
  }
}

/**
 * POST /feedback — 검색 품질 만족도 제출(round06f 갈래 C, spec §8.3).
 *
 * 퍼블 1~7점 척도를 그대로 보낸다(R6F-9). rating(good/bad)은 **보내지 않는다** —
 * 서버가 score 에서 파생한다(R6F-10: 5↑good · 3↓bad · 4는 NULL=등급 없음).
 * 신원(user_id)도 보내지 않는다 — 서버가 세션에서만 취득한다(/search 와 같은 원칙).
 *
 * request_id·conversation_id·query·subjects 는 "무엇을 평가했는가"를 사후에 복원하는
 * 유일한 단서다(R6F-23) — 질의 문자열은 어떤 로그·테이블에도 남지 않으므로 로그 조인으로
 * 대신할 수 없다.
 * subjects 는 "그 필터 상태에서 본 결과 집합"을 뜻한다(무필터는 빈 배열).
 * round07d 이전에는 다른 이름의 용도·기능 축이었다.
 *
 * 저장 실패는 서버가 200 + ok:false 로 흡수하므로 여기서도 예외로 승격하지 않는다 —
 * 평가 제출 실패가 검색 결과 화면을 깨뜨리면 안 된다(코딩표준 §2.4).
 */
export async function postFeedback({ score, comment, requestId, conversationId, query, subjects }) {
  const res = await fetch(`${BASE}/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      score,
      comment: comment ?? null,
      request_id: requestId ?? null,
      conversation_id: conversationId ?? null,
      query: query ?? null,
      subjects: subjects ?? [],
    }),
  })
  if (res.status === 401) notifyUnauthorized()
  const data = await res.json()
  return { ok: Boolean(data.ok), status: data.status ?? 'error', notice: data.notice ?? null }
}
