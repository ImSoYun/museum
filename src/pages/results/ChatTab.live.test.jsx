import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import ChatTab from './ChatTab.jsx'
import { defaultOutputTitle } from '../../lib/outputTitles.js'
// round10b B-4 — 채팅의 학예 기획 자료(exhibit) 결정 모달은 산출물생성 탭과 같은
// ExhibitModal을 재사용한다. 그 모달의 기본 컬럼 목록이 곧 채팅 흐름의 기본
// 요청 컬럼이므로, 손으로 다시 베끼지 않고 원본을 그대로 가져와 대조한다.
import { DEFAULT_COLUMNS } from './ExhibitModal.jsx'

afterEach(() => vi.restoreAllMocks())

const baseCtx = {
  isLive: true,
  activeScenario: { id: 'democracy', chat: [], materialIds: [] },
  lastQuery: '일제강점기 교과서',
  poolSize: 200,
  chatMessages: [],
  chatStatus: 'idle',
  chatNotice: null,
  sendChatMessage: vi.fn(),
}

function renderWith(ctx) {
  return render(
    <ToastProvider>
      <ScenarioContext.Provider value={{ ...baseCtx, ...ctx }}>
        <ChatTab />
      </ScenarioContext.Provider>
    </ToastProvider>,
  )
}

describe('ChatTab 라이브', () => {
  it('빈 대화 초기 상태에 검색 맥락 안내가 뜬다', () => {
    renderWith({})
    expect(screen.getByText(/일제강점기 교과서.*200건.*질문/)).toBeInTheDocument()
  })

  it('스트리밍 중이면 단계 배지가 뜬다', () => {
    renderWith({ chatStatus: 'retrieve' })
    expect(screen.getByText('자료 찾는 중 …')).toBeInTheDocument()
  })

  // R6c-ext D1-6: 칩의 자리가 문장 안(인라인 치환)에서 퍼블 위치(chat_msg_bubble 안의
  // chat_msg_cite 2열 그리드)로 옮겨졌다. 파싱 로직 단언(매핑된 번호만 칩이 된다)은 불변이고,
  // 본문의 [55] 표기는 텍스트로 남아 어느 문장이 어느 출처인지 잃지 않는다.
  it('ai 메시지의 [n]이 citations와 매핑되면 인용칩(chat_cite_item)으로 렌더된다', () => {
    const { container } = renderWith({
      chatMessages: [
        { role: 'user', text: '질문' },
        { role: 'ai', text: '국어독본 권5[55]는 조선총독부가 펴냈다',
          citations: [{ n: 55, idnbr: 'PS-55', name: '국어독본 권5',
                        image_url: '/images/PS-55' }] },
      ],
    })
    const chip = screen.getByRole('button', { name: /\[55\]/ })
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveClass('chat_cite_item')
    // 퍼블 위치 — 버블 안 chat_msg_cite 그리드의 자식이다
    expect(container.querySelector('.chat_msg_bubble .chat_msg_cite').contains(chip)).toBe(true)
    expect(chip.querySelector('.chat_cite_num').textContent).toBe('55')
    expect(chip.querySelector('.chat_cite_txt').textContent).toBe('국어독본 권5')
    // 본문 텍스트에 [55] 표기가 그대로 남는다
    expect(container.querySelector('.chat_msg_bubble_txt').textContent).toContain('[55]')
  })

  it('칩 클릭 시 상세 모달이 열린다(합성 material)', () => {
    renderWith({
      chatMessages: [
        { role: 'user', text: 'q' },
        { role: 'ai', text: '[55] 참조',
          citations: [{ n: 55, idnbr: 'PS-55', name: '국어독본 권5',
                        image_url: '/images/PS-55' }] },
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: /\[55\]/ }))
    // MaterialModal은 title을 헤더로 렌더한다
    expect(screen.getAllByText('국어독본 권5').length).toBeGreaterThan(0)
  })

  it('묶음 인용 [n, m]도 각 번호가 개별 칩으로 렌더된다', () => {
    const { container } = renderWith({
      isLive: true, lastQuery: '민주화', poolSize: 200,
      chatMessages: [{ role: 'ai', text: '자료 [18, 14] 그리고 [7]을 보라.', citations: [
        { n: 18, idnbr: 'PS-18', name: '전단 십팔', image_url: '/images/PS-18' },
        { n: 14, idnbr: 'PS-14', name: '전단 십사', image_url: '/images/PS-14' },
      ] }],
      chatStatus: null, chatNotice: null, sendChatMessage: vi.fn(),
    })
    expect(screen.getByRole('button', { name: '[18] 전단 십팔' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '[14] 전단 십사' })).toBeInTheDocument()
    // 칩은 정확히 2개 — 묶음이 분해되고 매핑 없는 번호는 칩이 되지 않는다(D1-6 위치: chat_msg_cite)
    expect(container.querySelectorAll('.chat_msg_cite .chat_cite_item').length).toBe(2)
    // 매핑 없는 [7]은 칩이 아니라 일반 텍스트로 남는다
    expect(screen.queryByRole('button', { name: /\[7\]/ })).toBeNull()
    expect(screen.getByText(/\[7\]/)).toBeInTheDocument()
  })

  it('chatNotice가 있으면 배너로 표시한다', () => {
    renderWith({ chatNotice: '질의 정리에 실패해 원문으로 검색했습니다' })
    expect(screen.getByTestId('chat-notice-banner')).toBeInTheDocument()
  })

  it('단계 스피너는 메시지 목록 아래(대화 위치)에서 돈다', () => {
    const { container } = renderWith({
      isLive: true, lastQuery: '백자', poolSize: 200,
      chatMessages: [{ role: 'user', text: '백자 질문' }],
      chatStatus: 'retrieve', chatNotice: null, sendChatMessage: vi.fn(),
    })
    const html = container.innerHTML
    const userIdx = html.indexOf('백자 질문')
    const badgeIdx = html.indexOf('자료 찾는 중')
    expect(userIdx).toBeGreaterThan(-1)
    expect(badgeIdx).toBeGreaterThan(userIdx)  // 배지가 사용자 메시지 뒤(아래)에 렌더
  })
})

describe('ChatTab 라이브 — 칩 모달 image URL(API base 있을 때, 회귀 가드)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.resetModules()
  })

  it('칩 클릭 → 모달 img의 src가 BASE+image_url로 정확히 접두된다(크로스오리진 배포 대비)', async () => {
    // MaterialModal은 mount 시 isLive()(searchApi)==true면 fetchArtifactDetail을 호출한다.
    // found:false로 응답해 detail을 null로 유지시켜, 모달이 handleChip이 넣어준
    // material.image(= toAbsolute(cit.image_url))로 폴백하는 경로를 강제로 타게 한다 —
    // 이것이 검증 대상인 ChatTab.jsx의 handleChip 라인이다.
    global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ found: false }) })

    // 파일 상단의 정적 import(ChatTab·ScenarioContext·ToastProvider)는 모두 BASE=''로
    // 바인딩된 옛 모듈 그래프다. resetModules 이후 스텁된 BASE를 ChatTab이 읽게 하려면
    // ChatTab을 동적으로 다시 로드해야 하고, 그 fresh ChatTab의 useScenario()/useToast()가
    // 찾는 Context 객체도 "같은 모듈 인스턴스"여야 하므로 Provider들도 함께 동적 로드한다.
    const { default: ChatTabFresh } = await import('./ChatTab.jsx')
    const { ScenarioContext: FreshScenarioContext } = await import('../../context/ScenarioContext.jsx')
    const { ToastProvider: FreshToastProvider } = await import('../../components/Toast.jsx')

    const ctx = {
      isLive: true,
      activeScenario: { id: 'democracy', chat: [], materialIds: [] },
      lastQuery: '질의',
      poolSize: 10,
      chatMessages: [
        { role: 'user', text: 'q' },
        {
          role: 'ai',
          text: '답 [1]',
          citations: [{ n: 1, idnbr: 'ABC-99', name: '유물', image_url: '/images/ABC-99' }],
        },
      ],
      chatStatus: 'idle',
      chatNotice: null,
      sendChatMessage: vi.fn(),
    }

    const { container } = render(
      <FreshToastProvider>
        <FreshScenarioContext.Provider value={ctx}>
          <ChatTabFresh />
        </FreshScenarioContext.Provider>
      </FreshToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /\[1\]/ }))

    // 모달이 실제로 렌더됐는지 먼저 확인(제목을 헤더로 렌더) — 공허 단정 방지.
    expect(screen.getAllByText('유물').length).toBeGreaterThan(0)

    // AI 답변 아바타 img(alt="")가 모달 img보다 DOM에 먼저 오므로, 검증 대상을
    // alt=자료명으로 특정한다. .src 프로퍼티는 jsdom이 document baseURI로 자동
    // 절대화해 상대경로 버그를 가려버리므로(공허화) 반드시 getAttribute로 원문을 읽는다.
    //
    // round10c Task A1 — MaterialModal의 오버레이가 document.body로 포털되면서
    // (MaterialModal.jsx L1 참조) 렌더한 container 안에는 더 이상 모달 마크업이 없다.
    // 그래서 container가 아니라 document에서 찾는다.
    const img = document.querySelector('img[alt="유물"]')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('https://api.example.com/images/ABC-99')
  })
})

// 사용자 실사용 버그(2026-07-28) — 결과기반 AI대화에서 답변이 스트리밍되는 동안 스크롤이
// 상단에 고정돼 생성되는 텍스트를 볼 수 없었다. 근본 원인은 옛 sentinel(sr_only 스팬)이
// column flex 컨테이너(chat_body)의 절대배치 자식이라 static position이 컨테이너 시작점
// (상단)으로 계산됐기 때문(CSS Flexbox 스펙 — 자세한 내용은 ChatTab.jsx 근본 원인 주석).
// 그래서 ChatTab.jsx는 이제 sentinel/scrollIntoView 없이 document.scrollingElement의
// scrollTop을 scrollHeight로 직접 대입한다 — 이 테스트는 그 대입 자체를 검증한다.
// ScenarioContext.appendAi는 토큰마다 배열과 마지막 메시지 객체를 새로 만들어(참조 동일성이
// 깨짐) 리렌더를 유발한다 — 여기서는 그 갱신을 rerender + 새 chatMessages 배열로 흉내낸다.
describe('ChatTab 라이브 — 스트리밍 중 자동 스크롤(버그 2026-07-28, 근본 원인 수정)', () => {
  const scrollingEl = () => document.scrollingElement || document.documentElement

  // scrollTop을 get/set 모두 스텁한다 — get은 "바닥 근처" 판정(window scroll 리스너)이
  // 읽고, set은 자동 스크롤 effect가 실제로 대입했는지(스파이) 검증하는 관측점이다.
  function stubScrollMetrics({ scrollTop, clientHeight, scrollHeight }) {
    let value = scrollTop
    const setScrollTop = vi.fn((v) => { value = v })
    Object.defineProperty(scrollingEl(), 'scrollTop', {
      configurable: true,
      get: () => value,
      set: setScrollTop,
    })
    Object.defineProperty(scrollingEl(), 'clientHeight', { value: clientHeight, configurable: true })
    Object.defineProperty(scrollingEl(), 'scrollHeight', { value: scrollHeight, configurable: true })
    return setScrollTop
  }

  afterEach(() => {
    delete scrollingEl().scrollTop
    delete scrollingEl().clientHeight
    delete scrollingEl().scrollHeight
  })

  function streamingCtx(text) {
    return {
      chatMessages: [
        { role: 'user', text: '질문' },
        { role: 'ai', text, citations: null },
      ],
      chatStatus: 'generate',
    }
  }

  function rerenderWithToken(rerender, text) {
    rerender(
      <ToastProvider>
        <ScenarioContext.Provider value={{ ...baseCtx, ...streamingCtx(text) }}>
          <ChatTab />
        </ScenarioContext.Provider>
      </ToastProvider>,
    )
  }

  it('토큰이 append되어 chatMessages 참조가 바뀌면(바닥 근처) 문서 scrollTop이 scrollHeight로 대입된다', () => {
    // 바닥에서 80px 임계값 이내(2350 >= 1920)이므로 "바닥 근처"로 판정돼야 한다.
    const setScrollTop = stubScrollMetrics({ scrollTop: 1950, clientHeight: 400, scrollHeight: 2000 })

    const { rerender } = renderWith(streamingCtx('답변 생성'))
    setScrollTop.mockClear()

    rerenderWithToken(rerender, '답변 생성 중')

    expect(setScrollTop).toHaveBeenCalledWith(2000)
  })

  // round07f R1 Minor-2 — 자동 스크롤 deps의 captionTurns가 무테스트였다(빼도 전부 초록).
  // 폼 턴은 대화 목록 안에 그려지지만 chatMessages를 바꾸지 않으므로, deps에 captionTurns가
  // 없으면 턴을 연 직후 화면이 바닥으로 내려가지 않아 **방금 연 폼이 화면 밖에 접혀 있다**.
  it('메시지가 그대로여도 폼 턴을 열면 문서가 바닥으로 내려간다(deps의 captionTurns)', () => {
    const setScrollTop = stubScrollMetrics({ scrollTop: 1950, clientHeight: 400, scrollHeight: 2000 })

    renderWith(streamingCtx('답변 생성'))
    setScrollTop.mockClear()

    // 「작업선택」으로 폼 턴을 연다 — chatMessages는 한 글자도 바뀌지 않는다.
    // round07g — 네이티브 <select> 가 커스텀 리스트박스(TaskSelect)로 바뀌어
    // 「열고 → 고른다」 두 단계다. 이 테스트가 보는 것(자동 스크롤)은 그대로다.
    fireEvent.click(screen.getByRole('button', { name: '작업선택' }))
    fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))

    expect(screen.getByText('설명문 캡션 만들어줘')).toBeInTheDocument()
    expect(setScrollTop).toHaveBeenCalledWith(2000)
  })

  it('사용자가 위로 스크롤해 이전 답변을 읽는 중이면(바닥에서 먼 위치) 새 토큰이 와도 문서를 끌어내리지 않는다', () => {
    // 바닥에서 1520px 떨어져(400 < 1920) 임계값 밖 — "바닥 근처"가 아니다.
    const setScrollTop = stubScrollMetrics({ scrollTop: 0, clientHeight: 400, scrollHeight: 2000 })

    const { rerender } = renderWith(streamingCtx('답변 생성'))

    // 사용자가 위로 스크롤했다는 신호 — 컨테이너 onScroll이 아니라 window의 scroll이다
    // (문서가 스크롤되는 구조라서).
    fireEvent.scroll(window)
    setScrollTop.mockClear()

    rerenderWithToken(rerender, '답변 생성 중')

    expect(setScrollTop).not.toHaveBeenCalled()
  })
})


// round07f — 설명문 생성이 「답변 아래 상시 노출 폼」에서 **대화의 한 턴**으로 바뀌었다
// (대조표 §4). 그래서 round07e가 잠갔던 7건이 전제부터 달라진다: 폼은 더 이상 저절로
// 뜨지 않고 「작업선택」 드롭다운을 골라야 열리며, 성공 신호의 자리가 토스트에서 대화
// 버블로 옮겨졌다. 아래는 그 7건을 새 흐름으로 다시 쓴 것 + 턴 흐름 자체를 잠그는
// 신규분이다.
//
// 격리 mock은 위 "칩 모달 image URL" 블록과 같은 기법(vi.doMock + resetModules +
// 동적 재import)이다. **doMock 팩토리가 모듈 전체를 대체**하므로, ChatTab이 import하는
// outputsApi의 export는 여기 전부 실려 있어야 한다 — createOutput만 실어 두면 ChatTab의
// `import { downloadOutputFile }` 한 줄에 이 describe 블록 전체가
// "No export named 'downloadOutputFile'"로 죽는다.
describe('설명문 생성(채팅 인라인, round07f 대화 턴)', () => {
  const createOutput = vi.fn()
  const downloadOutputFile = vi.fn()
  const triggerBrowserDownload = vi.fn()
  // round07f 최종 리뷰 I-3 — 이 describe 는 **자기 sendChatMessage 목**을 쓴다.
  // 모듈 상단 baseCtx 의 vi.fn() 은 파일 전체가 공유해 호출 이력이 누적되므로,
  // 「부르지 않았다」를 그 목으로 단언하면 앞선 테스트의 이력에 오염된다.
  const sendChatMessage = vi.fn()

  beforeEach(() => {
    sendChatMessage.mockReset()
    vi.resetModules()
    vi.doMock('../../lib/outputsApi.js', () => ({
      createOutput: (...a) => createOutput(...a),
      // round07f — ChatTab이 완료 턴의 파일 카드 다운로드를 위해 이것도 import한다.
      // 팩토리가 모듈 전체를 대체하므로 여기 없으면 import 자체가 실패한다.
      downloadOutputFile: (...a) => downloadOutputFile(...a),
      // round10a A조 최종 리뷰 I-2 — UNKNOWN_OUTCOME이 outputsApi.js로 옮겨간 뒤
      // (OutputTab.jsx 파일 상단 주석 참조) ChatTab.jsx도 그것을 import한다 — 전체
      // 교체 목이라 여기도 실어야 import가 죽지 않는다.
      UNKNOWN_OUTCOME: new Set([0, 502, 503, 504]),
    }))
    vi.doMock('../../lib/downloadFile.js', () => ({
      triggerBrowserDownload: (...a) => triggerBrowserDownload(...a),
    }))
  })

  afterEach(() => {
    createOutput.mockReset()
    downloadOutputFile.mockReset()
    triggerBrowserDownload.mockReset()
    vi.doUnmock('../../lib/outputsApi.js')
    vi.doUnmock('../../lib/downloadFile.js')
  })

  /** 같은 격리 mock 위에서 컨텍스트만 갈아 끼운 트리를 만든다 — rerender에 그대로
   *  넘길 수 있어야 「대화가 이어진다/바뀐다」를 흉내낼 수 있다(round07f R1).
   *  vi.resetModules()는 beforeEach에서 한 번만 돌므로 한 테스트 안의 재import는
   *  같은 모듈 인스턴스를 돌려준다 — 즉 rerender가 같은 컴포넌트 타입을 받아
   *  ChatTab이 **리마운트되지 않는다**(실제 앱에서 검색바로 재검색할 때와 같다). */
  async function freshView(ctx, props) {
    const { default: ChatTabFresh } = await import('./ChatTab.jsx')
    const { ScenarioContext: FreshScenarioContext } = await import('../../context/ScenarioContext.jsx')
    const { ToastProvider: FreshToastProvider } = await import('../../components/Toast.jsx')
    return (
      <FreshToastProvider>
        <FreshScenarioContext.Provider value={{ ...baseCtx, sendChatMessage, ...ctx }}>
          <ChatTabFresh {...props} />
        </FreshScenarioContext.Provider>
      </FreshToastProvider>
    )
  }

  async function freshRenderWith(ctx, props) {
    return render(await freshView(ctx, props))
  }

  const oneCitedTurn = (idnbr = 'PS-1', name = '국어독본 권5') => ([
    { role: 'user', text: 'q' },
    { role: 'ai', text: '[1] 참조', citations: [{ n: 1, idnbr, name, image_url: '' }] },
  ])

  /** 「작업선택」 드롭다운으로 폼 턴을 연다 — round07f의 유일한 진입점이다.
   *
   *  round07g — 네이티브 <select> 를 그만두고 커스텀 리스트박스(TaskSelect)가 됐다.
   *  목록을 **위로** 펼쳐야 하는데 브라우저가 <select> 의 펼침 방향을 지정하게 해
   *  주지 않기 때문이다. 그래서 진입이 「트리거를 눌러 열고 → 항목을 고른다」 두 단계다.
   *
   *  트리거 라벨은 고르고 나면 「설명문 캡션 작성」/「학예 기획 자료 작성」으로
   *  바뀐다(피그마 원문 — 목록은 「생성」, 닫힌 라벨은 「작성」이다). round07k 최종
   *  리뷰 F5 — (당시) 특별전시 쪽 닫힌 라벨이 빠져 있었다. 지금까지는 아무
   *  테스트도 그 종류를 고른 뒤 드롭다운을 다시 여는 경로를 타지 않아 들키지
   *  않았을 뿐이다(제품 결함이 아니라 이 헬퍼의 사각지대였다). round10b B-4 —
   *  그 자리가 특별전시(exhibition)에서 학예 기획 자료(exhibit)로 바뀌었다
   *  (chatTasks.js 정의부 주석 참조). 세 라벨을 다 받아야 같은 항목을 다시 골라
   *  턴을 또 여는 경로가 이 헬퍼 하나로 유지된다. */
  const taskTrigger = () => screen.getByRole('button', { name: /^(작업선택|설명문 캡션 작성|학예 기획 자료 작성)$/ })
  function pickCaptionTask() {
    fireEvent.click(taskTrigger())
    fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))
  }

  // ── round07f 연장 — 생성은 **두 단계**다 ────────────────────────────────
  // 폼의 「생성하기」는 만들지 않고 결정 모달(피그마 ③)을 연다. 모달의 「생성하기」가
  // 비로소 만든다. 두 버튼의 이름이 같으므로 자리로 가른다 — 모달은 대화 목록보다
  // **뒤에** 렌더되므로 문서상 마지막 「생성하기」가 모달의 것이다.
  // (「폼 버튼이 바로 만들지 않는다」 자체는 아래 전용 테스트가 따로 잠근다.)
  function openDecisionModal(formIndex = 0) {
    fireEvent.click(screen.getAllByRole('button', { name: '생성하기' })[formIndex])
  }

  function confirmDecision() {
    const buttons = screen.getAllByRole('button', { name: '생성하기' })
    expect(buttons.length).toBeGreaterThan(1) // 폼 + 모달 — 모달이 실제로 떠 있다
    fireEvent.click(buttons[buttons.length - 1])
  }

  /** 폼 → 모달 → 생성, 한 번에. */
  function generateViaModal(formIndex = 0) {
    openDecisionModal(formIndex)
    confirmDecision()
  }

  it('답변이 없으면(대화 이력이 비어 있으면) 작업선택이 disabled다', async () => {
    await freshRenderWith({})
    expect(taskTrigger()).toBeDisabled()
    // round07g — 커스텀 리스트박스라 disabled 가 「목록이 안 열린다」로 이어지는지도 본다
    // (네이티브라면 브라우저가 보장하던 것을 이제 컴포넌트가 보장한다).
    fireEvent.click(taskTrigger())
    expect(screen.queryByRole('listbox')).toBeNull()
    // 폼은 상시 노출이 아니라 아예 없다 — 열기 전에는 생성하기가 존재하지 않는다.
    expect(screen.queryByRole('button', { name: '생성하기' })).toBeNull()
  })

  it('답변이 있으면 작업선택으로 폼 턴을 열 수 있고 참고자료 건수를 말한다', async () => {
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    // 고르기 전에는 폼이 없다(round07e의 상시 노출과 갈리는 지점).
    expect(screen.queryByRole('button', { name: '생성하기' })).toBeNull()

    pickCaptionTask()

    expect(screen.getByText('설명문 캡션 만들어줘')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성하기' })).toBeInTheDocument()
    expect(screen.getByText(/총 1건/)).toBeInTheDocument()
  })

  it('여러 턴에 걸쳐 같은 idnbr가 인용돼도 한 번만 센다', async () => {
    await freshRenderWith({
      chatMessages: [
        { role: 'user', text: 'q1' },
        { role: 'ai', text: '[1]', citations: [{ n: 1, idnbr: 'PS-1', name: '국어독본 권5', image_url: '' }] },
        { role: 'user', text: 'q2' },
        { role: 'ai', text: '[1] 다시 인용', citations: [{ n: 1, idnbr: 'PS-1', name: '국어독본 권5', image_url: '' }] },
      ],
    })
    pickCaptionTask()
    expect(screen.getByText(/총 1건/)).toBeInTheDocument()
  })

  it('생성하기를 누르면 kind=caption·selection=[{node:"대화", idnbrs}]로 요청한다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o9', file_name: 'a.docx' } })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    generateViaModal()

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    // round07e 최종 리뷰 F5(c) — toMatchObject만으로는 format·timeline이 빠지거나
    // exhibit 전용 columns가 섞여 들어가도 초록으로 남는다. OutputTab.live.test.jsx가
    // 이미 잠근 것과 같은 수준으로 payload 전체를 확정한다(round07d가 "한쪽만 잠긴
    // 계약"으로 겪은 문제의 재발 방지). 대화 턴으로 흐름이 바뀌어도 **서버 계약은
    // 그대로**여야 하므로 이 단언은 round07e에서 글자 그대로 옮겨 왔다.
    const payload = createOutput.mock.calls[0][0]
    expect(payload).toMatchObject({
      kind: 'caption',
      selection: [{ node: '대화', idnbrs: ['PS-1'] }],
      // round07f 연장 — 형식은 **docx 고정**(폼에도 모달에도 고를 자리가 없다).
      format: 'docx',
      // 모달의 타임라인 체크박스는 기본 켜짐이므로, 그냥 생성하면 true다.
      timeline: true,
      // 제목도 입력칸이 없다 — 기존 헬퍼 defaultOutputTitle이 정한다.
      title: defaultOutputTitle('caption', { timeline: true }),
    })
    expect(payload).not.toHaveProperty('columns')
  })

  // round07g — 산출물 목록이 **대화로 걸러진다**. 채팅에서 만든 설명문도 같은
  // 목록에 쌓이므로 여기서 대화 id 를 빠뜨리면 그 산출물만 서버에 NULL 로 저장돼
  // **만든 직후부터 어느 목록에도 뜨지 않는다**(만들었는데 사라지는 침묵의 실패).
  it('생성 요청에 이 대화의 conversation_id 가 실린다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o9', file_name: 'a.docx' } })
    await freshRenderWith({ chatMessages: oneCitedTurn(), conversationId: 'conv-CHAT' })
    pickCaptionTask()

    generateViaModal()

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0]).toMatchObject({ conversation_id: 'conv-CHAT' })
  })

  // ── round07f 연장 — 폼과 실제 생성 사이에 결정 모달이 한 단계 있다 ──────────
  // 이것이 없으면 아래 confirmDecision 헬퍼(문서 마지막 「생성하기」)가 폼 버튼을
  // 눌러도 초록이 되어, 모달을 통째로 들어내도 아무도 모른다.
  it('폼의 「생성하기」는 바로 만들지 않고 결정 모달을 띄운다', async () => {
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    // 이 시점에 「생성하기」는 폼의 것 하나뿐이다.
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    expect(createOutput).not.toHaveBeenCalled()
    expect(
      screen.getByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.'),
    ).toBeInTheDocument()
    // 모달이 떴으므로 이제 「생성하기」가 둘이다(폼 + 모달).
    expect(screen.getAllByRole('button', { name: '생성하기' })).toHaveLength(2)
  })

  // ── 사용자가 명시적으로 요구한 지점 ────────────────────────────────────────
  // 폼에서 ✕로 지운 것을 **뺀** 건수가 모달에 떠야 한다. 모달이 turn.docs를
  // 스스로 세면 3건이라 말하고 2건을 만든다.
  it('모달의 건수는 폼에서 ✕로 제외한 것을 뺀 실제 건수다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o9', file_name: 'a.docx' } })
    await freshRenderWith({
      chatMessages: [
        { role: 'user', text: 'q' },
        {
          role: 'ai',
          text: '[1][2][3]',
          citations: [
            { n: 1, idnbr: 'PS-1', name: '자료하나', image_url: '' },
            { n: 2, idnbr: 'PS-2', name: '자료둘', image_url: '' },
            { n: 3, idnbr: 'PS-3', name: '자료셋', image_url: '' },
          ],
        },
      ],
    })
    pickCaptionTask()
    expect(screen.getByText('대화에서 나온 총 3건 자료를 바탕으로 생성하겠습니다.'))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /상세보기/ }))
    fireEvent.click(screen.getByRole('button', { name: '자료하나 PS-1 제외' }))
    openDecisionModal()

    // 폼과 모달이 같은 수를 말한다 — 3이 아니라 2다.
    expect(screen.getAllByText('대화에서 나온 총 2건 자료를 바탕으로 생성하겠습니다.'))
      .toHaveLength(2)
    expect(screen.queryByText(/총 3건/)).toBeNull()

    // 그리고 실제 요청도 같은 2건이다(표시와 요청이 갈리지 않는다).
    confirmDecision()
    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0].selection).toEqual([
      { node: '대화', idnbrs: ['PS-2', 'PS-3'] },
    ])
  })

  it('모달에서 타임라인을 끄면 제목도 「설명문 캡션_YYMMDD」로 따라간다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o9', file_name: 'a.docx' } })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()
    openDecisionModal()

    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    confirmDecision()

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    const payload = createOutput.mock.calls[0][0]
    expect(payload.timeline).toBe(false)
    expect(payload.title).toBe(defaultOutputTitle('caption', { timeline: false }))
    expect(payload.title).not.toBe(defaultOutputTitle('caption', { timeline: true }))
  })

  it('취소하면 모달만 닫히고 폼 턴은 남아 다시 시도할 수 있다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o9', file_name: 'a.docx' } })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()
    openDecisionModal()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    // 모달만 사라진다.
    expect(screen.queryByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.')).toBeNull()
    expect(createOutput).not.toHaveBeenCalled()
    // 폼 턴은 그대로 살아 있다 — 다시 눌러 만들 수 있다.
    expect(screen.getByText('설명문 캡션 만들어줘')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()

    generateViaModal()
    await waitFor(() => expect(createOutput).toHaveBeenCalledTimes(1))
  })

  it('생성에 성공하면 완료 문구가 대화 버블로 남는다(토스트 아님, 자동 다운로드 없음)', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: '설명문 캡션_260902.docx' },
    })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    generateViaModal()

    expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
    // round07e의 토스트 문구는 사라졌다 — 같은 신호가 두 자리에서 나면 안 된다.
    expect(screen.queryByText('산출물 생성이 완료되었습니다')).toBeNull()
    // 완료 후에도 자동으로 받지 않는다 — 파일 카드를 눌러야 받는다.
    expect(downloadOutputFile).not.toHaveBeenCalled()
    // 생성이 끝나면 모달은 닫혀 있다.
    expect(screen.queryByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.')).toBeNull()
  })

  // ── round07f 연장 — 완료 턴은 텍스트 링크가 아니라 파일 카드다(피그마 ④) ────
  it('완료 턴은 건수 문구 + 파일명 + DOCX 뱃지 카드로 그린다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: '설명문 캡션 + 타임라인_260903.docx' },
    })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    generateViaModal()

    expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
    // 완료 문구의 건수도 폼·모달과 같은 수를 쓴다(피그마 원문 — 「건의」다).
    expect(
      screen.getByText('대화에서 나온 총 1건의 자료를 바탕으로 설명문 캡션 생성'),
    ).toBeInTheDocument()

    // 카드 — 확장자를 뗀 파일명 + 형식 뱃지. 뱃지는 파일명 추측이 아니라 실제 요청한
    // 형식(docx 고정)에서 온다.
    const card = screen.getByRole('button', { name: /설명문 캡션 \+ 타임라인_260903/ })
    expect(within(card).getByText('설명문 캡션 + 타임라인_260903')).toBeInTheDocument()
    expect(within(card).getByText('DOCX')).toBeInTheDocument()
    // 확장자는 뱃지가 말하므로 파일명 줄에 붙여 두 번 말하지 않는다.
    expect(within(card).queryByText(/\.docx$/)).toBeNull()
  })

  // 피그마는 폼 턴과 완료 턴을 **함께** 그린다. 다만 같은 폼으로 두 번 만들 수는 없다.
  it('완료 뒤에도 폼 턴이 남지만 읽기 전용이 된다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: '설명문 캡션_260903.docx' },
    })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    generateViaModal()
    expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()

    // 폼은 대화에 남아 있다.
    expect(screen.getByText('설명문 캡션 생성')).toBeInTheDocument()
    expect(screen.getByText('참고자료')).toBeInTheDocument()
    // 하지만 다시 만들 수 없다 — 생성하기와 ✕가 잠긴다.
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /상세보기/ }))
    expect(screen.getByRole('button', { name: '국어독본 권5 PS-1 제외' })).toBeDisabled()

    // 눌러도 모달이 다시 뜨지 않고 두 번째 요청도 나가지 않는다.
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(screen.queryByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.')).toBeNull()
    expect(createOutput).toHaveBeenCalledTimes(1)
  })

  it('완료 턴의 파일 카드를 누르면 그때 다운로드를 요청한다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: '설명문 캡션_260902.docx' },
    })
    const blob = new Blob(['x'])
    downloadOutputFile.mockResolvedValue({ ok: true, blob, filename: '설명문 캡션_260902.docx' })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    generateViaModal()
    const card = await screen.findByRole('button', { name: /설명문 캡션_260902/ })
    fireEvent.click(card)

    await waitFor(() =>
      expect(downloadOutputFile).toHaveBeenCalledWith('o1', '설명문 캡션_260902.docx'))
    await waitFor(() =>
      expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, '설명문 캡션_260902.docx'))
  })

  it('생성 실패는 서버 사유를 토스트로 보여주고 턴이 폼으로 되돌아온다', async () => {
    createOutput.mockResolvedValue({ ok: false, notice: 'LLM 호출에 실패했습니다' })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    generateViaModal()

    // 실패 경로만 토스트를 쓴다(성공은 대화 버블).
    expect(await screen.findByText('LLM 호출에 실패했습니다')).toBeInTheDocument()
    // 턴이 busy에 갇히지 않고 폼으로 되돌아와 다시 시도할 수 있다.
    expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()
  })

  // ── round10a A조 최종 리뷰 I-2 — 응답을 못 받은 것을 「실패」로 단정하지 않는다 ────
  // OutputTab.jsx의 notifyCreateFailure(같은 createOutput·같은 UNKNOWN_OUTCOME)와
  // 같은 판정을 이 화면도 이제 본다(final-findings.md I-2 — 두 곳이 lib/outputsApi.js의
  // 같은 Set을 본다). 이 화면은 대화 이력의 출처자료 전부를 상한 없이 보내(파일 상단
  // 주석) 노드 선택보다 느려질 수 있는 경로라 이 판정이 특히 필요하다.
  it('502면 만들어졌을 수 있다고 말하고 목록을 새로 고친다(round10a A조 I-2)', async () => {
    createOutput.mockResolvedValue({ ok: false, status: 502, notice: '산출물 생성에 실패했습니다' })
    const bumpOutputsVersion = vi.fn()
    await freshRenderWith({ chatMessages: oneCitedTurn(), bumpOutputsVersion })
    pickCaptionTask()

    generateViaModal()

    expect(await screen.findByText(/만들어졌을 수 있습니다/)).toBeInTheDocument()
    expect(screen.queryByText('산출물 생성에 실패했습니다')).toBeNull()
    expect(bumpOutputsVersion).toHaveBeenCalled()
  })

  // round07e 최종 리뷰 F2(c)가 잠근 조건은 그대로다 — 다만 자리가 8초 토스트에서
  // 완료 버블 아래 회색 문구로 옮겨졌다. 턴은 스스로 사라지지 않으므로 표시 시간을
  // 벌 필요가 없어졌다.
  it('타임라인을 켰는데 0건이면 완료 버블 아래에 사유를 함께 말한다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o9', file_name: 'a.docx', timeline_count: 0 },
    })
    await freshRenderWith({ chatMessages: oneCitedTurn() })
    pickCaptionTask()

    // 타임라인은 결정 모달에서 정한다(기본 켜짐) — 폼에는 체크박스가 없다.
    openDecisionModal()
    expect(screen.getByLabelText('타임라인 생성')).toBeChecked()
    confirmDecision()

    expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
    expect(
      screen.getByText('다만 자료에 연도 근거가 부족해 타임라인 항목이 만들어지지 않았습니다.'),
    ).toBeInTheDocument()
    // 옛 8초 토스트 문구는 더 이상 없다.
    expect(
      screen.queryByText(
        '산출물 생성이 완료되었습니다 — 다만 자료에 연도 근거가 부족해 타임라인 항목이 만들어지지 않았습니다.',
      ),
    ).toBeNull()
  })

  describe('작업선택 — 대화 턴 흐름(round07f)', () => {
    it('작업선택 드롭다운이 입력창 옆에 있고, 목록은 트리거 위로 펼친다', async () => {
      const { container } = await freshRenderWith({ chatMessages: oneCitedTurn() })
      const trigger = taskTrigger()
      // 자리가 계약이다 — 대화 밖 패널이 아니라 입력 바 안이다.
      expect(container.querySelector('.chat_input_bar').contains(trigger)).toBe(true)

      // round07g — 입력 바는 화면 맨 아래(.chat_input_dock)라 아래로 열면 목록이
      // 잘린다. 피그마는 패널을 입력 바 **위**에 그린다. jsdom 은 레이아웃을 계산하지
      // 않으므로 좌표로는 볼 수 없다 — 여기서는 화면 안에서 패널이 트리거보다
      // DOM 앞에 온다(정상 흐름이면 그것만으로 위다)는 것을 잠근다. 짝이 되는 CSS 층
      // (.chat_task_select_panel 의 bottom 기준 배치)은 css-contract.test.js 몫이다.
      fireEvent.click(trigger)
      const panel = screen.getByRole('listbox')
      expect(container.querySelector('.chat_input_bar').contains(panel)).toBe(true)
      expect(panel.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy()
      // 피그마 원문 두 줄이 이 순서로 있다.
      // round07k에서 특별전시 자료 생성이 작업선택 목록에 추가됐었고, round10b
      // B-4에서 학예 기획 자료 생성으로 바뀌었다(chatTasks.js 정의부 주석 참조).
      // 플레이스홀더(작업선택)는 항상 마지막에 온다.
      expect(screen.getAllByRole('option').map((o) => o.textContent))
        .toEqual(['설명문 캡션 생성', '학예 기획 자료 생성', '작업선택'])
    })

    it('폼 턴은 대화 목록(chat_thread) 안, 연 시점의 메시지 뒤에 놓인다', async () => {
      const { container } = await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      const html = container.innerHTML
      expect(html.indexOf('[1] 참조')).toBeGreaterThan(-1)
      expect(html.indexOf('설명문 캡션 만들어줘')).toBeGreaterThan(html.indexOf('[1] 참조'))
      // 대화 밖 패널이 아니라 대화 목록의 한 줄이다.
      expect(
        container.querySelector('.chat_thread').contains(screen.getByText('설명문 캡션 만들어줘')),
      ).toBe(true)
    })

    it('여러 번 고르면 턴이 누적된다', async () => {
      await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      pickCaptionTask()
      expect(screen.getAllByText('설명문 캡션 만들어줘')).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: '생성하기' })).toHaveLength(2)
    })

    // round07f 연장 — 제목 입력·형식 라디오가 사라지면서 「턴마다 DOM id·radio name이
    // 갈린다」는 검증 대상 자체가 없어졌다(그 테스트는 지웠다). 턴 사이에 남은 유일한
    // 지역 상태는 ✕ 제외이므로, 그것이 턴마다 독립인지를 대신 잠근다 — 턴A에서 지운
    // 자료가 턴B에서도 사라지면 사용자가 만들려던 것과 다른 것이 만들어진다.
    it('턴이 둘이어도 ✕ 제외 상태가 턴마다 독립이다', async () => {
      createOutput.mockResolvedValue({ ok: true, data: { id: 'o9', file_name: 'a.docx' } })
      await freshRenderWith({
        chatMessages: [
          { role: 'user', text: 'q' },
          {
            role: 'ai',
            text: '[1][2]',
            citations: [
              { n: 1, idnbr: 'PS-1', name: '자료하나', image_url: '' },
              { n: 2, idnbr: 'PS-2', name: '자료둘', image_url: '' },
            ],
          },
        ],
      })
      pickCaptionTask()
      pickCaptionTask()

      // 둘째 턴만 펼쳐 한 건을 뺀다.
      fireEvent.click(screen.getAllByRole('button', { name: /상세보기/ })[1])
      fireEvent.click(screen.getByRole('button', { name: '자료하나 PS-1 제외' }))

      // 둘째 턴은 1건, 첫째 턴은 그대로 2건이다.
      expect(screen.getByText('대화에서 나온 총 1건 자료를 바탕으로 생성하겠습니다.'))
        .toBeInTheDocument()
      expect(screen.getByText('대화에서 나온 총 2건 자료를 바탕으로 생성하겠습니다.'))
        .toBeInTheDocument()

      // 첫째 턴으로 만들면 두 건이 그대로 나간다.
      generateViaModal(0)
      await waitFor(() => expect(createOutput).toHaveBeenCalled())
      expect(createOutput.mock.calls[0][0].selection).toEqual([
        { node: '대화', idnbrs: ['PS-1', 'PS-2'] },
      ])
    })

    // ── round07f 최종 리뷰 I-3 ───────────────────────────────────────────────
    // spec 결정 7 「채팅 생성 폼 턴은 대화 이력에 저장하지 않는다」는 이 라운드에서
    // 가장 위험한 계약인데(사용자가 「멀티턴 건드는 거 아니지?」로 못박은 자리)
    // 잠겨 있지 않았다 — openCaptionTurn 에 sendChatMessage('설명문 캡션 만들어줘')
    // 한 줄을 심어 **폼 턴을 실제로 서버 대화 이력에 저장**시켜도 1401건이 전부
    // 초록이었다(항진명제). 그렇게 되면 다음 AI 답변의 LLM 컨텍스트에 UI 조작이
    // 대화 내용으로 섞이고, `?c=` 로 재개했을 때 폼이 없는 유령 사용자 발화가
    // 되살아난다.
    //
    // 바로 아래 「리마운트하면 턴이 사라진다」는 **화면에 없다**만 본다 —
    // 「전송하지 않았다」는 다른 단언이라 여기서 따로 잠근다.
    it('폼 턴을 열어도 서버 대화 이력에는 아무것도 보내지 않는다', async () => {
      await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      // 화면에는 사용자 발화처럼 보이는 버블이 있다 — 그것이 지역 상태일 뿐임을
      // 「서버로 나가지 않았다」로 말한다.
      expect(screen.getByText('설명문 캡션 만들어줘')).toBeInTheDocument()
      expect(sendChatMessage).not.toHaveBeenCalled()
    })

    it('턴을 여러 번 열어도, 제출해 완료돼도 대화 이력으로 새지 않는다', async () => {
      createOutput.mockResolvedValue({
        ok: true, data: { id: 'o1', file_name: '설명문 캡션_260902.docx' },
      })
      await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      pickCaptionTask()
      generateViaModal(0)

      expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
      // 완료 문구(AI 버블처럼 보인다)도 지역 상태다 — 서버는 이 턴을 모른다.
      expect(sendChatMessage).not.toHaveBeenCalled()
    })

    // 위 두 단언의 **대조군**이다. 이것이 없으면 sendChatMessage 배선을 통째로
    // 들어내도 「부르지 않았다」가 초록으로 남아 계약이 다시 항진명제가 된다.
    it('반면 입력창으로 보낸 진짜 발화는 서버로 나간다(대조군)', async () => {
      await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      fireEvent.change(screen.getByLabelText('내용을 입력해주세요'), {
        target: { value: '더 알려줘' },
      })
      fireEvent.click(screen.getByRole('button', { name: '전송' }))

      expect(sendChatMessage).toHaveBeenCalledTimes(1)
      expect(sendChatMessage).toHaveBeenCalledWith('더 알려줘')
    })

    it('새로고침(리마운트)하면 턴이 사라진다 — 서버에 저장하지 않는다', async () => {
      const { unmount } = await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      expect(screen.getByText('설명문 캡션 만들어줘')).toBeInTheDocument()

      unmount()

      await freshRenderWith({ chatMessages: oneCitedTurn() })
      expect(screen.queryByText('설명문 캡션 만들어줘')).toBeNull()
    })

    it('폼 턴의 자료명을 누르면 자료상세 모달이 열린다', async () => {
      await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()
      fireEvent.click(screen.getByRole('button', { name: /상세보기/ }))
      fireEvent.click(screen.getByRole('button', { name: '국어독본 권5' }))
      // MaterialModal은 title을 헤더로 렌더한다 — 목록의 이름과 함께 2곳 이상이 된다.
      expect(screen.getAllByText('국어독본 권5').length).toBeGreaterThan(1)
    })

    // ── round07f R1 Important-2 ──────────────────────────────────────────────
    // ChatTab의 atIndex 인터리브(메시지와 턴을 **섞어** 그리기)가 무테스트였다:
    // turnsHere를 []로·후행 필터를 ()=>true로 바꿔 「항상 목록 끝에 붙이기」로
    // 되돌려도 전 테스트가 초록이었다. 턴을 연 **뒤** 대화를 계속하는 것이 그
    // 로직의 유일한 관측점이므로, rerender로 대화를 한 턴 더 진행시켜 잠근다.
    it('턴을 연 뒤 대화를 계속하면 새 메시지가 턴 **아래**에 붙는다(턴이 목록 끝으로 밀리지 않는다)',
      async () => {
        const msgs1 = [
          { role: 'user', text: 'q1' },
          { role: 'ai', text: '답변하나', citations: [] },
        ]
        // conversationId를 고정한다 — 같은 대화가 이어지는 상황이다(턴은 살아야 한다).
        const { container, rerender } = await freshRenderWith({
          chatMessages: msgs1, conversationId: 'conv-1',
        })
        pickCaptionTask()

        const msgs2 = [
          ...msgs1,
          { role: 'user', text: 'q2질문' },
          { role: 'ai', text: '답변둘', citations: [] },
        ]
        rerender(await freshView({ chatMessages: msgs2, conversationId: 'conv-1' }))

        // 같은 대화가 이어졌으므로 턴은 살아 있다.
        expect(screen.getByText('설명문 캡션 만들어줘')).toBeInTheDocument()

        const html = container.innerHTML
        const at = (t) => {
          const i = html.indexOf(t)
          expect(i, `'${t}'가 화면에 없다`).toBeGreaterThan(-1)
          return i
        }
        // 턴은 연 시점의 마지막 답변 **뒤**, 그 뒤 새 질문 **앞**이다.
        expect(at('답변하나')).toBeLessThan(at('설명문 캡션 만들어줘'))
        expect(at('설명문 캡션 만들어줘')).toBeLessThan(at('q2질문'))
        expect(at('q2질문')).toBeLessThan(at('답변둘'))
      })

    // ── round07f R1 Important-1 ──────────────────────────────────────────────
    // 새 검색은 ScenarioContext.runLiveSearch가 chatMessages를 비우고 conversationId를
    // 갈아 끼운다. ChatTab은 같은 라우트라 리마운트되지 않으므로, 이 잠금이 없으면
    // 옛 폼 턴이 빈 새 대화에 그대로 남아 **옛 자료로 새 질의 이름의 산출물**을 만든다.
    it('새 검색으로 대화가 비워지면 옛 폼 턴을 버린다 — 옛 자료로는 아무것도 만들 수 없다',
      async () => {
        const { rerender } = await freshRenderWith({
          chatMessages: oneCitedTurn(), conversationId: 'conv-1', lastQuery: '옛질의',
        })
        pickCaptionTask()
        expect(screen.getByRole('button', { name: '생성하기' })).toBeInTheDocument()

        // 새 검색 — runLiveSearch가 하는 그대로(대화 비움 + conversationId 리셋).
        rerender(await freshView({
          chatMessages: [], conversationId: null, lastQuery: '새질의',
        }))

        // 1) 옛 턴이 화면에 남지 않는다.
        expect(screen.queryByText('설명문 캡션 만들어줘')).toBeNull()
        expect(screen.queryByRole('button', { name: '생성하기' })).toBeNull()

        // 2) 새 대화가 자라도 되살아나지 않는다(옛 방어 블록은 여기서 되살렸다).
        rerender(await freshView({
          chatMessages: [
            { role: 'user', text: '새질의' },
            { role: 'ai', text: '새 답변', citations: [] },
          ],
          conversationId: 'conv-2',
          lastQuery: '새질의',
        }))
        expect(screen.queryByText('설명문 캡션 만들어줘')).toBeNull()
        expect(screen.queryByRole('button', { name: '생성하기' })).toBeNull()
        // 어떤 경로로도 옛 자료(PS-1)가 새 질의 이름으로 나가지 않았다.
        expect(createOutput).not.toHaveBeenCalled()
      })

    // round07g — 턴만 버리면 반쪽이다. 커스텀 드롭다운은 고른 값을 들고 있어(피그마가
    // 고른 뒤 닫힌 라벨을 「설명문 캡션 작성」으로 그린다) 대화가 비워져도 그 문장이
    // 남는다 — 지난 대화의 잔상인데, 그 트리거는 disabled 라 눌러 되돌릴 수도 없다.
    // 대화 신원(conversationId)이 갈리면 고른 작업도 폼 턴과 함께 버린다.
    it('새 검색으로 대화가 비워지면 작업선택 라벨도 「작업선택」으로 되돌아온다', async () => {
      const { rerender } = await freshRenderWith({
        chatMessages: oneCitedTurn(), conversationId: 'conv-1', lastQuery: '옛질의',
      })
      pickCaptionTask()
      expect(screen.getByRole('button', { name: '설명문 캡션 작성' })).toBeInTheDocument()

      rerender(await freshView({ chatMessages: [], conversationId: null, lastQuery: '새질의' }))

      expect(screen.getByRole('button', { name: '작업선택' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '설명문 캡션 작성' })).toBeNull()
    })

    // 위 잠금의 우회로 — 결정 모달이 떠 있는 채로 새 검색이 나면, 턴은 버려져도
    // 모달은 옛 idnbrs를 그대로 들고 있다. 그 상태로 「생성하기」를 누르면 **옛 자료를
    // 새 질의 이름으로** 보낸다(위 테스트가 막으려는 바로 그 사고).
    it('결정 모달이 열린 채 새 검색이 나면 모달도 함께 닫힌다', async () => {
      const { rerender } = await freshRenderWith({
        chatMessages: oneCitedTurn(), conversationId: 'conv-1', lastQuery: '옛질의',
      })
      pickCaptionTask()
      openDecisionModal()
      expect(
        screen.getByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.'),
      ).toBeInTheDocument()

      // 새 검색 — runLiveSearch가 하는 그대로(대화 비움 + conversationId 리셋).
      rerender(await freshView({
        chatMessages: [], conversationId: null, lastQuery: '새질의',
      }))

      expect(screen.queryByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.')).toBeNull()
      expect(screen.queryByRole('button', { name: '생성하기' })).toBeNull()
      expect(createOutput).not.toHaveBeenCalled()
    })

    // ── round07f R1 Minor-1 ──────────────────────────────────────────────────
    // createOutput은 실패를 {ok:false}로 흡수하지만 2xx 본문의 res.json() 한 경로만
    // 예외로 새어 나온다(outputsApi.js requestJson). 그때도 턴이 busy에 갇히면 안 된다.
    it('createOutput이 예외를 던져도 턴이 busy에 갇히지 않고 폼으로 돌아온다', async () => {
      createOutput.mockRejectedValue(new SyntaxError('Unexpected end of JSON input'))
      await freshRenderWith({ chatMessages: oneCitedTurn() })
      pickCaptionTask()

      generateViaModal()

      // 사유를 알린다(조용히 멈추지 않는다).
      expect(await screen.findByText('산출물 생성에 실패했습니다')).toBeInTheDocument()
      // 폼으로 되돌아와 다시 시도할 수 있다 — 「만드는 중…」(busy)에 갇히지 않는다.
      expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: '만드는 중…' })).toBeNull()
    })

    // ── round10b B-4 — 학예 기획 자료(exhibit)를 대화에서 만든다 ────────────────
    // (round07k 시절엔 이 자리가 특별전시(exhibition, docx)였다 — 사용자 결정으로
    // 채팅에서는 빼고 학예 기획 자료(exhibit, xlsx)를 넣었다, triage #11.)
    // 설명문과 같은 참고자료 박스·"두 단계(폼→결정)" 골격을 쓰되, 결정 단계는
    // **새 모달이 아니라 산출물생성 탭의 ExhibitModal을 그대로 재사용**한다
    // (사용자 결정 — "산출물 생성처럼 똑같이 할거야"). 그래서 결정 모달의 제목·
    // 컬럼 선택 UI는 캡션 결정 모달과 다르게 생겼다 — 이 describe는 사용자 버블
    // 문구·POST의 kind·columns·완료 카드 뱃지(xlsx)를 잠근다.
    describe('학예 기획 자료 생성(채팅 인라인, round10b B-4)', () => {
      function pickExhibitTask() {
        fireEvent.click(taskTrigger())
        fireEvent.click(screen.getByRole('option', { name: '학예 기획 자료 생성' }))
      }

      it('학예 기획 자료를 고르면 그 종류의 폼이 열리고 kind=exhibit·query·columns를 함께 보낸다', async () => {
        createOutput.mockResolvedValue({
          ok: true, data: { id: 'e1', file_name: '학예 기획 자료 목록_260909.xlsx' },
        })
        await freshRenderWith({ chatMessages: oneCitedTurn(), lastQuery: '민주화 운동' })

        pickExhibitTask()

        expect(screen.getByText('학예 기획 자료 만들어줘')).toBeInTheDocument()
        expect(screen.getByText('학예 기획 자료 생성')).toBeInTheDocument()

        openDecisionModal()
        // 결정 모달 — ExhibitModal 재사용이라 타임라인 체크박스가 없다(원래
        // 산출물생성 탭에서도 없다 — round07e에서 제거된 자리다).
        expect(screen.queryByRole('checkbox')).toBeNull()
        // ExhibitModal은 제목·컬럼에 기본값을 이미 채워 두므로(defaultTitle·
        // DEFAULT_COLUMNS) 아무것도 더 채우지 않아도 바로 제출할 수 있다.
        confirmDecision()

        await waitFor(() => expect(createOutput).toHaveBeenCalled())
        const payload = createOutput.mock.calls[0][0]
        expect(payload.kind).toBe('exhibit')
        // 서버가 topic = req.query or req.title 로 주제를 정한다(routes.py:334) —
        // query를 빠뜨리면 주제가 조용히 제목으로 대체된다.
        expect(payload.query).toBe('민주화 운동')
        // exhibit은 columns를 반드시 싣고, format·timeline은 아예 싣지 않는다 —
        // 서버 validator가 조합이 어긋나면 422로 거부한다(routes.py _check_combination).
        expect(payload.columns).toEqual(DEFAULT_COLUMNS)
        expect(payload).not.toHaveProperty('format')
        expect(payload).not.toHaveProperty('timeline')
        expect(payload.selection).toEqual([{ node: '대화', idnbrs: ['PS-1'] }])
      })

      it('완료 문구는 학예 기획 자료 문구를 쓰고, 완료 카드는 XLSX 뱃지를 단다', async () => {
        createOutput.mockResolvedValue({
          ok: true,
          data: { id: 'e1', file_name: '학예 기획 자료 목록_260909.xlsx', timeline_count: 0 },
        })
        await freshRenderWith({ chatMessages: oneCitedTurn() })
        pickExhibitTask()
        generateViaModal()

        expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
        expect(
          screen.getByText('대화에서 나온 총 1건의 자료를 바탕으로 학예 기획 자료 생성'),
        ).toBeInTheDocument()
        // turn.result.emptyTimeline은 설명문 전용 개념이다(turn.kind==='caption' 가드) —
        // 서버가 무관한 timeline_count:0을 돌려줘도 exhibit 턴에는 뜨지 않는다.
        expect(
          screen.queryByText('다만 자료에 연도 근거가 부족해 타임라인 항목이 만들어지지 않았습니다.'),
        ).toBeNull()
        const card = screen.getByRole('button', { name: /학예 기획 자료 목록_260909/ })
        // round10b — exhibit은 xlsx 고정이다(caption의 docx와 다르다,
        // CHAT_OUTPUT_FORMAT_BY_KIND 정의부 주석 참조). 뱃지가 실제 파일과
        // 다른 확장자를 말하면 안 된다.
        expect(within(card).getByText('XLSX')).toBeInTheDocument()
      })

      // 결정 모달이 종류별로 진짜 갈리는지 — 한 턴의 결정 모달이 다른 턴의
      // 종류로 새지 않는지를 잠근다.
      it('설명문 턴과 학예 기획 자료 턴이 함께 있어도 결정 모달이 종류를 섞지 않는다', async () => {
        await freshRenderWith({ chatMessages: oneCitedTurn() })
        pickCaptionTask()
        pickExhibitTask()

        // 둘째 턴(학예 기획 자료) 폼의 생성하기 — 뜨는 모달은 ExhibitModal이어야
        // 한다. 그 모달의 제목은 CHAT_TASKS.exhibit.panelTitle이 아니라 ExhibitModal
        // 자신이 정한 고정 문구다(산출물생성 탭과 같은 모달을 그대로 쓰기 때문).
        openDecisionModal(1)
        expect(screen.getByRole('heading', { name: '학예 기획 자료 목록' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '설명문 생성' })).toBeNull()
        expect(screen.queryByRole('checkbox')).toBeNull()
      })

      // submitTaskTurn의 실패 분기(created.notice를 그대로 토스트로 옮기고 턴을
      // 폼으로 되돌린다)가 exhibit 턴에서도 caption과 같게 동작하는지 잠근다 —
      // 실제 서버 사유(30건 상한 등)의 재현은 이 테스트의 범위가 아니다.
      it('실패 응답의 notice가 토스트로 그대로 뜨고 폼으로 되돌아온다', async () => {
        createOutput.mockResolvedValue({
          ok: false,
          notice: '산출물 생성에 실패했습니다',
        })
        await freshRenderWith({ chatMessages: oneCitedTurn() })
        pickExhibitTask()

        generateViaModal()

        expect(await screen.findByText('산출물 생성에 실패했습니다')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()
      })

      // round10b B-4 — ExhibitModal은 "노드" 칩(nodeId·label·count)을 그리는
      // 컴포넌트인데, 채팅에는 노드가 없다. ChatTab이 대화가 모은 자료 하나하나를
      // 칩 하나로 재해석해 넘긴다(ChatTab.jsx decisionChips 정의부 참조) — 그 재해석이
      // 실제로 맞물리는지, 즉 칩의 라벨이 "노드 이름"이 아니라 "자료 이름"인지를 잠근다.
      it('결정 모달의 칩 라벨은 노드가 아니라 대화가 인용한 자료 이름이다', async () => {
        await freshRenderWith({
          chatMessages: [
            { role: 'user', text: 'q' },
            {
              role: 'ai',
              text: '[1][2]',
              citations: [
                { n: 1, idnbr: 'PS-1', name: '국어독본 권5', image_url: '' },
                { n: 2, idnbr: 'PS-2', name: '창가집', image_url: '' },
              ],
            },
          ],
        })
        pickExhibitTask()
        openDecisionModal()

        // "창가집"은 대화 답변의 인용칩(chat_cite_item)에도 같은 글자가 있어
        // screen 전역으로 찾으면 모호해진다 — 결정 모달 안으로 범위를 좁힌다.
        const modal = screen.getByRole('heading', { name: '학예 기획 자료 목록' }).closest('.fixed')
        expect(within(modal).getByText('국어독본 권5')).toBeInTheDocument()
        expect(within(modal).getByText('창가집')).toBeInTheDocument()
        // ExhibitModal 원래 용법(산출물생성 탭)의 "노드"라는 말은 채팅엔 없다.
        expect(within(modal).queryByText(/노드를 열어/)).toBeNull()
      })

      // 결정 단계에서 칩을 제거하면(ExhibitModal의 ✕) 실제 POST의 idnbrs·selection에서도
      // 그 자료가 빠져야 한다 — 화면이 "뺐다"고 보여 주고 서버엔 그대로 보내면
      // 화면과 실제 요청이 다른 말을 하는 조용한 실패가 된다(코딩표준 §6).
      it('결정 모달에서 칩을 제거하면 그 자료가 요청에서도 빠진다', async () => {
        createOutput.mockResolvedValue({ ok: true, data: { id: 'e2', file_name: 'x.xlsx' } })
        await freshRenderWith({
          chatMessages: [
            { role: 'user', text: 'q' },
            {
              role: 'ai',
              text: '[1][2]',
              citations: [
                { n: 1, idnbr: 'PS-1', name: '국어독본 권5', image_url: '' },
                { n: 2, idnbr: 'PS-2', name: '창가집', image_url: '' },
              ],
            },
          ],
        })
        pickExhibitTask()
        openDecisionModal()

        const modal = screen.getByRole('heading', { name: '학예 기획 자료 목록' }).closest('.fixed')
        fireEvent.click(within(modal).getByRole('button', { name: '창가집 선택 해제' }))
        expect(within(modal).queryByText('창가집')).toBeNull()

        confirmDecision()
        await waitFor(() => expect(createOutput).toHaveBeenCalled())
        expect(createOutput.mock.calls[0][0].selection).toEqual([
          { node: '대화', idnbrs: ['PS-1'] },
        ])
      })
    })
  })
})
