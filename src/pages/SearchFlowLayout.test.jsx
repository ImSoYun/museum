import { useState } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { ScenarioContext } from '../context/ScenarioContext.jsx'
import { AuthContext } from '../context/AuthContext.jsx'
import SearchFlowLayout from './SearchFlowLayout.jsx'

// round07b-ext T13 — 이 셸이 탭 뱃지용으로 listOutputs를 직접 부르기 시작했다.
// 목하지 않으면 이 파일의 모든 테스트가 real fetch를 내보낸다(OutputTab.test.jsx와
// 같은 이유). new_count:2는 아래 "뱃지" 테스트가 기대하는 값과 같다 — 서버 계약
// 테스트(test_outputs_endpoint.py)가 "3건 중 1건 열람 → new_count 2"를 잠갔으므로
// 프론트 목도 같은 숫자를 쓴다.
const listOutputs = vi.fn().mockResolvedValue({
  ok: true, data: { outputs: [], has_more: false, new_count: 2 },
})
// isLive: 목 모듈이라 실제 env를 안 본다. 기본 true 로 둬야 데모 모드 게이트를
// 통과해 기존 조회 경로가 그대로 검증된다(맨 아래 「데모 모드」 테스트만 false).
const isLive = vi.fn(() => true)
// round07e D — 딥링크 재개. 실제 컨텍스트가 항상 주는 값이라 목에도 넣는다.
const resumeConversation = vi.fn(() => Promise.resolve({ ok: true }))
vi.mock('../lib/outputsApi.js', () => ({
  isLive: (...a) => isLive(...a),
  listOutputs: (...a) => listOutputs(...a),
}))

function renderAt(path, ctx = {}) {
  const value = { isLive: true, lastQuery: '민주화운동', conversationId: 'c-1',
                  setScenarioByQuery: vi.fn(), resumeConversation, ...ctx }
  render(
    <ScenarioContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/search" element={<SearchFlowLayout />}>
            <Route path="results" element={<div>결과본문</div>} />
            <Route path="chat" element={<div>대화본문</div>} />
            {/* round07f 최종 리뷰 I-2 — 상세 화면을 **실제로 마운트**하기 위한 두 줄.
                이게 없으면 /search/output/o1 로 렌더해도 Outlet 이 비어 탭 판정
                (startsWith)을 관측할 수 없다. 상세는 이 라운드가 신설한 자식
                라우트라 셸이 그 경로에서 어떻게 보이는지가 계약이다. */}
            <Route path="output" element={<div>산출물본문</div>} />
            <Route path="output/:outputId" element={<div>상세본문</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ScenarioContext.Provider>
  )
  return value
}

test('page_tabs 3링크가 렌더되고 현재 경로 탭이 aria-current=page', () => {
  renderAt('/search/results?c=c-1')
  expect(screen.getByRole('link', { name: '검색결과' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toBeInTheDocument()
})

test('page_tabs 링크는 현재 ?c 를 유지한다', () => {
  renderAt('/search/results?c=abc')
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).toHaveAttribute('href', '/search/chat?c=abc')
})

// round07b-ext T13 — 탭 뱃지(피그마 「산출물생성 2」). 위 mock의 new_count:2가 그대로
// 화면에 나오는지 본다 — has_more 같은 다른 필드를 읽거나 뱃지를 안 그리면 실패한다.
test('산출물생성 탭에 미열람 건수 뱃지가 붙는다', async () => {
  renderAt('/search/results?c=c-1')
  expect(await screen.findByRole('link', { name: /산출물생성/ })).toHaveTextContent('2')
})

// 이 셸은 react-router **레이아웃 라우트**라 /search/* 탭을 오가도 리마운트되지 않는다.
// 이펙트 의존성이 []이던 시절엔 산출물을 만들거나 열거나 지워도 뱃지가 최초 값에
// 영영 멈춰 있었다 — 그 신호(ScenarioContext.outputsVersion)를 실제로 구독하는지 본다.
test('outputsVersion 이 바뀌면 뱃지를 다시 읽는다(리마운트 없이)', async () => {
  const base = { isLive: true, lastQuery: '민주화운동', conversationId: 'c-1',
                 setScenarioByQuery: vi.fn(), resumeConversation, outputsVersion: 0 }
  const tree = (value) => (
    <ScenarioContext.Provider value={value}>
      <MemoryRouter initialEntries={['/search/results']}>
        <Routes>
          <Route path="/search" element={<SearchFlowLayout />}>
            <Route path="results" element={<div>결과본문</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ScenarioContext.Provider>
  )
  const { rerender } = render(tree(base))
  expect(await screen.findByRole('link', { name: /산출물생성/ })).toHaveTextContent('2')

  listOutputs.mockResolvedValue({
    ok: true, data: { outputs: [], has_more: false, new_count: 5 },
  })
  rerender(tree({ ...base, outputsVersion: 1 }))

  await waitFor(() =>
    expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveTextContent('5'))
})

// 데모 모드(VITE_API_BASE_URL 미설정)는 백엔드가 없다 — 뱃지 조회도 나가지 않는다.
test('데모 모드에서는 뱃지 조회를 하지 않는다', async () => {
  // 이 파일은 목을 자동 초기화하지 않는다(앞선 테스트들의 호출이 누적돼 있다) —
  // "이번 렌더에서 부르지 않았다"를 보려면 여기서 직접 지운다.
  listOutputs.mockClear()
  isLive.mockReturnValue(false)
  renderAt('/search/results?c=c-1')

  expect(await screen.findByRole('link', { name: /산출물생성/ })).toBeInTheDocument()
  expect(listOutputs).not.toHaveBeenCalled()
  isLive.mockReturnValue(true)
})

test('검색바 제출이 setScenarioByQuery를 호출한다', () => {
  const v = renderAt('/search/results?c=c-1')
  fireEvent.change(screen.getByLabelText('검색어'), { target: { value: '6월항쟁' } })
  fireEvent.submit(screen.getByLabelText('검색어').closest('form'))
  expect(v.setScenarioByQuery).toHaveBeenCalledWith('6월항쟁')
})

// ── round06f 갈래 E(spec §10.3): prod에서도 '산출물생성' 탭은 남고 본문만 준비중이다 ──
// round06e는 이 탭을 목록에서 뺐다 — 그때는 AppShell이 /search/output을 통째로
// 갈아치워 검색바까지 사라졌기 때문이다. round06f가 그 게이트를 페이지 레벨로 내려서,
// 이제 탭은 그대로 두고 본문만 준비중이 된다(사용자 요구 그대로 — spec §2-5).
//
// 위 renderAt은 AuthContext를 감싸지 않아 useAuth() 폴백(appEnv:'local')을 타므로
// prod 판정을 관찰할 수 없다. 그래서 appEnv를 주입하고 output 라우트까지 등록한
// 헬퍼를 따로 둔다(테스트 파일 간 import 금지 관례상 이 파일 안에 둔다).
function renderAtEnv(path, appEnv = 'prod') {
  const value = { isLive: true, lastQuery: '민주화운동', conversationId: 'c-1',
                  setScenarioByQuery: vi.fn(), resumeConversation }
  return render(
    <AuthContext.Provider value={{ appEnv }}>
      <ScenarioContext.Provider value={value}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/search" element={<SearchFlowLayout />}>
              <Route path="results" element={<div>결과본문</div>} />
              <Route path="output" element={<div>산출물본문</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ScenarioContext.Provider>
    </AuthContext.Provider>
  )
}

test('prod 환경: 산출물생성 탭이 목록에 그대로 남는다(round06e의 목록 제외를 되돌린다)', () => {
  renderAtEnv('/search/results?c=c-1')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '검색결과' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).toBeInTheDocument()
})

test('prod 환경: /search/output은 본문만 준비중이고 검색바·탭줄은 사라지지 않는다', () => {
  renderAtEnv('/search/output?c=c-1')
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(screen.queryByText('산출물본문')).toBeNull()
  // DoD 7의 "검색바·탭줄은 사라지지 않는다"를 이 두 줄이 잠근다.
  expect(screen.getByLabelText('검색어')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveAttribute('aria-current', 'page')
})

test('local 환경: /search/output 본문이 정상 렌더된다(게이트는 prod에서만 닫힌다)', () => {
  renderAtEnv('/search/output?c=c-1', 'local')
  expect(screen.getByText('산출물본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

// ── round06f R6F-27(spec §5): 라이브 로딩·브리핑 스트리밍 중 대화·산출물 탭 게이팅 ──
// 결과가 아직 없거나(loading) 브리핑이 스트리밍 중(briefStatus='loading')이면 "결과기반
// AI 대화"·"산출물생성" 탭으로 건너뛸 수 없다 — 후보풀이 비어 있는 채로 대화가 시작되는
// 반쪽 상태를 막기 위해서다. "검색결과" 탭은 항상 열려 있다.

test('라이브 loading=true: 대화·산출물 탭이 aria-disabled고, 검색결과 탭은 그대로 정상이다', () => {
  renderAt('/search/results?c=c-1', { loading: true })
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveAttribute('aria-disabled', 'true')
  const resultsLink = screen.getByRole('link', { name: '검색결과' })
  expect(resultsLink).not.toHaveAttribute('aria-disabled')
  expect(resultsLink).toHaveAttribute('aria-current', 'page')
})

test('라이브 loading=true: 비활성 탭을 클릭해도 이동하지 않는다(preventDefault)', () => {
  renderAt('/search/results?c=c-1', { loading: true })
  fireEvent.click(screen.getByRole('link', { name: /AI 학예 도우미/ }))
  // 이동이 없어야 한다 — preventDefault 누락이면 여기서 걸린다(Lnb.test.jsx와 동일 관행)
  expect(screen.getByText('결과본문')).toBeInTheDocument()
  expect(screen.queryByText('대화본문')).toBeNull()
})

test('라이브 briefStatus="loading"(브리핑 스트리밍 중): loading이 꺼져 있어도 대화·산출물 탭이 비활성화된다', () => {
  renderAt('/search/results?c=c-1', { loading: false, briefStatus: 'loading' })
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveAttribute('aria-disabled', 'true')
})

test('라이브 결과·브리핑 모두 종결(briefStatus="ok"): 탭이 다시 활성화되고 정상 이동한다', () => {
  renderAt('/search/results?c=c-1', { loading: false, briefStatus: 'ok' })
  const chatLink = screen.getByRole('link', { name: /AI 학예 도우미/ })
  expect(chatLink).not.toHaveAttribute('aria-disabled')
  fireEvent.click(chatLink)
  expect(screen.getByText('대화본문')).toBeInTheDocument()
})

test('라이브 브리핑이 error로 종결돼도 탭은 활성화된다(loading만 아니면 종결로 취급 — ok/error 구분 없음)', () => {
  renderAt('/search/results?c=c-1', { loading: false, briefStatus: 'error' })
  expect(screen.getByRole('link', { name: /산출물생성/ })).not.toHaveAttribute('aria-disabled')
})

test('비라이브(isLive=false): loading=true여도 탭 게이팅이 적용되지 않는다(더미 모드 무영향)', () => {
  renderAt('/search/results?c=c-1', { isLive: false, loading: true, briefStatus: 'loading' })
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).not.toHaveAttribute('aria-disabled')
  expect(screen.getByRole('link', { name: /산출물생성/ })).not.toHaveAttribute('aria-disabled')
})


// ─────────────────────────────────────────────────────────────────────────
// round07e D — 새로고침해도 대화가 살아 있어야 한다.
//
// 이전에는 `?c=` 가 탭 링크를 만드는 데만 쓰였다. F5 를 누르면 컨텍스트가
// 초기값으로 돌아가고 graph 가 null 이 되며, OutputTab 이 하드코딩 데모를
// **조용히** 그렸다 — 학예사가 「4·19 혁명 3건」 같은 가짜 숫자를 진짜로 읽는다.
describe('?c= 딥링크 재개', () => {
  beforeEach(() => { resumeConversation.mockClear() })

  it('컨텍스트가 그 대화를 아직 모르면 재개한다', async () => {
    renderAt('/search/results?c=c-9', { conversationId: null })
    await waitFor(() => expect(resumeConversation).toHaveBeenCalledWith('c-9'))
  })

  it('이미 그 대화를 들고 있으면 재개하지 않는다', async () => {
    // 탭을 오갈 때마다 재개가 도는 것을 막는 가드다 — 이 셸은 레이아웃
    // 라우트라 /search/* 안에서는 리마운트되지 않는다.
    renderAt('/search/results?c=c-1', { conversationId: 'c-1' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    expect(resumeConversation).not.toHaveBeenCalled()
  })

  it('?c= 가 없으면 재개하지 않는다', async () => {
    renderAt('/search/results', { conversationId: null })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    expect(resumeConversation).not.toHaveBeenCalled()
  })

  it('데모 모드에서는 재개하지 않는다 — 서버가 없다', async () => {
    renderAt('/search/results?c=c-9', { isLive: false, conversationId: null })
    expect(resumeConversation).not.toHaveBeenCalled()
  })

  // round07f 최종 리뷰 I-1 — **상세 화면에서의 F5 도 복원돼야 한다.**
  //
  // I-1 이 고친 것은 「c 를 이어 나르는 쪽(링크·네비게이션)」이고, 그것이 실제로
  // 무엇을 되살리는지는 여기서 확인한다: 상세는 이 셸의 자식 라우트이므로,
  // /search/output/:id?c=… 를 **처음부터 그 주소로** 열면(=F5·북마크) 이 셸이
  // 마운트되며 재개 이펙트가 돌아야 한다. `?c=` 를 떨어뜨렸던 동안에는 이 자리에서
  // target 이 null 이라 재개가 아예 시작되지 않았다 —
  // 검색어·노드 그래프·대화가 통째로 사라지던 원인이 그것이다.
  it('상세 화면을 ?c= 로 직접 열면(F5·북마크) 대화를 재개한다', async () => {
    renderAt('/search/output/o1?c=c-9', { conversationId: null })
    await waitFor(() => expect(resumeConversation).toHaveBeenCalledWith('c-9'))
  })

  it('상세 화면에 ?c= 가 없으면 재개할 근거가 없다 — I-1 이 막으려는 바로 그 상태다', async () => {
    renderAt('/search/output/o1', { conversationId: null })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    expect(resumeConversation).not.toHaveBeenCalled()
  })
})

// ── round07f 최종 리뷰 I-2 ─────────────────────────────────────────────────────
// 이 라운드가 상세를 **독립 라우트**로 승격하면서 탭 판정을 `===` 에서
// `startsWith` 로 바꿨다. 그런데 어떤 테스트도 상세 경로를 마운트하지 않아,
// `startsWith` 를 `===` 로 되돌려도 1401건이 전부 초록이었다(항진명제).
// 되돌아가면 실제로는 ① 「산출물생성」 탭의 하이라이트가 풀려 사용자가 자기가
// 어느 탭에 있는지 알 수 없고 ② sr_only 제목이 「검색결과」라고 거짓말한다
// (스크린리더 사용자에게 화면 이름이 틀리게 읽힌다).
test('상세 경로(/search/output/:id)에서도 산출물생성 탭이 aria-current=page 다', () => {
  renderAt('/search/output/o1?c=c-1')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveAttribute('aria-current', 'page')
  // 다른 탭까지 함께 켜지면(접두어 판정이 헐거우면) 그것도 거짓말이다.
  expect(screen.getByRole('link', { name: '검색결과' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('link', { name: /AI 학예 도우미/ })).not.toHaveAttribute('aria-current')
})

test('상세 경로의 sr_only 제목은 「산출물생성」이다', () => {
  renderAt('/search/output/o1?c=c-1')
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('산출물생성')
})

// 목록 경로에서도 같은 판정이 성립해야 한다 — startsWith 로 바꾼 뒤 목록 쪽이
// 조용히 깨지지 않았는지 함께 본다(세 탭 경로는 서로의 접두어가 아니다).
test('목록 경로(/search/output)에서도 산출물생성 탭이 켜진다', () => {
  renderAt('/search/output?c=c-1')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('산출물생성')
})

// 탭 링크의 목적지는 상세에서도 **목록**이다 — 상세 경로를 그대로 이어 붙여
// /search/output/o1?c= 로 만들면 탭이 자기 자신을 가리켜 되돌아갈 길이 없어진다.
test('상세에서도 산출물생성 탭 링크는 목록으로 간다(?c 유지)', () => {
  renderAt('/search/output/o1?c=abc')
  expect(screen.getByRole('link', { name: /산출물생성/ })).toHaveAttribute(
    'href', '/search/output?c=abc')
})

// round07g Task4 — 검색모드 토글은 **채팅 입력 바에서만** 사라졌다(피그마 채팅 화면에
// 그 위젯이 없다). 재검색바의 토글은 그대로다(spec 결정 10) — 셋 중 하나만 뺀 것이라
// 「보이니까 지우자」로 나머지가 따라 사라지지 않게 여기서 잠근다. 짝이 되는 단언
// (채팅에는 없고 첫 검색바에는 있다)은 ChatTab.test.jsx 맨 아래에 있다.
test('재검색바의 검색모드 토글은 그대로 남아 있다(채팅 입력 바에서만 뺐다)', () => {
  renderAt('/search/results?c=c-1')
  const toggle = screen.getByRole('button', { name: '검색 대상 선택' })
  expect(document.querySelector('.result_query_bar').contains(toggle)).toBe(true)
})

// round07g — **뱃지도 목록과 같은 대화 범위다.**
//
// 탭에는 보이지도 않는 산출물이 뱃지에만 세어지면 그 숫자가 거짓말이 된다
// (「산출물생성 5」인데 열어 보면 1건). 목록(OutputList)이 `?c=` 로 좁히므로
// 뱃지도 같은 값으로 좁혀야 한다 — 아래 셋이 그 한 축을 잠근다.
test('뱃지 조회가 주소의 ?c= 를 실어 보낸다', async () => {
  listOutputs.mockClear()
  renderAt('/search/results?c=conv-URL')
  await waitFor(() =>
    expect(listOutputs).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-URL' })))
})

test('주소에 없으면 컨텍스트 conversationId 로 떨어진다', async () => {
  listOutputs.mockClear()
  renderAt('/search/results', { conversationId: 'conv-CTX' })
  await waitFor(() =>
    expect(listOutputs).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-CTX' })))
})

test('뱃지가 세는 대화와 탭 링크가 실어 보내는 대화가 같다', async () => {
  listOutputs.mockClear()
  renderAt('/search/results?c=conv-URL')
  // 탭 링크가 나르는 값
  expect(screen.getByRole('link', { name: /산출물생성/ }))
    .toHaveAttribute('href', '/search/output?c=conv-URL')
  // 뱃지가 센 범위
  await waitFor(() => expect(listOutputs).toHaveBeenCalled())
  expect(listOutputs.mock.calls[0][0].conversationId).toBe('conv-URL')
})

// round07g 수정 R1 — **대화를 모르면 뱃지도 세지 않는다.**
//
// 목록(OutputList)이 그때 조회를 멈추는 것이 이번 수정의 본체다. 뱃지만 예전대로
// 서버 기본값(내 전체)을 받으면 「산출물생성 5」라고 써 놓고 눌러 들어가면 0건이다 —
// 뱃지 숫자가 다른 대화 것을 세고 있다는 뜻이라, 사용자가 신고한 증상이 숫자 쪽에
// 그대로 남는다. 두 자리는 같은 격리 축을 쓴다.
test('대화를 모르면 뱃지 조회를 하지 않는다', async () => {
  listOutputs.mockClear()
  renderAt('/search/results', { conversationId: null })
  // 탭은 그려지되(셸은 어느 환경에서도 사라지지 않는다) 조회는 나가지 않는다.
  expect(await screen.findByRole('link', { name: /산출물생성/ })).toBeInTheDocument()
  expect(listOutputs).not.toHaveBeenCalled()
})

test('대화를 모르면 뱃지 숫자도 붙지 않는다 — 옛 숫자가 남지 않는다', async () => {
  listOutputs.mockClear()
  renderAt('/search/results', { conversationId: null })
  const link = await screen.findByRole('link', { name: /산출물생성/ })
  // **마이크로태스크를 비운 뒤에 본다.** 뱃지는 조회 응답이 resolve 된 다음 렌더에
  // 그려지므로, 비우지 않고 단언하면 게이트를 지워도 「아직 안 그려졌다」로 초록이다
  // (변이 실험에서 실제로 그랬다 — 항진명제였다).
  await act(async () => { await Promise.resolve() })
  // **특정 숫자가 아니라 「숫자가 하나도 없음」을 본다.** 이 파일의 목 응답은 앞선
  // 테스트가 바꿔 놓아 new_count 가 무엇인지 여기서 단정할 수 없다 — 특정 값을 겨냥하면
  // 그 값이 아닐 때 조용히 통과하는 항진명제가 된다(이것도 변이 실험에서 드러났다).
  // 탭 라벨 「산출물생성」에는 숫자가 없으므로, 숫자가 하나라도 붙으면 그것은 다른
  // 대화까지 센 값이다.
  expect(link.textContent).not.toMatch(/\d/)
})

// ─────────────────────────────────────────────────────────────────────────────
// round07g 라이브 수정 — **새 검색으로 대화가 바뀌면 `?c=` 도 새 id 로 바뀐다.**
//
// 라이브(192.168.12.57:3010)에서 실측된 재현: 대화 A 에서 산출물 2건을 만든 뒤 이 셸의
// 검색바로 새 검색을 하면 서버에는 새 대화가 서고 결과도 새 200건이 뜨는데, 주소·탭
// 링크·산출물 조회는 전부 옛 A 그대로였다. `?c=` 가 최우선인 판정(useConversationScope ①)
// 이 옛 대화에 고정돼, 새 검색 화면에 **옛 대화의 산출물 2건**이 그대로 보였다
// (「산출물이 다른 세션에서도 공유된다」 — 사용자 보고). 같은 시점 서버 필터는 정확했다
// (옛 대화 2건 · 새 대화 0건 · 필터 없이 29건) — 화면이 옛 id 를 넘긴 것이 유일한 문제였다.
//
// 이 블록이 **실 라우터**(createMemoryRouter)를 쓰는 이유: 잠가야 할 것 중 둘이
// react-router 의 상태다 — 「주소가 실제로 바뀌었는가」와 「그것이 push 가 아니라
// **replace** 인가(뒤로가기 이력 오염 금지)」. MemoryRouter+Routes 로는 둘 다 볼 수 없다.
//
// 그리고 이 파일에서 유일하게 **컨텍스트의 대화가 시간에 따라 바뀌는** 하네스다 —
// 결함 자체가 「대화가 바뀌는 순간」에만 나타나므로 정적 렌더로는 관측되지 않는다.
const flowRoutes = [{
  path: '/search',
  element: <SearchFlowLayout />,
  children: [
    { path: 'results', element: <div>결과본문</div> },
    { path: 'chat', element: <div>대화본문</div> },
    { path: 'output', element: <div>산출물본문</div> },
    { path: 'output/:outputId', element: <div>상세본문</div> },
  ],
}]

function renderFlow(path, initial = {}) {
  const router = createMemoryRouter(flowRoutes, { initialEntries: [path] })
  // 라우터가 실제로 한 이동을 전부 적는다. 무한 루프 탐지의 본체다 —
  // 컨텍스트→주소 이펙트와 주소→컨텍스트(재개) 이펙트가 서로를 깨우면
  // 이 배열이 끝없이 자란다.
  const nav = []
  router.subscribe((s) => {
    nav.push(`${s.historyAction} ${s.location.pathname}${s.location.search}`)
  })
  let apply
  function Host() {
    const [value, setValue] = useState({
      isLive: true, lastQuery: '민주화운동', setScenarioByQuery: vi.fn(),
      resumeConversation, conversationId: null, ...initial,
    })
    apply = setValue
    return (
      <ScenarioContext.Provider value={value}>
        <RouterProvider router={router} />
      </ScenarioContext.Provider>
    )
  }
  render(<Host />)
  return {
    router,
    nav,
    url: () => `${router.state.location.pathname}${router.state.location.search}`,
    // 컨텍스트의 대화를 갈아끼운다 — ScenarioContext 가 실제로 하는 일 그대로다.
    setConversation: (id) => act(() => { apply((v) => ({ ...v, conversationId: id })) }),
    // [R2] 대화를 끊었다 세우는 두 갱신이 **한 커밋으로 묶이는** 경우. React 는 같은
    // 배치의 상태 갱신을 하나로 합치므로, 이때 이펙트는 중간의 null 을 **한 번도 보지
    // 못한다** — 위 setConversation 두 번(별도 렌더)과 관측 가능한 사실이 다르다.
    // 라이브 2차 실측이 걸린 자리가 정확히 이쪽이다.
    coalescedNewConversation: (id) => act(() => {
      apply((v) => ({ ...v, conversationId: null }))
      apply((v) => ({ ...v, conversationId: id }))
    }),
    // [R2] 이 셸의 검색바로 새 검색을 시작한다(사용자가 실제로 하는 동작).
    submit: (text) => {
      const input = screen.getByLabelText('검색어')
      fireEvent.change(input, { target: { value: text } })
      fireEvent.submit(input.closest('form'))
    },
    // 셸 **밖**에서 일어나는 이동(「나의 기록」·산출물 목록이 하는 navigate).
    go: async (to) => { await act(async () => { await router.navigate(to) }) },
    // 이펙트가 더 돌 기회를 준다 — 「고정점에 앉았다」를 보려면 한 번 더 흘려야 한다.
    settle: async () => {
      await act(async () => { await new Promise((r) => { setTimeout(r, 20) }) })
    },
  }
}

describe('새 검색은 주소의 ?c= 를 새 대화로 갈아끼운다 (라이브 재현 수정)', () => {
  beforeEach(() => {
    resumeConversation.mockClear()
    listOutputs.mockClear()
    listOutputs.mockResolvedValue({ ok: true, data: { outputs: [], has_more: false, new_count: 0 } })
  })

  // 새 검색은 `setConversationId(null)` 로 대화를 끊었다가 새로 세운다(runLiveSearch).
  // 그 중간의 null 을 테스트도 그대로 지난다 — 실제 앱이 지나는 구간이고,
  // 「그 구간에 옛 대화가 되살아나지 않는가」가 이 수정의 절반이다(아래 ② 테스트).
  async function newSearch(flow, newId) {
    flow.setConversation(null)
    flow.setConversation(newId)
    await flow.settle()
  }

  it('주소·탭 링크·산출물 조회가 모두 새 대화로 옮겨 간다', async () => {
    const flow = renderFlow('/search/results?c=conv-OLD', { conversationId: 'conv-OLD' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    expect(flow.url()).toBe('/search/results?c=conv-OLD')

    listOutputs.mockClear()
    await newSearch(flow, 'conv-NEW')

    // ① 주소 — 라이브에서 옛 id 로 굳어 있던 바로 그 값이다.
    expect(flow.url()).toBe('/search/results?c=conv-NEW')
    // ② 탭 링크 3개 — 라이브에서 셋 다 옛 대화를 실어 보내고 있었다.
    expect(screen.getByRole('link', { name: '검색결과' }))
      .toHaveAttribute('href', '/search/results?c=conv-NEW')
    expect(screen.getByRole('link', { name: /AI 학예 도우미/ }))
      .toHaveAttribute('href', '/search/chat?c=conv-NEW')
    expect(screen.getByRole('link', { name: /산출물생성/ }))
      .toHaveAttribute('href', '/search/output?c=conv-NEW')
    // ③ 실제 산출물 조회 — 사용자가 본 「옛 대화의 2건」이 나올 길이 없어진다.
    expect(listOutputs).toHaveBeenCalled()
    for (const [args] of listOutputs.mock.calls) {
      expect(args.conversationId).toBe('conv-NEW')
    }
  })

  it('갱신은 replace 다 — 뒤로가기 이력을 늘리지 않는다', async () => {
    const flow = renderFlow('/search/results?c=conv-OLD', { conversationId: 'conv-OLD' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())

    await newSearch(flow, 'conv-NEW')

    expect(flow.nav).toEqual(['REPLACE /search/results?c=conv-NEW'])
    expect(flow.router.state.historyAction).toBe('REPLACE')
  })

  // ── 두 이펙트가 서로를 깨우지 않는다 ─────────────────────────────────────────
  // 재개 이펙트는 주소 → 컨텍스트, 이 수정은 컨텍스트 → 주소다. 방향이 반대라
  // 고정점이 없으면 끝없이 왕복한다. 「이동 횟수가 1 에서 멈추고, 더 흘려도
  // 늘지 않는다」로 잰다 — 왕복이 있으면 이 배열이 자란다.
  //
  // 변이 실험 기록: 고정점 조기반환과 ③ 가드를 **동시에** 지우면 이 수가 1 → 3 이 되어
  // 여기서 빨갛게 걸린다. 3 에서 멎는 이유(=끝없이 자라지는 않는 이유)는 우리 코드가
  // 아니라 react-router 다 — useSearchParams 의 searchParams 는 `location.search`
  // **문자열**로 메모되므로, 같은 값을 다시 써도 참조가 그대로여서 이펙트가 재발화하지
  // 않는다. 즉 진짜 무한 루프는 「매번 **다른** 값을 쓰는 왕복」일 때만 생기고, 그것은
  // 아래 ②(옛 대화 되살리기) 테스트가 막는 상황이다. 이 테스트는 그 앞 단계인
  // 「불필요한 이동이 한 번이라도 더 생겼는가」를 잰다.
  it('무한 루프가 없다 — 이동은 한 번뿐이고 더 흘려도 늘지 않는다', async () => {
    const flow = renderFlow('/search/results?c=conv-OLD', { conversationId: 'conv-OLD' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())

    await newSearch(flow, 'conv-NEW')
    const settled = flow.nav.length
    expect(settled).toBe(1)

    await flow.settle()
    await flow.settle()
    expect(flow.nav.length).toBe(settled)
    expect(flow.url()).toBe('/search/results?c=conv-NEW')
    // 조회도 함께 멎는다 — 왕복하면 대화 범위가 바뀔 때마다 뱃지가 다시 나간다.
    const calls = listOutputs.mock.calls.length
    await flow.settle()
    expect(listOutputs.mock.calls.length).toBe(calls)
  })

  // ② 새 검색이 대화를 끊는 **null 구간**이 이 수정의 함정이다. 그때 주소에는 아직
  // 옛 `?c=A` 가 남아 있어, 재개 이펙트가 그것을 보고 resumeConversation(A) 를 쏘면
  // **방금 시작한 검색이 옛 대화로 되돌아간다**(옛 질의·옛 채팅·옛 산출물). 주소와
  // 컨텍스트가 이미 같은 대화를 가리킬 때 attemptedRef 를 채워 두는 것이 그 방어다.
  it('새 검색이 대화를 끊는 구간에 옛 대화를 되살리지 않는다', async () => {
    const flow = renderFlow('/search/results?c=conv-OLD', { conversationId: 'conv-OLD' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    expect(resumeConversation).not.toHaveBeenCalled()

    flow.setConversation(null) // 검색 왕복 중 — 대화가 잠깐 없다
    await flow.settle()
    expect(resumeConversation).not.toHaveBeenCalled()

    flow.setConversation('conv-NEW')
    await flow.settle()
    expect(resumeConversation).not.toHaveBeenCalled()
    expect(flow.url()).toBe('/search/results?c=conv-NEW')
  })

  // ③ 「나의 기록」 재개는 **스스로** `/search/results?c=…` 로 이동한다(LnbHistory.handleOpen).
  // 그 사이 컨텍스트만 먼저 갈리는 구간이 있는데, 거기서 이 이펙트가 앞질러 replace 하면
  // 재개가 목적지에 닿기도 전에 이력이 흔들린다. 대화 → 대화 전이는 손대지 않는다.
  it('「나의 기록」 재개(대화 → 대화)는 주소를 앞질러 바꾸지 않는다', async () => {
    const flow = renderFlow('/search/results?c=conv-X', { conversationId: 'conv-X' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())

    // resumeConversation 이 컨텍스트를 먼저 갈아끼운 순간(널을 지나지 않는다)
    flow.setConversation('conv-A')
    await flow.settle()
    expect(flow.url()).toBe('/search/results?c=conv-X')
    expect(flow.nav).toEqual([])

    // 그런 다음 LnbHistory 가 스스로 이동한다 — 주소의 주인은 그쪽이다.
    await flow.go('/search/results?c=conv-A')
    expect(flow.url()).toBe('/search/results?c=conv-A')
    expect(flow.nav).toEqual(['PUSH /search/results?c=conv-A'])
    // 재개된 대화를 다시 재개하지 않는다.
    expect(resumeConversation).not.toHaveBeenCalled()
  })

  it('재개로 열린 대화에서 다시 새 검색을 해도 주소가 따라온다', async () => {
    const flow = renderFlow('/search/results?c=conv-A', { conversationId: 'conv-A' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())

    listOutputs.mockClear()
    await newSearch(flow, 'conv-B')

    expect(flow.url()).toBe('/search/results?c=conv-B')
    expect(resumeConversation).not.toHaveBeenCalled()
    for (const [args] of listOutputs.mock.calls) {
      expect(args.conversationId).toBe('conv-B')
    }
  })

  // 상세 화면 왕복(목록 → 상세 → 돌아가기)은 `?c=` 를 이어 나르는 것이 계약이다
  // (round07f I-1, OutputDetailPage.test.jsx 가 링크 쪽을 잠근다). 셸이 그 사이에
  // 끼어들어 주소를 고쳐 쓰면 그 계약이 깨진다 — 셸 몫은 「아무것도 하지 않는다」다.
  it('상세 왕복에는 셸이 끼어들지 않는다 — ?c= 가 그대로 이어진다', async () => {
    const flow = renderFlow('/search/output?c=conv-A', { conversationId: 'conv-A' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())

    await flow.go('/search/output/o1?c=conv-A')   // 목록 → 상세(OutputList.openDetail)
    expect(flow.url()).toBe('/search/output/o1?c=conv-A')
    await flow.go('/search/output?c=conv-A')      // 상세 → 돌아가기
    expect(flow.url()).toBe('/search/output?c=conv-A')

    expect(flow.nav).toEqual([
      'PUSH /search/output/o1?c=conv-A',
      'PUSH /search/output?c=conv-A',
    ])
  })

  // 주소에 실린 대화가 컨텍스트와 달라도(딥링크·F5) **주소가 이긴다.** 갈아끼우는 것은
  // 「새로 선 대화」뿐이다 — 이 구분이 없으면 딥링크가 열리자마자 덮어써진다.
  it('딥링크로 연 대화를 컨텍스트 값으로 덮어쓰지 않는다', async () => {
    const flow = renderFlow('/search/results?c=conv-DEEP', { conversationId: 'conv-CTX' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    await flow.settle()
    expect(flow.url()).toBe('/search/results?c=conv-DEEP')
    expect(flow.nav).toEqual([])
  })

  it('데모 모드에서는 주소를 건드리지 않는다 — `?c=` 는 라이브 세션의 주소다', async () => {
    const flow = renderFlow('/search/results?c=conv-OLD',
      { conversationId: 'conv-OLD', isLive: false })
    await newSearch(flow, 'conv-NEW')
    expect(flow.url()).toBe('/search/results?c=conv-OLD')
    expect(flow.nav).toEqual([])
  })

  // ══ R2 — 라이브 2차 실측이 잡은 것: 위 12건이 통과하는데도 실사용 경로가 안 걸렸다 ══
  //
  // 1차 수정의 ③ 은 「새 검색만 `A → null → B` 로 null 을 지난다」를 근거로
  // `previous === null` 을 썼다. 그런데 그 null 은 **렌더 하나짜리 통과점**이고,
  // 위 newSearch() 헬퍼는 setConversation 을 두 번 호출해 그 렌더를 **항상 만들어
  // 준다**. 실제 앱에서 그 렌더가 관측되지 않으면(React 가 두 갱신을 한 커밋으로
  // 합치거나, 그 구간에 셸의 이펙트가 걷혔다 다시 붙으면) `previous` 는 옛 대화 id
  // 그대로 남아 ③ 이 쓰기를 **영구히** 막는다 — 대화는 다시 null 로 돌아오지 않는다.
  //
  // 라이브 실측이 보여 준 비대칭이 정확히 이것이다.
  //   · `/search/output`(`?c=` 없음)에서 새 검색 → **주소가 붙는다**
  //   · `/search/output?c=옛id` 에서 새 검색 → **주소 변화 0회**
  // `?c=` 가 있으면 재개가 컨텍스트를 옛 대화로 세워 두므로 `previous` 가 옛 id 이고,
  // 없으면 마운트값 `null` 이라 ③ 이 열린다. 아래 두 테스트가 그 갈림을 그대로 잠근다.
  describe('R2 — 중간 null 이 한 커밋에 묻혀도 주소는 새 대화로 간다', () => {
    // ★ 이 테스트가 R2 의 본체다. 수정 전 코드에서 `?c=conv-A` 그대로 남아 **red** 다.
    it('실사용 경로 — ?c=A 로 열어 둔 대화에서 검색바로 새 검색을 하면 주소가 따라온다', async () => {
      // 라이브와 같은 출발: 주소에 `?c=A`, 컨텍스트는 아직 비어 있다.
      const flow = renderFlow('/search/output?c=conv-A')
      // 재개 이펙트가 `?c=` 를 읽어 대화를 되살리고(주소 → 컨텍스트),
      await waitFor(() => expect(resumeConversation).toHaveBeenCalledWith('conv-A'))
      // 그 결과 컨텍스트가 A 로 정착한다 — 여기서 syncedRef 가 'conv-A' 로 굳는다.
      flow.setConversation('conv-A')
      await flow.settle()
      expect(flow.url()).toBe('/search/output?c=conv-A')
      expect(flow.nav).toEqual([])

      listOutputs.mockClear()
      // 상단 검색바로 새 검색 — 그리고 새 대화가 서기까지 중간 null 이 **관측되지 않는다**.
      flow.submit('광복절 기념 행사')
      flow.coalescedNewConversation('conv-B')
      await flow.settle()

      expect(flow.url()).toBe('/search/output?c=conv-B')
      expect(flow.nav).toEqual(['REPLACE /search/output?c=conv-B'])
      // 산출물 조회도 새 대화로 옮겨 간다 — 라이브에서 「옛 대화 4건」이 남던 자리다.
      expect(listOutputs).toHaveBeenCalled()
      for (const [args] of listOutputs.mock.calls) {
        expect(args.conversationId).toBe('conv-B')
      }
      // 옛 대화를 되살리지 않는다(②는 그대로 산다).
      expect(resumeConversation).toHaveBeenCalledTimes(1)
    })

    // 라이브의 ✅ 행. 같은 형태인데 통과한다 — 「왜 `?c=` 가 있을 때만 안 걸렸는가」의
    // 대조군이다. 이 테스트는 수정 전에도 green 이고, 그것이 결함의 비대칭을 증명한다.
    it('`?c=` 없이 출발한 새 검색은 예나 지금이나 주소가 붙는다(라이브 ✅ 행)', async () => {
      const flow = renderFlow('/search/output')
      await flow.settle()
      flow.submit('광복절 기념 행사')
      flow.coalescedNewConversation('conv-B')
      await flow.settle()
      expect(flow.url()).toBe('/search/output?c=conv-B')
      expect(resumeConversation).not.toHaveBeenCalled()
    })

    // 검색바를 거치지 않은 대화 교체는 「나의 기록」 재개다 — 커밋이 어떻게 묶이든
    // 주소의 주인은 그쪽이므로 셸은 아무 이동도 하지 않는다(③ 이 여전히 산다).
    it('검색바를 거치지 않은 대화 교체(재개)는 묶여 들어와도 주소를 건드리지 않는다', async () => {
      const flow = renderFlow('/search/results?c=conv-X', { conversationId: 'conv-X' })
      await waitFor(() => expect(listOutputs).toHaveBeenCalled())

      flow.coalescedNewConversation('conv-A')
      await flow.settle()

      expect(flow.url()).toBe('/search/results?c=conv-X')
      expect(flow.nav).toEqual([])
    })

    // 무한 루프 재확인 — `?c=` **있는 출발**에서도 이동은 한 번뿐이고, 더 흘려도 늘지
    // 않는다(라운드 지시 ③). 계측은 위 describe 와 같은 router.subscribe 다.
    it('무한 루프가 없다 — `?c=` 있는 출발에서도 이동은 한 번뿐이다', async () => {
      const flow = renderFlow('/search/output?c=conv-A')
      await waitFor(() => expect(resumeConversation).toHaveBeenCalledWith('conv-A'))
      flow.setConversation('conv-A')
      await flow.settle()

      flow.submit('광복절 기념 행사')
      flow.coalescedNewConversation('conv-B')
      await flow.settle()
      expect(flow.nav.length).toBe(1)

      await flow.settle()
      await flow.settle()
      expect(flow.nav.length).toBe(1)
      expect(flow.url()).toBe('/search/output?c=conv-B')
      // 조회도 함께 멎는다 — 왕복하면 대화 범위가 바뀔 때마다 뱃지가 다시 나간다.
      const calls = listOutputs.mock.calls.length
      await flow.settle()
      expect(listOutputs.mock.calls.length).toBe(calls)
      // 재개는 마운트 때 한 번뿐 — 새 검색이 옛 대화를 되살리지 않았다.
      expect(resumeConversation).toHaveBeenCalledTimes(1)
    })

    // 표식을 **고정점(①) 판정 다음**에 소비해야 하는 이유. 검색 왕복 중에 옛 대화가
    // 잠깐 되살아나면(재개가 null 구간에 끼어드는 경우 — ② 가 막는 그 상황) 그 렌더는
    // `?c=` 와 값이 같아 ① 로 빠진다. 거기서 표식을 태워 버리면, 뒤이어 진짜로 도착한
    // 새 대화가 판정을 못 받아 주소가 옛 id 에 굳는다.
    it('왕복 중 옛 대화가 잠깐 되살아나도 새 검색 표식은 살아남는다', async () => {
      const flow = renderFlow('/search/output?c=conv-A', { conversationId: 'conv-A' })
      await waitFor(() => expect(listOutputs).toHaveBeenCalled())

      flow.submit('광복절 기념 행사')
      flow.setConversation(null)
      flow.setConversation('conv-A')   // 옛 대화가 잠깐 되살아난다(= 주소와 같은 값 → ①)
      await flow.settle()
      expect(flow.url()).toBe('/search/output?c=conv-A')

      flow.setConversation('conv-B')   // 그리고 진짜 새 대화가 도착한다
      await flow.settle()
      expect(flow.url()).toBe('/search/output?c=conv-B')
    })

    // 새 검색 표식은 **한 번만** 쓰인다. 소비되지 않고 남으면 그 다음 재개까지
    // 주소를 앞질러 갈아끼워 뒤로가기 이력을 흔든다.
    it('새 검색 표식은 한 번 쓰이고 소모된다 — 이어지는 재개는 주소를 건드리지 않는다', async () => {
      const flow = renderFlow('/search/output?c=conv-A', { conversationId: 'conv-A' })
      await waitFor(() => expect(listOutputs).toHaveBeenCalled())

      flow.submit('광복절 기념 행사')
      flow.coalescedNewConversation('conv-B')
      await flow.settle()
      expect(flow.url()).toBe('/search/output?c=conv-B')

      // 이번에는 검색바를 거치지 않은 교체(=「나의 기록」 재개)
      flow.coalescedNewConversation('conv-C')
      await flow.settle()
      expect(flow.url()).toBe('/search/output?c=conv-B')
      expect(flow.nav).toEqual(['REPLACE /search/output?c=conv-B'])
    })
  })
})
