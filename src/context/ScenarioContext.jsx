import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react'
import { MAIN_SCENARIO_ID, matchScenarioResult, getScenario } from '../data/scenarios.js'
import { isLive, searchArtifacts, streamSearchBrief } from '../lib/searchApi.js'
import { fetchOutputGraph } from '../lib/outputsApi.js'
import { postChatStream } from '../lib/chatApi.js'
import { getConversation } from '../lib/conversationsApi.js'

// 테스트에서 라이브 상태(loading/liveStatus/liveResults 등)를 직접 주입할 수 있도록 export한다.
// (ScenarioProvider를 거치지 않고 <ScenarioContext.Provider value={...}> 로 mock 주입 — T20)
export const ScenarioContext = createContext(null)

// 채팅 자동 재시도 정책(round06d 후속 #8). 백엔드는 무변경 — 프론트에서만 얹는다.
//   왜: rewrite·generate가 모두 LLM 호출이고, OpenRouter 하위 공급자 라우팅이 간헐 실패하면
//   둘이 함께 죽어 대화가 "되지 않는" 것처럼 보인다(임베딩=Google은 늘 성공). 백엔드가 이 예외를
//   error 이벤트로 흡수하므로(api.py) 프론트는 그 error(kind='stream')를 받아 한 번 더 시도하면
//   대개 다른 공급자로 재라우팅돼 성공한다. 채팅 그래프가 durability="exit"라 실패 턴은 체크포인트에
//   남지 않아, 같은 conversationId로 재시도해도 히스토리가 중복되지 않는다(멱등).
// 재시도 대상은 일시적 실패(stream·network)뿐이다. http(429·422)는 서버의 의도적 거절이라 제외.
const CHAT_MAX_RETRIES = 1
// 백오프(ms). 재라우팅될 틈을 준다. 테스트는 0으로 낮춰 결정성 확보 / 운영은 값 조정 여지를 env로 연다.
const CHAT_RETRY_BACKOFF_MS = Number(import.meta.env.VITE_CHAT_RETRY_BACKOFF_MS ?? 500)

// crypto.randomUUID는 보안 컨텍스트(HTTPS·localhost) 전용이다 — HTTP 공인 IP
// 배포(Node A, 도메인 등록 전)에서는 undefined라 앱 마운트 자체가 죽는다(게이트3 실측).
// 대화 구분용 ID는 전역 유일성만 있으면 되므로 비보안 컨텍스트에선 시간+난수로 대체한다.
function newConversationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function ScenarioProvider({ children }) {
  const [activeId, setActiveId] = useState(MAIN_SCENARIO_ID)
  // 직전 쿼리 매칭 여부 — 초기 진입(메인 기본 노출)은 매칭으로 간주
  const [matched, setMatched] = useState(true)

  // 라이브 모드(백엔드 POST /search) 상태 — VITE_API_BASE_URL 미설정 시에는 쓰이지 않는다.
  const [liveResults, setLiveResults] = useState(null)
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveTotal, setLiveTotal] = useState(0)
  const [liveRewritten, setLiveRewritten] = useState(null)
  // 백엔드 안내문(degraded/error 시 "재작성 실패로 원문 검색" 같은 메시지). 정상(ok) 시에는 보통 없음.
  const [liveNotice, setLiveNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  // 서버 페이지네이션(round04) 상태. round06f 갈래 A(spec §6.1)에서 "모두 보기"(showAll)
  // 중간 단계를 폐기해, 검색 직후부터 서버 total 기준 페이지 이동 UI가 그대로 노출된다 —
  // 서버가 이미 20건 × 최대 10페이지(SEARCH_MAX 200 ÷ SEARCH_PAGE_SIZE 20)로 응답하므로
  // 프론트가 그 사이에 단계를 하나 더 둘 이유가 없다.
  // pageSize는 프론트가 정하지 않고 서버 응답(page_size)을 따른다(기본 20 — 상수 이중화 방지).
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [lastQuery, setLastQuery] = useState('')

  // round06f R6F-26(spec §5) — 로딩 문구 분기. 최초 검색(runLiveSearch)과 재개·페이지
  // 이동·필터 변경은 사용자에게 같은 의미가 아니다 — 후자들은 서버 관점에서도 랭킹
  // 캐시 슬라이스/DB 조회일 뿐 재검색이 아니다(§3.1·§3.2). "검색 중…"을 그대로 쓰면
  // "또 검색하는 것 같다"는 오해를 준다(사용자 지시 2026-07-28). fetchPage는 4곳(진입부)이
  // 공유하는 공용 통로라 원인을 스스로 모르므로, 호출부가 kind를 명시로 넘긴다
  // (modeOverride 인자, 그리고 filters 객체로 넘기는 값들과 같은 이유 — 클로저 stale 값 회피).
  const [loadingKind, setLoadingKind] = useState('search')

  // round06e Task6(spec R6E-2) — 검색 모드는 검색과 대화가 공유하므로 여기가 소유자다.
  // 기본은 메타만('meta') — 백엔드 포트 기본값(SearchMode.META)과 같아 이 상태를 추가해도
  // 기존 계약이 변하지 않는다. 토글 UI는 다음 태스크(T7) 몫 — 여기서는 상태만 둔다.
  const [searchMode, setSearchMode] = useState('meta')

  // round06f 갈래 B(spec §7.5) — AI 브리핑. 상태를 컨텍스트가 소유하는 이유는 세 가지다.
  //  ① 탭을 옮겨 카드가 언마운트돼도 다시 만들면 안 된다(LLM 1회 = 실비용).
  //  ② 페이지를 넘겨도 같은 문구가 유지돼야 한다(DoD 3-a — 이 구간엔 요청 자체가 없다).
  //  ③ 새 검색·기록 재개에서만 갈아끼워야 한다.
  const [brief, setBrief] = useState(null)
  const [briefStatus, setBriefStatus] = useState('idle')   // idle | loading | ok | error
  const [briefNotice, setBriefNotice] = useState(null)
  // 브리핑 세대 가드 — 빠른 재검색에서 앞선 요청의 응답이 뒤늦게 도착해 새 결과 위에
  // 옛 요약을 덮어쓰는 것을 막는다. chatGenRef(아래)가 스트림에 대해 하는 일과 같다.
  const briefGenRef = useRef(0)

  // round07b — 산출물생성 「자료선택」의 노드 그래프. 브리핑(brief*)과 **같은 모양**이다:
  // 검색 성공 직후 1회 받아 두고, 세대 가드로 늦게 온 응답이 새 화면을 덮지 못하게 한다.
  //
  // 검색 결과(liveResults)에서 프론트가 직접 파생하지 않는 이유가 둘이다.
  //  ① liveResults는 **한 페이지(20건)**뿐인데 그래프는 랭킹 200건 전체를 갈라야 한다.
  //  ② 파생 규칙(주제 축 파싱·미분류 처리)이 서버에 이미 있다 — 프론트가 다시 구현하면
  //     어휘가 두 곳에 생겨 갈라진다(R6F-15).
  const [graph, setGraph] = useState(null)
  const [graphStatus, setGraphStatus] = useState('idle')  // idle | loading | ok | error
  const [graphNotice, setGraphNotice] = useState(null)
  const graphGenRef = useRef(0)

  // round07b-ext 리뷰 — 산출물이 바뀌었다는 **신호**. graph 옆에 두는 이유는 소비처가
  // 층을 건너뛰기 때문이다: 산출물을 만들고·열고·지우는 곳은 OutputTab/OutputList인데,
  // 미열람 뱃지를 그리는 SearchFlowLayout은 그보다 위인 **레이아웃 라우트**라 탭을
  // 오가도 리마운트되지 않는다. 신호가 컨텍스트에 없으면 뱃지는 최초 마운트 값에
  // 영영 멈춘다.
  //
  // 「미열람 건수」가 아니라 **카운터**를 올린다 — 셋 중 가장 작은 모양이다.
  //  ① 건수의 정본은 서버(new_count)다. 컨텍스트가 그 수를 들고 있으면 서버 값과
  //     프론트 값 두 벌이 생겨 갈라진다(R6F-15와 같은 함정).
  //  ② 이 신호를 읽는 두 소비처(뱃지·목록)가 필요한 것은 "몇 개"가 아니라 "다시
  //     읽어라"뿐이다. 목록은 필터·페이지까지 실어 자기 질의를 다시 던져야 한다.
  //  ③ 카운터는 값이 같아도 매번 바뀌므로("0건 → 0건"도 신호가 된다) 이펙트가
  //     확실히 재실행된다.
  const [outputsVersion, setOutputsVersion] = useState(0)
  const bumpOutputsVersion = useCallback(() => setOutputsVersion((n) => n + 1), [])

  // fetchPage 세대 가드(B8, round06b) — briefGenRef와 같은 이유. 순차 검색·페이지
  // 이동이 겹치면 먼저 보낸 요청이 나중에 응답해 최신 화면을 덮어쓸 수 있다
  // (stale-response race). fetchPage 진입 시마다 증가시키고, 응답 처리 콜백마다
  // 그 시점의 세대가 아직 최신인지 확인한다.
  const fetchGenRef = useRef(0)

  // round06f 갈래 D(spec §9.4) → round07d 축 전환 — 주제(subject) 필터. 파셋(값+건수)은
  // 서버가 무필터 상위 200건에서 집계해 내려준다(R6F-16) — 프론트가 현재 페이지 20건에서
  // 세면 "전체 중 몇 건"이 아니라 "이 페이지에 몇 건"이 되어 사용자를 오도한다(§9.3, round04가
  // 라이브에서 유형 칩을 통째로 뺀 이유). round07d 이전에는 용도·기능 축(구 필드명)이었다 —
  // 축만 바뀌었을 뿐 이 근거(서버 집계·고정 파셋)는 그대로다.
  const [subjects, setSubjectsState] = useState([])
  const [facets, setFacets] = useState({ subject: [], media_type: [], holder: [] })

  // round07h — 정렬(디스크립션 2)·등록유형(2-1). subjects와 같은 자리·같은 이유로
  // 컨텍스트가 소유한다: changePage(페이지 이동)가 이 값을 물고 다녀야 하기 때문이다
  // (로컬 state였다면 3페이지에서 정렬을 "적합도순→최신순"으로 바꾼 뒤 changePage(2)를
  // 부르면 컨텍스트는 정렬을 몰라 서버 기본값으로 되돌아간다). 기본값은 백엔드 기본값과
  // 같다(SortOrder.RELEVANCE·Visibility.ALL) — 검색 진입 직후에는 필터를 건 적이 없다.
  const [sort, setSortState] = useState('relevance')
  const [visibility, setVisibilityState] = useState('all')

  // round07m — 종류(단일선택)·소장처(단일선택). visibility 와 같은 자리·같은 계약이다:
  // 새 검색에서 리셋, 페이지 이동에서 유지, 고르면 page 1·같은 conversation_id 로 재조회,
  // 재개에는 복원할 값이 없다. 기본값이 문자열이 아니라 null 인 이유는 「전체」가 서버
  // 어휘의 값이 아니라 「필터 없음」이기 때문이다(searchApi 가 null 이면 키를 뺀다).
  const [mediaType, setMediaTypeState] = useState(null)
  const [holder, setHolderState] = useState(null)

  // round06f 갈래 C(spec §8.2·R6F-22) — 만족도 폼의 리마운트 기준이 되는 "검색 세대".
  // request_id 를 key 로 쓰면 안 된다: 그것은 HTTP 요청 1건당 새 uuid 라(미들웨어가
  // 요청마다 uuid4 를 발급한다) 페이지를 넘기는 순간 폼이 리셋되고, 제출 후 감사 상태가
  // 사라져 중복 제출을 막는 유일한 방어선이 무너진다. 그래서 "검색이 바뀌었는가"만 세는
  // 카운터를 따로 둔다 — 증가 지점은 runLiveSearch·resumeConversation 진입부뿐이다
  // (chatGenRef 가 같은 자리에서 같은 이유로 증가하는 선례다. 다만 그것은 렌더에 쓰이지
  //  않아 useRef 이고, 이 값은 key 로 렌더에 관여하므로 useState 여야 한다).
  const [searchGenId, setSearchGenId] = useState(0)
  // 제출 body 에 싣는 "그 순간 보고 있던 요청"의 id. 페이지 이동·필터 변경마다 새 값이 되며
  // 그것이 정상이다 — 최신값이 곧 사용자가 방금 본 결과 집합을 가리킨다(R6F-12).
  const [liveRequestId, setLiveRequestId] = useState(null)
  // 최종 리뷰 F2 — 만족도 제출 완료 여부(RatingWidget의 "감사합니다" 전환 조건)를
  // 컨텍스트가 소유한다. AiBriefCard의 brief 상태와 동형인 이유: SearchResults.jsx가
  // loading===true 일 때 결과 서브트리 전체를 스피너로 바꿔치기해 RatingWidget이
  // 언마운트된다(예: changePage 도중) — 로컬 useState였다면 loading이 다시 false로
  // 돌아오며 새로 마운트되는 순간 sent가 초기값(false)으로 리셋돼, 페이지 이동 1회로
  // 중복 제출 방어선(§8.3 — DB 유니크 제약이 없어 이 감사 상태가 유일한 방어다)이
  // 무너진다. searchGenId와 리셋 지점이 같다(runLiveSearch·resumeConversation 진입부) —
  // "새 평가 대상이 생겼을 때만" 초기화하고, 페이지 이동·필터 변경으로는 유지한다.
  const [feedbackSent, setFeedbackSent] = useState(false)

  // round05a 채팅 상태(spec §12) → round06c C1b(spec §8.5·계획 C-D1)로 발급 주체가
  // 프론트(crypto.randomUUID, mount 즉시 발급)에서 서버(/search 응답)로 이전됐다.
  // mount 시점엔 아직 검색이 없어 값이 없다(null) — 새 검색이 시작되면(runLiveSearch)
  // 서버가 그 /search 응답에 실어 준 conversation_id를 저장해 이후 sendChatMessage가 쓴다.
  // !isLive()(더미/데모) 모드는 서버가 없어 로컬 폴백(newConversationId)을 쓴다.
  // 새로고침 시 이 프론트 상태는 소실되지만, 서버 conversations 테이블에는 대화가 남는다
  // — 재개 "UI"는 여전히 round07 몫이나, 재개용 데이터 자체는 round06c에서 이미 서버에
  // 귀속된다(구 주석 "재개 UI는 round07"만 보고 데이터도 미비한 것으로 오해하지 말 것).
  const [conversationId, setConversationId] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatStatus, setChatStatus] = useState('idle')
  const [chatNotice, setChatNotice] = useState(null)
  const [poolSize, setPoolSize] = useState(null)
  // 첫 턴에만 search_query를 실어 보낸다(서버 bootstrap용) — 첫 sendChatMessage 이후 false.
  const [chatStarted, setChatStarted] = useState(false)
  // 대화 세대 가드 — 스트림 도중 새 검색 시 이전 콜백들이 새 대화 상태를 오염하지 않도록.
  const chatGenRef = useRef(0)
  // round06c E3(계획 Task E3 Step4) — changePage가 재사용할 "서버가 실제로 발급한" conversationId.
  // 노출용 conversationId 상태(위)는 서버 미발급 시 로컬 폴백(newConversationId)도 섞여 들어간다
  // (채팅 전송엔 폴백이라도 있어야 하므로) — 그 폴백값을 그대로 /search에 되돌려 보내면 백엔드가
  // 모르는 id를 "재사용"하겠다고 우기는 셈이라 의미가 없다. 그래서 서버가 실제로 응답에 실어 준
  // 값만 여기 담아 두고, changePage는 이 값으로만 재사용을 시도한다(폴백일 땐 그냥 새 id로 조회 —
  // 기존 동작 그대로, 회귀 없음).
  const serverConvIdRef = useRef(null)

  // 공용 fetch: 질의 text의 n페이지를 조회해 live* 상태를 갱신한다.
  // 새 검색(runLiveSearch)과 페이지 이동(changePage)·재개(resumeConversation)가 공유한다.
  // round06c C1b(spec §8.5·계획 C-D1): 응답의 conversationId는 여기서 resolve값으로
  // "반환"만 하고 conversationId 상태에는 싣지 않는다 — 백엔드는 /search 호출마다 새
  // uuid를 발급하므로(캐시 적중 여부 무관, api.py) 페이지 이동(changePage)도 매번 새
  // 값을 받지만, 그건 "새 대화"가 아니라 같은 검색의 다른 페이지일 뿐이다. 상태 반영은
  // 새 검색으로 확정된 runLiveSearch만 한다(changePage는 반환값을 그냥 버린다).
  // round06c E3(계획 Task E3 Step4): 3번째 인자 reuseId — 있으면 /search에
  // conversation_id로 실어 보내 백엔드가 같은 대화 행을 재사용하게 한다(C4).
  // round06e S2 — modeOverride: 재개처럼 "상태를 막 바꾼 직후" 호출하는 경로를 위한 것.
  // setSearchMode 직후의 searchMode 는 아직 옛 값이므로(클로저) 명시로 받는다.
  // round06f 갈래 B(§7.5.1·R6F-21) — resolve 값을 { conversationId, ok } 객체로 확장한다.
  // 이전에는 serverConversationId 만 돌려주어 호출자가 "검색이 실제로 성공했는가"를 알 수
  // 없었다. AI 브리핑 트리거는 useEffect(StrictMode 이중 실행)가 아니라 이 프로미스 체인의
  // 명시 호출이어야 하므로, 판정에 필요한 ok 를 여기서 함께 내보낸다. ok 의 식은 바로 아래
  // setMatched 에 쓰는 그 식과 같다 — 새 판정 기준을 만들지 않는다.
  // round06f 갈래 D(§9.4 a) → round07d — subjects도 같은 이유다: setSubjects 직후·새 검색
  // 리셋 직후에는 subjects 상태가 아직 옛 값이라 명시로 받아야 한다(round07m부터는 filters
  // 객체의 subjects 키로 받는다 — 아래 참조).
  // round06f R6F-26 — kind('search'|'restore')도 명시 인자다. fetchPage 내부에서는
  // "왜 불렸는지" 판단할 근거가 없어(공용 통로), 호출부(runLiveSearch만 'search', 나머지
  // 셋은 'restore')가 그 판단을 대신 하고 값만 여기로 흘려보낸다.
  // Task 20(round06b) — useCallback으로 감싼다. 실제 읽는 state는 searchMode·subjects
  // 둘뿐이다(요청 payload를 만드는 데 쓰인다 — setter의 함수형 업데이트로 대체할 수 있는
  // "다음 state를 이전 state로 계산" 패턴이 아니라 정직하게 의존성에 남긴다). fetchGenRef·
  // 각 setter는 참조가 항상 안정적이라 의존성이 필요 없다. 이 함수는 changePage·setSubjects·
  // runLiveSearch·resumeConversation이 호출하므로, 여기서 참조를 안정시켜야 그 호출자들의
  // useCallback도 실제로 의미가 생긴다(호출자가 이 함수를 의존성에 넣어야 하는데, 이 함수
  // 자체가 매 렌더 바뀌면 호출자도 매 렌더 바뀐다).
  // round07h — sort·visibility도 subjects와 같은 이유로 명시로 받아야 한다: setSort/
  // setVisibility 직후의 클로저상 sort/visibility는 아직 옛 값이다(round07m부터는 filters
  // 객체의 sort·visibility 키로 받는다 — 아래 참조).
  //
  // round07m — 필터가 다섯(subjects·sort·visibility·mediaType·holder)이 되면서 위치 인자
  // (…, subjectsOverride, kind, sortOverride, visibilityOverride)를 더 늘리지 않고 마지막
  // 인자 `filters` 객체 하나로 묶었다. 호출부는 **방금 바꾼 필터만** 넣는다.
  // ⚠️ 키가 「있는가」로 고른다(`??` 가 아니다) — 새 검색 리셋이 넘기는 mediaType:null 을
  //    `??` 로 읽으면 「안 넘김」이 되어 클로저의 옛 선택이 다시 실린다.
  // round10 — `opts.recordHistory:false` 는 「이 검색은 나의 기록에 남기지 않는다」다.
  // filters 에 섞지 않는 이유: filters 는 **검색 조건**이고 이것은 부수효과 여부라 뜻이 다르다.
  const fetchPage = useCallback((text, n, reuseId, modeOverride, kind, filters = {}, opts = {}) => {
    const pick = (key, current) => (Object.prototype.hasOwnProperty.call(filters, key) ? filters[key] : current)
    const gen = (fetchGenRef.current += 1)
    setLoading(true)
    setLoadingKind(kind)
    return searchArtifacts({
      query: text,
      page: n,
      conversationId: reuseId,
      mode: modeOverride || searchMode,
      subjects: pick('subjects', subjects),
      sort: pick('sort', sort),
      visibility: pick('visibility', visibility),
      mediaType: pick('mediaType', mediaType),
      holder: pick('holder', holder),
      recordHistory: opts.recordHistory,
    })
      .then(({ status, total, page: respPage, pageSize: respPageSize, rewritten, notice, results, conversationId: serverConversationId, facets: respFacets, requestId }) => {
        // F-1(최종 리뷰) — stale 응답은 conversationId도 낡은 값이므로 null로 죽이고
        // stale:true 를 함께 실어 보낸다. .catch 쪽과 계약을 통일해, 호출자가 ok만 보고도
        // "성공"으로 오독하지 않고 stale만 보고도 안전하게 건너뛸 수 있게 한다(아래 두 곳).
        if (gen !== fetchGenRef.current) return { conversationId: null, ok: false, stale: true }
        setLiveResults(results)
        setLiveStatus(status)
        setLiveTotal(total)
        // 페이지 좌표는 서버가 확정한 값을 그대로 믿는다(응답 누락 시 요청값 n 폴백).
        setPage(respPage || n)
        if (respPageSize) setPageSize(respPageSize)
        setLiveRewritten(rewritten)
        setLiveNotice(notice ?? null)
        // R6F-16 — facets 는 필터 적용 **전** 200건에서 집계된 값이라 선택을 바꿔도
        // 건수가 붕괴하지 않는다. 서버가 항상 주지만 구 응답 대비 폴백을 둔다.
        setFacets(respFacets ?? { subject: [], media_type: [], holder: [] })
        setLiveRequestId(requestId ?? null)
        // degraded(rewrite 실패 → 원문으로 검색해 결과가 있는 정상 케이스)도 matched=true로 취급.
        // matched=false는 오직 error이거나 결과가 0건일 때만.
        const ok = status !== 'error' && results.length > 0
        setMatched(ok)
        if (serverConversationId) serverConvIdRef.current = serverConversationId
        return { conversationId: serverConversationId ?? null, ok }
      })
      .catch(() => {
        // F-1 — .then 가드와 동일한 stale 계약(위 주석 참조).
        if (gen !== fetchGenRef.current) return { conversationId: null, ok: false, stale: true }
        setLiveResults([])
        setLiveStatus('error')
        setLiveTotal(0)
        setLiveRewritten(null)
        setLiveNotice(null)
        setFacets({ subject: [], media_type: [], holder: [] })
        // 실패한 요청의 id 를 평가에 실어 보내지 않는다 — 서버가 자기 request_id 로 채운다.
        setLiveRequestId(null)
        setMatched(false)
        return { conversationId: null, ok: false }
      })
      .finally(() => {
        // 세대가 낡았으면 이 요청은 더 이상 "현재 로딩"의 주인이 아니다 — 최신 세대의
        // loading 상태를 잘못 끄지 않도록 finally도 가드한다.
        if (gen === fetchGenRef.current) setLoading(false)
      })
  }, [searchMode, subjects, sort, visibility, mediaType, holder])

  // 브리핑 1회 생성/조회. 트리거는 useEffect가 아니라 아래 두 진입점(runLiveSearch·
  // resumeConversation)의 프로미스 체인에서 명시 호출한다(R6F-21) — StrictMode에서
  // 이펙트가 이중 실행되면 LLM 비용이 두 배가 되기 때문이다.
  // 인자를 상태가 아니라 명시로 받는 것도 같은 이유다 — 호출 시점의 searchMode/lastQuery는
  // 클로저상 아직 옛 값일 수 있다(fetchPage의 modeOverride와 같은 함정).
  //
  // round06f R6F-24(spec §7.3a "프론트 계약") — JSON 일괄 응답 대신 SSE 토큰
  // 스트림을 소비한다. first token time을 줄이기 위한 변경이다(사용자 지시
  // 2026-07-28 — 완성문을 기다리면 카드가 뜨기까지 LLM 생성 전체 시간이 걸려
  // UX가 나쁘다). briefStatus는 'loading'을 유지하다가 **첫 token에서 'ok'로
  // 전환**하고 brief에 조각을 계속 누적한다 — 카드가 그 순간 뜨고 글자가
  // 차오른다. 캐시 히트는 전문이 단일 token 1회로 오므로 사용자 체감은 기존
  // JSON 방식과 같다(§7.3a).
  //
  // meta.status가 'ok'가 아니면(disabled·empty·error) 그 순간 바로 briefStatus를
  // 'error'로 접는다 — 카드가 아예 렌더되지 않으므로(§7.5.3) 검색 화면은
  // 브리핑 실패에 영향받지 않는다. 스트림 도중 실패(onError)는 다르게 처리한다 —
  // 누적된 조각이 하나도 없으면 'error'로 접지만, **부분 누적이 있으면 그대로
  // 두고 조용히 종료한다**(브리핑은 보조 정보라 부분도 유용하고, 실패는 서버가
  // 저장하지 않으므로 다음 검색이 자연히 재생성한다).
  //
  // 세대 가드(briefGenRef)는 모든 콜백(onMeta·onToken·onDone·onError)에서 동일하게
  // 적용한다 — 앞선 검색의 늦게 도착한 조각이 새 검색 화면을 오염하면 안 된다.
  // Task 20(round06b) — useCallback으로 감싼다. q·mode는 인자로 받아 상태를 읽지 않고,
  // 나머지는 briefGenRef(안정 ref)와 setter(항상 안정)뿐이라 실제 의존성이 없다 — []가
  // "일부러 뺀 것"이 아니라 정직하게 의존하는 게 없다는 뜻이다(setScenarioById와 같은 근거).
  const fetchBrief = useCallback((q, mode) => {
    const gen = (briefGenRef.current += 1)
    setBrief(null)
    setBriefNotice(null)
    setBriefStatus('loading')
    let accumulated = ''
    let firstTokenSeen = false
    return streamSearchBrief({ query: q, mode }, {
      onMeta: (meta) => {
        if (gen !== briefGenRef.current) return
        if (meta.status !== 'ok') {
          setBriefStatus('error')
          setBriefNotice(meta.notice ?? null)
        }
        // status==='ok'이면 아직 아무 것도 확정하지 않는다 — 첫 token이 그 일을 한다.
      },
      onToken: (text) => {
        if (gen !== briefGenRef.current) return
        accumulated += text
        if (!firstTokenSeen) {
          firstTokenSeen = true
          setBriefStatus('ok')
        }
        setBrief(accumulated)
      },
      onDone: () => {
        // 상태는 onMeta(비-ok)/onToken(ok)에서 이미 확정됐다 — done은 스트림
        // 종료 신호일 뿐 여기서 더 할 일이 없다. 가드는 위 주석("모든 콜백에서
        // 동일하게 적용")과의 일관성 유지용이다 — 향후 여기에 side-effect 를
        // 추가할 때 가드 누락이 조용한 버그가 되는 것을 미리 막는다.
        if (gen !== briefGenRef.current) return
      },
      onError: (notice) => {
        if (gen !== briefGenRef.current) return
        if (!accumulated) {
          setBriefStatus('error')
          setBriefNotice(notice ?? null)
        }
      },
    }).catch(() => {
      // streamSearchBrief 자신은 내부 실패를 onError로 흡수하고 resolve하지만,
      // 예상 밖의 예외까지 검색 결과 화면에 새지 않도록 마지막 안전망을 둔다.
      if (gen !== briefGenRef.current) return
      if (!accumulated) {
        setBriefStatus('error')
        setBriefNotice(null)
      }
    })
  }, [])

  // 새 검색: 항상 1페이지. 그리고 새 대화 — conversationId는 서버가
  // 이 /search 응답에서 발급한 값을 쓴다(round06c C1b, spec §8.5·계획 C-D1). 응답에 값이
  // 없으면(테스트 더블 등 서버 부재) 로컬 폴백(newConversationId)으로 대화가 끊기지 않게
  // 한다. fetch 진행 중엔 일단 비워(null) 이전 대화의 conversationId가 새 검색 결과가
  // 뜨기 전 잘못 쓰이지 않게 막는다. 채팅 이력·풀도 초기화(후보풀이 바뀌므로 이전 대화
  // 맥락은 무효다. spec §12).
  // Task 20(round06b) — useCallback으로 감싼다. fetchPage·fetchBrief(둘 다 이미 useCallback)를
  // 부르고, fetchBrief 호출에 searchMode를 그대로 읽어 넘기므로 셋 다 정직한 의존성이다.
  // searchMode를 함수형 업데이트로 없앨 수는 없다 — "다음 state를 계산"하는 게 아니라
  // fetchBrief의 인자값으로 그냥 읽는 것이라 setter 트릭이 적용되지 않는다.
  // 노드 그래프 1회 조회. 트리거는 useEffect가 아니라 검색 성공 지점의 명시 호출이다
  // (fetchBrief와 같은 이유 — StrictMode에서 두 번 돌지 않게).
  //
  // `selected`를 바꿔 다시 부를 때도 **재검색이 아니다**: 서버가 /search와 같은 랭킹
  // 캐시를 읽으므로 결과 집합이 그대로다. 그래서 좌측 클래스 건수와 중앙 그래프가
  // 언제나 같은 200건을 말한다.
  //
  // 의존성이 빈 이유는 fetchBrief와 같다 — 내부에서 쓰는 것이 setter(항상 안정)와
  // graphGenRef(안정 ref)뿐이고, query·mode·selected는 전부 인자로 받는다.
  const fetchGraph = useCallback((query, mode, selected) => {
    if (!isLive()) return Promise.resolve()
    const gen = (graphGenRef.current += 1)
    setGraphStatus('loading')
    setGraphNotice(null)
    return fetchOutputGraph(query, mode, selected).then((res) => {
      if (gen !== graphGenRef.current) return
      if (!res.ok) {
        setGraphStatus('error')
        setGraphNotice(res.notice)
        return
      }
      setGraph(res.data)
      // 검색 자체가 실패한 응답(status:'error')은 그래프가 비어 있는 것이 정상이 아니다 —
      // "분류가 없어서 0건"과 "검색이 실패해서 0건"을 화면이 구분해야 한다(R6F-16).
      setGraphStatus(res.data?.status === 'error' ? 'error' : 'ok')
    })
  }, [])

  const runLiveSearch = useCallback((text, opts = {}) => {
    setPage(1)
    setConversationId(null)
    serverConvIdRef.current = null
    setChatMessages([])
    setChatStatus('idle')
    setChatNotice(null)
    setPoolSize(null)
    setChatStarted(false)
    chatGenRef.current += 1
    // round06f 갈래 C — 새 검색은 새 평가 대상이다. 만족도 폼이 리마운트돼 초기화된다.
    setSearchGenId((n) => n + 1)
    // 최종 리뷰 F2 — feedbackSent도 같은 자리에서 리셋한다(=searchGenId 증가 지점과
    // 동일). 새 검색은 새 평가 대상이므로 직전 검색의 "제출 완료" 상태를 물려주지 않는다.
    setFeedbackSent(false)
    // round06f 갈래 B — 새 검색은 직전 브리핑을 즉시 지운다. 세대도 함께 올려, 앞선
    // 검색의 브리핑 응답이 뒤늦게 도착해도 이 검색 화면을 오염하지 못하게 한다.
    briefGenRef.current += 1
    setBrief(null)
    setBriefStatus('idle')
    setBriefNotice(null)
    // round07b — 새 검색은 직전 그래프를 즉시 지운다(브리핑과 같은 자리·같은 이유).
    // 안 지우면 새 결과가 뜨기 전까지 이전 질의의 클래스 목록이 남아 있어, 사용자가
    // 그것을 새 검색의 결과로 읽는다.
    graphGenRef.current += 1
    setGraph(null)
    setGraphStatus('idle')
    setGraphNotice(null)
    // round06f 갈래 D(§9.4 c) — 새 검색은 필터를 물려받지 않는다.
    setSubjectsState([])
    // round07h — 정렬·등록유형도 같은 자리에서 같은 이유로 리셋한다. filters 객체에
    // sort:'relevance'·visibility:'all'을 명시하는 이유는 subjects:[]와 같다 — 이 시점의
    // setSortState/setVisibilityState는 아직 반영 전이라 클로저상 sort/visibility가 옛 값이다.
    setSortState('relevance')
    setVisibilityState('all')
    // round07m — 종류·소장처도 같은 자리에서 같은 이유로 리셋한다.
    setMediaTypeState(null)
    setHolderState(null)
    return fetchPage(text, 1, undefined, undefined, 'search', { subjects: [], sort: 'relevance', visibility: 'all', mediaType: null, holder: null }, opts).then(({ conversationId: serverConversationId, ok, stale }) => {
      // F-1(최종 리뷰) — fetchPage 내부의 상태 쓰기는 세대 가드(fetchGenRef)로 막혀
      // 있었지만, 이 continuation은 그 가드를 통과하지 않아 늦게 도착한 낡은 응답의
      // conversationId를 그대로 반영하는 사각지대가 있었다(화면=최신, 대화=낡음 불일치).
      // stale이면 어떤 상태도 건드리지 않고 조용히 끝낸다.
      if (stale) return
      // 라이브 검색인데 서버가 conversation_id를 안 내려주면(백엔드 회귀·네트워크 이상 등)
      // 로컬 폴백으로 조용히 대체돼 왔다 — 방어로는 맞지만 운영에서 발생해도 드러나지
      // 않는다. 폴백 자체는 유지하되 경고를 남겨 발견 가능하게 한다(round06c C1b 리뷰).
      // 더미 모드(!isLive)의 폴백은 항상 기대되는 정상 경로라 경고하지 않는다.
      // round10 — 기록을 끈 검색은 서버가 conversation_id 를 **일부러** 주지 않는다.
      // 그건 회귀가 아니므로 경고하지 않고, 로컬 폴백 id 도 만들지 않는다(만들면 화면이
      // 존재하지 않는 대화를 가리키게 된다).
      if (opts.recordHistory === false) {
        setConversationId(null)
      } else {
        if (isLive() && !serverConversationId) {
          console.warn('[ScenarioContext] /search 응답에 conversation_id가 없어 로컬 폴백으로 대체합니다(백엔드 확인 필요)')
        }
        setConversationId(serverConversationId || newConversationId())
      }
      // round06f 갈래 B(§7.5·R6F-21) — 검색이 실제로 성공했을 때만 브리핑을 만든다.
      // 결과 0건·오류에 LLM을 태우지 않는다(R-2). 인자는 방금 쓴 값을 명시로 넘긴다.
      if (ok) {
        fetchBrief(text, searchMode)
        // round07b — 산출물 화면이 열려 있지 않아도 미리 받아 둔다. 서버가 랭킹 캐시를
        // 재사용하므로 추가 검색 비용이 없고, 탭을 옮겼을 때 빈 화면을 보지 않는다.
        fetchGraph(text, searchMode, null)
      }
    })
  }, [fetchPage, fetchBrief, fetchGraph, searchMode])

  // Task 20(round06b) — useCallback으로 감싼다. isLive()는 상태가 아니라 여전히 의존성
  // 대상이 아니다(getScenario(activeId) 주석과 같은 논리). runLiveSearch가 유일한 실 의존성 —
  // 그 함수 자체가 이미 useCallback으로 안정화돼 있으므로 이 함수도 안정된다.
  // round10 — opts 는 runLiveSearch 로 그대로 흘린다(`recordHistory:false` = 나의 기록에
  // 남기지 않는 복원용 검색). 인자를 주지 않으면 지금까지와 완전히 같다.
  const setScenarioByQuery = useCallback((text, opts = {}) => {
    // 라이브 모드: 백엔드 검색을 호출하고 결과를 live* 상태로 노출한다.
    // 더미 시나리오(activeId)는 건드리지 않는다 — 화면은 liveResults를 우선 사용한다.
    if (isLive()) {
      setLastQuery(text)
      return runLiveSearch(text, opts)
    }

    // 비라이브(더미) 모드 — 기존 동작 그대로(하위호환). 서버가 없어 conversation_id를
    // 내려줄 곳이 없으므로 로컬 폴백(newConversationId)으로 새 대화를 표시한다(ChatTab은
    // !isLive일 때 sendChatMessage를 호출하지 않고 캔드 응답으로 대체하므로 실제 전송에는
    // 쓰이지 않는다 — 그래도 컨텍스트 API 대칭을 위해 값은 채워 둔다).
    const { scenario, matched: ok } = matchScenarioResult(text)
    setActiveId(scenario.id)
    setMatched(ok)
    setConversationId(newConversationId())
    return undefined
  }, [runLiveSearch])

  // 페이지 이동: 질의는 직전 그대로(lastQuery — 서버 랭킹 캐시 키), 페이지 번호만 바꿔
  // 캐시 슬라이스를 받는다. 검색 전(lastQuery 없음)에는 이동할 결과 자체가 없어 아무 것도 하지 않는다.
  // round06c E3(계획 Task E3 Step4): 서버가 실제로 발급한 conversationId(serverConvIdRef)를
  // 함께 실어 보낸다 — 그래야 페이지 이동마다 백엔드에 새 conversations 행이 생기지 않는다
  // (C4가 /search에 conversation_id 옵션을 추가한 이유). 노출용 conversationId 상태가 아니라
  // ref를 쓰는 이유는 위 주석 참조 — 상태에는 서버 미발급 시의 로컬 폴백값도 섞이는데, 그
  // 폴백값은 백엔드가 모르는 id라 "재사용" 요청으로 보내도 무의미하다(폴백 상황에선 기존대로
  // 그냥 새로 조회한다 — 회귀 없음). 반환값({conversationId, ok} — round06f §7.5.1)은
  // 호출자에게 그대로 흘려보내되 여기서 소비하지 않는다 — "새 대화"가 아니므로 상태를
  // 갈아치우지 않고(위 fetchPage 주석), 브리핑도 페이지 이동으로는 다시 만들지 않는다(§7.5).
  // Task 20(round06b) — useCallback으로 감싼다. lastQuery는 실제로 읽어(가드+요청 인자) 쓰므로
  // 정직한 의존성이다. serverConvIdRef는 ref라 의존성이 필요 없다.
  const changePage = useCallback((n) => {
    if (isLive() && lastQuery) return fetchPage(lastQuery, n, serverConvIdRef.current, undefined, 'restore')
    return undefined
  }, [lastQuery, fetchPage])

  // 필터 적용/해제 — 같은 검색의 다른 뷰다(새 검색이 아니다).
  //  · page 를 1로 되돌린다: 3페이지에서 필터를 걸면 결과가 줄어 빈 페이지가 될 수 있다.
  //  · conversation_id 를 재사용한다: changePage 와 같은 계약이라 conversations 행이
  //    늘지 않는다(C4가 /search 에 conversation_id 옵션을 둔 이유).
  //  · 방금 고른 값을 `filters` 객체에 방금 바꾼 키만 넣는다: setSubjectsState 직후의
  //    subjects 는 아직 옛 값이다(modeOverride 와 같은 함정, 위 fetchPage 주석).
  //  · 브리핑은 건드리지 않는다(R6F-6a) — 재생성하면 R6F-4·R6F-6·R6F-17이 동시에 무너진다.
  //    모집단이 다르다는 사실은 AiBriefCard 가 ai_brief_desc 에 부기해 밝힌다.
  // Task 20(round06b) — useCallback으로 감싼다. changePage와 동형 근거(lastQuery 실 의존,
  // fetchPage 함수 의존, ref·setter는 제외).
  const setSubjects = useCallback((next) => {
    setSubjectsState(next)
    setPage(1)
    if (isLive() && lastQuery) return fetchPage(lastQuery, 1, serverConvIdRef.current, undefined, 'restore', { subjects: next })
    return undefined
  }, [lastQuery, fetchPage])

  // round07h — 정렬·등록유형도 setSubjects와 같은 계약이다(같은 검색의 다른 뷰 —
  // page를 1로 되돌리고 conversation_id를 재사용한다). `filters` 객체에 방금 바꾼 키만
  // 넣는다 — 정렬·필터를 바꾼다고 주제 선택까지 지울 이유가 없다. 방금 고른 값을
  // `filters` 객체에 넣어 명시 전달하는 이유도 setSubjects와 같다 — setSortState/
  // setVisibilityState 직후의 sort/visibility는 이 클로저 안에서 아직 옛 값이다.
  const setSort = useCallback((next) => {
    setSortState(next)
    setPage(1)
    if (isLive() && lastQuery) return fetchPage(lastQuery, 1, serverConvIdRef.current, undefined, 'restore', { sort: next })
    return undefined
  }, [lastQuery, fetchPage])

  const setVisibility = useCallback((next) => {
    setVisibilityState(next)
    setPage(1)
    if (isLive() && lastQuery) return fetchPage(lastQuery, 1, serverConvIdRef.current, undefined, 'restore', { visibility: next })
    return undefined
  }, [lastQuery, fetchPage])

  // round07m — 종류·소장처도 setVisibility 와 같은 계약이다(같은 검색의 다른 뷰).
  const setMediaType = useCallback((next) => {
    setMediaTypeState(next)
    setPage(1)
    if (isLive() && lastQuery) return fetchPage(lastQuery, 1, serverConvIdRef.current, undefined, 'restore', { mediaType: next })
    return undefined
  }, [lastQuery, fetchPage])

  const setHolder = useCallback((next) => {
    setHolderState(next)
    setPage(1)
    if (isLive() && lastQuery) return fetchPage(lastQuery, 1, serverConvIdRef.current, undefined, 'restore', { holder: next })
    return undefined
  }, [lastQuery, fetchPage])

  // 대화 재개("나의 기록"에서 이전 대화 클릭) — E2의 getConversation으로 메타·히스토리를
  // 로드한 뒤, 그 id를 보유 id로 재사용해 1페이지를 다시 조회한다(changePage와 같은 계약 —
  // 재개도 "새 대화"가 아니므로 새 conversations 행을 만들지 않는다). getConversation이
  // 돌려준 id는 이미 서버가 발급/승인한 실 id이므로 serverConvIdRef에도 그대로 심어 두어,
  // 재개 직후의 changePage(페이지 이동)도 같은 id를 재사용하게 한다.
  // messages 계약(conversationsApi): {role:'user'|'assistant', content, grounded_docs?,
  // rewritten_queries?} — 서버가 실제로 주는 형태다(conversations/routes.py._history_to_messages).
  // ‼️ citations 필드는 서버가 절대 안 준다 — assistant 턴엔 grounded_docs(12필드 전문+n)만
  // 있다(round06c 리뷰 F1). 화면 쪽 chatMessages 계약({role:'user'|'ai', text, citations})은
  // 라이브 스트리밍(chat/graph.py postprocess_node → resolve_citations)이 만드는
  // {n, idnbr, name, image_url} 배열을 기대하므로(ChatTab.jsx citedFromText·handleChip 소비),
  // grounded_docs를 그 형태로 여기서 변환한다 — image_url은 저장 필드가 아니라 idnbr 파생
  // (resolve_citations와 동일한 무조건 파생 규칙, chat/citations.py:48). rewritten_queries는
  // 프론트 소비처가 없어 의도적으로 버린다(리뷰 F1 — 근거: ChatTab.jsx 전체에 참조 없음).
  // user 턴은 grounded_docs 자체가 없어(Array.isArray가 false) citations:null로 남는다 —
  // assistant 턴은 grounded_docs가 없더라도(round04 이전 데이터 등) 항상 배열이므로(백엔드가
  // `turn.get("grounded_docs") or []`로 채운다) citations는 최소 []이 된다.
  //
  // round06c 리뷰 F3(실패 표면화): getConversation은 이제 deleteConversation과 대칭으로
  // status를 동봉한다(conversationsApi.js). 라이브에서 status!==200이거나(404/403 등)
  // search_query가 없으면(예: 삭제된 대화를 가리키는 낡은 id) 여기서 즉시 멈춘다 — 계속
  // 진행하면 q=''로 fetchPage(searchArtifacts)가 나가 서버가 "빈 질의의 새 대화"로 오인해
  // 쓰레기 conversations 행을 만든다. 실패는 **상태를 하나도 건드리지 않고**(기존 대화 화면을
  // 그대로 둔 채) `{ ok: false, status }`로 resolve한다 — reject 대신 이 방식을 고른 이유는
  // sendChatMessage의 기존 관행(runOnce가 settle({ok,...})로 성공/실패를 함께 표현)과
  // 맞추기 위함이다. 소비처(E5, 아직 미구현)는 `resumeConversation(id).then(({ok, status}) => {
  // if (!ok) showToast(...) })`로 배선하면 된다. 더미(!isLive) 모드는 이 가드에 걸리지 않는다
  // (데모 getConversation은 항상 status:200 — 아래 F2 가드가 별도로 처리).
  // Task 20(round06b) — useCallback으로 감싼다. id는 인자이고, 몸통이 읽는 외부 값은
  // fetchPage·fetchBrief(둘 다 이미 useCallback으로 안정화) 뿐이다 — searchMode·lastQuery
  // 등은 conv 응답에서 온 restoredMode·q로 대체돼 상태를 직접 읽지 않는다.
  //
  // round10 최종리뷰 C-1 — 두 번째 인자로 **조회 함수를 주입**받는다(기본값은 지금까지의
  // getConversation이라 기존 호출부 LnbHistory·SearchFlowLayout은 한 글자도 바뀌지 않는다).
  // 왜 이렇게 푸는가: 공유 열람자(남의 프로젝트를 연 사람)는 소유자 전용
  // GET /conversations/{id}를 부를 수 없어(403) 프로젝트 경유 경로로 읽어야 하는데,
  // 그렇다고 이 컨텍스트가 "지금 어느 프로젝트를 보고 있는가"를 알게 만들면 전역
  // 상태에 화면 사정이 섞인다. 같은 문제를 이 브랜치가 이미 콜백 주입으로 풀었다
  // (ProjectDetail이 ChatTab에 다운로드 함수를 내려주던 방식) — 그 관행을 따른다.
  // 주입 함수의 계약은 getConversation과 **같은 모양**이다: { status, search_query,
  // mode, messages[] }를 resolve한다(서버 응답 모양도 같아야 한다 — projects/routes.py
  // get_project_conversation이 conversations의 _summarize를 그대로 재사용하는 이유).
  const resumeConversation = useCallback((id, fetchConversation = getConversation) =>
    fetchConversation(id).then((conv) => {
      if (isLive() && (conv.status !== 200 || !conv.search_query)) {
        return { ok: false, status: conv.status }
      }
      const q = conv.search_query || ''
      // round06e S2(R6E-19) — 저장된 모드를 토글에 되살린다. 값이 없는 옛 대화는 meta 다
      // (DB 기본값과 같다). 더미 모드도 토글은 복원해야 하므로 아래 !isLive 조기반환보다 앞이다.
      const restoredMode = conv.mode || 'meta'
      setSearchMode(restoredMode)
      setLastQuery(q)
      setPage(1)
      setConversationId(id)
      serverConvIdRef.current = id
      // round06c 리뷰 F6: runLiveSearch(위)와 동일하게, 재개도 직전 대화의 notice 배너·
      // pool 문구가 새로 여는 대화 화면에 잔류하지 않도록 리셋한다.
      setChatNotice(null)
      setPoolSize(null)
      const msgs = (conv.messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'ai' : m.role,
        text: m.content ?? m.text ?? '',
        citations: Array.isArray(m.grounded_docs)
          ? m.grounded_docs.map((d) => ({ n: d.n, idnbr: d.idnbr, name: d.name, image_url: `/images/${d.idnbr}` }))
          : null,
      }))
      setChatMessages(msgs)
      setChatStatus('idle')
      setChatStarted(msgs.length > 0)
      chatGenRef.current += 1
      setSearchGenId((n) => n + 1)
      // 최종 리뷰 F2 — 재개도 새 검색과 같은 자리에서 feedbackSent를 리셋한다(새 평가
      // 대상이다). runLiveSearch와 동일 지점(=searchGenId 증가 지점)이라는 것이 계약이다.
      setFeedbackSent(false)
      // round06f 갈래 B — 재개도 새 검색과 마찬가지로 직전 브리핑을 즉시 지운다.
      briefGenRef.current += 1
      setBrief(null)
      setBriefStatus('idle')
      setBriefNotice(null)
      // conversations 에 필터를 저장하지 않으므로 재개에는 복원할 값이 없다(§9.4 c).
      setSubjectsState([])
      // round07h — 정렬·등록유형도 같은 이유로 재개에는 복원할 값이 없다(대화에
      // 저장되지 않는다). runLiveSearch(새 검색)와 같은 자리에서 같은 이유로 리셋한다.
      setSortState('relevance')
      setVisibilityState('all')
      // round07m — 종류·소장처도 같은 이유로 재개에는 복원할 값이 없다.
      setMediaTypeState(null)
      setHolderState(null)
      // round06c 리뷰 F2: 더미(!isLive) 모드는 서버가 없다 — fetchPage(searchArtifacts)를
      // 태우면 fetch('undefined/search')가 나가 실패 catch가 matched=false·liveStatus='error'로
      // 더미 화면을 오염한다. 위에서 채운 메타·메시지만으로 재개 화면을 그린다.
      if (!isLive()) return { ok: true }
      // round06f §7.5.1 — 안쪽 ok(검색 결과가 1건 이상인가)와 바깥 ok(대화 재개가
      // 성공했는가)는 **의미가 다르다**. 바깥 계약은 { ok:true } 그대로 둔다 —
      // 소비처 LnbHistory.jsx 의 handleOpen 이 ok===false 를 "대화를 불러오지 못했습니다"
      // 토스트 + 목록 재로드 + 네비게이션 취소로 처리하므로, 여기에 "결과가 0건이다"를
      // 실으면 결과 0건 대화를 열 수 없게 된다. 안쪽 ok 는 브리핑 트리거에만 쓴다.
      // 서버 캐시가 적중하면(cached:true) 그때 만든 문구가 그대로 돌아온다(DoD 3-b).
      return fetchPage(q, 1, id, restoredMode, 'restore', { subjects: [], sort: 'relevance', visibility: 'all', mediaType: null, holder: null }).then(({ ok, stale }) => {
        // F-1(최종 리뷰) — stale이면 이 fetchPage 응답은 더 최신 요청에 밀려난 것이다.
        // 이전에는 이 분기가 무조건 { ok:true }를 돌려줘 LnbHistory.handleOpen이 "성공"으로
        // 읽고 이 낡은 id로 내비게이션했다(화면은 이미 최신 대화인데 URL만 낡은 대화를
        // 가리키는 사고). stale을 그대로 밖으로 알려 호출자가 실패로 처리하게 한다.
        if (stale) return { ok: false, stale: true }
        if (ok) {
          fetchBrief(q, restoredMode)
          fetchGraph(q, restoredMode, null)
        }
        return { ok: true }
      })
    }), [fetchPage, fetchBrief, fetchGraph])

  // 채팅 한 턴 전송 — 토큰 도착 즉시 마지막 ai 메시지에 append(실스트림 렌더).
  // 일시적 실패(stream·network)는 CHAT_MAX_RETRIES회까지 "조용히" 자동 재시도한다(round06d 후속 #8):
  // 재시도가 소진되기 전에는 chatStatus를 error로 바꾸지 않아, 대개 성공하는 재시도를 사용자가 알아채지
  // 못하고 답변만 받게 한다. 세대 가드(gen)와 재시도가 겹치므로, gen 확인은 각 시도 사이(drive 루프)에 둔다.
  // Task 20(round06b) — useCallback으로 감싼다. 6개 함수 중 실 의존성(직접 읽는 state)이
  // 가장 많다: conversationId(가드+요청), chatStatus(가드), chatStarted(요청의 searchQuery
  // 분기), lastQuery(요청의 searchQuery 값), searchMode(요청의 mode 값). 전부 "다음 값을
  // 계산"이 아니라 "지금 값을 읽어 요청을 구성"하는 용도라 setX(prev => ...) 함수형
  // 업데이트로 뺄 수 없다(그 트릭은 같은 state를 갱신할 때만 의존성을 줄여준다) — 그래서
  // useRef 대신 있는 그대로 의존성에 남긴다. 이 다섯이 자주 바뀌는 값(특히 chatStatus는
  // 대화 한 턴마다 rewrite→retrieve→generate→idle로 바뀐다)이라 sendChatMessage 자체의
  // 참조는 자주 갱신되지만, 그건 이미 value 객체가 이 값들을 직접 노출해 어차피 재계산되는
  // 렌더와 같은 타이밍이라 추가 비용이 아니다(정확한 의존성 유지가 참조 안정성보다 우선 —
  // task-20-brief "절대 하지 말 것" 참조).
  const sendChatMessage = useCallback((text) => {
    const trimmed = (text || '').trim()
    // !conversationId 가드: runLiveSearch가 새 검색 왕복 동안 conversationId를 잠깐
    // null로 비우는 창(위 §)이 있다 — 그 사이 전송은 조용히 무시한다(no-op). 채팅은
    // 완결된 검색에 근거하므로, 정당하게 쓸 수 있는 시점엔 항상 conversationId가 있다
    // (round06c C1b 리뷰 — race: conversation_id: null이 백엔드에 도달하는 사고 방지).
    if (!trimmed || !conversationId || ['bootstrap', 'rewrite', 'retrieve', 'generate'].includes(chatStatus)) {
      return Promise.resolve()
    }
    setChatNotice(null)
    setChatMessages((prev) => [...prev, { role: 'user', text: trimmed },
                               { role: 'ai', text: '', citations: null }])
    setChatStatus('rewrite')
    const gen = chatGenRef.current
    const appendAi = (updater) =>
      setChatMessages((prev) => {
        const next = prev.slice()
        next[next.length - 1] = updater(next[next.length - 1])
        return next
      })

    // 스트림 1회 시도. onDone/onError로 결과({ok})를 확정해 resolve한다.
    // 이벤트 콜백(토큰·인용 등)은 성공 경로에서 그대로 렌더에 반영하되, 스트림이 done/error 없이
    // 끝나도(방어) 성공으로 마감한다 — 중복 settle은 무시되므로 어느 경로든 정확히 한 번만 확정된다.
    const runOnce = () => new Promise((resolve) => {
      let settled = false
      const settle = (v) => { if (!settled) { settled = true; resolve(v) } }
      postChatStream(
        {
          conversationId,
          message: trimmed,
          searchQuery: chatStarted ? undefined : lastQuery,
          // round06e Task6 — searchMode는 검색·대화 공유 상태(위 선언부 주석). 대화도 같은
          // 모드로 근거 문서를 검색해야 "메타만 보이는데 답변은 본문을 인용" 같은 불일치가 없다.
          mode: searchMode,
        },
        {
          onStatus: (d) => {
            if (gen !== chatGenRef.current) return
            // 미지 stage는 무시(현 상태 유지 — spec §12 전방 호환)
            if (['bootstrap', 'rewrite', 'retrieve', 'generate'].includes(d.stage)) {
              setChatStatus(d.stage)
            }
            if (d.stage === 'bootstrap' && d.pool_size != null) setPoolSize(d.pool_size)
          },
          onToken: (t) => {
            if (gen !== chatGenRef.current) return
            appendAi((m) => ({ ...m, text: m.text + t }))
          },
          onCitations: (c) => {
            if (gen !== chatGenRef.current) return
            appendAi((m) => ({ ...m, citations: c }))
          },
          onNotice: (n) => {
            if (gen !== chatGenRef.current) return
            setChatNotice(n)
          },
          onDone: () => {
            if (gen === chatGenRef.current) { setChatStatus('idle'); setChatStarted(true) }
            settle({ ok: true })
          },
          onError: (notice, kind) => settle({ ok: false, notice, kind }),
        },
      ).then(() => settle({ ok: true }))
    })

    const drive = async () => {
      for (let attempt = 0; ; attempt += 1) {
        const r = await runOnce()
        if (gen !== chatGenRef.current) return          // 새 검색으로 대체됨 → 조용히 중단
        if (r.ok) return
        const retryable = r.kind === 'stream' || r.kind === 'network'
        if (attempt < CHAT_MAX_RETRIES && retryable) {
          appendAi((m) => ({ ...m, text: '', citations: null }))   // 부분 출력 리셋(재시도분만 남김)
          setChatStatus('rewrite')                                 // 재시도 진행 표시(에러 아님)
          await new Promise((res) => setTimeout(res, CHAT_RETRY_BACKOFF_MS))
          if (gen !== chatGenRef.current) return
          continue
        }
        setChatStatus('error'); setChatNotice(r.notice)            // 재시도 소진 후에만 에러
        return
      }
    }
    return drive()
  }, [conversationId, chatStatus, chatStarted, lastQuery, searchMode])

  // B4(round06b) — 더미 시나리오 선택자. 이전에는 value 객체 리터럴 안에 인라인 화살표
  // 함수로 선언되어 있어 매 렌더 새 참조가 나왔다(Provider가 리렌더될 때마다 이 함수를
  // 의존성 배열에 쓰는 자식이 불필요하게 재구동됐다). useCallback으로 빼내 정체성을
  // 고정한다 — 의존성 배열이 빈 이유는 내부에서 쓰는 setActiveId/setMatched가 모두
  // useState 세터라 그 자체로 항상 안정적이고, getScenario는 인자 id에만 의존하는
  // 순수 함수라 클로저에 가둘 상태가 없기 때문이다.
  const setScenarioById = useCallback((id) => {
    setActiveId(getScenario(id).id)
    setMatched(true)
  }, [])

  // B4(round06b) 도입 → Task 20(round06b)에서 완성. value 객체를 useMemo로 감싸 "관련
  // 없는 state 변경 시 참조 동일성 유지"를 약속한다. isLive()는 의존성 배열에서 뺐다 —
  // env(VITE_API_BASE_URL) 기반 boolean이라 렌더마다 사실상 불변이고, 상태가 아니므로
  // 애초에 "의존"할 대상이 없다(정직하게 남기는 주석). getScenario(activeId)는 activeId에만
  // 의존하므로 배열의 activeId 하나로 충분하다.
  // fetchPage·setScenarioByQuery·changePage·setSubjects·sendChatMessage·resumeConversation
  // (그리고 이들이 내부에서 쓰는 fetchBrief·runLiveSearch)은 Task 20에서 전부 useCallback으로
  // 감쌌다 — B4 최소 구현 시점엔 인라인 클로저라 매 렌더 참조가 바뀌어 이 useMemo가 항상
  // 재계산됐지만(리뷰 확증), 이제는 각자 정직한 의존성 배열을 갖는다(함수별 근거는 각
  // 선언부 주석). 그 결과 이 useMemo는 실제로 나열된 의존성 중 하나라도 바뀔 때만
  // 재계산되고, 아무것도 바뀌지 않은 리렌더(예: 부모발 리렌더)에서는 이전 value 객체
  // 참조를 그대로 반환한다(ScenarioContext.memo.test.jsx가 이를 직접 검증한다).
  const value = useMemo(() => ({
    activeScenario: getScenario(activeId),
    scenarioKey: activeId,
    matched,
    isLive: isLive(),
    liveResults,
    liveStatus,
    liveTotal,
    liveRewritten,
    liveNotice,
    loading,
    loadingKind,
    page,
    pageSize,
    changePage,
    lastQuery,
    searchMode,
    setSearchMode,
    brief,
    briefStatus,
    briefNotice,
    graph,
    graphStatus,
    graphNotice,
    fetchGraph,
    outputsVersion,
    bumpOutputsVersion,
    subjects,
    setSubjects,
    facets,
    // round07h — 정렬·등록유형. subjects와 같은 자리에 둔다(같은 계약·같은 소유자).
    sort,
    setSort,
    visibility,
    setVisibility,
    // round07m — 종류·소장처. visibility와 같은 자리에 둔다(같은 계약·같은 소유자).
    mediaType,
    setMediaType,
    holder,
    setHolder,
    searchGenId,
    liveRequestId,
    feedbackSent,
    setFeedbackSent,
    setScenarioByQuery,
    setScenarioById,
    conversationId,
    chatMessages,
    chatStatus,
    chatNotice,
    poolSize,
    sendChatMessage,
    resumeConversation,
  }), [
    activeId, matched, liveResults, liveStatus, liveTotal, liveRewritten, liveNotice,
    loading, loadingKind, page, pageSize, changePage, lastQuery, searchMode, setSearchMode,
    brief, briefStatus, briefNotice, graph, graphStatus, graphNotice, fetchGraph,
    outputsVersion, bumpOutputsVersion,
    subjects, setSubjects, facets, sort, setSort, visibility, setVisibility,
    mediaType, setMediaType, holder, setHolder, searchGenId,
    liveRequestId, feedbackSent, setFeedbackSent, setScenarioByQuery, setScenarioById,
    conversationId, chatMessages, chatStatus, chatNotice, poolSize, sendChatMessage,
    resumeConversation,
  ])
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}

export function useScenario() {
  const ctx = useContext(ScenarioContext)
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider')
  return ctx
}
