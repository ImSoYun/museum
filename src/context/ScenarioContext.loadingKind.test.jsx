// 이 파일의 책임: round06f R6F-26 — 로딩 문구 분기(loadingKind). 최초 검색(runLiveSearch)만
// 'search'이고 재개(resumeConversation)·페이지 이동(changePage)·필터 변경(setSubjects)은
// 'restore'다(spec §5). fetchPage가 4곳이 공유하는 공용 통로라 스스로는 원인을 모르므로,
// 호출부가 kind를 명시 인자로 넘기는 계약을 여기서 잠근다. 헬퍼는 이 파일 안에 자체로
// 둔다(테스트 파일 간 import 금지 관례).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

const okResponse = (over = {}) => ({
  status: 'ok', total: 1, page: 1, pageSize: 20, rewritten: null, notice: null,
  results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1', ...over,
})

// 브리핑은 이 파일의 관심사가 아니다 — 콜백을 즉시 발화해 조용히 성공만 시킨다
// (계약 자체는 ScenarioContext.brief.test.jsx가 담당).
function okStream(_args, cb) {
  cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
  cb.onToken('요약')
  cb.onDone({ brief_len: 2 })
  return Promise.resolve()
}

async function setup(searchImpl) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? (() => Promise.resolve(okResponse())))
  const streamSearchBrief = vi.fn(okStream)
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  return { getCtx: () => ctx, searchArtifacts }
}

describe('ScenarioContext — loadingKind(R6F-26)', () => {
  it('runLiveSearch(최초 검색): 로딩 중 loadingKind=search이고, 완료 후에도 유지된다', async () => {
    const { getCtx } = await setup()
    let p
    act(() => { p = getCtx().setScenarioByQuery('민주화운동') })
    // fetchPage의 setLoading(true)/setLoadingKind(kind)는 async 경계 이전에(동기로) 실행된다
    // — 기존 ScenarioContext.test.jsx의 "fireEvent 직후 loading=true" 단언과 같은 원리.
    expect(getCtx().loading).toBe(true)
    expect(getCtx().loadingKind).toBe('search')
    await act(async () => { await p })
    expect(getCtx().loading).toBe(false)
    expect(getCtx().loadingKind).toBe('search')
  })

  it('changePage(페이지 이동): 로딩 중 loadingKind=restore다 — 재검색이 아니라 캐시 슬라이스일 뿐이라 "검색 중…"이 아니다', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().loadingKind).toBe('search') // 직전 최초 검색의 잔여값 확인(대조군)

    let p
    act(() => { p = getCtx().changePage(2) })
    expect(getCtx().loading).toBe(true)
    expect(getCtx().loadingKind).toBe('restore')
    await act(async () => { await p })
    expect(getCtx().loadingKind).toBe('restore')
  })

  it('setSubjects(필터 변경): 로딩 중 loadingKind=restore다', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })

    let p
    act(() => { p = getCtx().setSubjects(['사회생활']) })
    expect(getCtx().loading).toBe(true)
    expect(getCtx().loadingKind).toBe('restore')
    await act(async () => { await p })
    expect(getCtx().loadingKind).toBe('restore')
  })

  it('연속 사용: 재검색(runLiveSearch)이 다시 일어나면 loadingKind가 search로 되돌아온다(고착되지 않는다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().changePage(2) })
    expect(getCtx().loadingKind).toBe('restore')

    await act(async () => { await getCtx().setScenarioByQuery('산업화 자료') })
    expect(getCtx().loadingKind).toBe('search')
  })
})

// resumeConversation은 getConversation(비동기)의 완료 이후에야 fetchPage가 불린다 — "로딩
// 시작 직전" 시점을 동기로 가로챌 수 없으므로(추가 마이크로태스크 1홉), 완료 후 값이
// 'restore'로 남는지를 확인한다. loadingKind는 완료 후에도 리셋되지 않으므로(다음 로딩
// 전까지) 이 값은 곧 로딩 도중의 값과 같다.
describe('ScenarioContext — resumeConversation의 loadingKind(R6F-26)', () => {
  it('기록 재개: loadingKind=restore로 남는다("검색 중…"이 아니라 "불러오는 중…" 문구로 이어진다)', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
    const conv = { id: 'c-1', status: 200, search_query: '민주화운동', mode: 'meta', messages: [] }
    const getConversation = vi.fn().mockResolvedValue(conv)
    vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
    const searchArtifacts = vi.fn(() => Promise.resolve(okResponse()))
    const streamSearchBrief = vi.fn(okStream)
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))

    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)

    await act(async () => { await ctx.resumeConversation('c-1') })
    expect(ctx.loadingKind).toBe('restore')
  })
})
