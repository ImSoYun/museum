// 이 파일의 책임: round07m — 종류(mediaType)·소장처(holder) 상태와 그 재조회 계약.
// ScenarioContext.sortVisibility.test.jsx(정렬·공개여부)와 같은 자리·같은 계약이라 그
// 파일의 구조를 미러한다(테스트 파일 간 import 금지 관례 — 헬퍼를 다시 둔다).
//
// ★ 핵심은 「null 이 실제로 null 로 나가는가」다. fetchPage 가 필터를 `??` 로 고르면
//   새 검색 리셋이 넘긴 null 이 「안 넘김」으로 읽혀 옛 선택이 다시 실린다.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

async function setup() {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const searchArtifacts = vi.fn((opts) => Promise.resolve({
    status: 'ok', total: 99, page: opts.page, pageSize: 20, rewritten: null, notice: null,
    results: [{ id: 'i-1', title: '자료1' }], conversationId: 'srv-1',
    facets: { subject: [], media_type: [], holder: [] },
  }))
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

describe('ScenarioContext — 종류·소장처(round07m)', () => {
  it('기본값: mediaType=null · holder=null · facets 에 세 키', async () => {
    const { getCtx } = await setup()
    expect(getCtx().mediaType).toBeNull()
    expect(getCtx().holder).toBeNull()
    expect(getCtx().facets).toEqual({ subject: [], media_type: [], holder: [] })
  })

  it('setMediaType: 상태를 바꾸고 1페이지를 방금 고른 값으로 다시 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setMediaType('도서') })
    expect(getCtx().mediaType).toBe('도서')
    expect(getCtx().page).toBe(1)
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '민주화운동', page: 1, mediaType: '도서', conversationId: 'srv-1' }),
    )
  })

  it('setHolder: 상태를 바꾸고 다시 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setHolder('정보 없음') })
    expect(getCtx().holder).toBe('정보 없음')
    expect(searchArtifacts).toHaveBeenLastCalledWith(expect.objectContaining({ holder: '정보 없음' }))
  })

  it('한 필터를 바꿔도 다른 필터(주제·공개여부·종류·소장처)는 그대로 실린다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setSubjects(['정치행정']) })
    await act(async () => { await getCtx().setVisibility('public') })
    await act(async () => { await getCtx().setMediaType('이미지') })
    await act(async () => { await getCtx().setHolder('국가기록원') })
    expect(searchArtifacts).toHaveBeenLastCalledWith(expect.objectContaining({
      subjects: ['정치행정'], visibility: 'public', mediaType: '이미지', holder: '국가기록원',
    }))
  })

  it('setMediaType(null) 은 필터를 해제하고 null 로 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setMediaType('도서') })
    await act(async () => { await getCtx().setMediaType(null) })
    expect(getCtx().mediaType).toBeNull()
    expect(searchArtifacts.mock.calls.at(-1)[0].mediaType).toBeNull()
  })

  it('페이지 이동은 현재 종류·소장처를 유지한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setMediaType('영상') })
    await act(async () => { await getCtx().setHolder('대한민국역사박물관') })
    await act(async () => { await getCtx().changePage(3) })
    expect(searchArtifacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, mediaType: '영상', holder: '대한민국역사박물관' }),
    )
  })

  it('새 검색은 종류·소장처를 물려받지 않는다 — null 로 리셋하고 null 로 조회한다', async () => {
    const { getCtx, searchArtifacts } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setMediaType('도서') })
    await act(async () => { await getCtx().setHolder('국가기록원') })
    await act(async () => { await getCtx().setScenarioByQuery('산업화 자료') })
    expect(getCtx().mediaType).toBeNull()
    expect(getCtx().holder).toBeNull()
    const lastArg = searchArtifacts.mock.calls.at(-1)[0]
    expect(lastArg.query).toBe('산업화 자료')
    expect(lastArg.mediaType).toBeNull()
    expect(lastArg.holder).toBeNull()
  })

  it('종류 변경은 브리핑을 다시 만들지 않는다(R6F-6a — 필터는 같은 검색의 다른 뷰)', async () => {
    const { getCtx, streamSearchBrief } = await setup()
    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setMediaType('도서') })
    expect(streamSearchBrief).toHaveBeenCalledTimes(1)
  })
})
