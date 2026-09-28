// 이 파일의 책임: 검색 세션(결과/대화/산출물) 공용 셸 — result_query_bar + page_tabs + Outlet.
// 퍼블 search_result.html L26-43 의 result_query_bar·page_tabs 를 이식하고, 정적 링크를
// conversation 컨텍스트(?c)를 유지하는 React Link 로 승격한다.
import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom'
import { useScenario } from '../context/ScenarioContext.jsx'
import EnvGate from '../components/EnvGate.jsx'
import icSparkle from '../assets/icons/ic_sparkle.svg'      // Part A가 v2 자산 배치(경로는 A 산출에 맞춤)
import icSearchBtn from '../assets/icons/ic_search_btn.svg'
import SearchModeToggle from '../components/SearchModeToggle.jsx'
import { listOutputs, isLive as outputsLive } from '../lib/outputsApi.js'
import useConversationScope from '../hooks/useConversationScope.js'

const TABS = [
  { key: 'results', to: '/search/results', label: '검색결과' },
  { key: 'chat', to: '/search/chat', label: 'AI 학예 도우미' },
  { key: 'output', to: '/search/output', label: '산출물생성' },
]

export default function SearchFlowLayout() {
  const { pathname, state: locationState } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    lastQuery, conversationId, setScenarioByQuery, activeScenario,
    isLive, loading, briefStatus, outputsVersion, resumeConversation,
  } = useScenario()

  // round06f R6F-27(spec §5) — 결과가 아직 없거나(loading) 브리핑이 스트리밍 중이면
  // "AI 학예 도우미"·"산출물생성" 탭으로 건너뛸 수 없게 한다(퍼블 v2의 "결과기반 AI 대화"는
  // round07b-ext에서 피그마를 따라 "AI 학예 도우미"로 변경됨). 후보풀이 비어 있는 채로
  // 대화가 시작되는 등 반쪽 상태를 막기 위해서다(사용자 지시 2026-07-28). 결과·브리핑이
  // 모두 종결되면(ok든 error든 — loading만 아니면 된다) 다시 열린다. 비라이브(더미)는
  // loading/briefStatus 개념 자체가 이 화면 흐름에 없어 isLive가 판정을 무력화한다.
  //
  // 이 게이트는 라우팅(탭 클릭) 차단일 뿐 보안 경계가 아니다 — URL 직접 입력(주소창 이동·
  // ?c= 딥링크)은 막지 않는다. 이 원칙은 round06e가 이미 내린 판정(spec :560, prod 게이팅도
  // 같은 이유로 셸이 아니라 페이지 레벨이다)과 같다.
  const tabsGated = isLive && (loading || briefStatus === 'loading')
  // round06f 갈래 E(spec §10.3) — 산출물생성 탭 부활. round06e는 prod에서 이 탭을 목록에서
  // 뺐지만(isEnvHidden 필터), 사용자 요구는 "탭은 그대로 두고 누르면 준비중"이었다
  // (spec §2-5). 이제 판정은 아래 <EnvGate>가 본문(Outlet)에서만 하므로 탭줄·검색바는
  // 어느 환경에서도 사라지지 않는다. 이름은 "탭 목록 파생 지점"의 표식으로 유지한다
  // (spec §10.3이 지정한 형태 — :65의 visibleTabs.map은 무변경).
  const visibleTabs = TABS
  // 검색바 프리필: 라이브는 lastQuery(실제 검색 질의)가 항상 우선한다. 더미 모드는 lastQuery 가
  // 세팅되지 않으므로(ScenarioContext 비라이브 분기) activeScenario.query(더미 시나리오의 원본
  // 질의문)로 대신 채운다 — 예전에는 isLive 게이트 때문에 더미 모드 검색바가 영구 빈칸이었다(F8).
  // activeScenario 는 일부 테스트가 컨텍스트를 직접 주입하며 넣지 않으므로 옵셔널 체이닝 필수.
  const [q, setQ] = useState(lastQuery || activeScenario?.query || '')
  useEffect(() => { setQ(lastQuery || activeScenario?.query || '') }, [lastQuery, activeScenario])

  // round07g — **이 셸이 보고 있는 대화.** 탭 링크(withC)와 탭 뱃지가 같은 값을 쓴다.
  // `?c=` 가 우선인 이유: 재개·딥링크가 그 값을 실어 주고 F5 를 눌러도 살아남는다.
  // 컨텍스트 conversationId 는 그 다음(새 검색 직후처럼 주소에 아직 없을 때). 둘 다
  // 없으면 null — 링크에 붙이지 않고, 뱃지도 서버 기본값(전체)을 받는다.
  //
  // round07g 최종 리뷰 Important-1 — 판정을 훅 하나로 모았다. 「라이브러리에서
  // 두고 온 대화」는 컨텍스트에 남아 있어도 이 셸이 세지 않는다(그 프로젝트의
  // 산출물이 아니다). carryState 는 그 판정을 탭 링크에 실어 보내는 값이다 —
  // 없으면 탭을 한 번 누르는 순간 컨텍스트 폴백이 되살아나 결함이 재발한다.
  const { scope: conversationScope, fromContext, carryState } = useConversationScope(conversationId)

  // round07b-ext T13 — 탭 뱃지 — 미열람 산출물 수. limit:1 로 부르는 이유는 목록이
  // 아니라 new_count 하나만 필요하기 때문이다(응답이 카드 1장분으로 줄어든다).
  // kind·q로 좁히지 않는다 — 뱃지는 필터·페이지와 무관한 「내 미열람 전체」다.
  //
  // 의존성이 [outputsVersion]인 것이 핵심이다(리뷰 반영). 이 셸은 react-router의
  // **레이아웃 라우트**라 /search/* 탭을 오가도 리마운트되지 않는다 — []로 두면
  // 산출물을 만들거나 열거나 지워도 뱃지가 최초 값에 영영 멈춘다. 그 신호를 아래
  // 층(OutputTab·OutputList)에서 컨텍스트로 끌어올려 여기서 구독한다.
  const [newCount, setNewCount] = useState(0)
  useEffect(() => {
    // 데모 모드(VITE_API_BASE_URL 미설정)는 서버가 없다 — 부르면 매번 실패한다.
    // 이 이펙트는 토스트를 띄우지 않으므로 조용하지만, 불필요한 실패 요청이므로
    // 아예 나가지 않게 한다(OutputList와 같은 게이트).
    if (!outputsLive()) return undefined
    // round07g 수정 R1 — **대화를 모르면 뱃지도 세지 않는다.** 목록(OutputList)이
    // 그때 조회를 멈추고 빈 상태를 내는데, 뱃지만 서버 기본값(전체)을 받아 「산출물생성
    // 5」라고 말하면 그 숫자가 거짓말이 된다 — 눌러 들어가면 0건이다. 뱃지와 목록은
    // 같은 격리 축을 쓴다는 것이 이 라운드의 규칙이라(아래 `cid`와 같은 값) 게이트도
    // 같이 간다. 0으로 되돌리는 것은 대화가 사라졌을 때 옛 숫자가 남지 않게 하려는 것.
    if (!conversationScope) {
      setNewCount(0)
      return undefined
    }
    let alive = true
    // round07g — 뱃지도 **목록과 같은 대화 범위**다. 탭에는 보이지도 않는 산출물이
    // 뱃지에만 세어지면 그 숫자가 거짓말이 된다(kind·q 로는 여전히 좁히지 않는다 —
    // 그 둘은 필터이고, 대화는 격리 축이다). `conversationScope`는 아래 `cid`와 같은 값이라
    // 탭 링크가 실어 보내는 값과 뱃지가 세는 범위가 언제나 일치한다.
    listOutputs({ limit: 1, conversationId: conversationScope }).then((res) => {
      // `?? 0` 은 장식이 아니다 — 이 셸을 **실 라우터로** 마운트하는 테스트가 둘
      // 있다(App.test.jsx의 /search/results 스모크, Library.output-deeplink.test.jsx의
      // /library → /search/output 딥링크). 후자는 OutputTab 쪽 목적으로 outputsApi.js를
      // 목업해 둔 것이라 그 응답에 new_count가 없다 — 이 폴백이 없으면 그 테스트에서
      // `undefined > 0`이 되어 뱃지가 조용히 안 그려진다. 지우지 말 것.
      if (alive && res.ok) setNewCount(res.data.new_count ?? 0)
    })
    return () => { alive = false }
    // conversationScope 도 트리거다 — 대화 id 는 `?c=` 복원·새 검색으로 **나중에 정해지는**
    // 값이라, 없으면 뱃지가 최초 범위(대개 전체)에 굳는다.
  }, [outputsVersion, conversationScope])

  // round07e D — **새로고침해도 대화가 살아 있게 한다.**
  //
  // 이전에는 `?c=` 가 탭 링크를 만드는 데만 쓰였다(아래 withC). 그래서 F5 를
  // 누르면 컨텍스트가 초기값으로 돌아가고 graph 가 null 이 되며, OutputTab 이
  // **하드코딩 데모(nodes.js)로 조용히 폴백**했다 — 학예사가 「4·19 혁명 3건」
  // 같은 가짜 숫자를 진짜로 읽는다. graphStatus 가 'idle' 이라 경고조차 없었다.
  //
  // 이 셸은 레이아웃 라우트라 탭을 오가도 리마운트되지 않는다 — 탭 이동마다
  // 재개가 돌지 않게 이미 그 대화를 들고 있으면(conversationId === target)
  // 건너뛴다. attemptedRef 는 StrictMode 의 이중 실행과, 실패한 id 로 무한히
  // 재시도하는 것을 함께 막는다(실패해도 ref 에 남긴다).
  const attemptedRef = useRef(null)
  useEffect(() => {
    const target = searchParams.get('c')
    if (!isLive || !target) return
    if (conversationId === target || attemptedRef.current === target) return
    attemptedRef.current = target
    resumeConversation(target)
  }, [searchParams, isLive, conversationId, resumeConversation])

  // ── round07g 라이브 수정 — **새 검색으로 대화가 바뀌면 주소의 `?c=` 도 갈아끼운다.**
  //
  // 라이브에서 재현된 결함: 대화 A 에서 산출물을 만든 뒤 이 셸의 검색바로 새 검색을 하면
  // 서버에는 새 대화 B 가 서는데 주소는 `?c=A` 그대로였다. `?c=` 가 최우선인 판정
  // (useConversationScope ①) 때문에 탭 링크·뱃지·산출물 조회가 전부 A 로 가고, 새 검색
  // 화면에 **옛 대화의 산출물**이 그대로 남았다(「산출물이 다른 세션에서도 공유된다」 —
  // 사용자 보고). 같은 시점의 서버 필터는 정확했다(옛 대화 2건 · 새 대화 0건) — 화면이
  // 옛 id 를 넘긴 것이 전부였다. 이 미갱신은 round07e D 가 `?c=` 를 만든 때부터 있었으나
  // 그때는 산출물이 대화로 걸러지지 않아 티가 나지 않았고, round07g(T5)가 그 위에 의존을
  // 얹으면서 드러났다.
  //
  // ── 위 재개 이펙트와 **방향이 반대다**. 부딪히지 않게 하는 것이 이 이펙트의 절반이다 ──
  //     재개: 주소 → 컨텍스트 (`?c=` 를 읽어 resumeConversation)
  //     여기: 컨텍스트 → 주소 (선 대화를 `?c=` 로 replace)
  //   서로를 깨우면 무한 루프이고, 최악에는 새 검색 직후 옛 대화를 되살린다. 세 장치로 막는다.
  //
  //   ① **고정점.** 쓰고 나면 `searchParams.get('c') === settled` 가 되어 아래 첫 조기반환에
  //      걸린다 — 같은 값을 두 번 쓰지 않는다. 그 렌더에서 재개 이펙트도
  //      `conversationId === target` 이라 조기반환한다. 어느 쪽도 상대를 다시 깨우지 않는다.
  //   ② **attemptedRef 를 함께 채운다**(재개 이펙트가 이미 가진 가드 — 그 **본문은 무변경**).
  //      새 검색은 `setConversationId(null)` 로 대화를 끊었다가 새로 세운다(runLiveSearch).
  //      그 **null 구간**에 재개 이펙트가 다시 돌면 주소에 남은 옛 `?c=A` 를 보고
  //      resumeConversation(A) 를 쏴 **방금 시작한 검색을 옛 대화로 되돌린다.** 주소와
  //      컨텍스트가 이미 같은 대화를 가리키면 그 대화는 「정착했다」는 뜻이므로 여기서
  //      ref 에 적어 그 재개를 막는다 — 정착한 대화를 다시 재개할 이유는 없다.
  //   ③ **재개 전이(대화 → 대화)에는 주소를 건드리지 않는다.** 「나의 기록」은 스스로
  //      `/search/results?c=…` 로 이동하므로 주소의 주인이 그쪽이다. 덕분에 재개가 목적지에
  //      닿기 전에 이 이펙트가 앞질러 replace 해 뒤로가기 이력을 흔드는 일이 없다.
  //
  // ── R2(라이브 2차 실측) — ③ 의 판정 근거를 바꾼다 ─────────────────────────────
  //
  // 1차 수정은 ③ 을 **`previous === null`** 로 판정했다. 「새 검색만 `A → null → B` 로
  // null 을 지난다」가 근거였는데, 그 null 은 **렌더 하나짜리 통과점**이다. 이 이펙트가
  // 그 렌더를 관측하지 못하면(React 가 두 갱신을 한 커밋으로 합치거나, 그 구간에 이 셸의
  // 이펙트가 걷혔다 다시 붙으면) `previous` 는 **옛 대화 id 그대로** 남고 ③ 이 쓰기를
  // 영구히 막는다 — 대화는 다시 null 로 돌아오지 않으므로 회복 지점도 없다.
  //
  // 라이브 2차 실측이 이 비대칭을 그대로 보여 준다.
  //   · `?c=` 없이 출발 → **성공**. 그때 `previous` 는 마운트값 `null` 이라 ③ 이 열린다.
  //   · `?c=A` 로 출발 → **주소 변화 0회**. 재개가 컨텍스트를 A 로 세워 두었으므로
  //     `previous` 가 `'A'` 이고, 중간 null 을 놓치는 순간 ③ 이 영구히 닫힌다.
  // 「`?c=` 가 있을 때만 안 걸린다」의 정체가 이것이다(테스트도 이 갈림을 재현한다 —
  // 중간 null 을 별도 렌더로 흘려 주면 **수정 전 코드도 통과**한다. 1차 테스트 12건이
  // 전부 그 형태였고, 그래서 라이브 결함을 못 잡았다).
  //
  // 그래서 판정을 **일시적 통과점이 아니라 지속되는 사실**로 바꾼다: 「이 셸의 검색바가
  // 방금 새 검색을 시작했다」(searchStartedRef). handleSubmit 이 이벤트 핸들러에서 동기로
  // 적어 두고, 대화가 새로 서는 첫 순간에 이 이펙트가 소비한다 — 그 사이 React 가 렌더를
  // 몇 개 만들든, 어떤 렌더를 관측하든 값이 살아 있다.
  //   · 셸 밖에서 시작된 검색(홈 화면 검색바 → /search/results 착지)은 이 플래그가 없다.
  //     그 경로는 셸이 갓 마운트돼 `previous` 가 마운트값 null 이므로 기존 `previous === null`
  //     갈래가 그대로 받는다 — 두 갈래를 OR 로 둔 이유다.
  //   · 소비 지점을 **고정점(①) 판정 다음**에 둔다. 검색 왕복 중에 옛 대화가 잠깐 되살아나
  //     ① 로 빠지는 일이 있어도 플래그가 거기서 소모되지 않아야, 뒤이어 도착한 새 대화가
  //     제 몫의 판정을 받는다.
  //
  // 판정에 `scope` 가 아니라 `fromContext` 를 쓰는 이유: scope 는 주소와 컨텍스트를 이미
  // 합친 값이라 「주소가 낡았다」를 관측할 수 없다. fromContext 에도 「두고 온 대화」
  // 규칙(useConversationScope ③)이 그대로 걸려 있어, 라이브러리 딥링크에서 두고 온
  // 대화가 주소로 되살아나지 않는다.
  //
  // 갱신은 **replace** 다 — 새 검색은 같은 화면의 상태 변화이지 새 방문이 아니다. 라우터
  // state 도 그대로 실어 보낸다(탭 링크의 carryState 와 같은 이유 — 「두고 온 대화」 판정이
  // 주소를 한 번 고쳤다고 사라지면 안 된다).
  const syncedRef = useRef(fromContext)
  // R2 — 「이 셸의 검색바가 새 검색을 시작했다」. handleSubmit(아래)이 세우고 이 이펙트가
  // 대화가 새로 서는 첫 순간에 소비한다. ref 라서 렌더 사이를 살아 남는다 — ③ 이 더 이상
  // 「중간 null 렌더를 관측했는가」라는 운에 기대지 않게 하는 것이 이 값의 전부다.
  const searchStartedRef = useRef(false)
  useEffect(() => {
    const settled = fromContext
    const previous = syncedRef.current
    syncedRef.current = settled
    if (!isLive || !settled) return
    if (searchParams.get('c') === settled) {
      attemptedRef.current = settled // ②
      return
    }
    const startedHere = searchStartedRef.current
    searchStartedRef.current = false
    if (!startedHere && previous !== null) return // ③
    attemptedRef.current = settled // ②
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('c', settled)
      return next
    }, { replace: true, state: locationState })
  }, [fromContext, isLive, searchParams, setSearchParams, locationState])

  // ?c 우선(재개·딥링크), 없으면 컨텍스트 conversationId. 둘 다 없으면 미부착.
  // round07g — 위 뱃지가 세는 범위(conversationScope)와 **같은 값**이어야 한다.
  // 갈리면 탭 링크가 실어 보낸 대화와 뱃지의 숫자가 서로 다른 것을 말하게 된다.
  const cid = conversationScope
  const withC = (to) => (cid ? `${to}?c=${encodeURIComponent(cid)}` : to)

  // sr_only 페이지 제목 — 탭 라벨의 정본은 **피그마 디스크립션**이다(round07b-ext).
  // 퍼블 v2는 ai_chat.html="결과기반 AI 대화" 였으나 피그마가 "AI 학예 도우미"로 바꿨고,
  // 디스크립션이 정본이라는 이 라운드의 원칙에 따라 피그마를 따른다.
  // 어느 탭에도 안 걸리면(정의되지 않은 하위 경로 등) "검색결과"로 폴백한다 —
  // 이 셸의 기본 진입점이 결과 화면이라서다.
  // round07f — 상세 화면(/search/output/:id)도 「산출물생성」 탭이어야 한다.
  // startsWith 이면서도 다른 탭을 오염시키지 않는 이유: results·chat·output
  // 세 경로가 서로의 접두어가 아니다(겹치지 않는다).
  const activeTabLabel = TABS.find((t) => pathname.startsWith(t.to))?.label || '검색결과'

  function handleSubmit(e) {
    e.preventDefault()
    const text = q.trim()
    // R2 — **여기가 「새 검색」의 유일한 확실한 신호다.** 컨텍스트의 대화가 어떻게
    // 흔들리든(끊겼다 서든, 한 커밋에 묻히든) 이 한 줄은 사용자가 이 셸에서 검색을
    // 시작했다는 사실을 남긴다. 위 이펙트가 새 대화가 서는 순간 이 값을 소비해
    // 주소의 `?c=` 를 갈아끼운다. 데모 모드에서도 세우지만 이펙트가 isLive 로 막혀
    // 주소는 건드리지 않는다.
    if (text) {
      searchStartedRef.current = true
      setScenarioByQuery(text)
    }
  }

  return (
    <>
      <h2 className="sr_only">{activeTabLabel}</h2>
      <form className="result_query_bar" onSubmit={handleSubmit}>
        <img src={icSparkle} alt="" className="result_query_bar_icon" />
        <SearchModeToggle />
        <label className="sr_only" htmlFor="result_query_input">검색어</label>
        <input type="search" className="result_query_bar_input" id="result_query_input"
               value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="result_query_btn" aria-label="검색">
          <img src={icSearchBtn} alt="" className="result_query_btn_icon" />
        </button>
      </form>
      <nav className="page_tabs" aria-label="검색 결과 하위 메뉴">
        {visibleTabs.map((t) => {
          const active = pathname.startsWith(t.to)
          // "검색결과" 탭은 게이트 대상이 아니다 — 언제나 돌아올 곳이 있어야 한다.
          const disabled = tabsGated && t.key !== 'results'
          // 뱃지는 「산출물생성」 탭에만 붙는다(피그마 참조) — 미열람 0건이면 숫자
          // 0을 보여주는 대신 아예 렌더하지 않는다(「신규 없음」과 「0건」을 구분 안 함).
          const badge = t.key === 'output' && newCount > 0
            // 퍼블 v2 정본 클래스는 result_tabs_badge다(component.css L298) —
            // page_tabs_badge는 이 브리프 초안 표기이나 CSS가 없어 그대로 쓰면
            // 뱃지가 스타일 없이 뜬다. CLAUDE.md 원칙(퍼블이 코드와 어긋나면 퍼블이
            // 옳다)에 따라 퍼블 클래스로 맞춘다.
            ? <span className="result_tabs_badge">{newCount}</span>
            : null
          if (disabled) {
            // Lnb.jsx의 blockReasonOf 분기와 같은 관행 — <a>를 유지해 role='link'와
            // .page_tabs_link 선택자를 그대로 살리고, onClick만 무력화한다(preventDefault).
            // react-router Link가 아니므로 실제로는 이동할 곳이 없어 href는 참고용이다.
            return (
              <a key={t.key} href={withC(t.to)} className="page_tabs_link" aria-disabled="true"
                 onClick={(e) => { e.preventDefault() }}>
                {t.label}{badge}
              </a>
            )
          }
          return (
            <Link key={t.key} to={withC(t.to)} state={carryState} className="page_tabs_link"
                  {...(active ? { 'aria-current': 'page' } : {})}>
              {t.label}{badge}
            </Link>
          )
        })}
      </nav>
      {/* round06f 갈래 E(spec §10.3) — 게이트는 여기, 탭줄 **안쪽**이다. prod에서
          /search/output에 들어오면 위 검색바·page_tabs는 그대로 남고 이 자리만 준비중
          화면판으로 바뀐다. AppShell은 더 이상 이 경로를 셸 레벨에서 막지 않는다
          (envGates.js의 PAGE_LEVEL_PREFIXES에 '/search'가 있어 isShellLevelGated가
          false를 돌려준다) — 그래서 여기 게이트가 없으면 prod에 그대로 노출된다(R-11). */}
      <EnvGate><Outlet /></EnvGate>
    </>
  )
}
