/**
 * 이 파일의 책임: LnbHistory(나의 기록 블록, round06c Task E5)의 실데이터 렌더·재개·삭제·
 * 케밥 계약을 검증한다. 이관 배경: Lnb.jsx의 인라인 .lnb_history 블록(mock searchHistory +
 * 콜백 props onSaveHistory/onDeleteHistory)이 이 컴포넌트로 분리되며, 실데이터
 * (conversationsApi.js: listConversations/deleteConversation)와 재개(ScenarioContext.
 * resumeConversation)로 교체된다. 옛 Lnb.test.jsx의 히스토리 단언들(나의 기록 렌더 ·
 * placeholder 부재 · 케밥 열기 · 저장/삭제 콜백)이 여기로 이동했다 — 콜백 props 자체가
 * 폐기되므로 저장/삭제 단언은 실제 계약(토스트 · ConfirmDialog+deleteConversation)으로
 * 바꿔 옮긴다(계획 Task E5 Step1·Step5).
 *
 * ★ 계획서 브리프의 Step3 항목 클릭 계약(`resumeConversation(id).finally(()=>navigate(...))`
 * — 항상 이동)은 방금 커밋된 최신 계약(ScenarioContext.resumeConversation 도크스트링 F3)으로
 * 대체됐다: resumeConversation이 `{ok:false,status}`로 실패를 표면화하면, 실패 시에는
 * 이동하지 않고 토스트 안내 후 목록을 재조회한다(삭제된 대화를 가리키는 낡은 id로 빈 검색
 * 화면에 떨어지는 것을 막는다). 아래 (b) 성공 케이스와 (b-실패) 케이스가 그 조정된 계약을
 * 검증한다.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider } from '../Toast.jsx'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import LnbHistory from './LnbHistory.jsx'

vi.mock('../../lib/conversationsApi.js', () => ({
  listConversations: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
}))
import { listConversations, deleteConversation, renameConversation } from '../../lib/conversationsApi.js'

const LIVE_ITEMS = [
  { id: 'c1', search_query: '민주화운동 관련 자료' },
  { id: 'c2', search_query: '88서울올림픽 포스터' },
]

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="probe">{location.pathname}{location.search}</span>
}

function renderLnbHistory(scenarioValue, { collapsed = false, path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <ScenarioContext.Provider value={scenarioValue}>
          <LnbHistory collapsed={collapsed} />
        </ScenarioContext.Provider>
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listConversations.mockResolvedValue({ conversations: LIVE_ITEMS })
  deleteConversation.mockResolvedValue({ status: 200 })
  renameConversation.mockResolvedValue({ status: 200 })
})

// (a) 라이브: 목록 2건이 search_query로 렌더된다(백엔드 정렬을 신뢰 — 받은 순서 그대로)
test('(a) 라이브: listConversations 2건이 search_query로 받은 순서 그대로 렌더된다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })

  expect(await screen.findByText(LIVE_ITEMS[0].search_query)).toBeInTheDocument()
  expect(screen.getByText(LIVE_ITEMS[1].search_query)).toBeInTheDocument()

  const texts = Array.from(document.querySelectorAll('.lnb_history_txt')).map((n) => n.textContent)
  expect(texts).toEqual([LIVE_ITEMS[0].search_query, LIVE_ITEMS[1].search_query])
})

// (b) 항목 클릭: resumeConversation 성공 시 /search/results?c=id 로 이동한다
test('(b) 항목 클릭: resumeConversation 성공 시 재개 후 /search/results?c=id 로 이동한다', async () => {
  const resumeConversation = vi.fn().mockResolvedValue({ ok: true })
  renderLnbHistory({ isLive: true, resumeConversation })

  const item = await screen.findByText(LIVE_ITEMS[0].search_query)
  fireEvent.click(item)

  await waitFor(() => expect(resumeConversation).toHaveBeenCalledWith('c1'))
  await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('/search/results?c=c1'))
})

// (b-실패) ★ 조정 계약: resumeConversation이 {ok:false}면 이동하지 않고 토스트+재조회한다
test('(b-실패) 재개 실패 시 이동하지 않고 토스트를 띄운 뒤 목록을 재조회한다', async () => {
  const resumeConversation = vi.fn().mockResolvedValue({ ok: false, status: 404 })
  renderLnbHistory({ isLive: true, resumeConversation })

  const item = await screen.findByText(LIVE_ITEMS[0].search_query)
  fireEvent.click(item)

  await waitFor(() => expect(resumeConversation).toHaveBeenCalledWith('c1'))
  expect(await screen.findByRole('status')).toHaveTextContent('대화를 불러오지 못했습니다')
  // mount 1회 + 실패 후 재조회 1회 = 2회
  await waitFor(() => expect(listConversations).toHaveBeenCalledTimes(2))
  // 이동은 일어나지 않는다
  expect(screen.getByTestId('probe')).toHaveTextContent('/')
})

// 케밥 열기(구 Lnb.test.jsx '나의 기록 케밥: 클릭 시 저장/삭제 메뉴가 열린다' 이관)
test('케밥: 클릭 전에는 메뉴가 없고, 클릭하면 저장/삭제 메뉴가 열린다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  expect(screen.queryByRole('menuitem', { name: '라이브러리 저장' })).toBeNull()
  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  expect(screen.getByRole('menuitem', { name: '라이브러리 저장' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: '삭제' })).toBeInTheDocument()
})

// 케밥 메뉴 CSS 계약 — 퍼블 layout.css는 `.history_menu{display:none}` +
// `.history_menu.is_active{display:flex}`로 표시를 토글한다(v2 lnb.js 계약). React는
// 조건부 렌더를 쓰므로 렌더되는 순간이 곧 "열림"이고, 따라서 is_active를 항상 달아야
// 한다 — 안 달면 DOM에는 있지만 영구 display:none이라 사용자에게 안 보인다(dev 실측
// 결함, 2026-07-28). jsdom은 CSS를 로드하지 않아 display 자체는 관측할 수 없으므로
// 클래스 계약을 단언한다(css-contract 관행과 같은 이유).
test('케밥 메뉴는 is_active 클래스를 달고 렌더된다(퍼블 CSS 표시 계약)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  const menu = screen.getByRole('menu')
  expect(menu).toHaveClass('history_menu', 'is_active')
})

// 케밥 메뉴 바깥 클릭 닫기 — 퍼블 lnb.js:230-232 계약(케밥 버튼도 메뉴도 아닌 곳을
// 클릭하면 closeAllMenus). React 이식이 이 document 리스너를 떨어뜨려, 케밥을 다시
// 누르기 전엔 메뉴가 안 닫혔다(사용자 지시 2026-07-28: "다른 데를 누르면 사라지게").
test('케밥 메뉴는 메뉴 밖을 클릭하면 닫힌다(퍼블 lnb.js 계약)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  expect(screen.getByRole('menu')).toBeInTheDocument()

  // 메뉴 자신을 클릭하면 닫히지 않는다(항목 버튼이 아닌 메뉴 여백 클릭)
  fireEvent.click(screen.getByRole('menu'))
  expect(screen.getByRole('menu')).toBeInTheDocument()

  // 메뉴·케밥 밖(문서 아무 곳) 클릭 → 닫힌다
  fireEvent.click(document.body)
  expect(screen.queryByRole('menu')).toBeNull()
})

// Escape 닫기 — 퍼블 lnb.js:233 계약. 바깥 클릭과 같은 리스너 묶음이다.
test('케밥 메뉴는 Escape 키로 닫힌다(퍼블 lnb.js 계약)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  expect(screen.getByRole('menu')).toBeInTheDocument()

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
})

// 활성 항목 하이라이트 CSS 계약 — 퍼블 layout.css `.lnb_history_item.is_active
// { background: var(--primary10); }`는 "현재 열려 있는 대화"를 목록에서 강조하는
// 계약인데, 케밥 메뉴 결함(§34)과 같은 계열로 is_active 미부착이면 조용히 죽는다.
// jsdom은 CSS를 못 보므로 클래스 부착 자체를 단언한다. 판정 축은 useScenario()의
// conversationId(서버 발급 대화 id)와 item.id의 일치 여부다.
test('현재 열린 대화 항목에만 is_active가 붙는다(퍼블 CSS 하이라이트 계약)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn(), conversationId: 'c1' })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const items = document.querySelectorAll('.lnb_history_item')
  expect(items[0]).toHaveClass('lnb_history_item', 'is_active')
  expect(items[1]).toHaveClass('lnb_history_item')
  expect(items[1]).not.toHaveClass('is_active')
})

// (c) round10 — 케밥 '라이브러리 저장' 클릭은 더는 showToast('준비 중입니다') 스텁이
// 아니라 저장 모달을 연다. 그 실동작의 나머지(산출물 수집 → saveProject 배선 →
// 성공/실패 피드백)는 LnbHistory.save.test.jsx가 별도로 검증한다 — 이 파일은 여전히
// listOutputs·projectsApi를 목하지 않으므로(위 vi.mock은 conversationsApi.js뿐이다)
// 여기서는 "모달이 뜬다"까지만 확인하고 저장 버튼을 누르지 않는다.
test("(c) 케밥 '라이브러리 저장' 클릭 시 저장 모달이 열린다(round10 — 더는 준비중 스텁이 아니다)", async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '라이브러리 저장' }))

  expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).not.toBeInTheDocument()
  // 저장 모달을 열면 케밥 메뉴는 닫힌다(기존 저장/삭제와 같은 관행)
  expect(screen.queryByRole('menuitem', { name: '삭제' })).toBeNull()
})

// (d) 케밥 '삭제' 클릭 시 퍼블 삭제 확인(ConfirmPopup, #history_delete_alert 미러)이
// 열리고, '네' 확정 시 deleteConversation 후 재조회 + 완료 토스트가 뜬다.
// 사용자 신고(2026-07-28)로 라운드4 범용 모달(ConfirmDialog)에서 교체 — 표시명
// (title ?? search_query)이 alert_popup_quote 인용 줄에 실린다.
test("(d) 케밥 '삭제' 클릭 시 퍼블 확인 팝업이 열리고, '네' 확정 시 deleteConversation 후 재조회한다", async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))

  // 퍼블 구조: 삭제 알림 제목 + 삭제 대상 인용 + 아니오/네
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveClass('alert_popup', 'is_active')
  expect(screen.getByText('삭제 알림')).toBeInTheDocument()
  expect(screen.getByText(LIVE_ITEMS[0].search_query, { selector: '.alert_popup_quote' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '네' }))

  await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('c1'))
  // mount 1회 + 삭제 후 재조회 1회 = 2회
  await waitFor(() => expect(listConversations).toHaveBeenCalledTimes(2))
  // 완료 피드백 — 퍼블의 삭제완료 팝업 대신 앱 관행(토스트)으로. 사유는 완료노트 기록.
  expect(await screen.findByRole('status')).toHaveTextContent('기록을 삭제했습니다')
})

test("삭제 확인 팝업에서 '아니오'를 누르면 deleteConversation이 호출되지 않는다", async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '아니오' }))

  expect(deleteConversation).not.toHaveBeenCalled()
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

test("삭제 실패(status!==200) 시 실패 토스트를 띄우고 재조회하지 않는다", async () => {
  deleteConversation.mockResolvedValueOnce({ status: 500 })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: '네' }))

  await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('c1'))
  expect(await screen.findByRole('status')).toHaveTextContent('기록을 삭제하지 못했습니다')
  // 실패했으니 재조회는 mount 1회뿐이어야 한다(삭제 후 재조회 없음)
  expect(listConversations).toHaveBeenCalledTimes(1)
})

test('삭제 요청이 네트워크 오류로 reject되어도 실패 토스트를 띄운다', async () => {
  deleteConversation.mockRejectedValueOnce(new Error('network down'))
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: '네' }))

  expect(await screen.findByRole('status')).toHaveTextContent('기록을 삭제하지 못했습니다')
  expect(listConversations).toHaveBeenCalledTimes(1)
})

// (e) F7(round06c 배치 리뷰) 편차 — isLive:false여도 listConversations()를 호출한다.
// isLive 분기·searchHistory 폴백을 LnbHistory.jsx에서 걷어냈다(데모/라이브 판정은
// conversationsApi.js의 listConversations()가 이미 맡는다). 여기서는 그 함수가 데모
// 정본(DEMO_CONVERSATIONS 형태, id 'c-demo-1' 등)을 돌려준다고 셋업해 실제로 그 데모
// 항목이 렌더되는지 확인한다 — 이래야 그 항목을 클릭해 재개했을 때 conversationsApi.js의
// getConversation 데모 분기가 같은 id를 찾아 3턴 메시지를 연다(구 searchHistory id는
// 정렬되지 않아 빈 대화로 열리는 회귀가 있었다).
test('(e) 더미(isLive:false)여도 listConversations을 호출하고 데모 항목을 렌더한다', async () => {
  const DEMO_ITEMS = [
    { id: 'c-demo-1', search_query: '민주화운동에 관련된 자료 찾아줘' },
    { id: 'c-demo-2', search_query: '88서울올림픽 포스터' },
  ]
  listConversations.mockResolvedValue({ conversations: DEMO_ITEMS })
  renderLnbHistory({ isLive: false, resumeConversation: vi.fn() })

  expect(await screen.findByText(DEMO_ITEMS[0].search_query)).toBeInTheDocument()
  expect(screen.getByText(DEMO_ITEMS[1].search_query)).toBeInTheDocument()
  expect(listConversations).toHaveBeenCalled()
})

// 구 Lnb.test.jsx 'placeholder "최근 검색어 1"이 없다' 이관 — 회귀 가드
test('더미 모드에서도 placeholder "최근 검색어 1"이 없다', async () => {
  renderLnbHistory({ isLive: false, resumeConversation: vi.fn() })
  await waitFor(() => expect(listConversations).toHaveBeenCalled())
  expect(screen.queryByText('최근 검색어 1')).not.toBeInTheDocument()
})

// collapsed면 블록 자체를 렌더하지 않는다(현행 Lnb 관행). mount 시 데이터 로딩은
// collapsed 여부와 무관하게 일어나므로(F7 이후 listConversations()가 항상 불린다)
// 그 이펙트가 정착할 때까지 기다린 뒤 끝내 act 경고를 없앤다.
test('collapsed=true면 블록 자체를 렌더하지 않는다', async () => {
  renderLnbHistory({ isLive: false, resumeConversation: vi.fn() }, { collapsed: true })
  await waitFor(() => expect(listConversations).toHaveBeenCalled())
  expect(screen.queryByText('나의 기록')).not.toBeInTheDocument()
})

// (f) 새 대화가 생기면 목록이 따라 갱신된다 — round06c G1 라이브 실측 결함의 회귀 가드.
// Lnb는 레이아웃 상주라 라우트 이동으로 재마운트되지 않는다. mount 1회만 읽으면 검색으로
// 새 conversations 행이 생겨도 전체 새로고침 전까지 "나의 기록"이 비어 있었다.
// ScenarioContext는 새 검색 때 conversationId를 서버 발급 id로 갱신하므로 그것을 신호로 쓴다.
test('(f) conversationId가 바뀌면(새 검색) 목록을 다시 조회한다', async () => {
  const base = { isLive: true, resumeConversation: vi.fn() }
  const { rerender } = renderLnbHistory({ ...base, conversationId: null })
  await waitFor(() => expect(listConversations).toHaveBeenCalledTimes(1))

  listConversations.mockResolvedValue({
    conversations: [...LIVE_ITEMS, { id: 'c3', search_query: '경제개발 5개년 계획' }],
  })
  rerender(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <ScenarioContext.Provider value={{ ...base, conversationId: 'c3' }}>
          <LnbHistory collapsed={false} />
        </ScenarioContext.Provider>
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  )

  await waitFor(() => expect(listConversations).toHaveBeenCalledTimes(2))
  expect(await screen.findByText('경제개발 5개년 계획')).toBeInTheDocument()
})

// (g) round06e Task 10 — has_more 페이지네이션. 케밥(aria-label="더보기")과 접근명이
// 겹치지 않도록 새 버튼은 "기록 더 보기"를 쓴다(R6E-12).
test('has_more가 true면 "기록 더 보기" 버튼이 보인다', async () => {
  listConversations.mockResolvedValue({ conversations: LIVE_ITEMS, has_more: true })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })

  expect(await screen.findByRole('button', { name: '기록 더 보기' })).toBeInTheDocument()
})

test('has_more가 false(기본)면 "기록 더 보기" 버튼이 없다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  expect(screen.queryByRole('button', { name: '기록 더 보기' })).toBeNull()
})

test('"기록 더 보기" 클릭 시 offset=10으로 다음 페이지를 조회해 누적한다', async () => {
  listConversations.mockResolvedValueOnce({ conversations: LIVE_ITEMS, has_more: true })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  const moreBtn = await screen.findByRole('button', { name: '기록 더 보기' })

  listConversations.mockResolvedValueOnce({
    conversations: [{ id: 'c3', search_query: '3·1운동 문서' }], has_more: false,
  })
  fireEvent.click(moreBtn)

  expect(await screen.findByText('3·1운동 문서')).toBeInTheDocument()
  // 누적이지 대체가 아니다 — 기존 2건도 그대로 남아 있다.
  expect(screen.getByText(LIVE_ITEMS[0].search_query)).toBeInTheDocument()
  expect(listConversations).toHaveBeenNthCalledWith(2, { limit: 10, offset: 10 })
  expect(screen.queryByRole('button', { name: '기록 더 보기' })).toBeNull()
})

// round06e 최종리뷰 I-2 — catch는 fetch reject만 잡는다. 500/잘못된 바디는
// res.json()이 정상 resolve해 {detail: ...} 같은 형태로 돌아오므로,
// res?.conversations ?? []가 조용히 0건으로 흡수하고 has_more:false로 버튼이 사라지며
// offset만 전진해 버그를 재현조차 못 하게 됐다. 응답 shape을 검증해 토스트로 드러내고
// 목록·버튼·offset은 그대로 두어야 한다(재시도 가능).
test('"기록 더 보기" 중 서버가 잘못된 바디(예: 500 detail)를 주면 조용히 흡수하지 않고 토스트로 안내한다', async () => {
  listConversations.mockResolvedValueOnce({ conversations: LIVE_ITEMS, has_more: true })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  const moreBtn = await screen.findByRole('button', { name: '기록 더 보기' })

  listConversations.mockResolvedValueOnce({ detail: 'Internal Server Error' })
  fireEvent.click(moreBtn)

  expect(await screen.findByRole('status')).toHaveTextContent('기록을 더 불러오지 못했습니다')
  // 목록은 늘지 않는다 — 기존 2건 그대로.
  const texts = Array.from(document.querySelectorAll('.lnb_history_txt')).map((n) => n.textContent)
  expect(texts).toEqual([LIVE_ITEMS[0].search_query, LIVE_ITEMS[1].search_query])
  // 버튼도 사라지지 않는다 — 재시도할 수 있어야 한다.
  expect(screen.getByRole('button', { name: '기록 더 보기' })).toBeInTheDocument()
})

// round06e 최종리뷰 I-3 — in-flight 가드 부재. 응답 전 두 번 클릭하면 두 클로저가 같은
// offset(10)을 읽어 같은 페이지를 두 번 요청하고 offset도 두 번(10→30) 전진해
// 11~20번째 페이지(offset 10)를 영영 건너뛴다. 가드가 있으면 요청은 1회, offset은
// 1회(10→20)만 전진해야 한다.
test('"기록 더 보기" 응답 전 연속 클릭해도 요청은 1회만 나가고 offset은 1회만 전진한다', async () => {
  listConversations.mockResolvedValueOnce({ conversations: LIVE_ITEMS, has_more: true })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  const moreBtn = await screen.findByRole('button', { name: '기록 더 보기' })

  let resolveSecondCall
  listConversations.mockImplementationOnce(
    () => new Promise((resolve) => { resolveSecondCall = resolve }),
  )

  fireEvent.click(moreBtn)
  fireEvent.click(moreBtn)

  // mount 1회 + "더 보기" 1회 = 2회 (연타로 3회가 되면 안 된다)
  expect(listConversations).toHaveBeenCalledTimes(2)

  resolveSecondCall({ conversations: [{ id: 'c3', search_query: '3·1운동 문서' }], has_more: true })
  await screen.findByText('3·1운동 문서')

  // 두 번째 "더 보기" 클릭이 실제로 나가는지 — offset은 정확히 10→20으로 1회만 전진해야 한다.
  listConversations.mockResolvedValueOnce({
    conversations: [{ id: 'c4', search_query: '유신헌법 자료' }], has_more: false,
  })
  fireEvent.click(await screen.findByRole('button', { name: '기록 더 보기' }))
  await screen.findByText('유신헌법 자료')
  expect(listConversations).toHaveBeenNthCalledWith(3, { limit: 10, offset: 20 })
})

// round06f R6F-25 — 나의 기록 케밥 메뉴에 "이름 바꾸기" 추가. 표시명 = title ?? search_query,
// 재개(resumeConversation)는 여전히 id로 돈다(무변경). 아래 헬퍼는 매번 반복되는
// "더보기 → 이름 바꾸기" 오프닝 시퀀스를 묶는다.
const openRenameInput = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '이름 바꾸기' }))
  return screen.getByRole('textbox', { name: '대화 이름 바꾸기' })
}

test('케밥 메뉴에 "이름 바꾸기" 항목이 있다(R6F-25)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  expect(screen.getByRole('menuitem', { name: '이름 바꾸기' })).toBeInTheDocument()
})

test('이름 바꾸기 클릭 시 현재 표시명이 채워진 인라인 입력이 뜨고 포커스+전체선택된다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  expect(input).toHaveValue(LIVE_ITEMS[0].search_query)
  expect(input).toHaveFocus()
  expect(input.selectionStart).toBe(0)
  expect(input.selectionEnd).toBe(LIVE_ITEMS[0].search_query.length)
  // 이름 바꾸기를 열면 메뉴는 닫힌다
  expect(screen.queryByRole('menuitem', { name: '삭제' })).toBeNull()
})

// 리뷰 Critical 회귀 가드 — ref를 인라인 화살표 함수로 두면 renameDraft가 바뀔 때마다
// (=onChange, 즉 키 입력마다) 컴포넌트가 리렌더되고, 인라인 함수는 매번 새 정체성이라
// React가 ref(null)→ref(el)을 다시 호출해 select()가 재실행된다 — 그 결과 매 keystroke
// 뒤에 입력 전체가 재선택되어 버리고, 실제 브라우저에서는 바로 다음 키 입력이 그 선택
// 영역 전체를 치환해 "마지막 한 글자만 남는" 결과로 이어졌다. 아래는 여러 change를
// 연속으로 발생시켜(각 change = 한 번의 리렌더를 유발) ref가 재호출되지 않는지를
// 간접 관측한다: 재호출됐다면 마지막 change 이후 select()가 다시 돌아 selectionStart가
// 0으로, selectionEnd가 값 전체 길이로 되돌아간다(=전체 재선택 상태). 고정된 콜백이면
// change 이후 캐럿은 값 끝에 collapse된 채(전체 재선택이 아닌 채) 남는다.
test('연속 입력(리렌더 반복) 후에도 값이 유지되고 전체 재선택 상태로 돌아가지 않는다(ref 재실행 회귀 가드)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  // 실제 타이핑처럼 한 글자씩 늘어나는 값으로 change를 여러 번 연속 발생시킨다 —
  // change 1건마다 setRenameDraft → 리렌더 1회가 뒤따른다(실제 keystroke와 동일한 리렌더 횟수).
  const steps = ['새', '새 ', '새 이', '새 이름']
  for (const value of steps) {
    fireEvent.change(input, { target: { value } })
  }

  expect(input).toHaveValue('새 이름')
  // 전체 재선택(0, 전체 길이) 상태가 아니어야 한다 — 그렇다면 ref가 재호출돼 select()가
  // 다시 실행됐다는 뜻이다(수정 전 Critical의 재현 신호).
  const isFullySelectedAgain = input.selectionStart === 0 && input.selectionEnd === input.value.length
  expect(isFullySelectedAgain).toBe(false)
})

test('인라인 입력에 새 이름을 넣고 Enter → renameConversation 호출 후 목록을 재조회한다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  fireEvent.change(input, { target: { value: '나만의 별칭' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() => expect(renameConversation).toHaveBeenCalledWith('c1', '나만의 별칭'))
  // mount 1회 + 저장 후 재조회 1회 = 2회
  await waitFor(() => expect(listConversations).toHaveBeenCalledTimes(2))
  // 저장 후에는 입력이 닫히고 다시 버튼(라벨) 형태로 돌아온다
  expect(screen.queryByRole('textbox', { name: '대화 이름 바꾸기' })).toBeNull()
})

test('인라인 입력에서 Esc → 취소되고 renameConversation은 호출되지 않는다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  fireEvent.change(input, { target: { value: '취소될 이름' } })
  fireEvent.keyDown(input, { key: 'Escape' })

  expect(renameConversation).not.toHaveBeenCalled()
  expect(screen.queryByRole('textbox', { name: '대화 이름 바꾸기' })).toBeNull()
  // 원래 표시명이 그대로 남아 있다 — 변경이 반영되지 않았다
  expect(screen.getByText(LIVE_ITEMS[0].search_query)).toBeInTheDocument()
})

test('인라인 입력에서 blur → 취소되고 renameConversation은 호출되지 않는다', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  fireEvent.blur(input)

  expect(renameConversation).not.toHaveBeenCalled()
  expect(screen.queryByRole('textbox', { name: '대화 이름 바꾸기' })).toBeNull()
})

test('인라인 입력이 빈 문자열(공백만)일 때 Enter → 저장하지 않고 무시한다(클라 선검증)', async () => {
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  expect(renameConversation).not.toHaveBeenCalled()
  // 무시일 뿐 취소가 아니다 — 편집 모드(입력)는 그대로 유지된다
  expect(screen.getByRole('textbox', { name: '대화 이름 바꾸기' })).toBeInTheDocument()
})

test('저장 실패(status!==200) 시 토스트를 띄우고 편집 모드를 유지한다', async () => {
  renameConversation.mockResolvedValueOnce({ status: 404 })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText(LIVE_ITEMS[0].search_query)

  const input = await openRenameInput()
  fireEvent.change(input, { target: { value: '실패할 이름' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  expect(await screen.findByRole('status')).toHaveTextContent('이름을 바꾸지 못했습니다')
  // 편집 모드 유지 — 입력이 여전히 떠 있다
  expect(screen.getByRole('textbox', { name: '대화 이름 바꾸기' })).toBeInTheDocument()
  // 재조회는 일어나지 않는다(mount 1회만)
  expect(listConversations).toHaveBeenCalledTimes(1)
})

// 표시명 폴백 — R6F-25 spec: 표시명 = title ?? search_query
test('표시명은 title이 있으면 title을, 없으면(null) search_query를 쓴다', async () => {
  listConversations.mockResolvedValue({
    conversations: [
      { id: 'c1', search_query: '민주화운동 관련 자료', title: '내가 붙인 별칭' },
      { id: 'c2', search_query: '88서울올림픽 포스터', title: null },
    ],
  })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })

  expect(await screen.findByText('내가 붙인 별칭')).toBeInTheDocument()
  expect(screen.getByText('88서울올림픽 포스터')).toBeInTheDocument()
  expect(screen.queryByText('민주화운동 관련 자료')).not.toBeInTheDocument()
})

// round10c Task B2-2 — 라이브(2026-09-18) 전수 조회에서 search_query="" · title=null인
// 행이 5건 나왔다(B2-1 브리프 근거). `title ?? search_query`는 `??`가 null/undefined만
// 폴백해 title이 null이고 search_query도 ""면 빈 문자열이 그대로 나가 — 화면에 아무
// 글자도 없는, 클릭도 케밥 삭제도 표적이 없는 줄이 됐다. 아래는 그 결함의 회귀 가드다.
test('title=null, search_query=""인 항목은 "제목 없음"으로 그려진다', async () => {
  listConversations.mockResolvedValue({
    conversations: [{ id: 'c1', search_query: '', title: null }],
  })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })

  expect(await screen.findByText('제목 없음')).toBeInTheDocument()
})

test('title=""(빈 문자열)이면 search_query로 폴백한다 — 지금은 빈 줄이 된다', async () => {
  listConversations.mockResolvedValue({
    conversations: [{ id: 'c1', search_query: '민주화운동', title: '' }],
  })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })

  expect(await screen.findByText('민주화운동')).toBeInTheDocument()
})

test('title이 있으면 그대로 그려진다(회귀 방지)', async () => {
  listConversations.mockResolvedValue({
    conversations: [{ id: 'c1', search_query: '민주화운동', title: '내가 지은 이름' }],
  })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })

  expect(await screen.findByText('내가 지은 이름')).toBeInTheDocument()
  expect(screen.queryByText('민주화운동')).not.toBeInTheDocument()
})

// "제목 없음"은 보여주기용 자리표시이지 사용자가 지어 준 이름이 아니다 — 이름 바꾸기
// 입력 초기값에 그 문구가 들어가면, 사용자가 손대지 않고 Enter만 눌러도 진짜 제목이
// "제목 없음"으로 굳어 버린다. 그래서 편집 가능한 입력의 초기값은 빈 문자열이어야 한다.
test('이름 바꾸기 초기값에는 "제목 없음" 자리표시가 들어가지 않고 빈 문자열로 시작한다', async () => {
  listConversations.mockResolvedValue({
    conversations: [{ id: 'c1', search_query: '', title: null }],
  })
  renderLnbHistory({ isLive: true, resumeConversation: vi.fn() })
  await screen.findByText('제목 없음')

  const input = await openRenameInput()
  expect(input).toHaveValue('')
})
