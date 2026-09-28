import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// BASE(=isLive)는 모듈 로드 시 import.meta.env.VITE_API_BASE_URL을 한 번만 읽으므로,
// 값을 바꿔 테스트하려면 vi.stubEnv → vi.resetModules → 동적 import 순서를 지켜야 한다.

describe('searchApi — 기본(VITE_API_BASE_URL 미설정)', () => {
  test('isLive()는 false — 더미 모드', async () => {
    const { isLive } = await import('./searchApi.js')
    expect(isLive()).toBe(false)
  })
})

describe('deriveType — category 문자열 부분매칭', () => {
  test.each([
    ['사진', '사진'],
    ['기록사진', '사진'],
    ['전시 포스터', '사진'],
    ['기록영상', '영상'],
    ['구술 음성', '음성'],
    ['도서', '도서'],
    ['고서적', '도서'],
    ['기타문서', '사진'], // 매칭 없으면 사진으로 폴백
    [undefined, '사진'],
    ['', '사진'],
  ])('deriveType(%j) === %j', async (input, expected) => {
    const { deriveType } = await import('./searchApi.js')
    expect(deriveType(input)).toBe(expected)
  })
})

describe('mapResult — 백엔드 result → material shape', () => {
  test('idnbr→id, name→title, image_url→image, category→type 파생', async () => {
    const { mapResult } = await import('./searchApi.js')
    const r = {
      idnbr: 'i-100',
      name: '5·18 기록사진',
      category: '사진',
      // year_info(만들어진 때)는 응답에 실려 있어도 카드가 더는 읽지 않는다 — 아래에서
      // subject_year(다루는 시대)와 값을 다르게 둬 "여전히 무시되는지"까지 확인한다.
      year_info: '1980',
      subject_year: 2018,
      image_url: 'https://x/img.jpg',
      page_url: 'https://x/p',
      score: 0.92,
    }
    expect(mapResult(r)).toEqual({
      id: 'i-100',
      title: '5·18 기록사진',
      image: 'https://x/img.jpg',
      type: '사진',
      category: '사진',
      // round07d — 축이 주제로 옮겼다. 이 픽스처에는 subject 가 없으므로 빈 배열이다.
      subject: [],
      // round07h 후속 — year_info('1980')가 아니라 subject_year(2018)에서 나온다.
      eraText: '2018년',
      pageUrl: 'https://x/p',
      score: 0.92,
      hasImage: false,
      // round07h — 이 픽스처에는 is_public 이 없으므로(구 응답·보강 실패) null(모름)이다.
      isPublic: null,
      // round07m — 이 픽스처에는 media_type 이 없으므로(문화유산 등 원천에 매체 칸이 없는 경우) null이다.
      mediaType: null,
    })
  })

  // round07h 후속 — 카드가 보여줄 시대 축을 "만들어진 때"에서 "다루는 시대"로
  // 바꾼 것의 세 갈래(연도 있음 / 원본 텍스트만 있음 / 둘 다 없음)를 각각 잠근다.
  describe('eraText — 다루는 시대(subject_year/subject_era) 축', () => {
    test('subject_year가 있으면 "YYYY년"로 찍는다(91.8%) — year_info/era는 무시한다', async () => {
      const { mapResult } = await import('./searchApi.js')
      // 실측 사례 그대로 — 「하멜의 난파 기록」: year_info 파생값은 "2010년대"(디지털화
      // 시점)인데 실제 subject_year는 1653(자료가 다루는 시대)이다. year_info를 읽으면
      // 이 테스트가 '2010년대'를 기대하게 되어 즉시 빨개진다.
      const mapped = mapResult({
        idnbr: 'i-hamel', name: '하멜의 난파 기록',
        year_info: '2010년대', era: '2010년대', subject_year: 1653, subject_era: '2016.03.02.',
      })
      expect(mapped.eraText).toBe('1653년')
    })

    test('subject_year가 없고 subject_era 원본이 있으면 그대로 보여준다(0.7%, "미상"으로 덮지 않는다)', async () => {
      const { mapResult } = await import('./searchApi.js')
      const mapped = mapResult({
        idnbr: 'i-1', name: '국권 침탈기 기록', subject_year: null, subject_era: '일제강점기',
      })
      expect(mapped.eraText).toBe('일제강점기')
    })

    test('subject_year·subject_era 둘 다 없으면 "시대 미상"이다(7.5%)', async () => {
      const { mapResult } = await import('./searchApi.js')
      const mapped = mapResult({ idnbr: 'i-2', name: '출처 불명 자료' })
      expect(mapped.eraText).toBe('시대 미상')
    })

    test('subject_era가 빈 문자열이면(원본 자체가 공백) "시대 미상"이다', async () => {
      const { mapResult } = await import('./searchApi.js')
      const mapped = mapResult({ idnbr: 'i-3', name: '자료', subject_year: null, subject_era: '' })
      expect(mapped.eraText).toBe('시대 미상')
    })
  })

  test('mapResult: has_image=true → hasImage:true로 매핑된다', async () => {
    const { mapResult } = await import('./searchApi.js')
    expect(mapResult({ idnbr: 'i-1', name: 'n', has_image: true }).hasImage).toBe(true)
  })

  test('mapResult: has_image가 없으면 hasImage:false로 매핑된다', async () => {
    const { mapResult } = await import('./searchApi.js')
    expect(mapResult({ idnbr: 'i-1', name: 'n' }).hasImage).toBe(false)
  })

  test('mapResult: 서버가 준 subject 배열을 그대로 옮긴다(프론트 파생 금지 — round07d, 이전 R6F-15의 축 이전)', async () => {
    const { mapResult } = await import('./searchApi.js')
    const mapped = mapResult({ idnbr: 'i-1', name: 'n', category: '교통/통신-통신-우편-우표', subject: ['정치행정 > 정치'] })
    expect(mapped.subject).toEqual(['정치행정 > 정치'])
    // 원본 category 도 그대로 남는다 — 상세 모달이 전체 경로를 쓴다
    expect(mapped.category).toBe('교통/통신-통신-우편-우표')
  })

  test('mapResult: subject가 없으면 빈 배열이다(배지 렌더가 undefined를 map하지 않도록 — round07d)', async () => {
    const { mapResult } = await import('./searchApi.js')
    expect(mapResult({ idnbr: 'i-1', name: 'n', category: '사회생활-사회제도' }).subject).toEqual([])
  })

  // ── round07h — is_public → isPublic. 세 상태(공개·미공개·모름)를 그대로 옮긴다 ──
  describe('isPublic 매핑(세 상태)', () => {
    test('is_public:true → isPublic:true', async () => {
      const { mapResult } = await import('./searchApi.js')
      expect(mapResult({ idnbr: 'i-1', name: 'n', is_public: true }).isPublic).toBe(true)
    })

    test('is_public:false → isPublic:false(Boolean() 이 아니라 값을 그대로 옮긴다)', async () => {
      const { mapResult } = await import('./searchApi.js')
      expect(mapResult({ idnbr: 'i-1', name: 'n', is_public: false }).isPublic).toBe(false)
    })

    test('is_public이 없으면(구 응답·보강 실패) isPublic:null — false로 둔갑하지 않는다', async () => {
      // ★ 여기서 Boolean(r.is_public)을 썼다면 undefined가 false가 되어 "모른다"가
      //   "미공개다"로 둔갑한다. mapResult는 ?? null을 써서 세 상태를 지킨다.
      const { mapResult } = await import('./searchApi.js')
      expect(mapResult({ idnbr: 'i-1', name: 'n' }).isPublic).toBeNull()
    })
  })
})

describe('searchApi — 라이브 모드(VITE_API_BASE_URL 설정)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.resetModules()
  })

  test('isLive()는 true', async () => {
    const { isLive } = await import('./searchApi.js')
    expect(isLive()).toBe(true)
  })

  test('mapResult: 상대경로 image_url이 BASE로 접두된다', async () => {
    const { mapResult } = await import('./searchApi.js')
    const mapped = mapResult({ idnbr: 'i-100', name: '자료', category: '사진', year_info: '1980', image_url: '/images/i-100', page_url: 'p' })
    expect(mapped.image).toBe('https://api.example.com/images/i-100')
    expect(mapped.pageUrl).toBe('p') // page_url은 접두 대상 아님(현행 유지)
  })

  test('searchArtifacts: POST /search 호출(query+page) + 매핑된 results 반환', async () => {
    const mockResponse = {
      status: 'ok',
      total: 2,
      page: 1,
      page_size: 20,
      rewritten: { search_text: '민주화운동', filters: {} },
      results: [
        // i-1은 subject_year 갈래(91.8%), i-2는 subject_era 원본 폴백 갈래(0.7%) — 두
        // 갈래가 한 응답 안에 섞여도 각자 옳게 매핑되는지 함께 확인한다. year_info는
        // 응답에 실려 있어도(백엔드가 여전히 내려준다) eraText가 읽지 않는다.
        { idnbr: 'i-1', name: '자료1', category: '사진', year_info: '1980', subject_year: 1980, image_url: '/images/i-1', page_url: 'p1', score: 0.9 },
        { idnbr: 'i-2', name: '자료2', category: '기록영상', year_info: '1987', subject_year: null, subject_era: '19세기 후반', image_url: '/images/i-2', page_url: 'p2', score: 0.8 },
      ],
    }
    global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(mockResponse) })

    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('민주화운동')

    // round04 계약: body는 { query, page }만 — top_k는 보내지 않고,
    // page_size도 서버 기본(20)에 맡긴다(프론트 상수 이중화 금지).
    // round06c(F1): credentials:'include'가 전 fetch에 실린다(전면 게이트, spec §9.5).
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/search',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // round07h — sort·visibility는 서버 기본값과 같아도 항상 실린다(searchApi.js 주석 참조).
        body: JSON.stringify({ query: '민주화운동', page: 1, sort: 'relevance', visibility: 'all' }),
      })
    )
    expect(result.status).toBe('ok')
    expect(result.total).toBe(2)
    // 서버 페이지네이션 좌표(page/page_size)가 camelCase로 매핑되어야
    // 컨텍스트(ScenarioContext)가 그대로 상태에 실을 수 있다.
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.rewritten).toEqual(mockResponse.rewritten)
    // image_url(상대경로)이 BASE(VITE_API_BASE_URL)로 접두되어야 프론트·백엔드 오리진이 달라도
    // 썸네일이 404 없이 뜬다(DoD #1). page_url은 박물관 원본 절대 URL이므로 그대로 pageUrl에 남는다.
    expect(result.results).toEqual([
      // round07m — 이 픽스처들에는 media_type 이 없으므로 mediaType: null.
      { id: 'i-1', title: '자료1', image: 'https://api.example.com/images/i-1', type: '사진', category: '사진', subject: [], eraText: '1980년', pageUrl: 'p1', score: 0.9, hasImage: false, isPublic: null, mediaType: null },
      { id: 'i-2', title: '자료2', image: 'https://api.example.com/images/i-2', type: '영상', category: '기록영상', subject: [], eraText: '19세기 후반', pageUrl: 'p2', score: 0.8, hasImage: false, isPublic: null, mediaType: null },
    ])
  })

  test('searchArtifacts: page 인자를 주면 그 페이지를 요청한다(질의는 그대로)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 100, page: 3, page_size: 20, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('민주화운동', 3)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/search',
      expect.objectContaining({ body: JSON.stringify({ query: '민주화운동', page: 3, sort: 'relevance', visibility: 'all' }) })
    )
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(20)
    expect(result.total).toBe(100)
  })

  test('searchArtifacts: image_url이 이미 절대 URL이면 접두하지 않고 그대로 쓴다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok',
        total: 1,
        rewritten: {},
        results: [
          { idnbr: 'i-3', name: '자료3', category: '사진', year_info: '2000', image_url: 'https://cdn.example.org/img/i-3.jpg', page_url: 'p3', score: 0.7 },
        ],
      }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('아무거나')
    expect(result.results[0].image).toBe('https://cdn.example.org/img/i-3.jpg')
  })

  test('searchArtifacts: results가 없으면 빈 배열로 매핑', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'empty', total: 0, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('아무거나')
    expect(result.results).toEqual([])
    expect(result.status).toBe('empty')
  })

  test('searchArtifacts: 응답의 notice를 그대로 반환에 포함한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'degraded',
        total: 1,
        rewritten: null,
        notice: '질의 재작성에 실패하여 원문으로 검색했습니다.',
        results: [
          { idnbr: 'i-9', name: '자료9', category: '사진', year_info: '1990', image_url: 'u9', page_url: 'p9', score: 0.5 },
        ],
      }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('아무거나')
    expect(result.notice).toBe('질의 재작성에 실패하여 원문으로 검색했습니다.')
    expect(result.status).toBe('degraded')
  })

  test('searchArtifacts: 응답에 notice가 없으면 undefined로 반환', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('아무거나')
    expect(result.notice).toBeUndefined()
  })

  // round06c C1b(spec §8.5·C-D1): /search 응답의 conversation_id를 conversationId로 노출한다.
  test('searchArtifacts: 응답의 conversation_id를 conversationId로 노출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok', total: 0, rewritten: {}, results: [],
        conversation_id: 'c-server-발급-uuid',
      }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('아무거나')
    expect(result.conversationId).toBe('c-server-발급-uuid')
  })

  test('searchArtifacts: 응답에 conversation_id가 없으면 conversationId는 null(로컬 폴백은 호출부 몫)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts('아무거나')
    expect(result.conversationId).toBeNull()
  })

  // round06c E3(계획 Task E3 Step1): 객체 인자 시그니처 — ScenarioContext의 changePage/resumeConversation이
  // 보유 conversationId를 /search에 실어 보내 "페이지 이동·재개마다 새 conversations 행이 생기는" 문제를 해소한다.
  test('searchArtifacts: 객체 인자({query,page,conversationId})로 호출하면 body에 conversation_id가 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, page: 2, page_size: 20, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const result = await searchArtifacts({ query: '민주화', page: 2, conversationId: 'c-1' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: '민주화', page: 2, conversation_id: 'c-1', sort: 'relevance', visibility: 'all' }),
      })
    )
    expect(result.page).toBe(2)
  })

  test('searchArtifacts: 객체 인자에 conversationId가 없으면 body에 conversation_id 키가 없다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    await searchArtifacts({ query: '민주화', page: 1 })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/search',
      expect.objectContaining({ body: JSON.stringify({ query: '민주화', page: 1, sort: 'relevance', visibility: 'all' }) })
    )
  })

  test('searchArtifacts: 객체 인자에서 page 생략 시 기본값 1', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    await searchArtifacts({ query: '민주화' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/search',
      expect.objectContaining({ body: JSON.stringify({ query: '민주화', page: 1, sort: 'relevance', visibility: 'all' }) })
    )
  })

  // round06c F1(spec §9.5·C-D2): fetchArtifactDetail도 credentials 전수 대상이고,
  // 401은 authEvents.notifyUnauthorized()로 좁게(res.status===401) 통지된다.
  test('fetchArtifactDetail: GET /artifacts/{idnbr}에 credentials:"include"가 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ idnbr: 'i-1', name: '자료1' }),
    })
    const { fetchArtifactDetail } = await import('./searchApi.js')
    await fetchArtifactDetail('i-1')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/artifacts/i-1',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('searchArtifacts: 401 응답이면 authEvents.notifyUnauthorized()가 호출된다(!res.ok 아닌 좁은 판정)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      json: () => Promise.resolve({ detail: '인증 필요' }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await searchArtifacts('아무거나')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('fetchArtifactDetail: 401 응답이면 authEvents.notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      json: () => Promise.resolve({}),
    })
    const { fetchArtifactDetail } = await import('./searchApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await fetchArtifactDetail('i-1')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  // round06e Task6 — mode(meta|ocr|both)를 요청 바디에 실어 백엔드(Task4)의 mode 계약에 배선한다.
  test('mode 를 요청 바디에 싣는다', async () => {
    const fetchSpy = vi.fn(async () => ({ status: 200, json: async () => ({ results: [] }) }))
    globalThis.fetch = fetchSpy
    const { searchArtifacts } = await import('./searchApi.js')

    await searchArtifacts({ query: '태극기', page: 1, mode: 'both' })

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.mode).toBe('both')
  })

  test('mode 가 없으면 바디에 키를 넣지 않는다(서버 기본값 위임)', async () => {
    const fetchSpy = vi.fn(async () => ({ status: 200, json: async () => ({ results: [] }) }))
    globalThis.fetch = fetchSpy
    const { searchArtifacts } = await import('./searchApi.js')

    await searchArtifacts({ query: '태극기', page: 1 })

    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).not.toHaveProperty('mode')
  })

  test('searchArtifacts: 200 응답이면 notifyUnauthorized()가 호출되지 않는다(오탐 방지 회귀)', async () => {
    // 이 스위트의 기존 mock들처럼 .status 필드가 없는 응답도 401로 오판되지 않아야 한다
    // (‼️ !res.ok였다면 .ok가 undefined인 이 mock들이 전부 오탐됐을 것 — spec §9.5·C-D2).
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await searchArtifacts('아무거나')
    expect(onUnauthorized).not.toHaveBeenCalled()
    unregister()
  })

  test('downloadArtifactImage: 성공 시 blob과 filename을 반환한다', async () => {
    const fakeBlob = new Blob(['binary'])
    global.fetch = vi.fn().mockResolvedValue({ status: 200, blob: () => Promise.resolve(fakeBlob) })
    const { downloadArtifactImage } = await import('./searchApi.js')
    const res = await downloadArtifactImage('a1')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/artifacts/a1/download',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(res.ok).toBe(true)
    expect(res.blob).toBe(fakeBlob)
    expect(res.filename).toBe('a1.jpg')
  })

  test('downloadArtifactImage: 404면 ok:false와 서버 detail을 반환한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      json: () => Promise.resolve({ detail: '이미지가 없는 자료입니다' }),
    })
    const { downloadArtifactImage } = await import('./searchApi.js')
    const res = await downloadArtifactImage('a1')
    expect(res.ok).toBe(false)
    expect(res.notice).toBe('이미지가 없는 자료입니다')
  })

  test('downloadArtifactImage: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { downloadArtifactImage } = await import('./searchApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await downloadArtifactImage('a1')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  // ── round06f R6F-24(spec §7.3a) — POST /search/brief/stream(SSE) ───────────
  // chatApi.js의 postChatStream이 쓰는 fetch-reader SSE 파서를 미러한다(파싱·버퍼링·
  // 이벤트 분기 관행 동일). lib/ 각 파일은 자기완결(레포 관행) — chatApi.js를
  // import하지 않고 같은 패턴을 이 파일 안에 다시 둔다.
  describe('streamSearchBrief', () => {
    function streamOf(text, status = 200) {
      const encoder = new TextEncoder()
      return new Response(new ReadableStream({
        start(c) { c.enqueue(encoder.encode(text)); c.close() },
      }), { status })
    }

    test('이벤트를 콜백으로 분배하고 미지 이벤트는 무시한다', async () => {
      const body =
        'event: meta\ndata: {"status":"ok","cached":false,"model":"gemma","result_count":20}\n\n' +
        'event: mystery\ndata: {}\n\n' +
        'event: token\ndata: {"text":"민주화운동 관련 "}\n\n' +
        'event: token\ndata: {"text":"자료가 다수 검색되었습니다."}\n\n' +
        'event: done\ndata: {"brief_len":24}\n\n'
      global.fetch = vi.fn().mockResolvedValue(streamOf(body))
      const { streamSearchBrief } = await import('./searchApi.js')
      const seen = { meta: null, tokens: [], done: null, error: null }
      await streamSearchBrief({ query: '민주화운동', mode: 'meta' }, {
        onMeta: (d) => (seen.meta = d),
        onToken: (t) => seen.tokens.push(t),
        onDone: (d) => (seen.done = d),
        onError: (n) => (seen.error = n),
      })
      expect(seen.meta).toEqual({ status: 'ok', cached: false, model: 'gemma', result_count: 20 })
      expect(seen.tokens).toEqual(['민주화운동 관련 ', '자료가 다수 검색되었습니다.'])
      expect(seen.done).toEqual({ brief_len: 24 })
      expect(seen.error).toBeNull()
    })

    test('캐시 히트는 전문이 단일 token 1회로 온다(§7.3a — meta.cached:true)', async () => {
      const body =
        'event: meta\ndata: {"status":"ok","cached":true,"model":"gemma","result_count":20}\n\n' +
        'event: token\ndata: {"text":"그때 그 요약 전문"}\n\n' +
        'event: done\ndata: {"brief_len":9}\n\n'
      global.fetch = vi.fn().mockResolvedValue(streamOf(body))
      const { streamSearchBrief } = await import('./searchApi.js')
      const tokens = []
      let meta
      await streamSearchBrief({ query: 'q' }, {
        onMeta: (d) => (meta = d), onToken: (t) => tokens.push(t), onDone: () => {}, onError: () => {},
      })
      expect(meta.cached).toBe(true)
      expect(tokens).toEqual(['그때 그 요약 전문'])
    })

    test('스트림 중 error 이벤트는 onError(notice)로 전달한다', async () => {
      const body =
        'event: meta\ndata: {"status":"ok","cached":false,"model":"gemma","result_count":45}\n\n' +
        'event: token\ndata: {"text":"앞부분 "}\n\n' +
        'event: error\ndata: {"notice":"브리핑 생성에 실패했습니다"}\n\n'
      global.fetch = vi.fn().mockResolvedValue(streamOf(body))
      const { streamSearchBrief } = await import('./searchApi.js')
      const onError = vi.fn()
      const tokens = []
      await streamSearchBrief({ query: 'q' }, {
        onMeta: () => {}, onToken: (t) => tokens.push(t), onDone: () => {}, onError,
      })
      expect(tokens).toEqual(['앞부분 '])
      expect(onError).toHaveBeenCalledWith('브리핑 생성에 실패했습니다')
    })

    test('disabled 상태는 meta 뒤 곧바로 done — token 없이 종료한다', async () => {
      const body =
        'event: meta\ndata: {"status":"disabled","cached":false,"model":null,"result_count":0,"notice":"AI 브리핑이 비활성화되어 있습니다"}\n\n' +
        'event: done\ndata: {"brief_len":0}\n\n'
      global.fetch = vi.fn().mockResolvedValue(streamOf(body))
      const { streamSearchBrief } = await import('./searchApi.js')
      const onToken = vi.fn()
      let meta
      let done
      await streamSearchBrief({ query: 'q' }, {
        onMeta: (d) => (meta = d), onToken, onDone: (d) => (done = d), onError: () => {},
      })
      expect(meta.status).toBe('disabled')
      expect(onToken).not.toHaveBeenCalled()
      expect(done).toEqual({ brief_len: 0 })
    })

    test('POST /search/brief/stream에 query·mode·credentials가 실린다', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(streamOf('event: done\ndata: {"brief_len":0}\n\n'))
      global.fetch = fetchSpy
      const { streamSearchBrief } = await import('./searchApi.js')
      await streamSearchBrief({ query: '민주화운동', mode: 'both' }, {
        onMeta: () => {}, onToken: () => {}, onDone: () => {}, onError: () => {},
      })
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/search/brief/stream',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '민주화운동', mode: 'both' }),
        }),
      )
    })

    test('mode가 없으면 바디에 키를 넣지 않는다(서버 기본값 위임)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(streamOf('event: done\ndata: {"brief_len":0}\n\n'))
      global.fetch = fetchSpy
      const { streamSearchBrief } = await import('./searchApi.js')
      await streamSearchBrief({ query: '민주화운동' }, {
        onMeta: () => {}, onToken: () => {}, onDone: () => {}, onError: () => {},
      })
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({ query: '민주화운동' })
    })

    test('401이면 notifyUnauthorized()가 호출되고 onError도 불린다(!res.ok 아닌 좁은 판정)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: '인증 필요' }), { status: 401 }))
      const { streamSearchBrief } = await import('./searchApi.js')
      const { registerUnauthorizedHandler } = await import('./authEvents.js')
      const onUnauthorized = vi.fn()
      const unregister = registerUnauthorizedHandler(onUnauthorized)
      const onError = vi.fn()
      await streamSearchBrief({ query: 'q' }, { onMeta: () => {}, onToken: () => {}, onDone: () => {}, onError })
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalled()
      unregister()
    })

    test('429 등 !res.ok 응답은 서버 notice로 onError를 부른다(스트림을 열지 않는다)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ notice: '요청이 너무 많습니다 — 잠시 후 다시 시도하세요' }), { status: 429 }))
      const { streamSearchBrief } = await import('./searchApi.js')
      const onError = vi.fn()
      await streamSearchBrief({ query: 'q' }, { onMeta: () => {}, onToken: () => {}, onDone: () => {}, onError })
      expect(onError).toHaveBeenCalledWith('요청이 너무 많습니다 — 잠시 후 다시 시도하세요')
    })

    test('네트워크 오류(fetch reject)는 onError로 전달되고 예외로 새지 않는다', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
      const { streamSearchBrief } = await import('./searchApi.js')
      const onError = vi.fn()
      await expect(streamSearchBrief({ query: 'q' }, {
        onMeta: () => {}, onToken: () => {}, onDone: () => {}, onError,
      })).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalled()
    })
  })

  // ── round06f 갈래 D(spec §9.2·§9.4) → round07d 축 전환 — subjects 요청 · facets 응답 ──
  test('searchArtifacts: subjects가 비어 있지 않을 때만 body에 싣는다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    await searchArtifacts({ query: '민주화', page: 1, subjects: ['사회환경', '문화예술'] })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      query: '민주화', page: 1, subjects: ['사회환경', '문화예술'], sort: 'relevance', visibility: 'all',
    })
  })

  test('searchArtifacts: subjects가 빈 배열이면 body에 키를 넣지 않는다(기존 호출부·테스트의 body 형태 보존)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    await searchArtifacts({ query: '민주화', page: 1, subjects: [] })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ query: '민주화', page: 1, sort: 'relevance', visibility: 'all' })
  })

  test('searchArtifacts: 응답의 facets를 그대로 반환한다', async () => {
    const facets = { subject: [{ value: '사회환경', count: 87 }, { value: '문화예술', count: 12 }] }
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 99, page: 1, page_size: 20, rewritten: {}, results: [], facets }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    expect((await searchArtifacts({ query: 'q' })).facets).toEqual(facets)
  })

  // round07m — 폴백 모양이 세 키({ subject, media_type, holder })로 늘었다(searchApi.js 참조).
  test('searchArtifacts: 응답에 facets가 없으면 { subject: [], media_type: [], holder: [] }로 폴백한다(구 mock·429 대비)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    expect((await searchArtifacts({ query: 'q' })).facets).toEqual({ subject: [], media_type: [], holder: [] })
  })

  // ── round06f 갈래 C(spec §8.2·§8.3) — request_id · POST /feedback ──────────
  test('searchArtifacts: 응답의 request_id를 requestId로 노출한다(헤더가 아니라 body — R6F-12)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, rewritten: {}, results: [], request_id: 'req-abc' }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    expect((await searchArtifacts({ query: 'q' })).requestId).toBe('req-abc')
  })

  test('searchArtifacts: 응답에 request_id가 없으면 requestId는 null이다(서버가 스스로 채운다)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', total: 0, rewritten: {}, results: [] }),
    })
    const { searchArtifacts } = await import('./searchApi.js')
    expect((await searchArtifacts({ query: 'q' })).requestId).toBeNull()
  })

  test('postFeedback: POST /feedback에 7점 척도와 평가 맥락을 snake_case로 싣는다(round07d — 필드는 subjects)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200, json: () => Promise.resolve({ ok: true, status: 'ok' }),
    })
    const { postFeedback } = await import('./searchApi.js')
    await postFeedback({
      score: 6, comment: '유용했습니다', requestId: 'req-abc',
      conversationId: 'c-1', query: '민주화운동', subjects: ['사회환경'],
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/feedback',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: 6,
          comment: '유용했습니다',
          request_id: 'req-abc',
          conversation_id: 'c-1',
          query: '민주화운동',
          subjects: ['사회환경'],
        }),
      }),
    )
  })

  test('postFeedback: 선택 필드가 비면 null·빈 배열로 보낸다(rating은 서버가 파생하므로 보내지 않는다)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200, json: () => Promise.resolve({ ok: true, status: 'ok' }),
    })
    const { postFeedback } = await import('./searchApi.js')
    await postFeedback({ score: 4 })
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toEqual({
      score: 4, comment: null, request_id: null, conversation_id: null, query: null, subjects: [],
    })
    expect(body).not.toHaveProperty('rating')
  })

  test('postFeedback: 실패(ok:false)를 예외로 승격하지 않고 notice와 함께 돌려준다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200, json: () => Promise.resolve({ ok: false, status: 'error', notice: '평가 저장에 실패했습니다' }),
    })
    const { postFeedback } = await import('./searchApi.js')
    expect(await postFeedback({ score: 1 })).toEqual({
      ok: false, status: 'error', notice: '평가 저장에 실패했습니다',
    })
  })

  test('postFeedback: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { postFeedback } = await import('./searchApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await postFeedback({ score: 7 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  // ── round07d — 항목·요청의 축이 주제로 옮겼다(계획 §Task4·spec) ─────────────
  describe('round07d 주제 축', () => {
    test('항목에 subject 배열을 싣는다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          status: 'ok', total: 1, page: 1, page_size: 20, facets: { subject: [] },
          results: [{ idnbr: 'a', name: '선언문', subject: ['정치행정 > 정치'] }],
        }),
      })
      const { searchArtifacts } = await import('./searchApi.js')
      const r = await searchArtifacts({ query: '민주화운동' })
      expect(r.results[0].subject).toEqual(['정치행정 > 정치'])
    })

    test('subject가 없으면 빈 배열이다 — 배지가 undefined를 map하지 않게', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          status: 'ok', total: 1, page: 1, page_size: 20, facets: { subject: [] },
          results: [{ idnbr: 'a', name: '선언문' }],
        }),
      })
      const { searchArtifacts } = await import('./searchApi.js')
      const r = await searchArtifacts({ query: '민주화운동' })
      expect(r.results[0].subject).toEqual([])
    })

    test('categoryL1을 더 이상 만들지 않는다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          status: 'ok', total: 1, page: 1, page_size: 20, facets: { subject: [] },
          results: [{ idnbr: 'a', name: '선언문' }],
        }),
      })
      const { searchArtifacts } = await import('./searchApi.js')
      const r = await searchArtifacts({ query: '민주화운동' })
      expect('categoryL1' in r.results[0]).toBe(false)
    })

    test('필터를 subjects로 보낸다', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, facets: { subject: [] }, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      await searchArtifacts({ query: '민주화운동', subjects: ['정치행정'] })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.subjects).toEqual(['정치행정'])
      expect('categories' in body).toBe(false)
    })

    test('빈 배열은 아예 보내지 않는다 — 서버가 무필터로 읽는다', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, facets: { subject: [] }, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      await searchArtifacts({ query: '민주화운동', subjects: [] })
      expect('subjects' in JSON.parse(fetchMock.mock.calls[0][1].body)).toBe(false)
    })
  })

  // ── round07h — /search 정렬·등록유형(museum/search/sorting.py SortOrder·Visibility) ──
  describe('round07h 정렬·등록유형', () => {
    test('sort·visibility를 안 주면 기본값(relevance·all)이 항상 body에 실린다', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      await searchArtifacts({ query: '민주화운동' })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.sort).toBe('relevance')
      expect(body.visibility).toBe('all')
    })

    test('sort·visibility를 지정하면 그 값이 그대로 body에 실린다', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      await searchArtifacts({ query: '민주화운동', sort: 'recent', visibility: 'public' })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.sort).toBe('recent')
      expect(body.visibility).toBe('public')
    })
  })

  // ── round07m — /search 종류(media_type)·소장처(holder) ──
  describe('round07m 종류·소장처', () => {
    test('mediaType·holder 를 주면 body 에 media_type·holder 로 싣는다', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      await searchArtifacts({ query: '민주화운동', mediaType: '도서', holder: '정보 없음' })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.media_type).toBe('도서')
      expect(body.holder).toBe('정보 없음')
    })

    test('null 이면 키 자체를 싣지 않는다(subjects 와 같은 관행 — 없음 = 필터 없음)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      await searchArtifacts({ query: '민주화운동', mediaType: null, holder: null })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect('media_type' in body).toBe(false)
      expect('holder' in body).toBe(false)
    })

    test('mapResult 는 media_type 을 mediaType 으로 나르고, 없으면 null 이다', async () => {
      const { mapResult } = await import('./searchApi.js')
      expect(mapResult({ idnbr: 'a', name: 'n', media_type: '영상' }).mediaType).toBe('영상')
      expect(mapResult({ idnbr: 'b', name: 'n' }).mediaType).toBeNull()
    })

    test('facets 가 응답에 없으면 세 키를 가진 빈 폴백을 준다', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', total: 0, page: 1, page_size: 20, results: [] }),
      })
      global.fetch = fetchMock
      const { searchArtifacts } = await import('./searchApi.js')
      const res = await searchArtifacts({ query: 'x' })
      expect(res.facets).toEqual({ subject: [], media_type: [], holder: [] })
    })
  })
})
