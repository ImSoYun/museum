import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

async function loadLive() {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  return await import('./chatApi.js')
}

describe('parseSSE', () => {
  it('완결 프레임을 이벤트로, 불완전 꼬리는 rest로 보존한다', async () => {
    const { parseSSE } = await loadLive()
    const raw = 'event: token\ndata: {"t":"안"}\n\nevent: token\ndata: {"t":"녕'
    const { events, rest } = parseSSE(raw)
    expect(events).toEqual([{ event: 'token', data: { t: '안' } }])
    expect(rest).toBe('event: token\ndata: {"t":"녕')
  })

  it('빈 버퍼는 빈 결과', async () => {
    const { parseSSE } = await loadLive()
    expect(parseSSE('')).toEqual({ events: [], rest: '' })
  })
})

describe('postChatStream', () => {
  function streamOf(text) {
    const encoder = new TextEncoder()
    return new Response(new ReadableStream({
      start(c) { c.enqueue(encoder.encode(text)); c.close() },
    }), { status: 200 })
  }

  it('이벤트를 콜백으로 분배하고 미지 이벤트는 무시한다', async () => {
    const { postChatStream } = await loadLive()
    const body =
      'event: status\ndata: {"stage":"rewrite"}\n\n' +
      'event: mystery\ndata: {}\n\n' +
      'event: token\ndata: {"t":"안녕"}\n\n' +
      'event: citations\ndata: {"citations":[{"n":1}]}\n\n' +
      'event: done\ndata: {"status":"ok","took_ms":1.0,"turn":1}\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamOf(body)))
    const seen = { status: [], tokens: [], cits: null, done: null }
    await postChatStream(
      { conversationId: 'c1', message: 'q', searchQuery: 's' },
      {
        onStatus: (d) => seen.status.push(d.stage),
        onToken: (t) => seen.tokens.push(t),
        onCitations: (c) => (seen.cits = c),
        onDone: (d) => (seen.done = d),
        onError: () => {},
      },
    )
    expect(seen.status).toEqual(['rewrite'])
    expect(seen.tokens).toEqual(['안녕'])
    expect(seen.cits).toEqual([{ n: 1 }])
    expect(seen.done.turn).toBe(1)
  })

  it('422/429는 onError로 전달한다', async () => {
    const { postChatStream } = await loadLive()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ notice: '검색어로 시작' }), { status: 422 })))
    const onError = vi.fn()
    await postChatStream({ conversationId: 'c1', message: 'q' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError })
    // 2번째 인자 'http' = 서버의 의도적 거절이므로 호출부가 재시도하지 않는다는 신호(round06d 후속 #8)
    expect(onError).toHaveBeenCalledWith('검색어로 시작', 'http')
  })

  it('스트림 중 error 이벤트는 kind="stream"으로 onError를 부른다(자동 재시도 대상)', async () => {
    const { postChatStream } = await loadLive()
    const body = 'event: error\ndata: {"notice":"대화 처리 중 오류가 발생했습니다 — 다시 시도하세요"}\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamOf(body)))
    const onError = vi.fn()
    await postChatStream({ conversationId: 'c1', message: 'q' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError })
    expect(onError).toHaveBeenCalledWith('대화 처리 중 오류가 발생했습니다 — 다시 시도하세요', 'stream')
  })

  // round06c F1(spec §9.5·C-D2): POST /chat도 credentials 전수 대상이고,
  // 401은 authEvents.notifyUnauthorized()로 좁게(res.status===401) 통지된다.
  it('POST /chat에 credentials:"include"가 실린다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamOf('event: done\ndata: {"turn":1}\n\n'))
    vi.stubGlobal('fetch', fetchMock)
    const { postChatStream } = await loadLive()
    await postChatStream({ conversationId: 'c1', message: 'q' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError() {} })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  // round06e Task6 — searchApi.searchArtifacts와 같은 방식으로 mode를 받아 /chat 바디에 싣는다.
  it('mode 를 요청 바디에 싣는다', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(streamOf('event: done\ndata: {"turn":1}\n\n'))
    vi.stubGlobal('fetch', fetchSpy)
    const { postChatStream } = await loadLive()
    await postChatStream({ conversationId: 'c1', message: 'q', mode: 'ocr' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError() {} })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.mode).toBe('ocr')
  })

  it('mode 가 없으면 바디에 키를 넣지 않는다(서버 기본값 위임)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(streamOf('event: done\ndata: {"turn":1}\n\n'))
    vi.stubGlobal('fetch', fetchSpy)
    const { postChatStream } = await loadLive()
    await postChatStream({ conversationId: 'c1', message: 'q' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError() {} })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('mode')
  })

  it('401 응답이면 authEvents.notifyUnauthorized()가 호출된다(!res.ok 아닌 좁은 판정)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: '인증 필요' }), { status: 401 })))
    const { postChatStream } = await loadLive()
    const { registerUnauthorizedHandler } = await import('../lib/authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await postChatStream({ conversationId: 'c1', message: 'q' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError() {} })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('422는 onError로 넘어가되 notifyUnauthorized()는 호출되지 않는다(좁은 판정 회귀)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ notice: '검색어로 시작' }), { status: 422 })))
    const { postChatStream } = await loadLive()
    const { registerUnauthorizedHandler } = await import('../lib/authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await postChatStream({ conversationId: 'c1', message: 'q' },
      { onStatus() {}, onToken() {}, onCitations() {}, onDone() {}, onError() {} })
    expect(onUnauthorized).not.toHaveBeenCalled()
    unregister()
  })
})
