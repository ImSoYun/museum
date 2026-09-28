import { useState } from 'react'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioProvider, useScenario } from '../../context/ScenarioContext.jsx'
import { ReadOnlyProvider } from '../../context/ReadOnlyContext.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import ChatTab from './ChatTab.jsx'
// round07g Task4 — 「검색모드 토글이 채팅에서만 사라졌다」를 한 화면에서 보기 위해
// 첫 검색바를 나란히 렌더한다(맨 아래 테스트).
import IntroSearchCard from '../../components/IntroSearchCard.jsx'

// ── Helper ──────────────────────────────────────────────────────────────────
function renderChatTab() {
  return render(
    <ToastProvider>
      <ScenarioProvider>
        <MemoryRouter>
          <ChatTab />
        </MemoryRouter>
      </ScenarioProvider>
    </ToastProvider>
  )
}

// Helper: get source pill buttons (aria-label starts with "출처 N:")
// R6c-ext D1-6: 표시는 퍼블 인용칩(.chat_cite_item)으로 바뀌었지만 접근명 계약은 그대로다.
function getSourcePills() {
  return screen.getAllByRole('button').filter(
    (btn) => /^출처 \d+:/.test(btn.getAttribute('aria-label') || '')
  )
}

// R6c-ext D1-6: 입력창이 퍼블 form.chat_input_bar + input(단일행)으로 바뀌었다.
// 옛 textarea 의 Enter keyDown 전송 대신 폼 제출이 전송 경로다(SearchFlowLayout.test 와 동형).
function getComposer() {
  return screen.getByPlaceholderText(/내용을 입력해주세요/)
}
function submitComposer() {
  fireEvent.submit(getComposer().closest('form.chat_input_bar'))
}

// ── 1. Messages render ───────────────────────────────────────────────────────
test('renders user and AI messages', () => {
  // F7: chat_topic_bar 가 이제 activeScenario.query 를 표시하는데, 그 값이 시나리오의 첫
  // 사용자 메시지 원문과 같은 문자열이라(scenarios.js) screen 전역 getByText 는 topic bar와
  // chat_thread 두 곳에 매치해 모호해진다. thread 안으로 범위를 좁혀 스레드 렌더만 검증한다.
  const { container } = renderChatTab()
  expect(within(container.querySelector('.chat_thread')).getByText(/민주화운동에 관련된 자료 찾아줘/)).toBeInTheDocument()
  expect(screen.getByText(/민주화운동 관련 자료를 정리했습니다/)).toBeInTheDocument()
})

// ── 2. chat_body 골격 ────────────────────────────────────────────────────────
// R6c-ext D1-6: 옛 그라디언트 인트로 배너(“AI와 깊이있게 대화하기”)는 퍼블 chat_welcome 으로
// 대체되었고 그 소유자는 상위 ChatView 다(문구 단언은 ChatView.test.jsx). 이 파일은 ChatTab 만
// 렌더하므로, 여기서는 ChatTab 이 소유하는 chat_body 구조가 맞는지를 단언한다 —
// welcome 이 여기 있으면 소유 분할이 깨진 것이므로 그 부재도 함께 잠근다.
test('ChatTab 은 chat_body(topic_bar·thread·input_dock)를 소유하고 chat_welcome 은 소유하지 않는다', () => {
  const { container } = renderChatTab()
  const body = container.querySelector('.chat_body')
  expect(body).not.toBeNull()
  expect(body.querySelector('.chat_thread')).not.toBeNull()
  expect(body.querySelector('.chat_input_dock .chat_input_bar')).not.toBeNull()
  // 더미 데모는 lastQuery 가 없어 활성 시나리오의 원본 질의문(scenarios.js query)이 표시된다
  // (F7: label(컬렉션명 '민주화운동') 대신 query를 쓴다 — 무근거 하드코딩 금지).
  expect(container.querySelector('.chat_topic_bar_txt').textContent).toBe('민주화운동에 관련된 자료 찾아줘.')
  expect(container.querySelector('.chat_welcome')).toBeNull()
})

// ── 3. Source pills render and open MaterialModal ────────────────────────────
test('clicking a source pill opens the material modal', () => {
  renderChatTab()
  const pills = getSourcePills()
  expect(pills.length).toBeGreaterThan(0)
  fireEvent.click(pills[0])
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

// ── 4. Composer submit sends message with async loading delay ─────────────────
test('composer 제출이 새 사용자 메시지를 붙이고 로딩 후 AI 답변이 온다', async () => {
  vi.useFakeTimers()
  try {
    renderChatTab()
    const textarea = getComposer()
    const beforePillCount = getSourcePills().length

    fireEvent.change(textarea, { target: { value: '새로운 질문입니다' } })
    submitComposer()

    // User message appears immediately
    expect(screen.getByText('새로운 질문입니다')).toBeInTheDocument()

    // Loading indicator should be visible (Spinner has role="status")
    expect(screen.getByRole('status')).toBeInTheDocument()
    // The loading text should appear
    expect(screen.getByText(/답변 생성 중/)).toBeInTheDocument()

    // Advance timers to flush the 1200ms delay
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })

    // Loading should be gone
    expect(screen.queryByText(/답변 생성 중/)).not.toBeInTheDocument()

    // Source pills should have increased (AI reply has sources)
    expect(getSourcePills().length).toBeGreaterThan(beforePillCount)
  } finally {
    vi.useRealTimers()
  }
})

// ── 5. 빈 입력 제출은 전송되지 않는다 ─────────────────────────────────────────
// R6c-ext D1-6: 퍼블 입력창이 단일행 input 이라 Shift+Enter 줄바꿈(옛 textarea)이 사라졌다.
// 그 자리에 sendMessage 의 `if (!trimmed) return` 가드를 단언한다 — 제출 경로가 폼으로
// 바뀐 뒤에도 빈/공백 입력이 메시지를 만들지 않아야 한다(보존해야 하는 실제 로직).
test('빈(공백) 입력으로 제출하면 아무 메시지도 추가되지 않는다', () => {
  renderChatTab()
  const textarea = getComposer()
  const beforePillCount = getSourcePills().length
  fireEvent.change(textarea, { target: { value: '   ' } })
  submitComposer()
  // No NEW message bubble should have been added — pill count should be same
  expect(getSourcePills().length).toBe(beforePillCount)
  // 로딩 표시도 뜨지 않는다(캔드 응답 타이머가 걸리지 않았다는 뜻)
  expect(screen.queryByText(/답변 생성 중/)).not.toBeInTheDocument()
})

// ── 6. Legacy: original test still passes ────────────────────────────────────
test('chat tab shows messages and source chips open modal (legacy)', () => {
  // F7: topic bar 와 스레드 첫 사용자 메시지가 같은 문자열이라(위 테스트 1 참고) thread로 범위를 좁힌다.
  const { container } = renderChatTab()
  expect(within(container.querySelector('.chat_thread')).getByText(/민주화운동에 관련된 자료 찾아줘/)).toBeInTheDocument()
  const pills = getSourcePills()
  expect(pills.length).toBeGreaterThan(0)
  fireEvent.click(pills[0])
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

// ── 7. Scenario resync: switching scenario updates messages ───────────────────
test('switching scenario resyncs chat messages', () => {
  // Probe component inside ScenarioProvider that can switch scenario
  function Probe() {
    const { setScenarioById } = useScenario()
    return (
      <button onClick={() => setScenarioById('economy')}>
        Switch to Economy
      </button>
    )
  }

  const { container } = render(
    <ToastProvider>
      <ScenarioProvider>
        <MemoryRouter>
          <Probe />
          <ChatTab />
        </MemoryRouter>
      </ScenarioProvider>
    </ToastProvider>
  )
  // F7: topic bar가 activeScenario.query(각 시나리오 첫 사용자 메시지와 동일 문자열)를 표시하므로
  // thread 로 범위를 좁혀 스레드 렌더만 검증한다(topic bar와의 모호 매치 회피).
  const thread = () => container.querySelector('.chat_thread')

  // Democracy scenario messages should be present initially
  expect(within(thread()).getByText(/민주화운동에 관련된 자료 찾아줘/)).toBeInTheDocument()

  // Switch to economy scenario
  fireEvent.click(screen.getByText('Switch to Economy'))

  // Economy scenario first user line should appear
  expect(within(thread()).getByText('경제개발 5개년 계획 관련 자료 보여줘.')).toBeInTheDocument()

  // Democracy-only line should be gone
  expect(within(thread()).queryByText(/민주화운동에 관련된 자료 찾아줘/)).not.toBeInTheDocument()
})

// ── 8. Loading guard: second send while generating is a no-op ──────────────────
test('does not drop the pending AI reply when sending again while loading', async () => {
  vi.useFakeTimers()
  try {
    renderChatTab()
    const textarea = getComposer()
    const beforePillCount = getSourcePills().length

    // First send → user bubble + loading row, AI reply pending
    fireEvent.change(textarea, { target: { value: '첫 번째 질문' } })
    submitComposer()
    expect(screen.getByText('첫 번째 질문')).toBeInTheDocument()
    expect(screen.getByText(/답변 생성 중/)).toBeInTheDocument()

    // Second send WHILE loading (timers not advanced) → must be ignored.
    // The text stays in the composer (guard returns before setInput('')), but
    // NO message bubble should be created for it.
    fireEvent.change(textarea, { target: { value: '두 번째 질문' } })
    submitComposer()
    const secondMsgBubbles = screen
      .queryAllByText('두 번째 질문')
      .filter((el) => el.tagName !== 'INPUT')
    expect(secondMsgBubbles).toHaveLength(0)
    // Guard did not clear the composer, so the draft is preserved
    expect(textarea.value).toBe('두 번째 질문')

    // Flush the original 1200ms delay → first AI reply lands, loading gone
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(screen.queryByText(/답변 생성 중/)).not.toBeInTheDocument()
    expect(getSourcePills().length).toBeGreaterThan(beforePillCount)
  } finally {
    vi.useRealTimers()
  }
})

// round06c 최종 리뷰 must-fix I-2 — 이전에는 clipboard를 전혀 건드리지 않으면서
// '답변을 클립보드에 복사했습니다'라는 성공 문구를 무조건 띄웠다(정직성 위반, OutputTab의
// '준비 중입니다' 계약과도 어긋남). 이제 복사는 실제로 navigator.clipboard.writeText를
// 호출하고, 성공했을 때만 성공 문구를 띄운다. jsdom/비보안 컨텍스트에는 navigator.clipboard가
// 없을 수 있어 각 테스트가 필요한 형태로 직접 정의한다(Object.defineProperty, configurable).
describe('AI 답변 복사 — 실제 클립보드 기록(I-2)', () => {
  afterEach(() => {
    delete navigator.clipboard
  })

  test('복사 버튼 클릭 시 그 메시지 본문으로 writeText가 호출되고 성공 토스트가 뜬다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderChatTab()

    fireEvent.click(screen.getAllByRole('button', { name: '복사' })[0])

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toMatch(/민주화운동 관련 자료를 정리했습니다/)
    expect(screen.getByRole('status')).toHaveTextContent('답변을 클립보드에 복사했습니다')
  })

  test('navigator.clipboard 가 없으면(비보안 컨텍스트 등) 실패 토스트가 뜨고 성공 문구를 말하지 않는다', () => {
    // 존재 가드 대상 — beforeEach는 손대지 않고 이 테스트만 clipboard 부재를 흉내낸다.
    renderChatTab()

    fireEvent.click(screen.getAllByRole('button', { name: '복사' })[0])

    expect(screen.getByRole('status')).toHaveTextContent('복사에 실패했습니다')
  })

  test('writeText 가 reject 하면 실패 토스트가 뜬다', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderChatTab()

    fireEvent.click(screen.getAllByRole('button', { name: '복사' })[0])

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('복사에 실패했습니다'))
  })
})

// round06c 최종 리뷰 must-fix I-2 — '다시 생성'은 재전송 호출이 전혀 없는데 성공 문구
// ('답변을 재생성했습니다')를 띄우고 있었다(정직성 위반). 같은 라운드 OutputTab.jsx의
// '재생성하기'는 이미 '준비 중입니다'로 고쳤다(D1-7) — 이 라운드의 단일 계약으로 통일한다.
test('AI 답변 다시 생성 버튼 클릭 시 "준비 중입니다" 토스트가 뜬다(실동작 없음, 성공 문구 금지)', () => {
  renderChatTab()
  fireEvent.click(screen.getAllByRole('button', { name: '다시 생성' })[0])
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

// ── round07f R1 Minor-3 ───────────────────────────────────────────────────────
// 폼 턴의 자료명을 눌러 여는 자료상세가 더미(데모) 모드에서 껍데기로 떴다.
// ChatCaptionPanel은 {idnbr, name}만 갖고 있어 {id, title, image:null}을 넘기는데,
// 라이브는 MaterialModal이 fetchArtifactDetail로 채워 주지만 더미에는 그 경로가 없어
// 「이미지 없음」 + 메타 3행이 전부 '—'로 떴다. 같은 화면의 출처칩(handleSourceClick)은
// 이미 materials에서 전체 객체를 찾아 넘기므로, 그쪽에 맞춘 것을 잠근다.
test('더미 모드에서 폼 턴의 자료명을 누르면 자료상세가 실제 메타로 채워진다', () => {
  renderChatTab()

  // round07g — 「작업선택」은 커스텀 리스트박스라 「열고 → 고른다」 두 단계다.
  fireEvent.click(screen.getByRole('button', { name: '작업선택' }))
  fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))
  fireEvent.click(screen.getByRole('button', { name: /상세보기/ }))

  // 대화 첫 답변의 sources 중 m1 — materials.js가 meta.location을 갖고 있다.
  fireEvent.click(screen.getByRole('button', { name: '6월 민주항쟁 거리시위 현장 사진' }))

  // 얕은 {id,title,image:null}을 그대로 넘기면 이 값 대신 '—'가 뜬다.
  // round07h Task 6 리뷰 fix(Minor M1) — 수집처/자료번호 행은 location 그대로다.
  // material.id('m1', 앱 내부 키)는 더 이상 이어붙지 않는다 — location이 이미
  // 자료번호를 품고 있어("... H-1001") 내부 키를 다시 붙이면 더미 화면에 앱
  // 내부 id가 노출된다(MaterialModal.jsx idText 주석 참조).
  expect(screen.getByText('서울 종로 / 유물번호 H-1001')).toBeInTheDocument()
  expect(screen.getByText('민주화운동')).toBeInTheDocument()
})

// -- round07g Task4 — 검색모드 토글은 **채팅에서만** 사라졌다 -------------------
// 피그마 채팅 화면(695-100384)에 그 위젯이 없어 ChatTab 에서만 뺐다. 나머지 둘 —
// IntroSearchCard(첫 검색바)·SearchFlowLayout(재검색바) — 는 그대로 둔다(spec 결정 10).
//
// 「채팅에서 없어졌다」만 단언하면 다음 사람이 나머지 둘까지 지워도 초록이다. 그래서
// 한 화면에 둘을 나란히 렌더해 정확히 하나만 남는지를 본다 — 채팅에 되살아나도 red,
// IntroSearchCard 에서 지워도 red 다. 세 번째(SearchFlowLayout)는 그 파일의 테스트가
// 같은 이유로 따로 잠근다(SearchFlowLayout.test.jsx 맨 아래).
//
// searchModesEnabled 는 AuthContext 의 기본값이 true 라(Provider 없이도) 토글이 실제로
// 렌더된다 — 기능 플래그가 꺼져 있어 둘 다 안 보이는 항진명제가 아니다.
test('검색모드 토글은 채팅 입력 바에서만 사라졌다 — 첫 검색바에는 남아 있다', () => {
  function Both() {
    const [q, setQ] = useState('')
    return (
      <ToastProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <ChatTab />
            <IntroSearchCard value={q} onChange={setQ} onSearch={() => {}} />
          </MemoryRouter>
        </ScenarioProvider>
      </ToastProvider>
    )
  }
  const { container } = render(<Both />)

  // 한 화면에 토글은 정확히 하나 — 그리고 그 하나는 첫 검색바의 것이다.
  const toggles = screen.getAllByRole('button', { name: '검색 대상 선택' })
  expect(toggles).toHaveLength(1)
  expect(container.querySelector('.intro_search_box').contains(toggles[0])).toBe(true)

  // 채팅 입력 바 안에는 흔적도 없다.
  const bar = container.querySelector('.chat_input_bar')
  expect(bar).not.toBeNull()
  expect(bar.querySelector('.search_mode')).toBeNull()
  expect(bar.contains(toggles[0])).toBe(false)
})

// ── round10 Task7 — 프로젝트 상세의 읽기 전용 대화 탭(브리프 Step1) ────────────
// ProjectDetail이 <ReadOnlyProvider value={true}>로 감싸 이 화면을 재생한다(Task6).
// 저장된 대화·출처는 그대로 보여주되(허용: 보기·상세보기), 새 질문·재생성·
// 산출물 생성(작업선택도 입력 도크 안에 있다)은 막는다(spec §5-4·§5-5, Global
// Constraints).
describe('ChatTab 읽기 전용(round10)', () => {
  function renderChatTabReadOnly() {
    return render(
      <ToastProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <ReadOnlyProvider value={true}>
              <ChatTab />
            </ReadOnlyProvider>
          </MemoryRouter>
        </ScenarioProvider>
      </ToastProvider>
    )
  }

  test('읽기 전용이면 입력창·전송 버튼이 없다', () => {
    const { container } = renderChatTabReadOnly()
    expect(screen.queryByPlaceholderText(/내용을 입력해주세요/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전송' })).not.toBeInTheDocument()
    // 도크째 사라진다 — 작업선택(TaskSelect)도 이 안에 있어 함께 사라진다
    // (채팅에서 새 산출물을 만드는 진입점도 함께 막힌다).
    expect(container.querySelector('.chat_input_dock')).toBeNull()
  })

  test('읽기 전용이어도 대화와 출처는 그대로 보인다', () => {
    const { container } = renderChatTabReadOnly()
    expect(
      within(container.querySelector('.chat_thread')).getByText(/민주화운동에 관련된 자료 찾아줘/)
    ).toBeInTheDocument()
    expect(getSourcePills().length).toBeGreaterThan(0)
  })

  test('읽기 전용이면 「다시 생성」이 없다', () => {
    renderChatTabReadOnly()
    expect(screen.queryByRole('button', { name: '다시 생성' })).not.toBeInTheDocument()
    // 복사는 "보기" 범주라 그대로 남는다 — 다시 생성만 콕 집어 막는지도 함께 본다.
    expect(screen.getAllByRole('button', { name: '복사' }).length).toBeGreaterThan(0)
  })

  // round10 사용자 결정(2026-09-16 라이브 검증) — 읽기 전용에서는 주제 바도 라이브러리에
  // 저장한 제목으로 채운다. 질의문이 떠 있으면 「지금 이 질의로 대화하는 중」처럼 읽혀,
  // 칠 수 없는 채팅을 칠 수 있는 것처럼 보인다.
  function renderWithTitle(title) {
    return render(
      <ToastProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <ReadOnlyProvider value={true}>
              <ChatTab topicTitle={title} />
            </ReadOnlyProvider>
          </MemoryRouter>
        </ScenarioProvider>
      </ToastProvider>
    )
  }

  test('읽기 전용이면 주제 바가 저장한 프로젝트 제목을 보여준다', () => {
    const { container } = renderWithTitle('1970년대 관광 정책 정리')
    const bar = container.querySelector('.chat_topic_bar_txt')
    expect(bar).toHaveTextContent('1970년대 관광 정책 정리')
    // 질의문이 그 자리에 남아 있지 않다.
    expect(bar).not.toHaveTextContent('민주화운동')
  })

  test('제목을 주지 않으면 기존 동작 그대로 질의문을 보여준다', () => {
    // 자료검색 화면(ChatView)은 이 prop 을 주지 않는다 — 그 경로가 바뀌지 않는지 잠근다.
    const { container } = renderChatTabReadOnly()
    expect(container.querySelector('.chat_topic_bar_txt')).not.toHaveTextContent(
      '1970년대 관광 정책 정리'
    )
  })
})
