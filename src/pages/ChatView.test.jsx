// 이 파일의 책임: /search/chat 본문(ChatView + ChatTab)이 publish-v2 ai_chat.html 구조로
// 렌더되고, 라이브 대화 로직(전송·인용칩·다시생성/복사 토스트)이 그 구조 위에서 보존됨을 잠근다.
//
// 퍼블 정본: workspace/design/publish-v2/page/ai_chat.html L43-96
//   result_wrap.ty_chat > chat_welcome + chat_body(chat_topic_bar · chat_thread · chat_input_dock)
// 소유 분할: ChatView = result_wrap.ty_chat + chat_welcome / ChatTab = chat_body 이하.
// (SearchResults 가 자기 result_wrap 을 소유하는 D1-5 패턴과 같은 결.)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioProvider, ScenarioContext } from '../context/ScenarioContext.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import ChatView from './ChatView.jsx'

afterEach(() => vi.restoreAllMocks())

/** 라이브 주입 — ScenarioProvider 를 우회해 컨텍스트 값을 직접 넣는다(ChatTab.live.test 와 동형). */
function liveCtx(over = {}) {
  return {
    isLive: true,
    activeScenario: { id: 'democracy', chat: [], materialIds: [] },
    lastQuery: '1987년 민주화 운동의 전개 과정',
    poolSize: 200,
    chatMessages: [
      { role: 'user', text: '1987년 민주화 운동의 결정적 사건이 뭐야?' },
      {
        role: 'ai',
        text: '박종철 고문치사 사건[1]이 결정적 계기였습니다.',
        citations: [
          { n: 1, idnbr: 'PS-1', name: '박종철 고문치사 사건 기록', image_url: '/images/PS-1' },
        ],
      },
    ],
    chatStatus: 'idle',
    chatNotice: null,
    sendChatMessage: vi.fn(),
    ...over,
  }
}

function renderLive(over = {}) {
  const ctx = liveCtx(over)
  const utils = render(
    <ToastProvider>
      <ScenarioContext.Provider value={ctx}>
        <MemoryRouter>
          <ChatView />
        </MemoryRouter>
      </ScenarioContext.Provider>
    </ToastProvider>,
  )
  return { ...utils, ctx }
}

function renderDummy() {
  return render(
    <ToastProvider>
      <ScenarioProvider>
        <MemoryRouter>
          <ChatView />
        </MemoryRouter>
      </ScenarioProvider>
    </ToastProvider>,
  )
}

describe('ChatView — publish-v2 골격', () => {
  it('result_wrap.ty_chat 래퍼 안에 chat_welcome 과 chat_body 가 있다', () => {
    const { container } = renderDummy()
    const wrap = container.querySelector('.result_wrap.ty_chat')
    expect(wrap).not.toBeNull()
    const welcome = wrap.querySelector('.chat_welcome')
    const body = wrap.querySelector('.chat_body')
    expect(welcome).not.toBeNull()
    expect(body).not.toBeNull()
    // 퍼블 순서: chat_welcome 이 chat_body 보다 앞
    expect(welcome.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('chat_welcome 문구가 퍼블 정본과 같다', () => {
    renderDummy()
    expect(screen.getByText('SA:I가 더 도와드릴까요?')).toHaveClass('chat_welcome_tit')
    expect(
      screen.getByText('검색 결과를 바탕으로 자유롭게 질문하세요 · 모든 답변에 출처 인용'),
    ).toHaveClass('chat_welcome_desc')
  })

  it('대화 스레드가 chat_thread > chat_msg(ty_user/ty_ai)로 렌더된다', () => {
    const { container } = renderLive()
    const thread = container.querySelector('.chat_body .chat_thread')
    expect(thread).not.toBeNull()
    expect(thread.querySelectorAll('.chat_msg.ty_user').length).toBe(1)
    expect(thread.querySelectorAll('.chat_msg.ty_ai').length).toBe(1)
    expect(container.querySelector('.chat_msg.ty_user .chat_msg_bubble').textContent)
      .toContain('결정적 사건이 뭐야?')
    // AI 메시지는 아바타 + content(bubble + actions) 구조
    expect(container.querySelector('.chat_msg.ty_ai .chat_msg_avatar')).not.toBeNull()
    expect(container.querySelector('.chat_msg.ty_ai .chat_msg_content .chat_msg_bubble_txt'))
      .not.toBeNull()
  })

  it('chat_topic_bar 는 검색 질의(lastQuery)를 근거로 표시한다', () => {
    const { container } = renderLive()
    const txt = container.querySelector('.chat_topic_bar .chat_topic_bar_txt')
    expect(txt).not.toBeNull()
    expect(txt.textContent).toBe('1987년 민주화 운동의 전개 과정')
  })

  it('질의가 없으면 chat_topic_bar 를 렌더하지 않는다(무근거 문구 금지)', () => {
    const { container } = renderLive({ lastQuery: '', chatMessages: [] })
    expect(container.querySelector('.chat_topic_bar')).toBeNull()
  })
})

describe('ChatView — 인용칩(chat_cite_item)', () => {
  it('인용이 chat_msg_cite 안의 chat_cite_item(num + txt)으로 렌더된다', () => {
    const { container } = renderLive()
    const chips = container.querySelectorAll('.chat_msg_cite .chat_cite_item')
    expect(chips.length).toBe(1)
    expect(chips[0].querySelector('.chat_cite_num').textContent).toBe('1')
    expect(chips[0].querySelector('.chat_cite_txt').textContent).toBe('박종철 고문치사 사건 기록')
    // 접근명은 기존 계약 유지([n] 자료명) — 회귀 0
    expect(chips[0]).toHaveAttribute('aria-label', '[1] 박종철 고문치사 사건 기록')
  })

  it('인용칩 클릭 시 자료상세 모달이 열린다', () => {
    renderLive()
    fireEvent.click(screen.getByRole('button', { name: '[1] 박종철 고문치사 사건 기록' }))
    // MaterialModal 은 자료명을 제목으로 렌더한다
    expect(screen.getAllByText('박종철 고문치사 사건 기록').length).toBeGreaterThan(1)
  })
})

describe('ChatView — 라이브 전송과 액션 토스트', () => {
  // F1(리뷰): 전송 버튼(ChatTab.jsx:307)은 onClick 이 없다 — type="submit" 이라는 구조적
  // 사실 하나로만 전송이 성립한다(Enter 암시적 제출도 같은 전제). 나머지 전송 테스트는
  // fireEvent.submit(form)으로 폼을 직접 때려도 되지만, 이 테스트만은 실제 사용자 트리거
  // (버튼 클릭)를 거쳐야 "누가 type을 button으로 바꾸거나 버튼을 form 밖으로 옮기면 green을
  // 유지한 채 라이브 전송이 죽는" 회귀를 잡을 수 있다.
  it('입력 후 전송 버튼 클릭 시 sendChatMessage 가 호출된다(실제 전송 트리거)', () => {
    const { container, ctx } = renderLive()
    const input = container.querySelector('.chat_input_bar_input')
    expect(input).not.toBeNull()
    expect(input).toHaveAttribute('placeholder', '내용을 입력해주세요')
    fireEvent.change(input, { target: { value: '전시 소장품도 추천해줘' } })
    const sendBtn = screen.getByRole('button', { name: '전송' })
    // Enter 암시적 제출이 성립하려면 버튼이 폼의 submit 버튼이어야 한다 — 그 구조적 전제를 잠근다.
    expect(sendBtn).toHaveAttribute('type', 'submit')
    fireEvent.click(sendBtn)
    expect(ctx.sendChatMessage).toHaveBeenCalledWith('전시 소장품도 추천해줘')
  })

  it('전송 버튼의 접근명은 퍼블과 같다', () => {
    renderLive()
    expect(screen.getByRole('button', { name: '전송' })).toBeInTheDocument()
  })

  // round06c 최종 리뷰 must-fix I-2: 다시 생성은 실동작(재전송)이 없으므로 OutputTab.jsx
  // (D1-7)와 같은 '준비 중입니다'로 통일했다 — 이전의 '답변을 재생성했습니다'는 아무 일도
  // 안 하면서 성공을 선언하는 거짓 문구였다(ChatTab.test.jsx가 상세 계약을 잠근다).
  it('"다시 생성" 클릭 시 "준비 중입니다" 토스트가 뜬다(실동작 없음)', () => {
    renderLive()
    fireEvent.click(screen.getAllByRole('button', { name: '다시 생성' })[0])
    expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  })

  // round06c 최종 리뷰 must-fix I-2: 복사는 이제 navigator.clipboard.writeText를 실제로
  // 호출한다(ChatTab.test.jsx가 성공/실패 각 경로를 상세히 잠근다) — 여기서는 그 배선이
  // 이 화면(ChatView) 위에서도 살아있는지만 확인한다.
  it('"복사" 클릭 시 클립보드에 실제로 쓰고 정확 문구 토스트가 뜬다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderLive()
    fireEvent.click(screen.getAllByRole('button', { name: '복사' })[0])
    expect(await screen.findByText('답변을 클립보드에 복사했습니다')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledTimes(1)
    delete navigator.clipboard
  })
})

// ── 퍼블 정합 잠금(¼ 축소 방지) ──────────────────────────────────────────────
// round06d 에서 Tailwind spacing 스케일이 px 기반이 됐다(px-6 = 6px). 퍼블 1.2rem(=24px)을
// px-6 으로 옮기면 값이 ¼로 줄어 화면이 눈에 보이게 어긋난다(MaterialModal.test.jsx A1 선례).
// 패딩·간격은 이식한 chat_* CSS 가 담당하므로, 이 요소들에 한 자리 spacing 유틸이 되살아나면 red.
describe('ChatView — 퍼블이 담당하는 패딩/간격에 Tailwind 유틸이 없다', () => {
  it.each([
    ['.result_wrap.ty_chat'],
    ['.chat_welcome'],
    ['.chat_body'],
    ['.chat_topic_bar'],
    ['.chat_thread'],
    ['.chat_msg.ty_user .chat_msg_bubble'],
    ['.chat_msg.ty_ai .chat_msg_content'],
    ['.chat_msg_cite'],
    ['.chat_cite_item'],
    ['.chat_msg_actions'],
    ['.chat_input_dock'],
    ['.chat_input_bar'],
    ['.chat_input_send'],
  ])('%s 에 ¼ 축소 유틸이 없다', (sel) => {
    const { container } = renderLive()
    const el = container.querySelector(sel)
    expect(el, `${sel} 가 렌더되지 않았다`).not.toBeNull()
    expect(el.className).not.toMatch(/\b[pmg][xytblr]?-\d\b/)
  })
})
