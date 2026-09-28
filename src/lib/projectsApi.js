/**
 * projectsApi.js
 *
 * 라이브러리 프로젝트 클라이언트(round10 Task4) — 검색결과·산출물을 「프로젝트」로
 * 저장·조회·열기·다운로드한다.
 *
 * outputsApi.js를 본떠 쓴다(같은 BASE·credentials:'include'·401 처리 관행). lib/
 * 모듈끼리 서로 import하지 않는 규약(outputsApi.js 머리주석 참조)을 지키기 위해
 * BASE·공통 실패 흡수·filenameFrom을 outputsApi.js에서 끌어오지 않고 이 파일 안에
 * 다시 둔다 — 중복처럼 보이지만, lib/ 모듈이 서로를 부르기 시작하면 순환이 생기고
 * 테스트에서 한 모듈만 mock할 수 없게 된다. authEvents.js는 예외다: API 클라이언트가
 * 아니라 401 통지 전용 작은 이벤트 채널이라 다른 lib 모듈들도 전부 여기서 가져온다.
 *
 * ‼️ openProject만은 401에서 notifyUnauthorized()를 부르지 않는다 — 아래 openProject
 * 도크스트링 참조. 이 라운드 백엔드(projects/routes.py:117-120)가 401을 "이 프로젝트는
 * 암호가 필요하다"는 도메인 신호로 재사용하기 때문이다(403=틀림, 401=입력 필요).
 * 다른 모든 lib/ 모듈의 401은 예외 없이 "세션이 끊겼다"를 뜻하지만, 여기서 같은
 * 관행을 그대로 따르면 암호로 잠긴 프로젝트를 열 때마다 전역 로그아웃이 튀어나와
 * 정작 암호 입력 화면(Task 6·7)에 닿지도 못한다.
 */
import { notifyUnauthorized } from './authEvents.js'

const BASE = import.meta.env.VITE_API_BASE_URL

const jsonBody = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** 공통 실패 흡수 — outputsApi.js의 fail()과 같은 모양({ok:false, status, notice}). */
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

/**
 * POST /projects — 검색·산출물을 새 프로젝트로 저장한다.
 *
 * camelCase → snake_case 변환이 이 함수의 핵심이다(서버 계약은 스네이크). password는
 * null/undefined(=암호 없음)면 **키 자체를 싣지 않는다** — 서버(ProjectCreateRequest.
 * password, min_length=1)가 빈 문자열 암호를 422로 거부하므로, "설정 안 함"과
 * "빈 문자열"을 같은 값으로 흘려보내면 안 된다. 그 구분은 SaveProjectModal이 이미
 * 해 둔다(체크를 껐으면 onSave에 password:null을 준다) — 여기서는 null/undefined를
 * 한 번 더 걸러 키 자체를 지우기만 한다(호출부가 어디든 같은 안전판이 서도록).
 */
export async function saveProject({
  title, description, password, conversationId, searchQuery, searchMode, outputIds,
}) {
  const payload = {
    title,
    description,
    conversation_id: conversationId,
    search_query: searchQuery,
    search_mode: searchMode,
    output_ids: outputIds,
  }
  if (password != null) payload.password = password
  const res = await requestJson('/projects', jsonBody('POST', payload), '프로젝트 저장에 실패했습니다')
  if (!res.ok) return res
  return { ok: true, id: res.data.id }
}

/** GET /projects — 라이브러리 목록(공유 서랍 — 남의 것도 온다, 수정·삭제만 소유자 제한). */
export async function listProjects({ q, limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  const res = await requestJson(`/projects?${params}`, { method: 'GET' }, '라이브러리 목록을 불러오지 못했습니다')
  if (!res.ok) return res
  return { ok: true, projects: res.data.projects ?? [], hasMore: Boolean(res.data.has_more) }
}

/**
 * POST /projects/{id}/open — 프로젝트를 연다(암호가 걸려 있으면 매번 검증 — 세션에
 * 통과 상태를 남기지 않는다, routes.py 머리주석).
 *
 * 이 함수만 공용 fail()/requestJson 경로를 타지 않는다: 401이 "암호를 입력하세요"
 * (password_required)라는 **도메인** 신호이지 세션만료가 아니기 때문이다(파일 머리
 * 주석 참조). 403(password_mismatch)·404는 원래도 notifyUnauthorized 대상이 아니었으니
 * 그대로 상태 코드만 실어 올린다 — 어느 실패든 이 함수는 notifyUnauthorized를 부르지
 * 않는다.
 */
export async function openProject(id, password) {
  let res
  try {
    res = await fetch(`${BASE}/projects/${encodeURIComponent(id)}/open`, {
      credentials: 'include',
      ...jsonBody('POST', password != null ? { password } : {}),
    })
  } catch {
    return { ok: false, status: 0 }
  }
  if (!res.ok) return { ok: false, status: res.status }
  const data = await res.json()
  return { ok: true, status: res.status, project: data.project, outputIds: data.output_ids }
}

/** GET /projects/{id}/outputs — 그 프로젝트 스냅샷에 묶인 산출물 메타 목록. */
export async function listProjectOutputs(id) {
  const res = await requestJson(
    `/projects/${encodeURIComponent(id)}/outputs`,
    { method: 'GET' },
    '산출물 목록을 불러오지 못했습니다',
  )
  if (!res.ok) return res
  return { ok: true, outputs: res.data.outputs ?? [] }
}

/**
 * GET /projects/{id}/outputs/{output_id} — 공유 열람용 상세(메타).
 *
 * round10 Task7 사후조치(spec §5-5 위반 수정) — 목록(ProjectOutputList)의
 * 「상세보기」가 지금까지 소유자 전용 outputsApi.getOutput을 불러, 남의
 * 프로젝트를 연 사람이 상세보기를 누르면 403이 났다. 서버가 새로 낸
 * `GET /projects/{id}/outputs/{output_id}`(소속 판정 — 소유 여부 무관, 다운로드와
 * 같은 판정)를 그대로 부르기만 한다 — listProjectOutputs와 같은 관용구
 * (requestJson 경유, `{ ok, ... }` 모양)를 따르되, outputsApi.getOutput과 응답
 * 필드가 같아야 OutputDetailPage가 두 경로를 같은 코드로 소비할 수 있으므로
 * requestJson의 원 반환 모양({ ok, status, data })을 그대로 돌려준다(재포장하지
 * 않는다) — getOutput이 그렇게 하는 것과 동일하다.
 */
export async function getProjectOutput(projectId, outputId) {
  return requestJson(
    `/projects/${encodeURIComponent(projectId)}/outputs/${encodeURIComponent(outputId)}`,
    { method: 'GET' },
    '산출물을 불러오지 못했습니다',
  )
}

/**
 * GET /projects/{id}/outputs/{output_id}/doc — 공유 열람용 **원문 미리보기**.
 *
 * round10 재리뷰 — 상세 화면에서 소유자 전용 호출을 셋 고쳤는데 한 겹 더 깊은
 * `OutputViewer.jsx`가 `outputsApi.getOutputDoc`(소유자 전용 `GET /outputs/{id}/doc`)를
 * 무조건 부르고 있었다. 그래서 남의 프로젝트에서 「상세보기」를 누르면 제목·선택자료·
 * 다운로드는 나오는데 **본문만 「권한 없음」**이 됐다.
 *
 * 반환 모양은 `outputsApi.getOutputDoc`과 같아야 한다({ ok, status, data } — 뷰어가
 * 두 경로를 같은 코드로 소비한다). 그래서 getProjectOutput과 마찬가지로 requestJson의
 * 원 반환 모양을 재포장하지 않고 그대로 돌려준다. 404 사유 문구도 서버가 소유자용과
 * 같은 상수(`OUTPUT_DOC_MISSING`)를 쓰므로 뷰어의 「미리보기 없음」 안내가 두 경로에서
 * 똑같이 뜬다.
 *
 * ★ 폴백 문구도 `outputsApi.getOutputDoc`과 **글자까지 같게** 둔다. 이 문구는 서버가
 *   detail을 안 줄 때(예: 500)만 쓰이는데, 거기서 두 경로가 다른 말을 하면 「같은
 *   화면이 두 경로 어느 쪽으로 와도 그대로 그린다」(spec §4)에 구멍이 생긴다. 이
 *   문구가 일반 실패에까지 「미리보기 전에 생성되었습니다」라고 말하는 것은 소유자
 *   경로에 원래 있던 느슨함이라, 이번에 새로 만들지 않고 그대로 따라간다.
 */
export async function getProjectOutputDoc(projectId, outputId) {
  return requestJson(
    `/projects/${encodeURIComponent(projectId)}/outputs/${encodeURIComponent(outputId)}/doc`,
    { method: 'GET' },
    '이 산출물은 미리보기를 만들기 전에 생성되었습니다 — 다운로드로 확인해 주세요',
  )
}

/**
 * GET /projects/{id}/outputs/{output_id}/file — outputsApi.downloadOutputFile(:132-147)과
 * 같은 모양({ ok, blob, filename })으로 만든다(브리프 지시) — 호출부가 같은
 * triggerBrowserDownload(blob, filename)을 그대로 쓸 수 있게. 파일명 파싱도 같은
 * 방식(RFC 5987 filename* 우선, 실패 시 ASCII filename= 폴백)이다.
 */
export async function downloadProjectOutput(projectId, outputId, fallbackName = 'output.xlsx') {
  let res
  try {
    res = await fetch(
      `${BASE}/projects/${encodeURIComponent(projectId)}/outputs/${encodeURIComponent(outputId)}/file`,
      { credentials: 'include' },
    )
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
 * GET /projects/{id}/conversations/{conversation_id} — 공유 열람용 대화 조회.
 *
 * round10 최종리뷰 C-1. 남의 프로젝트를 연 사람은 소유자 전용
 * `GET /conversations/{id}`(conversationsApi.getConversation)를 부를 수 없다 — 403이다.
 * 서버가 낸 프로젝트 경유 경로(판정은 소유가 아니라 「그 프로젝트의 대화인가」)를
 * 그대로 부른다.
 *
 * ★ 반환 모양을 conversationsApi.getConversation과 **똑같이** 맞춘다
 *   ({ ...body, status }). 소비처인 ScenarioContext.resumeConversation이 두 경로를
 *   같은 코드로 소비하기 때문이다(그쪽이 조회 함수를 주입받는 구조 — 그 주석 참조).
 *   서버 응답 필드도 같다(projects/routes.py가 conversations의 _summarize 재사용).
 *
 * 401은 여기서만은 「세션이 끊겼다」가 맞다 — openProject의 401(암호 필요)과 달리
 * 이 경로에는 암호 개념이 없다. 그래서 다른 lib/ 모듈과 같은 관행대로 통지한다.
 */
export async function getProjectConversation(projectId, conversationId) {
  let res
  try {
    res = await fetch(
      `${BASE}/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}`,
      { credentials: 'include' },
    )
  } catch {
    // 네트워크 자체가 끊겼다. status가 없으므로 requestJson과 같은 관행으로 0을 쓴다 —
    // 호출부(resumeConversation)는 status!==200이면 실패로 본다.
    return { status: 0 }
  }
  if (res.status === 401) notifyUnauthorized()
  let body = {}
  try {
    body = await res.json()
  } catch { /* 본문이 없거나 JSON이 아니다 — status만으로 실패를 판정한다 */ }
  return { ...body, status: res.status }
}

/** outputsApi.js의 filenameFrom과 같은 로직 — lib/ 모듈 간 무의존 규약이라 다시 둔다. */
function filenameFrom(header) {
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
