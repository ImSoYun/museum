// 이 파일의 책임: 프로젝트 상세 셸(round10 Task6) — 제목 머리 · 3탭(지역 상태) · 읽기 전용.
//
// 목록(Library.jsx)에서 카드를 누르면 openProject 응답(project·outputIds)을 navigate
// state로 들고 이 화면에 온다 — 그 값이 있으면 다시 서버를 부르지 않는다(Library.jsx
// 머리주석 "상세 화면이 같은 요청을 두 번 하지 않게" 참조). 주소창에 /library/:id를
// 직접 치고 들어오면 state가 없으므로 여기서 openProject(id)를 한 번 더 부른다 —
// 암호가 걸려 있으면(401) **이 화면에서** 곧바로 묻는다(round10a 최종리뷰 M-6① 정정 —
// 예전에는 「암호는 목록에서만 묻는다」며 목록으로 돌려보냈는데, 이 화면은 되돌아올
// 때마다 openProject를 타서 잠긴 프로젝트에서는 산출물 상세를 열었다 돌아오는 것조차
// 막혔다. 아래 401 분기 주석 참조). 그 외 실패는 상세에서 보여줄 대안이 없어 목록으로
// 돌려보낸다 — 실패를 조용히 삼키지 않도록(코딩표준 §6) showToast로 사유를 알린다.
//
// ⚠️ round10 결정(브리프 Step2 지시와 다른 부분) — 브리프는 "검색을 재실행하고,
// conversation_id가 있으면 resumeConversation도 부른다"고 적었지만, resumeConversation
// (ScenarioContext.jsx:579-640)은 대화만 복원하지 않는다 — 저장된 search_query·mode를
// 꺼내 fetchPage까지 **직접** 다시 돌린다(:636). 즉 둘을 함께 부르면 검색 요청이 두 번
// 나가 경쟁한다. 그래서 여기서는 conversation_id 유무로 **하나만** 고른다:
//   conversation_id 있음 → resumeConversation(id, 프로젝트 경유 조회) 하나만(검색+대화를 함께 되살린다)
//   conversation_id 없음 → setScenarioByQuery(search_query)
// 마운트당 정확히 한 번만 실행되도록 useRef 가드를 쓴다 — SearchFlowLayout의
// attemptedRef(재개 중복 방지)와 같은 관행이다(React 18 StrictMode 이중 마운트 대비).
//
// ⚠️ round10 최종리뷰 C-1 — 대화 복원은 **프로젝트 경유 조회 함수를 주입해서** 한다.
// 기본 경로(conversationsApi.getConversation)는 소유자 전용이라 남의 프로젝트를 연
// 사람에게는 403이고, 그 실패를 ScenarioContext가 상태를 건드리지 않고 조용히
// resolve하는 바람에 **열람자 자신의 직전 검색·직전 대화가 남의 프로젝트 제목 아래**
// 그대로 남아 있었다(리뷰가 지적한 실제 결함). 컨텍스트가 프로젝트를 알게 만들지
// 않고 조회 함수만 내려보내는 이유는 ScenarioContext.resumeConversation 주석 참조.
// 그리고 **실패를 삼키지 않는다**(코딩표준 §6): 복원이 실패하면 ⓐ 저장된 질의로
// 검색만이라도 되살리고(그 과정에서 이전 대화 상태도 함께 비워진다 — runLiveSearch가
// chatMessages를 리셋한다) ⓑ 대화 탭에 한 줄로 알린다(spec §6).
//
// 검색결과 탭은 기존 ResultsTab을 그대로 태우고(그 화면은 보기·다운로드만 갖고 있어
// 이 라운드에서 고칠 것이 없었다, 리포트 참조) project 를 실제로 받은 뒤에만
// <ReadOnlyProvider value={true}>로 감싼다 — 나머지 두 탭(AI 학예 도우미·산출물생성)은
// Task 7이 채운다.
//
// <EnvGate>로 감싸는 이유 — envGates.js의 HIDDEN_BY_ENV.prod['/library']는
// pathname.startsWith 매칭이라 '/library/:id'도 이미 숨김 대상이지만, 그 판정을
// 실제로 적용하는 것은 셸(AppShell)이 아니라 PAGE_LEVEL_PREFIXES에 오른 페이지
// 자신의 <EnvGate>다(AppShell은 '/library' 접두 아래를 더 이상 셸 레벨에서 막지
// 않는다 — isShellLevelGated가 false). Library.jsx가 스스로 <EnvGate>를 두는 것과
// 같은 이유로 여기도 둔다 — 없으면 prod에서 상세만 조용히 노출된다.
//
// ⚠️ round10a 최종리뷰 M-6② — 그래서 게이트는 반드시 **모든 렌더 분기**를 감싸야
// 한다. project 를 아직 못 받은 구간(암호 모달·null)이 게이트 밖에 있으면, prod 에서도
// 잠긴 프로젝트 URL 로 직접 들어온 사람에게 「준비 중」 대신 암호 입력 모달이 그대로
// 뜬다 — 예전 `return null`은 최소한 아무것도 노출하지 않았는데 그보다 나빠진 것이다.
// 그래서 컴포넌트 최상위 return 전체를 <EnvGate>로 감싸고, 그 안에서 project 유무로
// 갈라 그린다(EnvGate.jsx — AuthContext Provider 밖·appEnv 미정 구간은 fail-open 이라
// 이 페이지 아래 나머지 로직에는 영향이 없다).
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useScenario } from '../context/ScenarioContext.jsx'
import { useToast } from '../components/useToast.js'
import { openProject, getProjectConversation } from '../lib/projectsApi.js'
import { ReadOnlyProvider } from '../context/ReadOnlyContext.jsx'
import { rememberOpenedProject, recallOpenedProject } from '../state/openedProjects.js'
import EnvGate from '../components/EnvGate.jsx'
import PasswordModal from '../components/PasswordModal.jsx'
import ResultsTab from './results/ResultsTab.jsx'
import ChatTab from './results/ChatTab.jsx'
import OutputTab from './results/OutputTab.jsx'
import ProjectOutputList from './results/ProjectOutputList.jsx'
import icCalendar from '../assets/icons/ic_calendar.svg'
import icCertified from '../assets/icons/ic_certified.svg'
import icDocument from '../assets/icons/ic_document.svg'

const TABS = [
  { key: 'results', label: '검색결과' },
  { key: 'chat', label: 'AI 학예 도우미' },
  { key: 'output', label: '산출물생성' },
]

// Library.jsx의 formatCreatedAt과 같은 규칙(OutputCard.jsx 관행 — ISO를 ko-KR로 표시).
// lib/ 모듈 간 무의존 규약과 같은 이유로, 페이지 레벨의 이 짧은 순수 함수도 다시 둔다.
const formatCreatedAt = (iso) => new Date(iso).toLocaleString('ko-KR')

export default function ProjectDetail() {
  const { projectId } = useParams()
  const location = useLocation()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const { setScenarioByQuery, resumeConversation } = useScenario()

  // outputIds(location.state·openProject 응답 둘 다에 있다)는 이 태스크에서 소비하지
  // 않는다 — Task 7의 산출물생성 탭은 자기 몫의 listProjectOutputs(projectId)로 직접
  // 조회한다(interface 문서). 여기서 들고 있어 봤자 쓰는 곳이 없어 저장하지 않는다.
  // round10(2026-09-16 사용자 결정) — 이번 방문에서 이미 연 프로젝트면 그 값을 쓴다.
  // 산출물 상세를 열었다가 돌아올 때 암호를 다시 묻지 않게 하는 자리다
  // (openedProjects.js 머리주석 — 새로고침에는 남지 않는다).
  const [project, setProject] = useState(
    location.state?.project ?? recallOpenedProject(projectId) ?? null
  )

  // ⚠️ round10 최종리뷰 I-2 — navigate state 는 **이번 내비게이션에만 유효한 값**이다.
  // router.jsx 는 createBrowserRouter 라 navigate state 가 `window.history.state.usr`
  // 에 영속된다. 위 useState 가 그 값을 읽은 뒤 그대로 두면, 암호 프로젝트에 들어간
  // 사람이 F5(또는 뒤로→앞으로)를 누를 때 그 히스토리 엔트리의 state 가 되살아나
  // openProject 를 건너뛰고 상세가 그대로 뜬다 — 결정 2(「암호는 기억하지 않는다.
  // 열 때마다 묻는다 — 세션·쿠키·서버 어디에도 통과 상태를 남기지 않는다」)에서
  // **브라우저 히스토리도 그 「어디」에 포함된다.** 그래서 마운트가 값을 쓰고 나면
  // 히스토리에서 지운다. 그러면 새로고침에는 state 가 없어 openProject 를 다시 타고,
  // 암호가 걸려 있으면 401 로 목록에 돌아가 다시 묻는다.
  //
  // 암호 없는 프로젝트에는 새 왕복이 생기지 않는다 — 지우는 것은 히스토리 엔트리이고
  // 이번 마운트의 `project` 상태는 이미 채워져 있어 아래 openProject 이펙트는 여전히
  // 건너뛴다(그 이펙트의 `if (project …) return` 가드).
  //
  // round10 재리뷰(Minor) — 지우는 것은 **state 뿐**이다. 예전에는 `location.pathname`
  // 만 넘겨 `?…`(search)와 `#…`(hash)를 함께 버렸다. 오늘 이 라우트로 들어오는
  // 진입점이 쿼리를 싣지 않아 증상이 없을 뿐, 나중에 딥링크(예: `?tab=chat`)가
  // 붙으면 마운트 직후 조용히 사라진다 — 원인을 찾기 어려운 종류의 유실이다.
  // 셋을 그대로 이어 붙여 「주소는 그대로, state 만 비운다」를 지킨다.
  //
  // round10a 최종리뷰 M-6① 정정 — 히스토리에서 state 를 지운 뒤 새로고침하면 state
  // 가 없어 openProject 를 다시 타고, 암호가 걸려 있으면 401 을 만나 **이 화면에서**
  // 다시 묻는다(목록으로 돌아가지 않는다 — 예전 주석은 「목록에 돌아가 다시 묻는다」
  // 였는데 그 사이 401 분기가 바뀌었다).
  useEffect(() => {
    if (!location.state) return
    // round10a 최종리뷰 I-4 — 여기서 소비하는 location.state.project 도 recallOpenedProject
    // 가 돌려주는 값과 같은 신뢰 수준이다(둘 다 서버가 이미 내어 준 값이다). 기억해 두지
    // 않으면 목록에서 카드를 눌러 들어온(가장 흔한) 사람이 산출물 상세를 열었다 돌아올 때
    // (그 사이 이 이펙트가 아래에서 state 를 지운다) openProject 를 다시 타 버려 비소유자는
    // 방금 확인한 암호를 또 입력해야 한다(소유자는 서버 면제 — 결정 2-b — 에 가려 라이브
    // 검증에서 드러나지 않았다). openProject 성공·암호 제출 성공과 같은 자리에 나란히 세워
    // 세 경로의 신뢰 수준을 맞춘다.
    if (location.state.project) {
      rememberOpenedProject(projectId, location.state.project)
    }
    nav(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })
    // location.state 만 보고 한 번 지우면 된다 — 지운 뒤에는 이 이펙트가 조기 반환한다.
  }, [location.state, location.pathname, location.search, location.hash, nav, projectId])

  // 주소창 직접 진입 등 목록에서 넘어온 값이 없을 때만 다시 연다(중복 요청 방지).
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (project || fetchedRef.current) return
    fetchedRef.current = true
    openProject(projectId).then((res) => {
      if (res.ok) {
        rememberOpenedProject(projectId, res.project)
        setProject(res.project)
        return
      }
      // round10(2026-09-16 라이브 검증, 사용자 지적) — 401 은 **그 자리에서** 묻는다.
      //
      // 예전에는 「상세는 암호 UI 를 갖지 않는다(암호는 목록에서만 묻는다)」는 결정에 따라
      // 목록으로 돌려보냈다. 그런데 이 화면은 **다시 열릴 때마다** openProject 를 탄다 —
      // 목록에서 카드를 눌러 들어올 때만 붙는 값(navigate state)이 링크로 되돌아올 때는
      // 없기 때문이다. 그래서 잠긴 프로젝트에서는 산출물 상세를 열었다가 「이전 화면
      // 돌아가기」를 누르면 상세로 오다가 목록으로 튕겼다. 새로고침·주소창 직접 입력도
      // 같은 자리에서 같은 이유로 막혔다 — **들어간 뒤에는 화면을 벗어날 수 없었다.**
      //
      // 여기서 물으면 그 세 경로가 한 번에 풀린다. 결정 2(「열 때마다 묻는다 — 어디에도
      // 통과 상태를 남기지 않는다」)는 그대로다. 오히려 더 충실해진다 — 되돌아올 때마다
      // 실제로 다시 묻기 때문이다(주인은 서버가 면제한다, 결정 2-b).
      if (res.status === 401) {
        setAskPassword(true)
        return
      }
      // 그 밖의 실패(404·403·네트워크)는 이 화면이 풀 수 있는 것이 없다 — 사유를 알리고
      // 목록으로 돌려보낸다(코딩표준 §6 — 조용히 삼키지 않는다).
      showToast('프로젝트를 열지 못했습니다')
      nav('/library', { replace: true })
    })
  }, [project, projectId, nav, showToast])

  // 암호를 묻는 중인가 — 위 401 분기가 켠다. 통과 상태는 어디에도 저장하지 않는다.
  const [askPassword, setAskPassword] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwBusy, setPwBusy] = useState(false)

  const handlePasswordSubmit = async (pw) => {
    setPwBusy(true)
    const res = await openProject(projectId, pw)
    setPwBusy(false)
    if (res.ok) {
      rememberOpenedProject(projectId, res.project)
      setAskPassword(false)
      setProject(res.project)
      return
    }
    // 목록(Library.jsx)과 같은 문구·같은 갈래 — 403 은 「틀렸다」, 그 외는 일반 실패.
    setPwError(res.status === 403 ? '암호가 맞지 않습니다' : '프로젝트를 열지 못했습니다')
  }

  // 「아니오」 — 열지 않기로 했으므로 목록으로 돌아간다(이 화면에는 보여 줄 것이 없다).
  const handlePasswordCancel = () => {
    if (pwBusy) return
    nav('/library', { replace: true })
  }

  // 대화 복원이 실패했다는 사실을 대화 탭에 한 줄로 남긴다(spec §6 — 「대화가
  // 지워졌으면 그 탭만 비고 나머지는 정상이다. 침묵하지 않고 한 줄로 알린다」).
  // ChatTab에 prop을 새로 내지 않고 여기서 그리는 이유: 자료검색 화면이 쓰는
  // ChatTab의 기본 경로를 한 줄도 건드리지 않기 위해서다.
  const [conversationNotice, setConversationNotice] = useState(null)

  // 마운트당 정확히 한 번만 — 위 파일 머리주석 "⚠️ round10 결정" 참조.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!project || restoredRef.current) return
    restoredRef.current = true
    if (!project.conversation_id) {
      setScenarioByQuery(project.search_query, { recordHistory: false })   // round10 — 열어 보기만 해도 「나의 기록」이 늘어나지 않게 한다
      return
    }
    // 프로젝트 경유 조회를 주입한다 — 소유자가 아니어도 이 프로젝트의 대화는 읽힌다.
    resumeConversation(
      project.conversation_id,
      (conversationId) => getProjectConversation(projectId, conversationId),
    ).then((res) => {
      if (res?.ok) return
      // 복원 실패(대화 삭제·소속 불일치·네트워크). 검색만이라도 되살리고 알린다.
      setScenarioByQuery(project.search_query, { recordHistory: false })   // round10 — 열어 보기만 해도 「나의 기록」이 늘어나지 않게 한다
      setConversationNotice('저장된 대화를 불러오지 못했습니다 — 검색결과만 보여 드립니다')
    })
  }, [project, projectId, resumeConversation, setScenarioByQuery])

  // round10(2026-09-16 라이브 검증) — 산출물 상세를 열었다가 「이전 화면 돌아가기」로
  // 되돌아오면 왔던 자리(산출물생성 탭)로 와야 한다. 탭은 라우트가 아니라 지역 상태라
  // (상세는 한 화면이다) 주소만으로는 복원되지 않아, `?tab=` 한 칸으로 처음 탭을 고른다.
  // 모르는 값이면 기본값(검색결과)으로 떨어뜨린다 — 주소창에 아무 값이나 와도 안전하다.
  const initialTab = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'results'
  const [activeTab, setActiveTab] = useState(initialTab)

  // 데이터를 아직 못 받은 구간(주소창 직접 진입 → openProject 왕복 중)은 그릴 것이 없다 —
  // 실패하면 위 이펙트가 곧 /library로 돌려보내므로 여기서 별도 오류 화면을 두지 않는다.
  // 다만 401(암호 필요)이면 **이 화면에서** 묻는다 — 목록으로 쫓아내지 않는다(위 주석).
  //
  // round10a 최종리뷰 M-6② — project 유무 분기를 <EnvGate> **안에서** 한다(위 파일
  // 머리주석 참조). 게이트 밖에 두면 이 구간(암호 모달·null)이 prod 에서도 그대로
  // 노출된다.
  return (
    <EnvGate>
      {!project ? (
        askPassword ? (
          <PasswordModal
            open
            error={pwError}
            busy={pwBusy}
            onCancel={handlePasswordCancel}
            onSubmit={handlePasswordSubmit}
          />
        ) : null
      ) : (
        <ReadOnlyProvider value={true}>
          <h2 className="sr_only">프로젝트 상세</h2>
          <div className="library_panel">
            <Link to="/library" className="text-[13px] text-[#5A6173] w-fit inline-flex items-center gap-1">
              ‹ 돌아가기
            </Link>

            {/* 머리: 검색 입력 박스 자리에 제목이 온다(결정 6) — 새 검색을 받는 대신
                무엇을 저장한 기록인지 보여준다. */}
            <div className="flex flex-wrap items-center gap-2">
              <strong className="section_tit">{project.title}</strong>
              {project.has_password && (
                <span className="library_card_lock" style={{ width: 'auto' }}>
                  <img src={icCertified} alt="" className="library_card_lock_icon" />
                  비밀번호
                </span>
              )}
            </div>
            <p className="library_card_desc">{project.description}</p>
            <div className="flex items-center gap-3">
              <p className="library_card_date">
                <img src={icCalendar} alt="" className="library_card_date_icon" />
                {formatCreatedAt(project.created_at)}
              </p>
              <span className="library_card_counts_item">
                <img src={icDocument} alt="" className="library_card_counts_icon" />
                산출물 {project.output_count}건
              </span>
            </div>

            {/* 읽기 전용 안내 — 회색 한 줄(spec Global Constraints: 읽기 전용 표현은
                회색 비활성이다. 여기는 막을 버튼이 없어 disabled/opacity-40 대신 문구
                자체를 회색으로 둔다). */}
            <p className="text-[12.5px] text-[#8A90A2]">
              저장된 기록이라 검색·생성은 할 수 없습니다 — 산출물은 내려받을 수 있습니다
            </p>

            {/* page_tabs — SearchFlowLayout의 마크업을 그대로 쓰되(클래스·aria-current
                동일), 라우트 전환이 아니라 지역 상태로 바꾼다(상세는 한 화면이다). */}
            <nav className="page_tabs" aria-label="프로젝트 상세 하위 메뉴">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="page_tabs_link"
                  {...(activeTab === t.key ? { 'aria-current': 'page' } : {})}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="result_wrap">
              {activeTab === 'results' && <ResultsTab />}
              {activeTab === 'chat' && (
                // round10 Task7 — 저장된 대화를 읽기 전용으로 재생한다(ChatTab 자체가
                // useReadOnly()로 입력창·전송·다시 생성을 스스로 지운다, Task6이 감싼
                // ReadOnlyProvider value=true 참조).
                //
                // ⚠️ round10 최종리뷰 I-4 — 대화 끝에 **이 프로젝트 스냅샷의 산출물**을
                // 한 묶음으로 둔다. 사용자 요구와 spec §5-4·결정 9는 「두 탭 모두에서
                // 산출물을 받을 수 있어야 한다」인데, 대화 안의 파일 카드는
                // ChatTab.captionTurns(서버에 저장하지 않는 지역 상태 — 결정 7)로만
                // 그려져 **복원된 대화에는 존재할 수 없다.** 그래서 이전에 물려주던
                // onDownloadOutput 콜백은 도달할 수 없는 배선이었고(걷어냈다), 그 자리를
                // 목록으로 대신한다.
                //
                // 어느 턴에서 만들어진 산출물인지는 복원할 수 없다 — 서버에 산출물↔턴
                // 연결이 없다(outputs는 conversation_id까지만 안다). 그래서 턴 사이에
                // 끼워 넣으려 하지 않고 대화 끝에 한 묶음으로 둔다.
                //
                // round10b Task D — 산출물생성 탭과 같은 컴포넌트를 재사용하되(새로
                // 만들지 않는다) **제목이 아니라 모양**으로 맥락을 준다. 예전에는
                // 「이 프로젝트에 저장된 산출물」 제목만 붙이고 나머지는 산출물생성
                // 탭과 똑같은 큰 그리드 카드였다 — 그래서 두 화면이 구분되지 않는다는
                // 지적을 받았다(2026-09-17). 사용자가 바로잡은 본뜻은 데이터 분리가
                // 아니라 모양이었다 — variant="chat" 가 피그마 완료 턴 모양
                // (figma-695-100384.txt:175-195)으로 통째로 바꾼다(ProjectOutputList.jsx
                // 머리 주석 참조).
                <>
                  {/* 안내는 대화 **위**에 둔다 — 대화가 길면 아래에 둔 한 줄은 스크롤
                      밖으로 밀려 「침묵하지 않는다」는 목적을 잃는다. */}
                  {conversationNotice && (
                    <p className="text-[12.5px] text-[#8A90A2]" role="status">
                      {conversationNotice}
                    </p>
                  )}
                  {/* round10 사용자 결정(2026-09-16) — 대화 탭의 주제 바도 저장한 제목으로
                      채운다. 저장된 기록을 보는 화면이라 질의문이 떠 있으면 「지금 이 질의로
                      대화 중」처럼 읽힌다. 프로젝트를 모르는 ChatTab 에 값만 내려 준다. */}
                  <ChatTab topicTitle={project.title} />
                  <ProjectOutputList projectId={projectId} variant="chat" />
                </>
              )}
              {activeTab === 'output' && (
                // round10 Task7 — OutputTab은 useReadOnly()로 노드·생성시작을 스스로
                // 비활성화하고, 읽기 전용일 때 자기 OutputList(소유자 전용, 대화로
                // 거른 "내 산출물")를 그리지 않는다(OutputTab.jsx의 `!readOnly &&
                // <OutputList/>` 참조). 그 자리를 ProjectOutputList가 대신한다 —
                // 그래서 이 화면 안에 산출물 목록이 정확히 하나만 뜬다.
                <>
                  <OutputTab />
                  <ProjectOutputList projectId={projectId} />
                </>
              )}
            </div>
          </div>
        </ReadOnlyProvider>
      )}
    </EnvGate>
  )
}
