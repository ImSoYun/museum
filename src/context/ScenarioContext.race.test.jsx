// 이 파일의 책임: round06b 단계3-B B8 — fetchPage의 세대 가드(fetchGenRef). 순차 페이지
// 이동·필터 변경(모두 changePage/setSubjects를 거쳐 fetchPage를 호출한다)이 겹치면,
// 먼저 보낸 요청이 나중에 응답해 최신 화면을 덮어쓰는 stale-response race가 있었다
// (Playwright e2e를 다중 워커로 돌릴 때 검색 시나리오가 불안정하게 실패한 원인 중 하나
// — E-SEARCH-02가 지목한 "원인 A"). briefGenRef(ScenarioContext.brief.test.jsx의
// "세대 가드" 테스트)와 같은 이유·같은 검증 방식(캡처링 fake로 응답 순서를 뒤집어
// 재현)을 fetchPage에도 그대로 적용해 잠근다.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

const okResponse = (over = {}) => ({
  status: 'ok', total: 1, page: 1, pageSize: 20, rewritten: null, notice: null,
  results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1', facets: { subject: [] }, ...over,
})

// 타이밍을 직접 제어해야 하는 경합 재현용 캡처링 fake(ScenarioContext.brief.test.jsx의
// makeCapturingStream과 동형) — 호출될 때마다 즉시 resolve하지 않고 {resolve}를 calls에
// 쌓아 두어, 테스트가 원하는 순서로 응답을 흘려보낼 수 있게 한다.
function makeCapturingSearch() {
  const calls = []
  const fn = vi.fn(() => {
    let resolve
    const promise = new Promise((res) => { resolve = res })
    calls.push({ resolve })
    return promise
  })
  return { fn, calls }
}

async function setup({ searchImpl } = {}) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? (() => Promise.resolve(okResponse())))
  // round06f R6F-24 — 브리핑은 SSE 스트림(streamSearchBrief)으로 나간다. 이 파일의
  // 관심사는 fetchPage의 세대 가드이지 브리핑이 아니므로, 콜백을 즉시 발화해 트리거가
  // 조용히 성공만 하면 된다(브리핑 계약 자체는 ScenarioContext.brief.test.jsx).
  const streamSearchBrief = vi.fn((_args, cb) => {
    cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
    cb.onToken('요약')
    cb.onDone({ brief_len: 2 })
    return Promise.resolve()
  })
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  return { getCtx: () => ctx, searchArtifacts }
}

describe('ScenarioContext — fetchPage 세대 가드(B8, round06b)', () => {
  it('연속 페이지 이동에서 먼저 보낸 요청이 나중에 응답해도 최신 결과를 덮어쓰지 않는다', async () => {
    const { fn: searchArtifacts, calls } = makeCapturingSearch()
    const { getCtx } = await setup({ searchImpl: searchArtifacts })

    // 초기 검색(calls[0]) — lastQuery를 세워 changePage가 동작할 수 있게 한다.
    await act(async () => {
      const p = getCtx().setScenarioByQuery('민주화운동')
      calls[0].resolve(okResponse({ results: [{ id: 'init' }] }))
      await p
    })

    // 1차·2차 페이지 이동을 연속 발사한다 — 아직 둘 다 응답이 없다(calls[1]·calls[2]).
    let p1, p2
    act(() => {
      p1 = getCtx().changePage(1)
      p2 = getCtx().changePage(2)
    })
    expect(calls).toHaveLength(3)

    // 나중에 보낸(더 최근) 2차 요청(calls[2])이 먼저 응답한다.
    await act(async () => {
      calls[2].resolve(okResponse({ page: 2, results: [{ id: 'SECOND' }] }))
      await p2
    })
    expect(getCtx().liveResults).toEqual([{ id: 'SECOND' }])

    // 먼저 보낸(더 오래된) 1차 요청(calls[1])이 이제야 응답한다 — 최신 화면을 덮으면 안 된다.
    await act(async () => {
      calls[1].resolve(okResponse({ page: 1, results: [{ id: 'FIRST-STALE' }] }))
      await p1
    })
    expect(getCtx().liveResults).toEqual([{ id: 'SECOND' }])
  })
})

// F-1(최종 리뷰, 단계3-B 머지 차단 요인) — 위 describe가 잠근 것은 fetchPage **내부**의
// 상태 쓰기(liveResults 등)뿐이다. fetchPage의 resolve 값을 소비하는 runLiveSearch의
// continuation은 그 가드를 통과하지 않아, 늦게 도착한 낡은 응답의 conversationId를 그대로
// 반영하는 사각지대가 있었다("화면=최신, 대화=낡음" 불일치 — 위 파일 도크스트링과 달리
// 이번엔 conversationId가 문제다). 재현 방식은 위 describe와 동형(캡처링 fake로 응답
// 순서를 뒤집는다) — 다만 대상이 changePage/liveResults가 아니라
// setScenarioByQuery(runLiveSearch)/conversationId다.
describe('ScenarioContext — runLiveSearch continuation의 stale 가드(F-1)', () => {
  it('연속 재검색에서 나중 질의(C)가 먼저 응답하면, 먼저 보낸 질의(B)가 늦게 응답해도 conversationId는 C로 유지된다', async () => {
    const { fn: searchArtifacts, calls } = makeCapturingSearch()
    const { getCtx } = await setup({ searchImpl: searchArtifacts })

    // B·C를 연속 발사한다 — 아직 둘 다 응답이 없다(calls[0]=B, calls[1]=C).
    let pB, pC
    act(() => {
      pB = getCtx().setScenarioByQuery('B')
      pC = getCtx().setScenarioByQuery('C')
    })
    expect(calls).toHaveLength(2)

    // 나중에 보낸(더 최근) C가 먼저 응답한다.
    await act(async () => {
      calls[1].resolve(okResponse({ conversationId: 'convC', results: [{ id: 'C' }] }))
      await pC
    })
    expect(getCtx().conversationId).toBe('convC')
    expect(getCtx().liveResults).toEqual([{ id: 'C' }])

    // 먼저 보낸(더 오래된) B가 이제야 응답한다 — conversationId를 convB로 덮어쓰면 안 된다.
    await act(async () => {
      calls[0].resolve(okResponse({ conversationId: 'convB', results: [{ id: 'B-STALE' }] }))
      await pB
    })
    expect(getCtx().conversationId).toBe('convC')
    expect(getCtx().liveResults).toEqual([{ id: 'C' }])
  })

  // 역방향 — 경합이 없는 정상 응답까지 가드가 과하게 막아서는 안 된다.
  it('경합이 없는 단일 검색에서는 conversationId가 서버 응답값으로 정상 갱신된다', async () => {
    const { getCtx } = await setup({
      searchImpl: () => Promise.resolve(okResponse({ conversationId: 'conv-normal' })),
    })
    await act(async () => { await getCtx().setScenarioByQuery('평범질의') })
    expect(getCtx().conversationId).toBe('conv-normal')
  })
})

// F-1 — resumeConversation도 자신의 fetchPage 응답이 stale일 때 예전엔 무조건
// { ok: true }를 돌려줬다(도크스트링 "바깥 계약은 { ok:true } 그대로" 참조 — 그 결정 자체는
// 유효하나 stale까지 그 계약에 포함되는 것은 별개 문제였다). 소비처 LnbHistory.handleOpen은
// `r.ok === false`일 때만 실패로 처리하므로, stale 응답도 성공으로 읽어 이미 최신 화면(다른
// 대화)로 갈아탄 상태에서 낡은 대화 id로 내비게이션하는 사고가 날 수 있었다.
describe('ScenarioContext — resumeConversation의 stale 가드(F-1)', () => {
  it('연속 재개(두 번째가 첫 번째보다 먼저 완결)에서, 첫 번째 재개는 stale 응답을 {ok:false, stale:true}로 받는다', async () => {
    const { fn: searchArtifacts, calls } = makeCapturingSearch()
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
    const getConversation = vi.fn((id) => Promise.resolve({ id, status: 200, search_query: `Q-${id}`, messages: [] }))
    vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
    const streamSearchBrief = vi.fn((_args, cb) => {
      cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
      cb.onToken('요약')
      cb.onDone({ brief_len: 2 })
      return Promise.resolve()
    })
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)

    // r-1·r-2 재개를 연속 발사한다. getConversation은 이미 resolve된 프로미스라 .then은
    // 마이크로태스크로 미뤄진다 — act(async) 안에서 한 틱 흘려보내 두 fetchPage(calls[0]·
    // calls[1]) 호출이 모두 등록되게 한다(호출 순서=r-1 먼저).
    let p1, p2
    await act(async () => {
      p1 = ctx.resumeConversation('r-1')
      p2 = ctx.resumeConversation('r-2')
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(calls).toHaveLength(2)

    // 두 번째(더 최신) 재개가 먼저 응답한다.
    await act(async () => {
      calls[1].resolve(okResponse({ conversationId: 'r-2', results: [{ id: 'r2-result' }] }))
    })

    // 첫 번째(더 오래된) 재개가 이제야 응답한다.
    await act(async () => {
      calls[0].resolve(okResponse({ conversationId: 'r-1', results: [{ id: 'r1-STALE' }] }))
    })

    const r1 = await p1
    const r2 = await p2
    expect(r1).toEqual({ ok: false, stale: true })
    expect(r2).toEqual({ ok: true })
    // 화면·conversationId 모두 더 최신 재개(r-2) 것으로 남아 있어야 한다.
    expect(ctx.conversationId).toBe('r-2')
    expect(ctx.liveResults).toEqual([{ id: 'r2-result' }])
  })
})
