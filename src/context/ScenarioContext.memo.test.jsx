// 이 파일의 책임: Task 20(round06b) — ScenarioContext value의 useMemo 메모화가 실제로
// 효과가 있는지 검증한다. Task 5/B4는 value를 useMemo로 감쌌지만 changePage·
// setScenarioByQuery·setSubjects·sendChatMessage·resumeConversation·fetchPage 6개가
// useCallback 없는 일반 클로저라 매 렌더 참조가 바뀌었고, 그래서 useMemo는 항상
// 재계산됐다(리뷰 확증 — activeId를 의존성에서 빼도 당시 테스트 2개가 그대로 PASS했다).
// Task 20이 6개(및 그것들이 부르는 내부 헬퍼 fetchBrief·runLiveSearch) 전부를 useCallback으로
// 감싸 완성했으므로, 이 파일도 그 완성을 실제로 관측 가능하게 고쳐 쓴다.
// 테스트 파일 간 import 금지 관례(다른 ScenarioContext.*.test.jsx 참조)에 따라 헬퍼는
// 이 파일 안에 둔다.
import { useState } from 'react'
import { render, act } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'
import { MAIN_SCENARIO_ID } from '../data/scenarios.js'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

// 더미 모드(라이브 백엔드 mock 불필요) — 정방향·역방향 테스트가 쓴다.
async function setupDummy() {
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  return { ScenarioProvider, useScenario }
}

// 라이브 모드 — 낡은 state 캡처 방지 테스트가 쓴다. searchArtifacts 호출 인자를 그대로
// 검사해 fetchPage(및 그를 부르는 changePage·setSubjects·sendChatMessage 경유 postChatStream)가
// "지금" state를 읽는지 확인한다.
async function setupLive({ searchImpl, chatImpl } = {}) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? ((opts) => Promise.resolve({
    status: 'ok', total: 1, page: opts.page, pageSize: 20, rewritten: null, notice: null,
    results: [{ id: 'i-1' }], conversationId: 'srv-1', facets: { subject: [] },
  })))
  const streamSearchBrief = vi.fn((_args, cb) => {
    cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
    cb.onDone({ brief_len: 0 })
    return Promise.resolve()
  })
  const postChatStream = vi.fn(chatImpl ?? (async (_req, cb) => { cb.onDone({ turn: 1 }) }))
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
  vi.doMock('../lib/chatApi.js', () => ({ postChatStream, parseSSE: vi.fn() }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  return { getCtx: () => ctx, searchArtifacts, postChatStream }
}

// ─────────────────────────────────────────────────────────────────────────
// 정방향·역방향 — value 객체 "자체의 참조"를 직접 비교한다(필드 하나가 아니라).
// ─────────────────────────────────────────────────────────────────────────
describe('T20 — value 참조 안정화', () => {
  test('정방향: 컨텍스트 자신의 state와 무관한 리렌더에서는 value 객체 참조가 그대로 유지된다', async () => {
    const { ScenarioProvider, useScenario } = await setupDummy()
    const out = {}
    function ValueProbe() {
      out.value = useScenario()
      out.renderCount = (out.renderCount ?? 0) + 1
      return null
    }
    // Harness: ScenarioProvider "바깥"의 state로 강제 리렌더를 일으킨다 — Provider 자신의
    // state·subjects·activeId 등은 전혀 건드리지 않는 가장 순수한 "무관한 리렌더"다.
    // 메모화가 효과 없던 시절(B4 최소 구현)에는 6개 핸들러가 매 렌더 새 클로저였으므로
    // useMemo가 매번 재계산돼 이런 리렌더에서도 value가 항상 새로 만들어졌다 — 지금은
    // 실제로 bail-out(캐시 재사용)돼야 한다.
    let bump
    function Harness() {
      const [, setTick] = useState(0)
      bump = () => setTick((t) => t + 1)
      return <ScenarioProvider><ValueProbe /></ScenarioProvider>
    }
    render(<Harness />)
    const firstValue = out.value
    const before = out.renderCount

    act(() => { bump() })

    expect(out.renderCount).toBeGreaterThan(before)   // 리렌더는 실제로 일어났다
    expect(out.value).toBe(firstValue)                // 그런데도 value 객체 참조는 유지된다
  })

  test('역방향: activeId처럼 관련 있는 state가 바뀌면 value 객체가 새 참조로 갱신된다(useMemo 의존성 배열 누락 방지)', async () => {
    const { ScenarioProvider, useScenario } = await setupDummy()
    const out = {}
    function ValueProbe() { out.value = useScenario(); return null }
    render(<ScenarioProvider><ValueProbe /></ScenarioProvider>)
    const firstValue = out.value
    expect(firstValue.scenarioKey).toBe(MAIN_SCENARIO_ID)

    act(() => { out.value.setScenarioById('economy') })

    // activeId는 value의 useMemo 의존성 배열에 있다 — 관련 상태가 바뀌면 value 객체
    // 자체가 새로 만들어져야 한다. 의존성 배열에서 activeId가 빠지면(stale closure)
    // 이 값이 옛 객체에 멈춰버리는데, 그 회귀를 이 테스트가 잡는다(사보타주로 실측 — 보고서 참조).
    expect(out.value).not.toBe(firstValue)
    expect(out.value.scenarioKey).toBe('economy')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 낡은 state 캡처(stale closure) 방지 — Task 20의 최대 위험.
// 6개 함수 중 자체 useCallback 의존성 배열이 가장 긴 3개를 고른다:
//   sendChatMessage(5: conversationId·chatStatus·chatStarted·lastQuery·searchMode)
//   changePage·setSubjects(공동 2위, 각 2: lastQuery + fetchPage) — 이 둘은 동시에
//   fetchPage 자신의 실 의존성(searchMode)도 modeOverride 없이 경유해 간접 검증한다.
//   (fetchPage는 value에 노출되지 않아 직접 호출할 수 없다 — changePage·setSubjects를
//   통해서만 관측 가능하다.)
// ─────────────────────────────────────────────────────────────────────────
describe('T20 — 낡은 state 캡처 방지', () => {
  test('sendChatMessage는 최신 lastQuery·searchMode·conversationId를 읽는다(의존성 5개로 최다)', async () => {
    let capturedReq
    const { getCtx } = await setupLive({
      chatImpl: async (req, cb) => { capturedReq = req; cb.onDone({ turn: 1 }) },
    })

    // 첫 검색 — lastQuery='초기질의', searchMode 기본값('meta'), conversationId='srv-1'.
    await act(() => getCtx().setScenarioByQuery('초기질의'))
    // mount 시점 클로저에는 없던 값으로 searchMode를 바꾼다.
    await act(() => { getCtx().setSearchMode('both') })
    // 재검색으로 lastQuery·conversationId를 다시 갱신한다(대화 시작 전이라 chatStarted=false).
    await act(() => getCtx().setScenarioByQuery('최신질의'))
    const latestConversationId = getCtx().conversationId

    await act(async () => { await getCtx().sendChatMessage('질문') })

    // 의존성이 정확하면 "최신" 값이 실린다. 의존성을 잘못 비우면(사보타주) mount 시점
    // 클로저(''·'meta'·null)에 멈추거나, conversationId=null 가드에 걸려 아예 호출되지 않는다.
    expect(capturedReq.searchQuery).toBe('최신질의')
    expect(capturedReq.mode).toBe('both')
    expect(capturedReq.conversationId).toBe(latestConversationId)
  })

  test('changePage는 최신 lastQuery와(fetchPage 경유) searchMode를 읽는다', async () => {
    const { getCtx, searchArtifacts } = await setupLive()

    await act(() => getCtx().setScenarioByQuery('첫 질의'))
    await act(() => { getCtx().setSearchMode('both') })
    await act(() => getCtx().setScenarioByQuery('두번째 질의'))   // lastQuery 갱신

    searchArtifacts.mockClear()
    await act(() => getCtx().changePage(3))

    expect(searchArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      query: '두번째 질의', page: 3, mode: 'both',
    }))
  })

  test('setSubjects는 최신 lastQuery와(fetchPage 경유) searchMode를 읽는다', async () => {
    const { getCtx, searchArtifacts } = await setupLive()

    await act(() => getCtx().setScenarioByQuery('필터 전 질의'))
    await act(() => { getCtx().setSearchMode('both') })
    await act(() => getCtx().setScenarioByQuery('필터 대상 질의'))

    searchArtifacts.mockClear()
    await act(() => getCtx().setSubjects(['사진']))

    expect(searchArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      query: '필터 대상 질의', page: 1, mode: 'both', subjects: ['사진'],
    }))
  })
})
