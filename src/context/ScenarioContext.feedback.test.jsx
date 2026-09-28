// 이 파일의 책임: round06f 갈래 C — 만족도 위젯이 기대는 세 값(searchGenId·liveRequestId·
// feedbackSent)의 갱신 시점 계약(spec §8.2, R6F-22 · 최종 리뷰 F2). 헬퍼는 이 파일 안에
// 자체로 둔다(테스트 파일 간 import 금지).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

async function setup({ searchImpl } = {}) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  let n = 0
  const defaultSearchImpl = (opts) => {
    n += 1
    return Promise.resolve({
      status: 'ok', total: 99, page: opts.page, pageSize: 20, rewritten: null, notice: null,
      results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1',
      facets: { subject: [] }, requestId: `req-${n}`,
    })
  }
  const searchArtifacts = vi.fn(searchImpl ?? defaultSearchImpl)
  // round06f R6F-24 — 브리핑은 이제 SSE 스트림(streamSearchBrief)으로 나간다. 이 파일의
  // 관심사는 searchGenId·liveRequestId·feedbackSent 갱신 시점이지 브리핑 자체가 아니므로,
  // 콜백을 즉시 발화해 브리핑 트리거가 조용히 성공만 하면 된다(ScenarioContext.brief.test.jsx가
  // 브리핑 계약 자체를 잠근다).
  const streamSearchBrief = vi.fn((_args, cb) => {
    cb.onMeta({ status: 'ok', cached: false, model: 'm', result_count: 1 })
    cb.onToken('요약')
    cb.onDone({ brief_len: 2 })
    return Promise.resolve()
  })
  const getConversation = vi.fn().mockResolvedValue({
    id: 'c-9', status: 200, search_query: '재개질의', mode: 'meta', messages: [],
  })
  vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts, streamSearchBrief }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  // 최종 리뷰 F2 — SearchResults.jsx 의 `loading ? <spinner/> : <...RatingWidget/></...>`
  // 삼항을 그대로 흉내 낸 서브트리다. loading===true 면 RatingLike 가 통째로 언마운트되고
  // (스피너로 교체), false 로 돌아오면 "새 인스턴스"로 다시 마운트된다 — 이 파일 하단의
  // 언마운트/리마운트 테스트가 실제 마운트 경계를 넘어 feedbackSent 를 관측하는 근거가
  // 이 컴포넌트다. RatingLike 자신은 로컬 state 를 전혀 두지 않는다(수정 후 RatingWidget과
  // 동형 — feedbackSent 를 컨텍스트에서만 읽는다).
  function RatingLike() {
    const { feedbackSent } = useScenario()
    return <div data-testid="rating-like">{feedbackSent ? 'sent' : 'form'}</div>
  }
  function Shell() {
    const { loading } = useScenario()
    return loading ? <div data-testid="spinner" /> : <RatingLike />
  }
  render(<ScenarioProvider><Probe /><Shell /></ScenarioProvider>)
  return { getCtx: () => ctx }
}

describe('ScenarioContext — searchGenId(R6F-22)', () => {
  it('기본값은 0이다', async () => {
    const { getCtx } = await setup()
    expect(getCtx().searchGenId).toBe(0)
  })

  it('새 검색마다 1씩 오른다', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    expect(getCtx().searchGenId).toBe(1)
    await act(async () => { await getCtx().setScenarioByQuery('B') })
    expect(getCtx().searchGenId).toBe(2)
  })

  it('페이지 이동으로는 오르지 않는다(같은 검색의 다른 페이지일 뿐 새 평가 대상이 아니다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    await act(async () => { await getCtx().changePage(2) })
    await act(async () => { await getCtx().changePage(3) })
    expect(getCtx().searchGenId).toBe(1)
  })

  it('로딩 스피너로 서브트리가 언마운트됐다가 다시 마운트돼도 감사 상태(feedbackSent)가 유지된다 — 이것이 "페이지를 넘겨도 제출 후 감사 상태가 유지되는" 실제 근거다(F2 리뷰. 이전에는 RatingWidget 로컬 state라 여기서 소실됐다)', async () => {
    let resolveSearch
    const searchImpl = (opts) => (
      opts.page === 2
        ? new Promise((resolve) => { resolveSearch = resolve })
        : Promise.resolve({
            status: 'ok', total: 99, page: opts.page, pageSize: 20, rewritten: null, notice: null,
            results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1',
            facets: { subject: [] }, requestId: 'req-1',
          })
    )
    const { getCtx } = await setup({ searchImpl })
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    act(() => { getCtx().setFeedbackSent(true) })
    expect(screen.getByTestId('rating-like').textContent).toBe('sent')

    // 페이지 이동 — fetchPage 가 loading 을 true 로 올리는 동안 Shell 이 스피너로
    // 갈아끼워 RatingLike 를 언마운트한다(SearchResults.jsx 의 실제 조건과 동일).
    act(() => { getCtx().changePage(2) })
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('rating-like')).toBeNull()

    // 응답 도착 — loading 이 false 로 돌아가 RatingLike 가 "새 인스턴스"로 재마운트된다.
    await act(async () => { resolveSearch({
      status: 'ok', total: 99, page: 2, pageSize: 20, rewritten: null, notice: null,
      results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1',
      facets: { subject: [] }, requestId: 'req-2',
    }) })

    // 리마운트된 새 인스턴스도 feedbackSent:true 를 그대로 읽는다 — 로컬 state 였다면
    // 여기서 초기값(false='form')으로 되돌아갔을 것이다(리뷰가 지적한 실제 결함).
    expect(screen.getByTestId('rating-like').textContent).toBe('sent')
    expect(getCtx().searchGenId).toBe(1)   // 같은 검색 세대 — 리마운트만으로는 리셋되지 않는다
  })

  it('필터 변경으로도 오르지 않는다(같은 검색의 다른 뷰다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    await act(async () => { await getCtx().setSubjects(['사회생활']) })
    expect(getCtx().searchGenId).toBe(1)
  })

  it('기록 재개에서는 오른다(새 평가 대상이다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    await act(async () => { await getCtx().resumeConversation('c-9') })
    expect(getCtx().searchGenId).toBe(2)
  })
})

describe('ScenarioContext — liveRequestId(§8.2)', () => {
  it('검색 응답의 request_id를 보관한다', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    expect(getCtx().liveRequestId).toBe('req-1')
  })

  it('페이지를 넘기면 새 값으로 바뀐다 — 요청 1건당 새 uuid이므로 최신값이 곧 "그 순간 본 요청"이다', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    await act(async () => { await getCtx().changePage(2) })
    expect(getCtx().liveRequestId).toBe('req-2')
    // 그런데 searchGenId 는 그대로다 — 이 둘의 갱신 주기가 다른 것이 R6F-22의 핵심이다
    expect(getCtx().searchGenId).toBe(1)
  })

  it('검색이 실패하면 null로 되돌린다(옛 요청 id를 평가에 실어 보내지 않는다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    expect(getCtx().liveRequestId).toBe('req-1')
    // 다음 호출만 실패시킨다
    const mod = await import('../lib/searchApi.js')
    mod.searchArtifacts.mockRejectedValueOnce(new Error('down'))
    await act(async () => { await getCtx().changePage(2) })
    expect(getCtx().liveRequestId).toBeNull()
  })
})

describe('ScenarioContext — feedbackSent(최종 리뷰 F2)', () => {
  it('기본값은 false다', async () => {
    const { getCtx } = await setup()
    expect(getCtx().feedbackSent).toBe(false)
  })

  it('새 검색은 false로 되돌린다 — searchGenId 증가 지점과 동일하다(새 평가 대상)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    act(() => { getCtx().setFeedbackSent(true) })
    expect(getCtx().feedbackSent).toBe(true)

    await act(async () => { await getCtx().setScenarioByQuery('B') })
    expect(getCtx().feedbackSent).toBe(false)
  })

  it('기록 재개도 false로 되돌린다(같은 이유 — 새 평가 대상이다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    act(() => { getCtx().setFeedbackSent(true) })

    await act(async () => { await getCtx().resumeConversation('c-9') })
    expect(getCtx().feedbackSent).toBe(false)
  })

  it('필터 변경으로는 되돌아가지 않는다(같은 검색의 다른 뷰일 뿐이다)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('A') })
    act(() => { getCtx().setFeedbackSent(true) })

    await act(async () => { await getCtx().setSubjects(['사회생활']) })
    expect(getCtx().feedbackSent).toBe(true)
  })
})
