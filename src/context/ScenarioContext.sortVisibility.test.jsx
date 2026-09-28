// 이 파일의 책임: round07h — 정렬(sort)·등록유형(visibility) 상태와 그 재조회 계약.
// subjects(ScenarioContext.filter.test.jsx)와 같은 자리·같은 계약이라 그 파일의 구조를
// 그대로 미러한다(테스트 파일 간 import 금지 관례이므로 헬퍼를 이 파일 안에 다시 둔다).
//
// 이 스위트가 잠그는 것은 "셀렉트를 바꾸면 실제로 다시 서버를 부르는가"다 — UI 컴포넌트
// (SortSelect.test.jsx·ResultsTab.live.test.jsx)만 통과하고 이 배선이 없으면, 셀렉트는
// 화면에서 움직이지만 검색 결과는 그대로인 "아무것도 안 하는 UI"가 된다.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

async function setup(searchImpl) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn(searchImpl ?? ((opts) => Promise.resolve({
    status: 'ok', total: 99, page: opts.page, pageSize: 20, rewritten: null, notice: null,
    results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1', facets: { subject: [] },
  })))
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

describe('ScenarioContext — 정렬·등록유형(round07h)', () => {
  it('기본값: sort="relevance" · visibility="all"', async () => {
    const { getCtx } = await setup()
    expect(getCtx().sort).toBe('relevance')
    expect(getCtx().visibility).toBe('all')
  })

  it('setSort: 상태를 바꾸고 1페이지를 다시 조회한다 — 방금 고른 값을 명시 인자로 넘긴다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSort('recent') })

    expect(getCtx().sort).toBe('recent')
    expect(getCtx().page).toBe(1)
    // 상태(sort)를 읽었다면 클로저상 옛 값 'relevance'가 실려 나갔을 것이다 — 명시 인자여야 한다
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '민주화운동', page: 1, sort: 'recent' }),
    )
  })

  it('setVisibility: 상태를 바꾸고 1페이지를 다시 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setVisibility('public') })

    expect(getCtx().visibility).toBe('public')
    expect(getCtx().page).toBe(1)
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '민주화운동', page: 1, visibility: 'public' }),
    )
  })

  it('setSort는 visibility를, setVisibility는 sort를 서로 건드리지 않는다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setVisibility('private') })
    await act(async () => { await getCtx().setSort('past') })

    expect(getCtx().visibility).toBe('private')
    expect(getCtx().sort).toBe('past')
    // setSort 호출 시 직전에 고른 visibility('private')가 사라지지 않아야 한다
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'past', visibility: 'private' }),
    )
  })

  it('setSort: conversation_id를 재사용한다(정렬 변경은 새 대화가 아니다 — changePage와 같은 계약)', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSort('past') })
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationId: 'srv-1' }),
    )
  })

  it('setSort: 브리핑은 다시 만들지 않는다(R6F-6a와 같은 계약 — 정렬은 모집단을 바꾸지 않는다)', async () => {
    const { getCtx, streamSearchBrief } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSort('recent') })
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
  })

  it('페이지 이동은 현재 정렬·등록유형을 유지한 채 조회한다', async () => {
    // ★ 이 테스트가 진짜 핵심이다 — sort/visibility가 ResultsTab 로컬 state였다면
    //   ScenarioContext.changePage는 그 값을 몰라 서버 기본값(relevance·all)으로
    //   되돌아간다. 3페이지를 "최신순"으로 보다가 페이지만 넘겨도 정렬이 풀린다.
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSort('recent') })
    await act(async () => { await getCtx().setVisibility('public') })
    await act(async () => { await getCtx().changePage(3) })
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, sort: 'recent', visibility: 'public' }),
    )
  })

  it('새 검색은 정렬·등록유형을 물려받지 않는다 — relevance·all로 리셋하고 그 값으로 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSort('past') })
    await act(async () => { await getCtx().setVisibility('private') })
    await act(async () => { await getCtx().setScenarioByQuery('산업화 자료') })

    expect(getCtx().sort).toBe('relevance')
    expect(getCtx().visibility).toBe('all')
    // 리셋 직후의 클로저는 아직 옛 값을 잡고 있으므로, 명시 인자가 넘어가야 한다
    const lastArg = searchArtifacts.mock.calls.at(-1)[0]
    expect(lastArg.query).toBe('산업화 자료')
    expect(lastArg.sort).toBe('relevance')
    expect(lastArg.visibility).toBe('all')
  })
})
