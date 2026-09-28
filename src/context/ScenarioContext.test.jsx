import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScenarioProvider, useScenario } from './ScenarioContext.jsx'

function Probe() {
  const { activeScenario, setScenarioByQuery } = useScenario()
  return (
    <div>
      <span data-testid="label">{activeScenario.label}</span>
      <button onClick={() => setScenarioByQuery('수출 산업화')}>경제</button>
      <button onClick={() => setScenarioByQuery('xyz')}>없음</button>
    </div>
  )
}

test('기본은 메인(민주화운동), 쿼리로 전환, 미매칭은 메인', () => {
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  expect(screen.getByTestId('label').textContent).toBe('민주화운동')
  fireEvent.click(screen.getByText('경제'))
  expect(screen.getByTestId('label').textContent).toBe('경제개발')
  fireEvent.click(screen.getByText('없음'))
  expect(screen.getByTestId('label').textContent).toBe('민주화운동')
})

function MatchProbe() {
  const { matched, scenarioKey, setScenarioByQuery } = useScenario()
  return (
    <div>
      <span data-testid="matched">{String(matched)}</span>
      <span data-testid="key">{scenarioKey}</span>
      <button onClick={() => setScenarioByQuery('5·18 자료')}>hit</button>
      <button onClick={() => setScenarioByQuery('아무거나 xyz')}>miss</button>
    </div>
  )
}

test('ScenarioContext: 초기 matched=true(메인 기본 노출), scenarioKey=democracy', () => {
  render(<ScenarioProvider><MatchProbe /></ScenarioProvider>)
  expect(screen.getByTestId('matched').textContent).toBe('true')
  expect(screen.getByTestId('key').textContent).toBe('democracy')
})

test('ScenarioContext: 매칭 쿼리는 matched=true, 미매칭 쿼리는 matched=false', () => {
  render(<ScenarioProvider><MatchProbe /></ScenarioProvider>)
  fireEvent.click(screen.getByText('miss'))
  expect(screen.getByTestId('matched').textContent).toBe('false')
  expect(screen.getByTestId('key').textContent).toBe('democracy') // 폴백은 메인
  fireEvent.click(screen.getByText('hit'))
  expect(screen.getByTestId('matched').textContent).toBe('true')
})

function LiveFlagProbe() {
  const { isLive } = useScenario()
  return <span data-testid="is-live">{String(isLive)}</span>
}

test('ScenarioContext: VITE_API_BASE_URL 미설정 시 isLive=false(비라이브 기본)', () => {
  render(<ScenarioProvider><LiveFlagProbe /></ScenarioProvider>)
  expect(screen.getByTestId('is-live').textContent).toBe('false')
})

// round04: 결과 개수(top_k) API는 서버 페이지네이션으로 대체 — 컨텍스트에서 완전히 제거됐는지,
// 그 자리에 페이지네이션 상태(page/pageSize)가 기본값으로 노출되는지 검증한다.
// round06f 갈래 A(spec §6.1): showAll·setShowAll도 같은 방식으로 **부재**를 잠근다. "모두 보기"
// 중간 단계를 폐기했으므로 이 키가 value에 다시 생기면 화면 어딘가에 죽은 분기가 되살아난
// 것이다. 기본값(false)을 단언하던 이전 계약을 부재 단언으로 반전했다.
function PaginationApiProbe() {
  const ctx = useScenario()
  return (
    <div>
      <span data-testid="has-topk">{String('topK' in ctx)}</span>
      <span data-testid="has-change-topk">{String('changeTopK' in ctx)}</span>
      <span data-testid="has-show-all">{String('showAll' in ctx)}</span>
      <span data-testid="has-set-show-all">{String('setShowAll' in ctx)}</span>
      <span data-testid="default-page">{String(ctx.page)}</span>
      <span data-testid="default-page-size">{String(ctx.pageSize)}</span>
    </div>
  )
}

test('ScenarioContext: topK·changeTopK·showAll·setShowAll 부재 + page/pageSize 기본값(1/20) 노출', () => {
  render(<ScenarioProvider><PaginationApiProbe /></ScenarioProvider>)
  expect(screen.getByTestId('has-topk').textContent).toBe('false')
  expect(screen.getByTestId('has-change-topk').textContent).toBe('false')
  expect(screen.getByTestId('has-show-all').textContent).toBe('false')
  expect(screen.getByTestId('has-set-show-all').textContent).toBe('false')
  expect(screen.getByTestId('default-page').textContent).toBe('1')
  expect(screen.getByTestId('default-page-size').textContent).toBe('20')
})

// ── 라이브 모드(VITE_API_BASE_URL 설정) ──────────────────────────────────────
// searchApi.js는 모듈 로드 시 import.meta.env.VITE_API_BASE_URL을 한 번만 읽으므로,
// vi.stubEnv → vi.resetModules → 동적 import 순서로 라이브 버전의 ScenarioContext를 불러온다.
describe('ScenarioContext 라이브 모드', () => {
  const originalFetch = global.fetch

  // round06f 갈래 B — 검색 성공 직후 /search/brief 가 한 번 더 나간다(spec §7.5·R6F-21).
  // "몇 번째 fetch"로 좌표를 잡으면 그 추가 호출과 경합해 단언이 비결정적이 되므로,
  // URL로 걸러 "검색 호출만" 본다. /search/brief 는 '/search'로 끝나지 않아 정확히 갈린다.
  const searchCalls = () => global.fetch.mock.calls.filter((c) => String(c[0]).endsWith('/search'))
  const lastSearchBody = () => JSON.parse(searchCalls().at(-1)[1].body)

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.resetModules()
  })

  test('검색 성공: liveResults/liveStatus/liveTotal/page/pageSize가 갱신되고 loading이 해제된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok',
        total: 1,
        page: 1,
        page_size: 20,
        rewritten: { search_text: '민주화운동', filters: {} },
        results: [
          { idnbr: 'i-1', name: '자료1', category: '사진', year_info: '1980', image_url: 'u1', page_url: 'p1', score: 0.9 },
        ],
      }),
    })

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function LiveProbe() {
      const { isLive, loading, liveStatus, liveTotal, liveResults, liveRewritten, page, pageSize, setScenarioByQuery } = useLiveScenario()
      return (
        <div>
          <span data-testid="live">{String(isLive)}</span>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="status">{String(liveStatus)}</span>
          <span data-testid="total">{String(liveTotal)}</span>
          <span data-testid="page">{String(page)}</span>
          <span data-testid="page-size">{String(pageSize)}</span>
          <span data-testid="count">{liveResults ? liveResults.length : 'null'}</span>
          <span data-testid="title0">{liveResults?.[0]?.title ?? ''}</span>
          <span data-testid="search-text">{liveRewritten?.search_text ?? ''}</span>
          <button onClick={() => setScenarioByQuery('민주화운동')}>검색</button>
        </div>
      )
    }

    render(<LiveProvider><LiveProbe /></LiveProvider>)
    expect(screen.getByTestId('live').textContent).toBe('true')
    expect(screen.getByTestId('count').textContent).toBe('null') // 검색 전에는 미조회

    fireEvent.click(screen.getByText('검색'))
    expect(screen.getByTestId('loading').textContent).toBe('true')

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ok'))
    expect(screen.getByTestId('total').textContent).toBe('1')
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(screen.getByTestId('title0').textContent).toBe('자료1')
    expect(screen.getByTestId('search-text').textContent).toBe('민주화운동')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    // 서버 페이지네이션 좌표는 응답값을 그대로 따른다(round04)
    expect(screen.getByTestId('page').textContent).toBe('1')
    expect(screen.getByTestId('page-size').textContent).toBe('20')
  })

  // 페이지별 결과를 흉내내는 fetch mock — 요청 body의 page를 그대로 되돌려주고,
  // 결과 제목에 페이지 번호를 새겨 "어느 페이지 분량이 렌더됐는지"를 관찰 가능하게 한다.
  function mockPagedFetch(total = 100) {
    return vi.fn().mockImplementation((url, opts) => {
      const body = JSON.parse(opts.body)
      const page = body.page ?? 1
      return Promise.resolve({
        json: () => Promise.resolve({
          status: 'ok',
          total,
          page,
          page_size: 20,
          rewritten: { search_text: body.query, filters: {} },
          results: [
            { idnbr: `i-p${page}`, name: `자료 p${page}`, category: '사진', year_info: '1980', image_url: `u${page}`, page_url: `p${page}`, score: 0.9 },
          ],
        }),
      })
    })
  }

  test('changePage: lastQuery 그대로 해당 페이지를 fetch하고 page가 갱신된다', async () => {
    global.fetch = mockPagedFetch()

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function PageProbe() {
      const { page, liveResults, lastQuery, setScenarioByQuery, changePage } = useLiveScenario()
      return (
        <div>
          <span data-testid="page">{String(page)}</span>
          <span data-testid="last-query">{lastQuery}</span>
          <span data-testid="title0">{liveResults?.[0]?.title ?? ''}</span>
          <button onClick={() => setScenarioByQuery('민주화운동')}>검색</button>
          <button onClick={() => changePage(2)}>2페이지</button>
        </div>
      )
    }

    render(<LiveProvider><PageProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(screen.getByTestId('title0').textContent).toBe('자료 p1'))
    expect(screen.getByTestId('page').textContent).toBe('1')

    fireEvent.click(screen.getByText('2페이지'))
    await waitFor(() => expect(screen.getByTestId('title0').textContent).toBe('자료 p2'))
    expect(screen.getByTestId('page').textContent).toBe('2')
    // 페이지 이동은 질의를 바꾸지 않는다 — lastQuery를 그대로 재사용해 서버 캐시를 맞춘다
    expect(screen.getByTestId('last-query').textContent).toBe('민주화운동')
    // round06e Task6: fetchPage가 searchMode(기본 'meta')를 body에 함께 싣는다.
    // round06f: /search 호출만 골라 본다(브리핑 호출과 섞이지 않게).
    expect(lastSearchBody()).toEqual({ query: '민주화운동', page: 2, mode: 'meta', sort: 'relevance', visibility: 'all' })
  })

  test('새 검색은 page=1로 리셋된다(round06f 갈래 A — showAll 단계를 없애도 페이지 좌표는 초기화된다)', async () => {
    global.fetch = mockPagedFetch()

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function ResetProbe() {
      const { page, setScenarioByQuery, changePage } = useLiveScenario()
      return (
        <div>
          <span data-testid="page">{String(page)}</span>
          <button onClick={() => setScenarioByQuery('민주화운동')}>검색A</button>
          <button onClick={() => changePage(2)}>2페이지</button>
          <button onClick={() => setScenarioByQuery('산업화 자료')}>검색B</button>
        </div>
      )
    }

    render(<LiveProvider><ResetProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('검색A'))
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('1'))
    fireEvent.click(screen.getByText('2페이지'))
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('2'))

    // 새 질의로 재검색 → 페이지 좌표가 1페이지로 돌아와야 한다
    fireEvent.click(screen.getByText('검색B'))
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('1'))
    // round06e Task6: fetchPage가 searchMode(기본 'meta')를 body에 함께 싣는다.
    // round06f: /search 호출만 골라 본다(브리핑 호출과 섞이지 않게).
    expect(lastSearchBody()).toEqual({ query: '산업화 자료', page: 1, mode: 'meta', sort: 'relevance', visibility: 'all' })
  })

  test('changePage: 검색 전(lastQuery 없음)에는 fetch하지 않는다', async () => {
    global.fetch = vi.fn()

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function NoQueryProbe() {
      const { page, changePage } = useLiveScenario()
      return (
        <div>
          <span data-testid="page">{String(page)}</span>
          <button onClick={() => changePage(2)}>2페이지</button>
        </div>
      )
    }

    render(<LiveProvider><NoQueryProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('2페이지'))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('page').textContent).toBe('1')
  })

  test('검색 실패(fetch reject): liveStatus=error, matched=false', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function ErrProbe() {
      const { liveStatus, matched, loading, setScenarioByQuery } = useLiveScenario()
      return (
        <div>
          <span data-testid="status">{String(liveStatus)}</span>
          <span data-testid="matched">{String(matched)}</span>
          <span data-testid="loading">{String(loading)}</span>
          <button onClick={() => setScenarioByQuery('아무거나')}>검색</button>
        </div>
      )
    }

    render(<LiveProvider><ErrProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'))
    expect(screen.getByTestId('matched').textContent).toBe('false')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  test('검색 degraded(rewrite 실패, 원문 검색 결과 있음): matched=true, liveNotice 노출', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'degraded',
        total: 1,
        rewritten: null,
        notice: '질의 재작성에 실패하여 원문으로 검색했습니다.',
        results: [
          { idnbr: 'i-1', name: '자료1', category: '사진', year_info: '1980', image_url: 'u1', page_url: 'p1', score: 0.9 },
        ],
      }),
    })

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function DegradedProbe() {
      const { liveStatus, matched, liveNotice, setScenarioByQuery } = useLiveScenario()
      return (
        <div>
          <span data-testid="status">{String(liveStatus)}</span>
          <span data-testid="matched">{String(matched)}</span>
          <span data-testid="notice">{String(liveNotice)}</span>
          <button onClick={() => setScenarioByQuery('아무거나')}>검색</button>
        </div>
      )
    }

    render(<LiveProvider><DegradedProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('degraded'))
    expect(screen.getByTestId('matched').textContent).toBe('true')
    expect(screen.getByTestId('notice').textContent).toBe('질의 재작성에 실패하여 원문으로 검색했습니다.')
  })

  test('검색 degraded이지만 결과 0건: matched=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'degraded',
        total: 0,
        rewritten: null,
        notice: '질의 재작성에 실패하여 원문으로 검색했습니다.',
        results: [],
      }),
    })

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function EmptyDegradedProbe() {
      const { liveStatus, matched, setScenarioByQuery } = useLiveScenario()
      return (
        <div>
          <span data-testid="status">{String(liveStatus)}</span>
          <span data-testid="matched">{String(matched)}</span>
          <button onClick={() => setScenarioByQuery('아무거나')}>검색</button>
        </div>
      )
    }

    render(<LiveProvider><EmptyDegradedProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('degraded'))
    expect(screen.getByTestId('matched').textContent).toBe('false')
  })

  test('검색 성공(ok)이지만 notice가 없으면 liveNotice는 null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok',
        total: 1,
        rewritten: { search_text: '민주화운동', filters: {} },
        results: [
          { idnbr: 'i-1', name: '자료1', category: '사진', year_info: '1980', image_url: 'u1', page_url: 'p1', score: 0.9 },
        ],
      }),
    })

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function NoNoticeProbe() {
      const { liveStatus, liveNotice, setScenarioByQuery } = useLiveScenario()
      return (
        <div>
          <span data-testid="status">{String(liveStatus)}</span>
          <span data-testid="notice">{String(liveNotice)}</span>
          <button onClick={() => setScenarioByQuery('민주화운동')}>검색</button>
        </div>
      )
    }

    render(<LiveProvider><NoNoticeProbe /></LiveProvider>)
    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ok'))
    expect(screen.getByTestId('notice').textContent).toBe('null')
  })

  // round06e Task6 — searchMode는 검색과 대화가 공유하는 상태(spec R6E-2). 기본값 'meta'가
  // /search 요청 바디에 실려 백엔드(Task4) 계약과 맞물리는지, setSearchMode로 바꾼 값이
  // 다음 검색에 그대로 반영되는지 검증한다.
  test('searchMode: 기본값 meta가 요청 바디에 실리고, setSearchMode로 바꾸면 다음 검색에 반영된다', async () => {
    global.fetch = mockPagedFetch()

    const { ScenarioProvider: LiveProvider, useScenario: useLiveScenario } = await import('./ScenarioContext.jsx')

    function ModeProbe() {
      const { searchMode, setSearchMode, setScenarioByQuery } = useLiveScenario()
      return (
        <div>
          <span data-testid="mode">{searchMode}</span>
          <button onClick={() => setScenarioByQuery('민주화운동')}>검색</button>
          <button onClick={() => setSearchMode('both')}>모드전환</button>
        </div>
      )
    }

    render(<LiveProvider><ModeProbe /></LiveProvider>)
    expect(screen.getByTestId('mode').textContent).toBe('meta')

    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(searchCalls()).toHaveLength(1))
    expect(JSON.parse(searchCalls()[0][1].body)).toEqual({ query: '민주화운동', page: 1, mode: 'meta', sort: 'relevance', visibility: 'all' })

    fireEvent.click(screen.getByText('모드전환'))
    expect(screen.getByTestId('mode').textContent).toBe('both')

    fireEvent.click(screen.getByText('검색'))
    await waitFor(() => expect(searchCalls()).toHaveLength(2))
    expect(JSON.parse(searchCalls()[1][1].body)).toEqual({ query: '민주화운동', page: 1, mode: 'both', sort: 'relevance', visibility: 'all' })
  })
})
