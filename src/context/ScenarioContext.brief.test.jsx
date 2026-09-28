// 이 파일의 책임: round06f 갈래 B — fetchPage 반환 계약({conversationId, ok})과
// 그 위에 얹히는 AI 브리핑 트리거(spec §7.5·§7.5.1, R6F-21)를 잠근다.
//
// 트리거를 useEffect가 아니라 프로미스 체인 명시 호출로 두는 것이 이 계약의 전부다 —
// ScenarioContext에는 useEffect가 하나도 없고 main.jsx가 React.StrictMode라 dev에서
// 이펙트가 이중 실행돼 LLM 비용이 두 배가 된다. 그래서 "호출자가 성공 여부를 관측할 수
// 있는가"가 곧 이 계약이고, 여기서 그것을 검증한다.
//
// round06f R6F-24(spec §7.3a) — 브리핑 호출이 JSON(fetchSearchBrief) 일괄 응답에서
// SSE 토큰 스트림(streamSearchBrief)으로 바뀌면서, 이 파일의 mock도 fetch 응답
// 흉내에서 "콜백을 직접 호출하는 fake"로 바뀐다. 실제 fetch/ReadableStream까지
// 흉내 내는 대신(그건 searchApi.test.js가 맡는다 — streamSearchBrief 자체의
// SSE 파싱은 거기서 이미 잠갔다), 여기서는 searchApi.js 모듈 자체를 모킹하는
// 기존 관행(다른 ScenarioContext.*.test.jsx 파일들과 동형)을 그대로 유지한다 —
// 이 파일의 관심사는 "ScenarioContext가 콜백을 올바르게 해석하는가"이지
// "SSE 프레임을 올바르게 파싱하는가"가 아니다.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

const okResponse = (over = {}) => ({
  status: 'ok', total: 1, page: 1, pageSize: 20, rewritten: null, notice: null,
  results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1', ...over,
})

// streamSearchBrief 기본 동작 — 캐시 히트와 같은 모양(meta → 전문 단일 token → done)을
// 동기로 흘려보낸다. 대부분의 테스트는 "브리핑이 결국 어떤 값으로 자리잡는가"만
// 보면 되므로, 조각을 여러 번 나누는 대신 이 단순한 형태를 기본값으로 쓴다.
function defaultStreamImpl(_args, cb) {
  cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
  cb.onToken('요약 본문')
  cb.onDone({ brief_len: 4 })
  return Promise.resolve()
}

// 타이밍을 직접 제어해야 하는 테스트(세대 가드 등)를 위한 캡처링 fake.
// 호출될 때마다 콜백을 즉시 발화하지 않고 {args, cb, resolve}를 calls에 쌓아 두어,
// 테스트가 원하는 시점에 수동으로 onMeta/onToken/onDone을 호출할 수 있게 한다.
function makeCapturingStream() {
  const calls = []
  const fn = vi.fn((args, cb) => {
    let resolve
    const promise = new Promise((res) => { resolve = res })
    calls.push({ args, cb, resolve })
    return promise
  })
  return { fn, calls }
}

async function setup({ searchImpl, streamImpl } = {}) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? (() => Promise.resolve(okResponse())))
  const streamSearchBrief = vi.fn(streamImpl ?? defaultStreamImpl)
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  return { getCtx: () => ctx, searchArtifacts, streamSearchBrief }
}

describe('ScenarioContext — fetchPage 반환 계약(§7.5.1)', () => {
  it('성공 경로는 { conversationId, ok:true }로 resolve한다 — changePage가 그 값을 그대로 흘려보낸다', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    let r
    await act(async () => { r = await getCtx().changePage(2) })
    expect(r).toEqual({ conversationId: 'srv-1', ok: true })
  })

  it('결과 0건이면 ok:false다(판정식은 status!=="error" && results.length>0 — setMatched와 같은 식)', async () => {
    const { getCtx } = await setup({ searchImpl: () => Promise.resolve(okResponse({ total: 0, results: [] })) })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    let r
    await act(async () => { r = await getCtx().changePage(2) })
    expect(r).toEqual({ conversationId: 'srv-1', ok: false })
  })

  it('status가 error면 결과가 있어도 ok:false다', async () => {
    const { getCtx } = await setup({ searchImpl: () => Promise.resolve(okResponse({ status: 'error' })) })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    let r
    await act(async () => { r = await getCtx().changePage(2) })
    expect(r.ok).toBe(false)
  })

  it('실패 경로(reject)는 { conversationId: null, ok:false }로 resolve한다(reject로 새지 않는다)', async () => {
    let call = 0
    const impl = () => { call += 1; return call === 1 ? Promise.resolve(okResponse()) : Promise.reject(new Error('network down')) }
    const { getCtx } = await setup({ searchImpl: impl })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    let r
    await act(async () => { r = await getCtx().changePage(2) })
    expect(r).toEqual({ conversationId: null, ok: false })
  })

  it('runLiveSearch는 확장된 객체에서 conversationId를 꺼내 상태에 싣는다(회귀)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().conversationId).toBe('srv-1')
  })
})

describe('ScenarioContext — AI 브리핑 트리거(§7.5 · SSE 스트림 R6F-24)', () => {
  it('검색이 성공하면 /search/brief/stream을 정확히 1회 부르고 brief·briefStatus를 채운다', async () => {
    const { getCtx, streamSearchBrief } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
    // 상태가 아니라 "방금 쓴 값"을 명시 인자로 넘긴다(stale closure 회피, §7.5).
    // 두 번째 인자(콜백 묶음)는 온전성만 확인하면 되므로 첫 인자만 좁혀서 본다.
    expect(streamSearchBrief.mock.calls[0][0]).toEqual({ query: '민주화운동', mode: 'meta' })
    expect(getCtx().brief).toBe('요약 본문')
    expect(getCtx().briefStatus).toBe('ok')
    expect(getCtx().briefNotice).toBeNull()
  })

  it('결과 0건이면 브리핑을 아예 부르지 않는다(LLM 비용 방지 — R-2)', async () => {
    const { getCtx, streamSearchBrief } = await setup({
      searchImpl: () => Promise.resolve(okResponse({ total: 0, results: [] })),
    })
    await act(async () => { await getCtx().setScenarioByQuery('없는질의') })
    expect(streamSearchBrief).not.toHaveBeenCalled()
    expect(getCtx().briefStatus).toBe('idle')
  })

  it('검색이 실패하면(reject) 브리핑을 부르지 않는다', async () => {
    const { getCtx, streamSearchBrief } = await setup({ searchImpl: () => Promise.reject(new Error('down')) })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(streamSearchBrief).not.toHaveBeenCalled()
  })

  it('브리핑 meta.status가 ok가 아니면 briefStatus=error·briefNotice를 싣는다(카드는 미렌더된다, token 없이 종료)', async () => {
    const { getCtx } = await setup({
      streamImpl: (_args, cb) => {
        cb.onMeta({ status: 'disabled', cached: false, model: null, result_count: 0, notice: '브리핑이 비활성화되어 있습니다' })
        cb.onDone({ brief_len: 0 })
        return Promise.resolve()
      },
    })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().brief).toBeNull()
    expect(getCtx().briefStatus).toBe('error')
    expect(getCtx().briefNotice).toBe('브리핑이 비활성화되어 있습니다')
  })

  it('브리핑 호출 자체가 실패해도(reject) 검색 화면을 깨뜨리지 않는다', async () => {
    const { getCtx } = await setup({ streamImpl: () => Promise.reject(new Error('boom')) })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().briefStatus).toBe('error')
    expect(getCtx().liveStatus).toBe('ok')   // 검색 결과는 그대로 살아 있다
  })

  it('스트림 도중 error 이벤트가 나도 누적된 조각이 있으면 그대로 두고 조용히 종료한다(부분도 유용 — §7.3a)', async () => {
    const { getCtx } = await setup({
      streamImpl: (_args, cb) => {
        cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 20 })
        cb.onToken('앞부분 조각만 ')
        cb.onError('브리핑 생성에 실패했습니다')
        return Promise.resolve()
      },
    })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    // 부분 누적을 그대로 유지한다 — 'error'로 뒤집지 않는다.
    expect(getCtx().brief).toBe('앞부분 조각만 ')
    expect(getCtx().briefStatus).toBe('ok')
    expect(getCtx().briefNotice).toBeNull()
  })

  it('스트림 도중 error 이벤트가 나고 누적된 조각이 하나도 없으면 briefStatus=error로 접는다', async () => {
    const { getCtx } = await setup({
      streamImpl: (_args, cb) => {
        cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 20 })
        cb.onError('브리핑 생성에 실패했습니다')
        return Promise.resolve()
      },
    })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().brief).toBeNull()
    expect(getCtx().briefStatus).toBe('error')
    expect(getCtx().briefNotice).toBe('브리핑 생성에 실패했습니다')
  })

  it('페이지 이동(changePage)은 브리핑을 다시 부르지 않는다(§7.5 · DoD 3-a)', async () => {
    const { getCtx, streamSearchBrief } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().changePage(2) })
    await act(async () => { await getCtx().changePage(3) })
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
    expect(getCtx().brief).toBe('요약 본문')
  })

  it('새 검색은 직전 브리핑을 먼저 지운다(이전 요약이 새 결과 위에 남지 않는다)', async () => {
    const { fn: streamSearchBrief, calls } = makeCapturingStream()
    const { getCtx } = await setup({ streamImpl: streamSearchBrief })

    await act(async () => { await getCtx().setScenarioByQuery('A') })
    await act(async () => {
      calls[0].cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
      calls[0].cb.onToken('A 요약')
      calls[0].resolve()
    })
    expect(getCtx().brief).toBe('A 요약')

    await act(async () => { await getCtx().setScenarioByQuery('B') })
    expect(getCtx().brief).toBeNull()
    expect(getCtx().briefStatus).toBe('loading')
  })

  it('searchMode가 기본값(meta)이 아니어도 그 값 그대로 브리핑을 요청한다 — mode 하드코딩 회귀 가드(최종 리뷰 F8)', async () => {
    // 이 테스트가 없으면 fetchBrief 호출부의 `searchMode` 인자를 문자열 리터럴
    // 'meta'로 바꿔치기해도(회귀) 위 "검색이 성공하면..." 테스트가 기본값이 우연히
    // 같아 계속 green이었다 — mode 전달이 실제로 배선돼 있는지 별도로 잠근다.
    const { getCtx, streamSearchBrief } = await setup()
    await act(() => { getCtx().setSearchMode('ocr') })
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(streamSearchBrief.mock.calls[0][0]).toEqual({ query: '민주화운동', mode: 'ocr' })
  })

  it('앞선 검색의 브리핑이 늦게 도착해도 새 검색의 브리핑을 덮어쓰지 않는다(세대 가드)', async () => {
    const { fn: streamSearchBrief, calls } = makeCapturingStream()
    const { getCtx } = await setup({ streamImpl: streamSearchBrief })

    await act(async () => { await getCtx().setScenarioByQuery('A') })
    await act(async () => { await getCtx().setScenarioByQuery('B') })
    expect(calls).toHaveLength(2)

    await act(async () => {
      calls[1].cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
      calls[1].cb.onToken('B 요약')
      calls[1].resolve()
    })
    expect(getCtx().brief).toBe('B 요약')

    // 뒤늦게 도착한 A의 응답(콜백)은 버려진다
    await act(async () => {
      calls[0].cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
      calls[0].cb.onToken('A 요약')
      calls[0].resolve()
    })
    expect(getCtx().brief).toBe('B 요약')
    expect(getCtx().briefStatus).toBe('ok')
  })
})

describe('ScenarioContext — 기록 재개의 브리핑(§7.5 · DoD 3-b)', () => {
  async function setupResume(conv, { streamImpl } = {}) {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
    const getConversation = vi.fn().mockResolvedValue(conv)
    vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
    const searchArtifacts = vi.fn(() => Promise.resolve(okResponse()))
    const streamSearchBrief = vi.fn(streamImpl ?? ((_args, cb) => {
      cb.onMeta({ status: 'ok', cached: true, model: 'm', result_count: 1 })
      cb.onToken('그때 그 요약')
      cb.onDone({ brief_len: 6 })
      return Promise.resolve()
    }))
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)
    return { getCtx: () => ctx, streamSearchBrief }
  }

  it('재개도 브리핑을 1회 부른다 — 복원한 질의·모드를 명시 인자로 넘긴다', async () => {
    const conv = { id: 'c-1', status: 200, search_query: '민주화운동', mode: 'both', messages: [] }
    const { getCtx, streamSearchBrief } = await setupResume(conv)
    await act(async () => { await getCtx().resumeConversation('c-1') })
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
    expect(streamSearchBrief.mock.calls[0][0]).toEqual({ query: '민주화운동', mode: 'both' })
    expect(getCtx().brief).toBe('그때 그 요약')
  })

  // 기록 재진입 캐시 계약(구현 지시 3번) — "재개 경로에서 fetchBrief가 같은 스트림
  // 엔드포인트를 타고, 서버 fake가 cached:true+전문 단일 token을 주면 brief가 그
  // 전문과 일치"를 명시적으로 잠근다. R6F-4(브리핑은 DB 영속, 기록 재진입은 그때
  // 만든 문구가 그대로 나와야 한다)를 "재생성이 아니라 DB에서 온다"로 프론트
  // 레벨에서도 검증하는 것이 이 테스트의 목적이다 — fetchSearchBrief(JSON, 구
  // 폴백 계약)가 아니라 streamSearchBrief가 호출되는지, 그리고 서버가 캐시 히트
  // 시 실제로 내려주는 모양(전문 단일 token)을 그대로 반영하는지 둘 다 확인한다.
  it('기록 재진입 캐시 계약 — 서버 fake가 cached:true + 전문 단일 token을 주면 brief가 그 전문과 정확히 일치한다(재생성이 아니라 DB에서 온다)', async () => {
    const FULL_TEXT = '민주화운동 관련 자료 20건을 검색했습니다. 대부분 1980년대 시위·집회 기록사진과 문서로 구성되어 있습니다.'
    let capturedArgs = null
    let metaSeen = null
    const streamImpl = (args, cb) => {
      capturedArgs = args
      // 서버 fake — §7.3a: "캐시 히트면 전문을 단일 token 1회"를 그대로 흉내낸다.
      const meta = { status: 'ok', cached: true, model: 'gemma', result_count: 20 }
      metaSeen = meta
      cb.onMeta(meta)
      cb.onToken(FULL_TEXT)
      cb.onDone({ brief_len: FULL_TEXT.length })
      return Promise.resolve()
    }
    const conv = { id: 'c-cache', status: 200, search_query: '민주화운동', mode: 'meta', messages: [] }
    const { getCtx, streamSearchBrief } = await setupResume(conv, { streamImpl })

    await act(async () => { await getCtx().resumeConversation('c-cache') })

    // ① 같은 스트림 엔드포인트(streamSearchBrief)를 탄다 — JSON fetchSearchBrief가 아니다.
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
    expect(capturedArgs).toEqual({ query: '민주화운동', mode: 'meta' })
    // ② 서버가 cached:true를 밝혔다 — DB에서 왔지 새로 생성한 것이 아니다.
    expect(metaSeen.cached).toBe(true)
    // ③ brief는 서버가 준 전문과 정확히 일치한다(조각을 이어붙이는 게 아니라
    //    단일 token으로 온 전문을 그대로 반영 — 우연한 부분 일치가 아님을 보장).
    expect(getCtx().brief).toBe(FULL_TEXT)
    expect(getCtx().briefStatus).toBe('ok')
  })

  it('재개의 바깥 resolve는 검색 결과와 무관하게 { ok:true }다(LnbHistory 계약 보존)', async () => {
    const conv = { id: 'c-2', status: 200, search_query: '결과없는질의', mode: 'meta', messages: [] }
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
    const getConversation = vi.fn().mockResolvedValue(conv)
    vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
    const searchArtifacts = vi.fn(() => Promise.resolve(okResponse({ total: 0, results: [] })))
    const streamSearchBrief = vi.fn()
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)

    let r
    await act(async () => { r = await ctx.resumeConversation('c-2') })
    expect(r).toEqual({ ok: true })          // 결과 0건이어도 재개는 성공이다
    expect(streamSearchBrief).not.toHaveBeenCalled()
  })
})
