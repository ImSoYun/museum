// round06c E3 Step6: resumeConversation("나의 기록"에서 대화 재개) 계약 검증.
// getConversation(E2)으로 메타·히스토리를 로드해 chatMessages/lastQuery/conversationId를 채우고,
// 보유 id로 searchArtifacts를 재호출한다 — 페이지 이동과 마찬가지로 "재개"도 새 conversations
// 행을 만들지 않아야 한다(중복 신규 행 방지 계약). 관행은 ScenarioContext.chat.test.jsx와 동형
// (vi.doMock + vi.stubEnv('VITE_API_BASE_URL') → vi.resetModules → 동적 import).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

async function setup({ conv, searchArtifactsImpl } = {}) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const getConversation = vi.fn().mockResolvedValue(conv)
  vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
  const searchArtifacts = vi.fn(
    searchArtifactsImpl ??
      (() => Promise.resolve({
        status: 'ok', total: 0, page: 1, pageSize: 20, rewritten: null,
        notice: null, results: [], conversationId: null,
      })),
  )
  vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts }))
  const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
  let ctx
  function Probe() { ctx = useScenario(); return null }
  render(<ScenarioProvider><Probe /></ScenarioProvider>)
  return { getCtx: () => ctx, getConversation, searchArtifacts }
}

describe('ScenarioContext — resumeConversation(E3 Step5)', () => {
  it('getConversation을 불러 메타·히스토리를 채우고, 보유 id로 searchArtifacts를 재호출한다(중복 신규 행 방지)', async () => {
    // F1: 서버는 citations를 절대 주지 않고 grounded_docs(12필드 전문+n)를 준다
    // (conversations/routes.py._history_to_messages). 픽스처를 실제 계약 형태로 둔다 —
    // desc처럼 소비하지 않는 여분 필드가 섞여도 매핑 결과(citations)에는 새지 않아야 한다.
    const conv = {
      id: 'c-1',
      status: 200,
      search_query: '민주화운동',
      messages: [
        { role: 'user', content: '질문1' },
        {
          role: 'assistant',
          content: '답변1',
          grounded_docs: [{ n: 1, idnbr: 'PS-1', name: '자료1', desc: '전문(소비하지 않음)' }],
          rewritten_queries: ['민주화운동 관련 자료'],
        },
      ],
    }
    const { getCtx, getConversation, searchArtifacts } = await setup({ conv })

    await act(async () => { await getCtx().resumeConversation('c-1') })

    expect(getConversation).toHaveBeenCalledWith('c-1')
    // 재개도 changePage와 같은 계약: 보유 id를 실어 보내 새 conversations 행을 만들지 않는다.
    expect(searchArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ query: '민주화운동', page: 1, conversationId: 'c-1' }),
    )
    expect(getCtx().conversationId).toBe('c-1')
    expect(getCtx().lastQuery).toBe('민주화운동')
    expect(getCtx().page).toBe(1)
    // assistant→ai, content→text 매핑 + grounded_docs→citations 변환(라이브 채팅과 동일 형태:
    // {n, idnbr, name, image_url}). rewritten_queries·desc 등 여분 필드는 버려진다(F1).
    // user 턴은 grounded_docs 자체가 없어 citations:null.
    expect(getCtx().chatMessages).toEqual([
      { role: 'user', text: '질문1', citations: null },
      { role: 'ai', text: '답변1', citations: [{ n: 1, idnbr: 'PS-1', name: '자료1', image_url: '/images/PS-1' }] },
    ])
    expect(getCtx().chatStatus).toBe('idle')
  })

  it('messages가 빈 배열(검색만 하고 대화는 없던 행)이면 chatMessages도 빈 배열로 재개된다', async () => {
    const conv = { id: 'c-2', status: 200, search_query: '88서울올림픽 포스터', messages: [] }
    const { getCtx } = await setup({ conv })

    await act(async () => { await getCtx().resumeConversation('c-2') })

    expect(getCtx().chatMessages).toEqual([])
    expect(getCtx().conversationId).toBe('c-2')
    expect(getCtx().lastQuery).toBe('88서울올림픽 포스터')
  })

  it('assistant 턴이 자료를 인용하지 않았으면(grounded_docs:[]) citations는 빈 배열이다', async () => {
    const conv = {
      id: 'c-3',
      status: 200,
      search_query: '질의',
      messages: [
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: 'A(인용 없음)', grounded_docs: [], rewritten_queries: [] },
      ],
    }
    const { getCtx } = await setup({ conv })
    await act(async () => { await getCtx().resumeConversation('c-3') })
    expect(getCtx().chatMessages[1]).toEqual({ role: 'ai', text: 'A(인용 없음)', citations: [] })
  })
})

// F2: 더미(비라이브) 모드에서는 서버가 없으므로 재개가 fetchPage(searchArtifacts)를 태우지
// 않아야 한다 — 태우면 fetch('undefined/search')가 나가고 실패 catch가 matched=false·
// liveStatus='error'로 더미 화면을 오염한다.
describe('ScenarioContext — resumeConversation 더미 모드 가드(F2)', () => {
  async function setupDummy({ conv }) {
    const getConversation = vi.fn().mockResolvedValue(conv)
    vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
    const searchArtifacts = vi.fn()
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => false, searchArtifacts }))
    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)
    return { getCtx: () => ctx, getConversation, searchArtifacts }
  }

  it('더미 모드에서는 getConversation 결과로 메타·메시지만 세팅하고 fetchPage(searchArtifacts)는 부르지 않는다', async () => {
    const conv = {
      id: 'c-demo-1',
      search_query: '민주화운동에 관련된 자료 찾아줘',
      messages: [{ role: 'user', content: 'Q' }, { role: 'assistant', content: 'A', grounded_docs: [] }],
    }
    const { getCtx, getConversation, searchArtifacts } = await setupDummy({ conv })

    await act(async () => { await getCtx().resumeConversation('c-demo-1') })

    expect(getConversation).toHaveBeenCalledWith('c-demo-1')
    expect(searchArtifacts).not.toHaveBeenCalled()
    expect(getCtx().conversationId).toBe('c-demo-1')
    expect(getCtx().lastQuery).toBe('민주화운동에 관련된 자료 찾아줘')
    expect(getCtx().chatMessages).toEqual([
      { role: 'user', text: 'Q', citations: null },
      { role: 'ai', text: 'A', citations: [] },
    ])
  })

  // round06e 리뷰(test-coverage) — 검색 모드 복원(위 R6E-19 describe)은 라이브 경로만
  // 커버해, setSearchMode(restoredMode)를 !isLive() 조기반환 "뒤"로 옮기는 변이를 아무도
  // 잡지 못했다. 구현(ScenarioContext.jsx)은 이미 조기반환보다 앞에서 setSearchMode를
  // 호출한다 — 더미 모드에서도 토글이 복원돼야 함을 여기서 직접 검증한다.
  it('더미 모드에서 재개해도 저장된 검색 모드가 토글에 복원된다(setSearchMode가 !isLive 조기반환보다 앞)', async () => {
    const conv = {
      id: 'c-demo-2',
      search_query: '태극기',
      mode: 'both',
      messages: [],
    }
    const { getCtx } = await setupDummy({ conv })

    await act(async () => { await getCtx().resumeConversation('c-demo-2') })

    expect(getCtx().searchMode).toBe('both')
  })
})

// F3: getConversation이 이제 status를 동봉한다(deleteConversation과 대칭). 비200이거나
// search_query가 없으면(예: 404 detail 바디) resumeConversation은 fetchPage를 아예 태우지
// 않고 실패를 표면화한다(여기서는 { ok:false, status } 반환을 선택 — 아래 도크스트링 참고).
describe('ScenarioContext — resumeConversation 실패 표면화(F3)', () => {
  it('getConversation이 404(status:404, search_query 없음)면 fetchPage를 부르지 않고 {ok:false}를 반환한다', async () => {
    const conv = { status: 404, detail: '대화를 찾을 수 없습니다' }
    const { getCtx, searchArtifacts } = await setup({ conv })

    const result = await act(async () => getCtx().resumeConversation('missing-id'))

    expect(searchArtifacts).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, status: 404 })
    // 실패 시엔 기존 상태를 갈아치우지 않는다(쓰레기 행 방지 — conversationId 등 미변경).
    expect(getCtx().conversationId).toBeNull()
  })
})

// F6: runLiveSearch(L130-131)와 동일하게, 재개도 직전 대화의 notice 배너·pool 문구가
// 새 대화 화면에 잔류하지 않도록 리셋해야 한다.
describe('ScenarioContext — resumeConversation의 chatNotice·poolSize 리셋(F6)', () => {
  it('직전 대화에서 남은 chatNotice·poolSize가 재개 후 초기화된다', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
    const conv = { id: 'c-9', status: 200, search_query: '질의', messages: [] }
    const getConversation = vi.fn().mockResolvedValue(conv)
    vi.doMock('../lib/conversationsApi.js', () => ({ getConversation }))
    const searchArtifacts = vi.fn().mockResolvedValue({
      status: 'ok', total: 0, page: 1, pageSize: 20, rewritten: null,
      notice: null, results: [], conversationId: null,
    })
    vi.doMock('../lib/searchApi.js', () => ({ isLive: () => true, searchArtifacts }))
    const postChatStream = vi.fn(async (_req, cb) => {
      cb.onStatus({ stage: 'bootstrap', pool_size: 42 })
      cb.onNotice('직전 대화 안내')
      cb.onDone({ turn: 1 })
    })
    vi.doMock('../lib/chatApi.js', () => ({ postChatStream, parseSSE: vi.fn() }))

    const { ScenarioProvider, useScenario } = await import('./ScenarioContext.jsx')
    let ctx
    function Probe() { ctx = useScenario(); return null }
    render(<ScenarioProvider><Probe /></ScenarioProvider>)

    await act(async () => { await ctx.setScenarioByQuery('첫 검색') })
    await act(async () => { await ctx.sendChatMessage('질문') })
    expect(ctx.poolSize).toBe(42)
    expect(ctx.chatNotice).toBe('직전 대화 안내')

    await act(async () => { await ctx.resumeConversation('c-9') })
    expect(ctx.poolSize).toBeNull()
    expect(ctx.chatNotice).toBeNull()
  })
})

// round06e Task9(spec R6E-19 후반) — resumeConversation은 저장된 mode를 토글(searchMode)에
// 복원하고, 이어지는 재검색도 그 복원값으로 나가야 한다(현재 토글값이 아니라). setSearchMode
// 직후 fetchPage를 그대로 부르면 클로저에 갇힌 옛 searchMode를 읽으므로, fetchPage가 명시
// 인자(modeOverride)를 받아야 한다 — 아래 두 테스트가 각각 그 계약의 양면을 검증한다.
describe('ScenarioContext — resumeConversation의 검색 모드 복원(round06e Task9, R6E-19)', () => {
  it('대화를 재개하면 저장된 검색 모드가 토글에 복원된다', async () => {
    const conv = { id: 'c-1', status: 200, search_query: '태극기', mode: 'both', messages: [] }
    const { getCtx } = await setup({ conv })

    await act(async () => { await getCtx().resumeConversation('c-1') })

    expect(getCtx().searchMode).toBe('both')
  })

  it('재개 직후의 재검색은 복원된 모드로 나간다 — 현재 토글값이 아니라', async () => {
    const conv = { id: 'c-1', status: 200, search_query: '태극기', mode: 'ocr', messages: [] }
    const { getCtx, searchArtifacts } = await setup({ conv })

    await act(async () => { await getCtx().resumeConversation('c-1') })

    expect(searchArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ query: '태극기', mode: 'ocr' }),
    )
  })

  it('mode가 없는 옛 대화는 meta로 복원된다(DB 기본값과 동일)', async () => {
    const conv = { id: 'c-1', status: 200, search_query: '태극기', messages: [] }
    const { getCtx } = await setup({ conv })

    await act(async () => { await getCtx().resumeConversation('c-1') })

    expect(getCtx().searchMode).toBe('meta')
  })
})

// F8: changePage가 서버 echo된 conversation_id를 다음 페이지 요청 바디에 싣는지 직접 검증한다
// (기존 ScenarioContext.test.jsx의 changePage 테스트는 conversation_id를 안 주는 mock이라
// "없을 때 안 실린다"만 증명했고, "있을 때 실제로 실린다"는 별도 커버리지가 없었다).
describe('ScenarioContext — changePage의 conversationId 재사용(F8 직접 테스트)', () => {
  it('첫 검색 응답의 conversationId를 changePage 요청 바디에 그대로 싣는다', async () => {
    let call = 0
    const impl = (opts) => {
      call += 1
      return Promise.resolve({
        status: 'ok', total: 1, page: opts.page, pageSize: 20, rewritten: null, notice: null,
        results: [], conversationId: call === 1 ? 'srv-77' : null,
      })
    }
    const { getCtx, searchArtifacts } = await setup({ searchArtifactsImpl: impl })

    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().changePage(2) })

    const lastCallArg = searchArtifacts.mock.calls.at(-1)[0]
    expect(lastCallArg).toEqual(expect.objectContaining({ query: '민주화운동', page: 2, conversationId: 'srv-77' }))
  })
})

// round07m — 재개에는 복원할 종류(mediaType)·소장처(holder) 값이 없다(서버가 conversations에
// 필터를 저장하지 않는다 — 정렬·등록유형과 같은 이유, 위 §9.4 c 계열과 동형). 재개 직전에
// 걸어 둔 필터가 새로 여는 대화 화면에 남아 있으면 안 된다 — 상태도 null로 리셋되고, 재조회도
// null로(이전 선택이 아니라) 나가야 한다.
describe('ScenarioContext — resumeConversation의 종류·소장처 리셋(round07m)', () => {
  it('재개는 종류·소장처를 상태에서 null로 되돌리고, null로 재조회한다', async () => {
    const conv = { id: 'c-1', status: 200, search_query: '민주화운동', messages: [] }
    const { getCtx, searchArtifacts } = await setup({ conv })

    await act(async () => { await getCtx().setScenarioByQuery('민주화운동') })
    await act(async () => { await getCtx().setMediaType('도서') })
    await act(async () => { await getCtx().setHolder('국가기록원') })
    expect(getCtx().mediaType).toBe('도서')
    expect(getCtx().holder).toBe('국가기록원')

    await act(async () => { await getCtx().resumeConversation('c-1') })

    expect(getCtx().mediaType).toBeNull()
    expect(getCtx().holder).toBeNull()
    const lastArg = searchArtifacts.mock.calls.at(-1)[0]
    expect(lastArg.mediaType).toBeNull()
    expect(lastArg.holder).toBeNull()
  })
})

// ── round10 최종리뷰 C-1 — 조회 함수 주입 ──────────────────────────────────────
// 공유 열람자(남의 프로젝트를 연 사람)는 소유자 전용 GET /conversations/{id}를 부를 수
// 없다(403). 그렇다고 이 컨텍스트가 "지금 어느 프로젝트를 보는가"를 알게 만들지는
// 않는다 — 호출부가 조회 함수를 내려준다. 기본값은 지금까지의 getConversation이라
// 기존 호출부(LnbHistory·SearchFlowLayout)는 한 글자도 바뀌지 않는다.
describe('ScenarioContext — resumeConversation의 조회 함수 주입(C-1)', () => {
  it('두 번째 인자를 주면 그 함수로 조회하고 기본 getConversation은 부르지 않는다', async () => {
    const conv = {
      id: 'c-proj', status: 200, search_query: '민주화운동', mode: 'ocr',
      messages: [{ role: 'user', content: '질문1' }],
    }
    // 기본 경로는 403(소유자가 아니다)을 돌려주도록 둔다 — 주입이 실제로 갈아끼웠는지를
    // 「기본을 안 불렀다」와 「그래도 복원에 성공했다」 둘로 확인한다.
    const { getCtx, getConversation, searchArtifacts } =
      await setup({ conv: { status: 403, detail: '다른 사용자의 대화입니다' } })
    const viaProject = vi.fn().mockResolvedValue(conv)

    const result = await act(async () => getCtx().resumeConversation('c-proj', viaProject))

    expect(viaProject).toHaveBeenCalledWith('c-proj')
    expect(getConversation).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
    expect(getCtx().lastQuery).toBe('민주화운동')
    expect(getCtx().conversationId).toBe('c-proj')
    expect(getCtx().searchMode).toBe('ocr')
    expect(searchArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ query: '민주화운동', conversationId: 'c-proj' }),
    )
  })

  it('인자를 주지 않으면 지금까지처럼 getConversation을 쓴다(기존 호출부 무변경)', async () => {
    const conv = { id: 'c-1', status: 200, search_query: '민주화운동', messages: [] }
    const { getCtx, getConversation } = await setup({ conv })
    await act(async () => { await getCtx().resumeConversation('c-1') })
    expect(getConversation).toHaveBeenCalledWith('c-1')
  })

  it('주입한 조회가 실패하면(404) 상태를 건드리지 않고 {ok:false}를 돌려준다', async () => {
    const { getCtx, searchArtifacts } = await setup({ conv: { status: 200, search_query: 'x' } })
    const viaProject = vi.fn().mockResolvedValue({ status: 404, detail: 'not_found' })

    const result = await act(async () => getCtx().resumeConversation('c-gone', viaProject))

    expect(result).toEqual({ ok: false, status: 404 })
    expect(searchArtifacts).not.toHaveBeenCalled()
    expect(getCtx().conversationId).toBeNull()
  })
})
