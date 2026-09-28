// 이 파일의 책임: round07b — 산출물생성 노드 그래프의 컨텍스트 이음매를 잠근다.
//
// 브리핑(ScenarioContext.brief.test.jsx)과 **같은 계약**이다: useEffect가 아니라
// 검색 성공 지점의 명시 호출로 트리거되고, 세대 가드가 늦게 온 응답을 버린다.
// ScenarioContext에는 useEffect가 하나도 없고 main.jsx가 StrictMode라, 이펙트로
// 두면 dev에서 요청이 두 번 나간다.
//
// 여기서 잠그는 것 넷:
//   ① 검색이 성공했을 때만 부른다 — 0건·오류에 헛요청하지 않는다
//   ② 새 검색이 직전 그래프를 즉시 지운다 — 이전 질의의 클래스가 남으면 오독한다
//   ③ 세대 가드 — 늦게 온 응답이 새 화면을 덮지 않는다
//   ④ 클래스 전환(fetchGraph 재호출)은 **재검색이 아니다**
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

const okResponse = (over = {}) => ({
  status: 'ok', total: 1, page: 1, pageSize: 20, rewritten: null, notice: null,
  results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1', ...over,
})

const graphPayload = (over = {}) => ({
  classes: [{ value: '정치행정', count: 2 }],
  selected: '정치행정',
  nodes: [
    { id: 'n0', label: '정치행정', count: 2, group: 'root' },
    { id: 'n1', label: '민주화운동', count: 2, group: 'subject' },
  ],
  edges: [{ from: 'n0', to: 'n1' }],
  nodeItems: { n1: ['a', 'b'] },
  total: 2,
  status: 'ok',
  ...over,
})

/** 호출을 쌓아 두고 테스트가 원하는 시점에 resolve하는 fake. */
function makeCapturingGraph() {
  const calls = []
  const fn = vi.fn((query, mode, selected) => new Promise((resolve) => {
    calls.push({ query, mode, selected, resolve })
  }))
  return { fn, calls }
}

async function setup({ searchImpl, graphImpl } = {}) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? (() => Promise.resolve(okResponse())))
  const streamSearchBrief = vi.fn(() => Promise.resolve())
  const fetchOutputGraph = vi.fn(
    graphImpl ?? (() => Promise.resolve({ ok: true, data: graphPayload() })),
  )
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
  vi.doMock('../lib/outputsApi.js', () => ({ fetchOutputGraph }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  return { getCtx: () => ctx, searchArtifacts, fetchOutputGraph }
}

describe('검색 성공 시 그래프를 받는다', () => {
  it('성공한 검색 뒤 graph가 채워지고 status가 ok다', async () => {
    const { getCtx } = await setup()

    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })

    expect(getCtx().graphStatus).toBe('ok')
    expect(getCtx().graph.classes).toEqual([{ value: '정치행정', count: 2 }])
  })

  it('검색 질의·모드를 그대로 넘기고 selected는 null이다', async () => {
    const { getCtx, fetchOutputGraph } = await setup()

    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })

    expect(fetchOutputGraph).toHaveBeenCalledWith('민주화운동', 'meta', null)
  })

  it('결과 0건이면 부르지 않는다 — 헛요청을 하지 않는다', async () => {
    const { getCtx, fetchOutputGraph } = await setup({
      searchImpl: () => Promise.resolve(okResponse({ results: [], total: 0 })),
    })

    await act(async () => { await getCtx().setScenarioByQuery('없는질의') })

    expect(fetchOutputGraph).not.toHaveBeenCalled()
  })

  it('검색이 실패하면 부르지 않는다', async () => {
    const { getCtx, fetchOutputGraph } = await setup({
      searchImpl: () => Promise.resolve(okResponse({ status: 'error', results: [] })),
    })

    await act(async () => { await getCtx().setScenarioByQuery('q') })

    expect(fetchOutputGraph).not.toHaveBeenCalled()
  })
})

describe('새 검색은 직전 그래프를 지운다', () => {
  it('두 번째 검색이 시작되면 이전 그래프가 남지 않는다', async () => {
    const { fn, calls } = makeCapturingGraph()
    const { getCtx } = await setup({ graphImpl: fn })

    await act(async () => { await getCtx().setScenarioByQuery('첫질의') })
    await act(async () => { calls[0].resolve({ ok: true, data: graphPayload() }) })
    expect(getCtx().graph).not.toBeNull()

    // 두 번째 검색 — 응답은 아직 오지 않았다.
    await act(async () => { await getCtx().setScenarioByQuery('둘째질의') })

    expect(getCtx().graph).toBeNull()
  })
})

describe('세대 가드', () => {
  it('늦게 도착한 앞선 응답은 버린다', async () => {
    const { fn, calls } = makeCapturingGraph()
    const { getCtx } = await setup({ graphImpl: fn })

    await act(async () => { await getCtx().setScenarioByQuery('첫질의') })
    await act(async () => { await getCtx().setScenarioByQuery('둘째질의') })

    // 둘째가 먼저 도착하고, 첫째가 뒤늦게 온다.
    await act(async () => {
      calls[1].resolve({ ok: true, data: graphPayload({ selected: '둘째' }) })
    })
    await act(async () => {
      calls[0].resolve({ ok: true, data: graphPayload({ selected: '첫째' }) })
    })

    expect(getCtx().graph.selected).toBe('둘째')
  })
})

describe('클래스 전환', () => {
  it('fetchGraph 재호출은 재검색을 일으키지 않는다', async () => {
    const { getCtx, searchArtifacts, fetchOutputGraph } = await setup()

    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    const searchCalls = searchArtifacts.mock.calls.length

    await act(async () => { await getCtx().fetchGraph('민주화운동', 'meta', '사회환경') })

    expect(searchArtifacts.mock.calls.length).toBe(searchCalls)
    expect(fetchOutputGraph).toHaveBeenLastCalledWith('민주화운동', 'meta', '사회환경')
  })
})

describe('실패 처리', () => {
  it('요청 실패는 status error + 사유', async () => {
    const { getCtx } = await setup({
      graphImpl: () => Promise.resolve({ ok: false, notice: '노드 그래프를 불러오지 못했습니다' }),
    })

    await act(async () => { await getCtx().setScenarioByQuery('q') })

    expect(getCtx().graphStatus).toBe('error')
    expect(getCtx().graphNotice).toBe('노드 그래프를 불러오지 못했습니다')
  })

  it('본문 status가 error면 ok 응답이어도 error다', async () => {
    // "분류가 없어서 0건"과 "검색이 실패해서 0건"을 화면이 구분해야 한다(R6F-16).
    const { getCtx } = await setup({
      graphImpl: () => Promise.resolve({
        ok: true, data: graphPayload({ status: 'error', classes: [], nodes: [] }),
      }),
    })

    await act(async () => { await getCtx().setScenarioByQuery('q') })

    expect(getCtx().graphStatus).toBe('error')
  })
})
