import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); vi.restoreAllMocks() })

async function setup(streamImpl) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  // 재시도 백오프를 0으로 낮춰 결정적으로(실타이머, 대기 없음) 재시도가 완료되게 한다.
  vi.stubEnv('VITE_CHAT_RETRY_BACKOFF_MS', '0')
  vi.doMock('../lib/chatApi.js', () => ({
    postChatStream: vi.fn(streamImpl),
    parseSSE: vi.fn(),
  }))
  // searchApi도 라이브 판정을 위해 스텁
  vi.doMock('../lib/searchApi.js', () => ({
    isLive: () => true,
    searchArtifacts: vi.fn().mockResolvedValue({
      status: 'ok', total: 1, page: 1, pageSize: 20, rewritten: null,
      notice: null, results: [] }),
  }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  // round06c C1b 리뷰 fix 1: sendChatMessage는 conversationId가 있어야만 동작한다(검색
  // 왕복 중 null인 창의 race 가드 — 아래 별도 테스트). 이 파일의 기존 테스트 대부분은
  // 검색 없이 바로 sendChatMessage를 부르므로, 여기서 미리 한 번 검색을 태워 conversationId를
  // 채워 둔다(이 mock 응답엔 conversation_id가 없어 로컬 폴백으로 채워진다).
  await act(() => ctx.setScenarioByQuery('setup 초기 검색'))
  return () => ctx
}

describe('채팅 컨텍스트(라이브)', () => {
  it('sendChatMessage가 user 메시지 추가 → 토큰 누적 → citations 확정 순으로 진행한다', async () => {
    const getCtx = await setup(async (_req, cb) => {
      cb.onStatus({ stage: 'rewrite' })
      cb.onToken('안')
      cb.onToken('녕')
      cb.onCitations([{ n: 1, idnbr: 'PS-1', name: '자료1', image_url: '/images/PS-1' }])
      cb.onDone({ status: 'ok', took_ms: 1, turn: 1 })
    })
    await act(() => getCtx().sendChatMessage('질문'))
    const msgs = getCtx().chatMessages
    expect(msgs[0]).toMatchObject({ role: 'user', text: '질문' })
    expect(msgs[1].role).toBe('ai')
    expect(msgs[1].text).toBe('안녕')
    expect(msgs[1].citations).toHaveLength(1)
    expect(getCtx().chatStatus).toBe('idle')
  })

  // round06e Task6 리뷰 — sendChatMessage가 postChatStream에 searchMode를 실제로 실어
  // 보내는지 검증하는 테스트가 없었다(구현은 옳으나, ScenarioContext.jsx의 `mode: searchMode,`
  // 한 줄을 지워도 프론트 전건이 그대로 통과했다). 기본값('meta')만 단언하면 mode 배선이
  // 통째로 빠져 undefined가 되어도 우연히 걸리지 않을 여지가 있으므로, setSearchMode로
  // 비-기본값('both')을 먼저 설정해 그 값이 그대로 전달되는지 확인한다(검색 경로의
  // ScenarioContext.test.jsx searchMode 테스트와 대칭).
  it('sendChatMessage는 setSearchMode로 바꾼 비-기본값을 postChatStream 요청에 실어 보낸다', async () => {
    let capturedReq
    const getCtx = await setup(async (req, cb) => {
      capturedReq = req
      cb.onDone({ turn: 1 })
    })
    await act(() => { getCtx().setSearchMode('both') })
    await act(async () => { await getCtx().sendChatMessage('질문') })
    expect(capturedReq.mode).toBe('both')
  })

  it('새 검색은 conversationId를 재발급하고 chatMessages를 비운다', async () => {
    // round06c C1b: conversationId는 이제 서버(/search 응답)가 발급한다 — 첫 검색으로
    // 값을 받아둔 뒤, 두 번째 검색이 그것과 다른 값으로 재발급하는지를 검증한다.
    const getCtx = await setup(async (_req, cb) => { cb.onDone({ turn: 1 }) })
    await act(() => getCtx().setScenarioByQuery('첫 검색'))
    const before = getCtx().conversationId
    expect(typeof before).toBe('string')
    await act(() => getCtx().sendChatMessage('질문'))
    await act(() => getCtx().setScenarioByQuery('새 검색'))
    expect(getCtx().conversationId).not.toBe(before)
    expect(getCtx().chatMessages).toEqual([])
  })

  it('onError(kind 없음)은 재시도 없이 chatStatus=error와 chatNotice를 남긴다', async () => {
    // kind가 없는 error는 레거시/미상 실패로 간주해 재시도하지 않는다(회귀 가드 — round06d 후속 #8 §6-A).
    let call = 0
    const getCtx = await setup(async (_req, cb) => { call += 1; cb.onError('오류 발생') })
    await act(() => getCtx().sendChatMessage('질문'))
    expect(call).toBe(1)
    expect(getCtx().chatStatus).toBe('error')
    expect(getCtx().chatNotice).toBe('오류 발생')
  })

  // ── round06d 후속 #8: 자동 재시도(stream·network만, 1회, 조용히) ──────────────
  it('stream 오류는 1회 자동 재시도하고, 재시도가 성공하면 정상 응답으로 마감한다', async () => {
    let call = 0
    const getCtx = await setup(async (_req, cb) => {
      call += 1
      if (call === 1) { cb.onError('일시 오류', 'stream'); return } // 첫 시도 실패
      cb.onStatus({ stage: 'rewrite' }); cb.onToken('안녕'); cb.onDone({ turn: 1 }) // 재시도 성공
    })
    await act(async () => { await getCtx().sendChatMessage('질문') })
    expect(call).toBe(2)
    const msgs = getCtx().chatMessages
    expect(msgs[1].role).toBe('ai')
    expect(msgs[1].text).toBe('안녕')       // 부분 출력 리셋 후 재시도분만 남는다
    expect(getCtx().chatStatus).toBe('idle')
    expect(getCtx().chatNotice).toBeNull()  // 조용한 재시도 — 사용자에게 오류를 노출하지 않는다
  })

  it('stream 오류가 재시도까지 실패하면 마지막 notice로 error 마감한다', async () => {
    let call = 0
    const getCtx = await setup(async (_req, cb) => {
      call += 1
      cb.onError(call === 1 ? '1차 실패' : '2차 실패', 'stream')
    })
    await act(async () => { await getCtx().sendChatMessage('질문') })
    expect(call).toBe(2)                        // 최초 1 + 재시도 1
    expect(getCtx().chatStatus).toBe('error')
    expect(getCtx().chatNotice).toBe('2차 실패') // 소진 후 마지막 실패의 안내를 보여준다
  })

  it('http 오류(429·422)는 재시도하지 않고 즉시 error로 마감한다', async () => {
    // http는 서버의 의도적 거절이라 즉시 재시도가 무의미하다(§6-G).
    let call = 0
    const getCtx = await setup(async (_req, cb) => { call += 1; cb.onError('요청이 거절됨', 'http') })
    await act(async () => { await getCtx().sendChatMessage('질문') })
    expect(call).toBe(1)
    expect(getCtx().chatStatus).toBe('error')
    expect(getCtx().chatNotice).toBe('요청이 거절됨')
  })

  it('스트림 도중 새 검색하면 이전 콜백들이 새 대화를 오염하지 않는다', async () => {
    let capturedCb
    const getCtx = await setup(async (_req, cb) => {
      capturedCb = cb
      // 콜백을 보류 — 나중에 수동으로 발화
    })
    // 스트림 시작
    const p = await act(async () => getCtx().sendChatMessage('질문1'))
    // 콜백이 아직 발화되지 않은 상태에서 새 검색
    await act(async () => {
      const search = getCtx().setScenarioByQuery('새 검색')
      if (search) await search
    })
    expect(getCtx().chatMessages).toEqual([])
    expect(getCtx().chatStatus).toBe('idle')
    // 이제 보류했던 콜백들을 발화 — 세대 가드로 무시돼야 함
    capturedCb.onStatus({ stage: 'rewrite' })
    capturedCb.onToken('안')
    capturedCb.onToken('녕')
    capturedCb.onCitations([{ n: 1, idnbr: 'PS-1', name: '자료1' }])
    capturedCb.onDone({ turn: 1 })
    await p
    // 새 대화 상태가 오염되지 않아야 함
    expect(getCtx().chatMessages).toEqual([])
    expect(getCtx().chatStatus).toBe('idle')
    expect(getCtx().chatNotice).toBeNull()
  })

  it('crypto.randomUUID 부재(비보안 컨텍스트)에서도 대화 ID가 생성된다', async () => {
    const original = globalThis.crypto.randomUUID
    // jsdom(Node) crypto.randomUUID는 Crypto.prototype에 있지만, 인스턴스에
    // defineProperty로 섀도잉하면 비보안 컨텍스트(HTTP 공인 IP)에서 undefined가 되는
    // 상황을 그대로 재현할 수 있다.
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const getCtx = await setup(async (_req, cb) => { cb.onDone({ turn: 1 }) })
      // round06c C1b: mount 시점엔 아직 conversationId가 없다(서버 발급 전, null) —
      // 검색을 한 번 일으켜야 한다. 이 테스트 더블(searchArtifacts)의 응답엔
      // conversation_id가 없으므로 로컬 폴백(newConversationId)이 쓰이고, 그 폴백이
      // crypto.randomUUID 없이도 유효한 문자열 ID를 만드는지가 검증 대상이다.
      await act(() => getCtx().setScenarioByQuery('질문'))
      expect(typeof getCtx().conversationId).toBe('string')
      expect(getCtx().conversationId.length).toBeGreaterThan(0)
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  // ── round06c C1b 리뷰 fix 1: 검색 왕복 중(conversationId=null 창) race 가드 ──────
  it('검색 왕복 중(conversationId=null 창)에 sendChatMessage를 부르면 postChatStream을 호출하지 않는다', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
    vi.stubEnv('VITE_CHAT_RETRY_BACKOFF_MS', '0')
    const postChatStream = vi.fn(async (_req, cb) => { cb.onDone({ turn: 1 }) })
    vi.doMock('../lib/chatApi.js', () => ({ postChatStream, parseSSE: vi.fn() }))

    // searchArtifacts를 아직 resolve하지 않는 promise로 스텁 — 검색 왕복 중인 창을 인위로 붙잡는다.
    let resolveSearch
    const pendingSearch = new Promise((resolve) => { resolveSearch = resolve })
    const searchArtifacts = vi.fn(() => pendingSearch)
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts }))

    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)

    // 검색 시작 — await하지 않는다(runLiveSearch가 conversationId를 null로 비운 채 대기).
    act(() => { ctx.setScenarioByQuery('질문') })
    expect(ctx.conversationId).toBeNull()

    // 검색이 아직 끝나지 않은 상태에서 채팅 전송을 시도 — no-op이어야 한다.
    await act(async () => { await ctx.sendChatMessage('검색 왕복 중 전송') })
    expect(postChatStream).not.toHaveBeenCalled()   // conversation_id: null이 백엔드로 나가지 않았다
    expect(ctx.chatMessages).toEqual([])            // user 메시지도 추가되지 않는다(이르게 return)
    expect(ctx.chatStatus).toBe('idle')

    // 검색을 마저 끝내 정리한다(act 경고 방지) — 서버 conversation_id로 정상 확정되는지도 함께 확인.
    resolveSearch({
      status: 'ok', total: 0, page: 1, pageSize: 20, rewritten: null,
      notice: null, results: [], conversationId: 'conv-server-1',
    })
    await waitFor(() => expect(ctx.conversationId).toBe('conv-server-1'))

    // 검색이 끝난 뒤엔 정상적으로 전송된다.
    await act(async () => { await ctx.sendChatMessage('검색 완료 후 전송') })
    expect(postChatStream).toHaveBeenCalledTimes(1)
    expect(postChatStream.mock.calls[0][0].conversationId).toBe('conv-server-1')
  })
})
