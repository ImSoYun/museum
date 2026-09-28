import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import ProjectDetail from './ProjectDetail.jsx'
import { clearOpenedProjects } from '../state/openedProjects.js'
import { ScenarioContext, ScenarioProvider } from '../context/ScenarioContext.jsx'
import { AdminProvider } from '../state/AdminProvider.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { AuthContext } from '../context/AuthContext.jsx'

/**
 * 이 파일의 책임: 프로젝트 상세 셸(round10 Task6) — 제목 머리·3탭(지역 상태)·읽기 전용
 * 안내 한 줄·마운트 시 검색/대화 복원·암호 미보유 직접 진입 시 목록 복귀를 검증한다.
 *
 * ResultsTab 내부 동작(필터·다운로드 등)은 이 파일의 관심사가 아니다 — 여기서는 그것이
 * "검색결과" 탭의 기본 내용으로 실제로 마운트되는지만 본다. ResultsTab이 useScenario를
 * 쓰므로 ScenarioContext.Provider에 라이브 최소 계약(isLive·liveResults 등)을 직접
 * 주입한다(ResultsTab.live.test.jsx와 같은 관행 — ScenarioProvider/실 fetch를 거치지 않는다).
 *
 * round10 Task7 — listProjectOutputs·downloadProjectOutput도 이 모듈에서 나온다
 * (ChatTab/OutputTab을 채우며 ProjectDetail이 함께 가져다 쓰기 시작했다). 이 파일의
 * vi.mock 팩토리가 모듈 전체를 대체하므로 여기 없으면 "산출물생성" 탭을 실제로 렌더하는
 * 아래 새 테스트에서 ProjectOutputList의 `import { listProjectOutputs }`가 undefined를
 * 만나 죽는다 — 기존 테스트(검색결과 탭만 본다)는 이 탭을 열지 않아 원래도 영향이 없었다.
 */
vi.mock('../lib/projectsApi.js', () => ({
  openProject: vi.fn(),
  listProjectOutputs: vi.fn(),
  downloadProjectOutput: vi.fn(),
  // round10 최종리뷰 C-1 — 상세가 공유 열람용 대화 조회를 주입한다(ProjectDetail.jsx).
  getProjectConversation: vi.fn(),
}))
import { openProject, listProjectOutputs, getProjectConversation } from '../lib/projectsApi.js'

// 위치 탐침 — I-2(히스토리 state 소거)는 "지금 히스토리 엔트리에 state 가 남아 있는가"가
// 전부라 그 값을 그대로 노출해 단언한다(ProjectOutputList.test.jsx의 LandingProbe와 같은 관행).
function StateProbe() {
  const { state } = useLocation()
  return <div data-testid="nav-state">{state === null || state === undefined ? 'none' : 'kept'}</div>
}

const FIXTURE_PROJECT = {
  id: 'p1',
  title: '민주화운동 자료 모음',
  description: '4·19 혁명부터 6월 항쟁까지 자료 정리',
  author: '김연구',
  has_password: false,
  output_count: 3,
  search_query: '민주화운동',
  search_mode: 'meta',
  conversation_id: null,
  created_at: '2026-06-24T14:21:00Z',
}

function renderDetail({ project = FIXTURE_PROJECT, outputIds = [], path = '/library/p1', withState = true, ctxOverrides = {} } = {}) {
  const ctxValue = {
    isLive: true, liveResults: [], liveTotal: 0, page: 1, pageSize: 20,
    changePage: vi.fn(), facets: {}, holder: null, setHolder: vi.fn(),
    setScenarioByQuery: vi.fn(), resumeConversation: vi.fn(() => Promise.resolve({ ok: true })),
    // round10 최종리뷰 — 「AI 학예 도우미」 탭을 실제로 열어 보는 테스트가 생겨
    // ChatTab이 읽는 최소 계약도 함께 심는다(ChatTab.live.test.jsx의 baseCtx와 같은 값).
    activeScenario: { id: 'democracy', chat: [], materialIds: [] },
    lastQuery: '민주화운동', poolSize: 200,
    chatMessages: [], chatStatus: 'idle', chatNotice: null,
    conversationId: null, sendChatMessage: vi.fn(), bumpOutputsVersion: vi.fn(),
    ...ctxOverrides,
  }
  const entries = withState ? [{ pathname: path, state: { project, outputIds } }] : [path]
  const result = render(
    <ToastProvider>
      <ScenarioContext.Provider value={ctxValue}>
        <MemoryRouter initialEntries={entries}>
          <Routes>
            <Route path="/library/:projectId" element={<><ProjectDetail /><StateProbe /></>} />
            <Route path="/library" element={<div>라이브러리 목록</div>} />
          </Routes>
        </MemoryRouter>
      </ScenarioContext.Provider>
    </ToastProvider>
  )
  // round10a 최종리뷰 I-4 — 산출물 상세를 열었다 되돌아오는 것(state 없이 재마운트)을
  // 재현하려면 첫 마운트를 명시적으로 unmount 할 수 있어야 한다(openedProjects.js의
  // 모듈 메모리는 마운트를 넘나들어 남는다). 기존 반환값(ctxValue)의 필드는 그대로 두고
  // unmount만 얹는다 — 기존 테스트는 이 키를 보지 않으므로 영향이 없다.
  return { ...ctxValue, unmount: result.unmount }
}

beforeEach(() => {
  // round10a — 「이번 방문에서 이미 연 프로젝트」는 모듈 메모리다(openedProjects.js).
  // 테스트 사이에 남으면 다음 테스트가 openProject 를 아예 타지 않아 조용히 통과한다.
  clearOpenedProjects()
  openProject.mockReset()
  listProjectOutputs.mockReset()
  getProjectConversation.mockReset()
})

test('머리에 프로젝트 제목·설명·날짜가 뜨고, 질문 입력 박스는 없다', async () => {
  renderDetail()
  expect(await screen.findByText('민주화운동 자료 모음')).toBeInTheDocument()
  expect(screen.getByText('4·19 혁명부터 6월 항쟁까지 자료 정리')).toBeInTheDocument()
  expect(screen.getByText(/2026/)).toBeInTheDocument()
  // 검색 입력 박스 자리에 제목이 대신 온다(결정 6) — 질의 입력용 텍스트박스가 없다.
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
})

test('세 탭(검색결과·AI 학예 도우미·산출물생성)이 있고 기본은 검색결과다', async () => {
  renderDetail()
  await screen.findByText('민주화운동 자료 모음')
  expect(screen.getByRole('button', { name: '검색결과' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'AI 학예 도우미' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('button', { name: '산출물생성' })).toBeInTheDocument()
})

test('읽기 전용 안내 한 줄이 보인다', async () => {
  renderDetail()
  expect(
    await screen.findByText('저장된 기록이라 검색·생성은 할 수 없습니다 — 산출물은 내려받을 수 있습니다')
  ).toBeInTheDocument()
})

test('마운트하면 저장된 질의로 검색을 다시 실행한다', async () => {
  const ctx = renderDetail()
  await screen.findByText('민주화운동 자료 모음')
  await waitFor(() => expect(ctx.setScenarioByQuery).toHaveBeenCalledWith('민주화운동', { recordHistory: false }))
  expect(ctx.resumeConversation).not.toHaveBeenCalled()
})

test('대화 id가 있으면 그 대화를 불러온다', async () => {
  const project = { ...FIXTURE_PROJECT, conversation_id: 'c-1' }
  const ctx = renderDetail({ project })
  await screen.findByText('민주화운동 자료 모음')
  // round10 최종리뷰 C-1 — 두 번째 인자로 **프로젝트 경유 조회 함수**를 주입한다.
  await waitFor(() => expect(ctx.resumeConversation).toHaveBeenCalledWith('c-1', expect.any(Function)))
  // 그 함수가 실제로 프로젝트 경유 경로를 부르는지까지 확인한다 — 함수를 넘겼다는
  // 사실만 보면 안쪽이 소유자 전용 경로여도 초록이다.
  ctx.resumeConversation.mock.calls[0][1]('c-1')
  expect(getProjectConversation).toHaveBeenCalledWith('p1', 'c-1')
  // ⚠️ round10 결정 — resumeConversation 자체가 검색까지 되살린다(ScenarioContext.jsx:579-640,
  // fetchPage를 내부에서 직접 부른다). 여기서 setScenarioByQuery까지 함께 부르면 검색
  // 요청이 두 번 나가 서로 경쟁한다 — 그래서 대화 id가 있으면 setScenarioByQuery는 부르지
  // 않는다(브리프 Step2 지시와 다른 부분 — task-6-brief.md ⚠️ 절 참조).
  expect(ctx.setScenarioByQuery).not.toHaveBeenCalled()
})

// round10(2026-09-16 라이브 검증, 사용자 지적) — 401 은 **이 화면에서** 묻는다.
// 예전에는 목록으로 돌려보냈는데, 이 화면은 되돌아올 때마다 openProject 를 타므로
// 잠긴 프로젝트에서는 산출물 상세를 열었다가 돌아오는 것조차 막혔다(목록으로 튕김).
test('암호가 필요하면 목록으로 쫓아내지 않고 이 화면에서 암호를 묻는다', async () => {
  openProject.mockResolvedValue({ ok: false, status: 401 })
  renderDetail({ withState: false })
  expect(await screen.findByText('프로젝트 암호 입력')).toBeInTheDocument()
  expect(screen.queryByText('라이브러리 목록')).not.toBeInTheDocument()
  expect(openProject).toHaveBeenCalledWith('p1')
})

test('암호를 맞히면 그 자리에서 상세가 열린다', async () => {
  openProject
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValue({ ok: true, status: 200, project: FIXTURE_PROJECT, outputIds: [] })
  renderDetail({ withState: false })
  fireEvent.change(await screen.findByPlaceholderText('암호를 입력하세요'), { target: { value: '1234' } })
  fireEvent.click(screen.getByText('네'))
  expect(await screen.findByText(FIXTURE_PROJECT.title)).toBeInTheDocument()
  expect(openProject).toHaveBeenLastCalledWith('p1', '1234')
})

test('암호가 틀리면 모달을 닫지 않고 알린다', async () => {
  openProject
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValue({ ok: false, status: 403 })
  renderDetail({ withState: false })
  fireEvent.change(await screen.findByPlaceholderText('암호를 입력하세요'), { target: { value: '0000' } })
  fireEvent.click(screen.getByText('네'))
  expect(await screen.findByText('암호가 맞지 않습니다')).toBeInTheDocument()
  expect(screen.getByText('프로젝트 암호 입력')).toBeInTheDocument()
})

// ── round10 Task7 — 산출물생성 탭의 목록은 정확히 하나다 ────────────────────────
// ⚠️ 반드시 짚고 갈 것(task-7-brief.md) — OutputTab의 하단 OutputList는 "지금
// 로그인한 사람 자신의" 산출물을 대화 id로 걸러 서버에서 읽는다. 그대로 두면 남의
// 프로젝트를 열어 보는 이 화면에 그 프로젝트와 무관한 내 산출물이 뜬다. OutputTab이
// 읽기 전용일 때 자기 목록을 그리지 않는 것(OutputTab.test.jsx가 컴포넌트 단위로
// 잠근다)과 ProjectOutputList가 그 자리를 대신하는 것(ProjectOutputList.test.jsx가
// 그 목록 자체를 잠근다)을 **실제로 같은 화면에 함께 마운트해** 목록 컨테이너가
// 하나만 뜨는지 여기서 통합으로 잠근다 — 이 파일이 상세 화면 전체를 렌더하는
// 유일한 자리이기 때문이다.
//
// 이 테스트만 실 ScenarioProvider·AdminProvider를 쓴다(다른 테스트의 손으로 만든
// ScenarioContext.Provider에는 OutputTab이 읽는 graph·outputsVersion 등이 없다) —
// 데모 모드(VITE_API_BASE_URL 미설정인 테스트 환경)라 실제 네트워크 요청 없이
// 동기적으로 동작한다(ScenarioContext.jsx의 setScenarioByQuery 비라이브 분기).
// round10(2026-09-16 라이브 검증) — 복원용 검색은 `recordHistory:false` 로 부른다.
// 그 인자가 빠지면 프로젝트를 **열어 보기만 해도** 「나의 기록」에 대화가 한 줄씩
// 쌓인다(읽기 전용 약속과 어긋난다). 그래서 인자까지 함께 잠근다.
test('산출물생성 탭에는 산출물 목록이 정확히 하나만 뜬다(OutputTab 자기 목록과 ProjectOutputList 중복 방지)', async () => {
  listProjectOutputs.mockResolvedValue({
    ok: true,
    outputs: [{
      id: 'o1', kind: 'exhibit', title: '전시자료 하나',
      file_name: '전시자료 하나.xlsx', file_bytes: 1024,
      created_at: '2026-06-01T00:00:00Z',
    }],
  })
  const { container } = render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter
            initialEntries={[{ pathname: '/library/p1', state: { project: FIXTURE_PROJECT, outputIds: [] } }]}
          >
            <Routes>
              <Route path="/library/:projectId" element={<ProjectDetail />} />
            </Routes>
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )

  await screen.findByText('민주화운동 자료 모음')
  fireEvent.click(screen.getByRole('button', { name: '산출물생성' }))

  await waitFor(() => expect(listProjectOutputs).toHaveBeenCalledWith('p1'))
  await screen.findByText(/전시자료 하나/)

  // 목록 컨테이너(.output_list — OutputList.jsx와 ProjectOutputList.jsx가 함께
  // 쓰는 클래스)가 정확히 하나, 그 안의 카드도 정확히 하나(중복 렌더가 있었다면
  // 이 값이 늘어난다).
  expect(container.querySelectorAll('.output_list')).toHaveLength(1)
  expect(container.querySelectorAll('[data-testid="output-card-o1"]')).toHaveLength(1)
})

// ── round10 최종리뷰 C-1 — 복원 실패 갈래 ──────────────────────────────────────
// 이 파일은 지금까지 resumeConversation을 **성공만** 고정해(`{ok:true}`) 이 결함을
// 통째로 놓쳤다. 실패하면 화면이 아무 것도 하지 않아, 열람자 자신의 직전 검색·직전
// 대화가 남의 프로젝트 제목 아래 그대로 남아 있었다(토스트도 없었다).
test('대화 복원이 실패하면 저장된 질의로 검색을 되살리고 대화 탭에 한 줄로 알린다', async () => {
  const project = { ...FIXTURE_PROJECT, conversation_id: 'c-1' }
  const ctx = renderDetail({
    project,
    ctxOverrides: { resumeConversation: vi.fn(() => Promise.resolve({ ok: false, status: 404 })) },
  })
  await screen.findByText('민주화운동 자료 모음')

  // ⓐ 검색 폴백 — 최소한 검색결과 탭은 이 프로젝트의 것이 된다(이 호출이
  //    runLiveSearch를 태워 이전 대화 상태까지 함께 비운다).
  await waitFor(() => expect(ctx.setScenarioByQuery).toHaveBeenCalledWith('민주화운동', { recordHistory: false }))

  // ⓑ 대화 탭에 한 줄(spec §6 — 침묵하지 않는다).
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [] })
  fireEvent.click(screen.getByRole('button', { name: 'AI 학예 도우미' }))
  expect(
    await screen.findByText('저장된 대화를 불러오지 못했습니다 — 검색결과만 보여 드립니다')
  ).toBeInTheDocument()
})

test('대화 복원이 성공하면 검색 폴백도 안내도 없다', async () => {
  const project = { ...FIXTURE_PROJECT, conversation_id: 'c-1' }
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [] })
  const ctx = renderDetail({ project })
  await screen.findByText('민주화운동 자료 모음')
  await waitFor(() => expect(ctx.resumeConversation).toHaveBeenCalled())
  expect(ctx.setScenarioByQuery).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'AI 학예 도우미' }))
  expect(
    screen.queryByText('저장된 대화를 불러오지 못했습니다 — 검색결과만 보여 드립니다')
  ).toBeNull()
})

// ── round10 최종리뷰 I-2 — navigate state 는 이번 내비게이션에만 유효하다 ───────
// createBrowserRouter는 state를 window.history.state.usr에 **영속**시킨다. 그대로 두면
// 암호 프로젝트에 들어간 뒤 F5(또는 뒤로→앞으로)에서 state가 되살아나 openProject를
// 건너뛰고 상세가 그냥 뜬다 — 결정 2(「암호는 기억하지 않는다」) 위반이다.
test('마운트가 navigate state 를 쓰고 나면 히스토리에서 지운다', async () => {
  renderDetail()
  await screen.findByText('민주화운동 자료 모음')
  // 화면은 그대로 뜨고(이번 마운트는 그 값을 이미 썼다)…
  expect(screen.getByText('4·19 혁명부터 6월 항쟁까지 자료 정리')).toBeInTheDocument()
  // …히스토리 엔트리에는 값이 남지 않는다 — 새로고침이면 state 없이 다시 들어온다.
  await waitFor(() => expect(screen.getByTestId('nav-state')).toHaveTextContent('none'))
  // 암호 없는 프로젝트에 새 왕복을 만들지 않는다(이번 마운트는 openProject를 타지 않는다).
  expect(openProject).not.toHaveBeenCalled()
})

test('state 없이 들어오면(=새로고침·앞으로가기) openProject 를 다시 타고 암호를 묻는다', async () => {
  // 위 테스트가 지운 그 상태에서 다시 들어오는 것과 같은 조건이다 — 암호 프로젝트라면
  // 여기서 401을 만나고, 이제는 **이 화면이** 묻는다(목록으로 쫓아내지 않는다).
  openProject.mockResolvedValue({ ok: false, status: 401 })
  renderDetail({ withState: false })
  expect(await screen.findByText('프로젝트 암호 입력')).toBeInTheDocument()
  expect(openProject).toHaveBeenCalledWith('p1')
})

// ── round10 최종리뷰 I-4 — AI 학예 도우미 탭에서도 산출물을 받을 수 있다 ────────
// 사용자 요구·spec §5-4·결정 9: 「두 탭 모두 산출물 다운로드가 가능해야 한다」.
// 대화 안의 파일 카드는 복원되지 않으므로(captionTurns는 서버에 없다) 대화 끝에
// 스냅샷 목록을 한 묶음으로 둔다.
//
// round10b Task D — 큰 그리드 카드 + 제목(「이 프로젝트에 저장된 산출물」)은
// 산출물생성 탭과 구분되지 않는다는 지적을 받아 피그마 완료 턴 모양(695:100384)으로
// 바꿨다(2026-09-17 사용자 정정 — 데이터 분리(source 컬럼)가 아니라 모양이 문제였다).
// 제목은 없앤다 — 모양 자체가 「대화에서 만든 산출물」이라는 맥락을 말해 준다.
test('AI 학예 도우미 탭 끝에 이 프로젝트의 산출물이 완료 카드 모양으로 뜬다', async () => {
  listProjectOutputs.mockResolvedValue({
    ok: true,
    outputs: [{
      id: 'o1', kind: 'caption', title: '설명문 하나', summary: '카드 본문',
      file_name: '설명문 하나.docx', file_bytes: 2048,
      created_at: '2026-06-01T00:00:00Z',
    }],
  })
  renderDetail()
  await screen.findByText('민주화운동 자료 모음')
  fireEvent.click(screen.getByRole('button', { name: 'AI 학예 도우미' }))

  await waitFor(() => expect(listProjectOutputs).toHaveBeenCalledWith('p1'))
  expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
  expect(screen.queryByText('이 프로젝트에 저장된 산출물')).toBeNull()
  expect(await screen.findByText(/설명문 하나/)).toBeInTheDocument()
  // 다운로드 버튼이 실제로 있다(허용 목록 — 다운로드. 선택·삭제는 없다 — spec §5-5).
  expect(screen.getByRole('button', { name: '설명문 하나 다운로드' })).toBeInTheDocument()
})

// ── round10a 최종리뷰 I-4 — 가장 흔한 경로(목록에서 카드 클릭)도 되돌아올 때 다시
// 묻지 않아야 한다 ────────────────────────────────────────────────────────────
// location.state 로 들어온 값은 openProject 성공·암호 제출 성공과 같은 신뢰 수준이다
// (셋 다 서버가 이미 내어 준 값). 여기서 기억해 두지 않으면, 목록에서 카드를 눌러
// 들어온(가장 흔한) 사람이 산출물 상세를 열었다 「이전 화면 돌아가기」로 돌아올 때
// (그 사이 history state 는 지워진다, I-2) openProject 를 다시 타 버려 비소유자는
// 방금 확인한 암호를 또 입력해야 한다 — 소유자는 서버 면제(결정 2-b)에 가려 이 결함이
// 라이브 검증에서 드러나지 않았다.
test('목록에서 카드를 눌러 들어온 값도 기억해 두어, 되돌아올 때(state 없이) 암호를 다시 묻지 않는다', async () => {
  const lockedProject = { ...FIXTURE_PROJECT, has_password: true }
  // 혹시 기억이 안 됐다면(=결함이 그대로라면) 두 번째 마운트가 401을 만나 암호를 묻는다 —
  // 그 경로가 실제로 열리는지까지 눈에 보이게 만들어 둔다.
  openProject.mockResolvedValue({ ok: false, status: 401 })

  // 1) 목록에서 카드를 눌러 들어온다 — location.state 로 이미 검증된 값이 온다.
  const first = renderDetail({ project: lockedProject })
  await screen.findByText(lockedProject.title)
  first.unmount()

  // 2) 산출물 상세를 열었다 「이전 화면 돌아가기」로 되돌아온 것과 같다 — state 없음.
  renderDetail({ project: lockedProject, withState: false })
  expect(await screen.findByText(lockedProject.title)).toBeInTheDocument()
  // 암호가 걸린 프로젝트인데도 openProject 왕복(=암호 재확인) 없이 그대로 열린다.
  expect(openProject).not.toHaveBeenCalled()
  expect(screen.queryByText('프로젝트 암호 입력')).not.toBeInTheDocument()
})

// ── round10a 최종리뷰 M-6② — 암호 모달 분기가 게이트 밖에 있으면 prod 에서도 노출된다 ──
// envGates.js 의 HIDDEN_BY_ENV.prod['/library']는 이 경로도 숨김 대상이고,
// PAGE_LEVEL_PREFIXES 에 '/library'가 올라 있어 그 판정은 셸(AppShell)이 아니라 이
// 페이지 자신의 <EnvGate>가 한다(envGates.js 머리주석·isShellLevelGated 참조). 암호를
// 묻는 분기가 그 게이트 밖에 있으면, 잠긴 프로젝트 URL 로 직접 들어온 사람에게 prod
// 에서도 「준비 중」 대신 암호 입력 모달이 그대로 뜬다 — 예전 `return null`은 최소한
// 아무것도 노출하지 않았는데 그보다 나빠진 것이다.
test('prod 에서는 암호를 묻는 대신 준비 중이 뜬다(암호 모달도 EnvGate 안에 있다)', async () => {
  openProject.mockResolvedValue({ ok: false, status: 401 })
  render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <ScenarioContext.Provider
          value={{
            isLive: true, liveResults: [], liveTotal: 0, page: 1, pageSize: 20,
            changePage: vi.fn(), facets: {}, holder: null, setHolder: vi.fn(),
            setScenarioByQuery: vi.fn(), resumeConversation: vi.fn(() => Promise.resolve({ ok: true })),
            activeScenario: { id: 'democracy', chat: [], materialIds: [] },
            lastQuery: '민주화운동', poolSize: 200,
            chatMessages: [], chatStatus: 'idle', chatNotice: null,
            conversationId: null, sendChatMessage: vi.fn(), bumpOutputsVersion: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/library/p1']}>
            <Routes>
              <Route path="/library/:projectId" element={<ProjectDetail />} />
            </Routes>
          </MemoryRouter>
        </ScenarioContext.Provider>
      </ToastProvider>
    </AuthContext.Provider>
  )
  expect(await screen.findByText('준비 중입니다')).toBeInTheDocument()
  expect(screen.queryByText('프로젝트 암호 입력')).not.toBeInTheDocument()
})
