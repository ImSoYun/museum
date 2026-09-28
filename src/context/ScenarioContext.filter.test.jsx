// 이 파일의 책임: round06f 갈래 D → round07d — 주제 필터 상태(subjects·facets)와 그 재조회
// 계약(spec §9.4). 헬퍼는 이 파일 안에 자체로 둔다(테스트 파일 간 import 금지 관례).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

const FACETS = { subject: [{ value: '정치행정', count: 87 }, { value: '경제산업', count: 12 }] }

async function setup(searchImpl) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? ((opts) => Promise.resolve({
    status: 'ok', total: 99, page: opts.page, pageSize: 20, rewritten: null, notice: null,
    results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1', facets: FACETS,
  })))
  // round06f R6F-24 — 브리핑은 이제 SSE 스트림(streamSearchBrief)으로 나간다. 이 파일의
  // 관심사는 주제 필터(subjects·facets)이지 브리핑 자체가 아니므로, 콜백을 즉시
  // 발화해 트리거가 조용히 성공만 하면 된다(브리핑 계약 자체는 ScenarioContext.brief.test.jsx).
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
  return { getCtx: () => ctx, searchArtifacts, streamSearchBrief }
}

describe('ScenarioContext — 주제 필터(§9.4, round07d)', () => {
  it('기본값: subjects=[] · facets={subject: [], media_type: [], holder: []}', async () => {
    const { getCtx } = await setup()
    expect(getCtx().subjects).toEqual([])
    // round07m — facets 폴백 모양이 세 키로 늘었다(ScenarioContext.mediaHolder.test.jsx 참조).
    expect(getCtx().facets).toEqual({ subject: [], media_type: [], holder: [] })
  })

  it('검색 응답의 facets를 상태로 싣는다(파셋은 서버가 준다 — §9.3)', async () => {
    const { getCtx } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().facets).toEqual(FACETS)
  })

  // round07m — 폴백 모양이 세 키로 늘었다.
  it('응답에 facets가 없으면 { subject: [], media_type: [], holder: [] }로 폴백한다(DropdownCheckBox가 undefined를 받지 않는다)', async () => {
    const { getCtx } = await setup((opts) => Promise.resolve({
      status: 'ok', total: 1, page: opts.page, pageSize: 20, rewritten: null, notice: null,
      results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1',
    }))
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    expect(getCtx().facets).toEqual({ subject: [], media_type: [], holder: [] })
  })

  it('setSubjects: 상태를 바꾸고 1페이지를 다시 조회한다 — 방금 고른 값을 명시 인자로 넘긴다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['정치행정']) })

    expect(getCtx().subjects).toEqual(['정치행정'])
    expect(getCtx().page).toBe(1)
    // 상태(subjects)를 읽었다면 클로저상 옛 값 []이 실려 나갔을 것이다 — 명시 인자여야 한다
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '민주화운동', page: 1, subjects: ['정치행정'] }),
    )
  })

  it('setSubjects: conversation_id를 재사용한다(필터 변경은 새 대화가 아니다 — changePage와 같은 계약)', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['경제산업']) })
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationId: 'srv-1' }),
    )
  })

  it('setSubjects: 브리핑은 다시 만들지 않는다(R6F-6a — 모집단이 다름은 카드가 밝힌다)', async () => {
    const { getCtx, streamSearchBrief } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['정치행정']) })
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
  })

  it('페이지 이동은 현재 필터를 유지한 채 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['정치행정']) })
    await act(async () => { await getCtx().changePage(2) })
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, subjects: ['정치행정'] }),
    )
  })

  it('새 검색은 필터를 물려받지 않는다 — subjects=[]로 리셋하고 그 값으로 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['정치행정']) })
    await act(async () => { await getCtx().setScenarioByQuery('산업화 자료') })

    expect(getCtx().subjects).toEqual([])
    // 리셋 직후의 클로저는 아직 옛 값을 잡고 있으므로, 명시 인자 []가 넘어가야 한다
    const lastArg = searchArtifacts.mock.calls.at(-1)[0]
    expect(lastArg.query).toBe('산업화 자료')
    expect(lastArg.subjects).toEqual([])
  })

  it('setSubjects([])는 필터를 걷어낸 무필터 조회다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['정치행정']) })
    await act(async () => { await getCtx().setSubjects([]) })
    expect(getCtx().subjects).toEqual([])
    expect(searchArtifacts.mock.calls.at(-1)[0].subjects).toEqual([])
  })
})
