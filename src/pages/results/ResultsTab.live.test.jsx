import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import ResultsTab from './ResultsTab.jsx'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import { ReadOnlyProvider } from '../../context/ReadOnlyContext.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { getScenario } from '../../data/scenarios.js'

vi.mock('../../lib/downloadFile.js', () => ({ triggerBrowserDownload: vi.fn() }))
import { triggerBrowserDownload } from '../../lib/downloadFile.js'

// T20: ResultsTab 라이브 분기 — ScenarioContext.Provider에 라이브 상태값을 직접 mock 주입해
// (ScenarioProvider/실 fetch를 거치지 않고) 파셋 재작성을 검증한다.
// round04부터 서버 페이지네이션 상태(page/pageSize/changePage)도 함께 주입한다.
// round06f 갈래 A: showAll·setShowAll은 컨텍스트에서 폐기됐으므로 주입하지 않는다.
function renderLive({ readOnly = false, ...overrides } = {}) {
  const value = {
    activeScenario: getScenario('democracy'),
    scenarioKey: 'democracy',
    matched: true,
    isLive: true,
    liveResults: null,
    liveStatus: null,
    liveTotal: 0,
    liveRewritten: null,
    liveNotice: null,
    loading: false,
    page: 1,
    pageSize: 20,
    changePage: () => {},
    setScenarioByQuery: () => {},
    setScenarioById: () => {},
    // round07d — 주제 필터 상태. 기본값은 무필터·no-op이다. facets는 기본값을 두지
    // 않는다(undefined) — 대부분의 기존 테스트는 파셋을 다루지 않으므로 facetOptions가
    // ResultsTab.jsx의 `facets?.subject ?? []`로 안전하게 빈 배열로 접힌다.
    subjects: [],
    setSubjects: () => {},
    // round07h — 정렬·등록유형. 기본값은 서버 기본값과 같다(무필터·적합도순).
    sort: 'relevance',
    setSort: () => {},
    visibility: 'all',
    setVisibility: () => {},
    // round07m — 종류·소장처. 기본값은 무필터·no-op이다.
    mediaType: null,
    setMediaType: () => {},
    holder: null,
    setHolder: () => {},
    ...overrides,
  }
  // round10a A조 최종 리뷰 M-3 — ProjectDetail이 ResultsTab을 <ReadOnlyProvider
  // value={true}>로 감싸 재생하는 경우를 흉내낸다. 기본값(readOnly 생략)은 false라
  // (ReadOnlyContext.jsx 기본값과 같다) 기존 호출부는 전부 그대로다.
  const body = (
    <ToastProvider>
      <ScenarioContext.Provider value={value}>
        <ResultsTab />
      </ScenarioContext.Provider>
    </ToastProvider>
  )
  return render(readOnly ? <ReadOnlyProvider value={true}>{body}</ReadOnlyProvider> : body)
}

const liveResults = [
  { id: 'a1', title: '사진자료 A', image: 'imgA', type: '사진', category: '사진', eraText: '1980', pageUrl: 'pA', score: 0.9 },
  { id: 'a2', title: '영상자료 B', image: 'imgB', type: '영상', category: '기록영상', eraText: '1987', pageUrl: 'pB', score: 0.8 },
]

test('라이브: liveResults로 카드가 렌더된다', () => {
  renderLive({ liveResults, liveTotal: 2 })
  expect(screen.getByRole('button', { name: '사진자료 A' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '영상자료 B' })).toBeInTheDocument()
})

test('라이브: 총 N건 = liveTotal (liveResults.length와 별개의 서버 반환값을 그대로 표시)', () => {
  // liveTotal은 "반환 결과 수"(round4 결정)이며 pool(liveResults) 파생값이 아님을 명시적으로 검증하기 위해
  // 일부러 liveResults.length(2)와 다른 liveTotal(5)을 주입한다.
  renderLive({ liveResults, liveTotal: 5 })
  expect(screen.getByTestId('total-count').textContent).toBe('5')
})

test('라이브: 유형 칩 줄(type-pills)을 렌더하지 않는다 — 카운트·필터 모두 제거(round04)', () => {
  renderLive({ liveResults, liveTotal: 2 })
  // 비라이브(더미) 모드의 칩 줄 유지는 ResultsTab.test.jsx의 기존 테스트가 계속 보증한다
  expect(screen.queryByTestId('type-pills')).not.toBeInTheDocument()
})

test('라이브: institution aside(기관 필터)를 렌더하지 않는다', () => {
  const { container } = renderLive({ liveResults, liveTotal: 2 })
  expect(container.querySelector('aside')).toBeNull()
  // 비라이브에서만 노출되는 더미 기관명이 라이브에는 없어야 한다
  expect(screen.queryByText('국가기록원')).not.toBeInTheDocument()
})

test('라이브: MaterialCard key=m.id — id가 다른 카드가 각각 독립적으로 렌더된다', () => {
  renderLive({ liveResults, liveTotal: 2 })
  // 카드 2장이 각각 자기 title로 식별 가능해야 한다 (key 충돌/재사용 없음)
  const cards = screen.getAllByRole('button', { name: /자료/ })
  expect(cards.length).toBe(2)
})

// 서버가 준 "현재 페이지 분량"(1페이지 20건) — 클라이언트는 이걸 그대로 렌더해야 한다.
const twentyResults = Array.from({ length: 20 }, (_, i) => ({
  id: `id-${i}`, title: `자료 ${i}`, image: `img-${i}`, type: '사진', category: '사진', eraText: '2000', pageUrl: `p-${i}`, score: 0.5,
}))

test('라이브: 서버가 준 현재 페이지 분량 전부를 렌더한다(클라 슬라이싱 금지)', () => {
  renderLive({ liveResults: twentyResults, liveTotal: 200, pageSize: 20 })
  // 더미 모드의 ITEMS_PER_PAGE 슬라이싱이 라이브에 새어들면 20건이 그대로 남지 않는다
  expect(screen.getAllByRole('button', { name: /^자료 \d+$/ }).length).toBe(20)
})

test('라이브: "모두 보기" 없이 검색 직후부터 페이지네이션이 곧바로 노출된다(round06f 갈래 A)', () => {
  renderLive({ liveResults: twentyResults, liveTotal: 200, pageSize: 20 })
  expect(screen.getByLabelText('다음 페이지')).toBeInTheDocument()
  // SEARCH_MAX(200) ÷ SEARCH_PAGE_SIZE(20) = 10 — 사용자 요구("20개씩 10페이지")의
  // 상한이 백엔드 변경 없이 그대로 화면에 나온다(spec §6.3).
  expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '11' })).not.toBeInTheDocument()
})

test('라이브: totalPages=ceil(liveTotal/pageSize) 페이지네이션이 렌더된다', () => {
  renderLive({ liveResults: twentyResults, liveTotal: 100, pageSize: 20, page: 1 })
  expect(screen.getByLabelText('다음 페이지')).toBeInTheDocument()
  // 100건 ÷ 20 = 5페이지 — 마지막 페이지 번호는 5, 6은 없어야 한다
  expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '6' })).not.toBeInTheDocument()
})

test('라이브: 현재 페이지 표시는 context.page를 따른다', () => {
  renderLive({ liveResults: twentyResults, liveTotal: 100, pageSize: 20, page: 3 })
  expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page')
})

test('라이브: 페이지 번호 클릭 → changePage(n) 호출(서버 재조회는 컨텍스트에 위임)', () => {
  const changePage = vi.fn()
  renderLive({ liveResults: twentyResults, liveTotal: 100, pageSize: 20, page: 1, changePage })
  fireEvent.click(screen.getByRole('button', { name: '2' }))
  expect(changePage).toHaveBeenCalledWith(2)
})

test('라이브: 총 건수가 한 페이지 이하면 페이지네이션이 없다(Pagination이 totalPages<=1에서 null — R6F-3)', () => {
  renderLive({ liveResults, liveTotal: 2, pageSize: 20 })
  expect(screen.queryByLabelText('다음 페이지')).not.toBeInTheDocument()
})

test('라이브: liveResults가 빈 배열이면 무결과 EmptyState가 뜬다', () => {
  renderLive({ liveResults: [], liveTotal: 0 })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
})

test('라이브: liveResults가 null(검색 전)이어도 크래시 없이 무결과 EmptyState로 처리된다', () => {
  renderLive({ liveResults: null, liveTotal: 0 })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
})

// ── round10a A조 최종 리뷰 M-3 — 0건 안내가 상황에 맞는 사유를 말한다 ────────────────
// 결정 8이 SearchResults.jsx에서 이미 세운 기준(필터가 걸려 있으면 "다른 검색어로"가
// 아니라 "필터를 조정해 보세요")을 이 화면에도 적용한다. 위 두 테스트(필터 기본값)는
// 여전히 "검색 결과가 없습니다" 제목만 보므로 아래 description 분기와 부딪히지 않는다.
test('라이브: 필터가 걸려 있으면 0건 안내가 "필터를 조정해 보세요"다(round10a A조 M-3)', () => {
  renderLive({ liveResults: [], liveTotal: 0, holder: 'inst-1' })
  expect(screen.getByText('선택한 조건에 해당하는 자료가 없습니다. 필터를 조정해 보세요.')).toBeInTheDocument()
  expect(screen.queryByText(/다른 검색어로/)).toBeNull()
})

// 라이브에는 "필터 초기화" 액션을 두지 않는다 — resetFilters는 이 화면의 지역 상태
// (비라이브 전용)만 되돌릴 뿐 실제 라이브 필터는 그대로라, 눌러도 반응 없는 버튼이 된다.
test('라이브: 0건이어도 "필터 초기화" 버튼은 없다 — 조정은 항상 보이는 ResultFilterControls로 한다(round10a A조 M-3)', () => {
  renderLive({ liveResults: [], liveTotal: 0, holder: 'inst-1' })
  expect(screen.queryByRole('button', { name: '필터 초기화' })).toBeNull()
})

// 읽기 전용(프로젝트 상세, ResultsTab을 검색창 없이 직접 마운트)에서는 필터가 없어도
// "다른 검색어로 다시 시도해 보세요"가 칠 곳 없는 거짓 안내다 — 결정 8이 고친 것과
// 같은 종류의 문장이 다른 자리(검색창 없는 화면)에서 반복된 것이다(final-findings.md M-3).
test('라이브 + 읽기 전용이고 필터가 없으면 "저장된 검색 결과가 없습니다"라고 말한다(round10a A조 M-3)', () => {
  renderLive({ liveResults: [], liveTotal: 0, readOnly: true })
  expect(screen.getByText('저장된 검색 결과가 없습니다')).toBeInTheDocument()
  expect(screen.queryByText(/다른 검색어로/)).toBeNull()
})

// 읽기 전용이어도 필터가 걸려 있으면 그 사실이 우선한다 — "저장된 검색 결과가
// 없습니다"보다 더 구체적인 사유가 있을 때는 그것을 말한다.
test('라이브 + 읽기 전용이어도 필터가 걸려 있으면 필터 문구가 우선한다(round10a A조 M-3)', () => {
  renderLive({ liveResults: [], liveTotal: 0, readOnly: true, mediaType: 'image' })
  expect(screen.getByText('선택한 조건에 해당하는 자료가 없습니다. 필터를 조정해 보세요.')).toBeInTheDocument()
  expect(screen.queryByText('저장된 검색 결과가 없습니다')).toBeNull()
})

// 정상(비읽기전용) + 무필터는 기존 그대로 — 회귀 대조군.
test('라이브: 읽기 전용이 아니고 필터도 없으면 기존 그대로 "다른 검색어로"다(회귀 대조군)', () => {
  renderLive({ liveResults: [], liveTotal: 0 })
  expect(screen.getByText('다른 검색어로 다시 시도해 보세요.')).toBeInTheDocument()
})

test('라이브: 카드 클릭 시 MaterialModal이 열린다', () => {
  renderLive({ liveResults, liveTotal: 2 })
  fireEvent.click(screen.getByRole('button', { name: '사진자료 A' }))
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

// ── round10a Task4-A — 「이미지 1장」 거짓말 제거 ─────────────────────────
// 실측(2026-09-17): 새마을운동 포스터 결과 20장이 전부 「이미지 1장」인데 실제
// <img>는 11개뿐이었다. mapResult(searchApi.js)는 imageCount를 채우지 않으므로
// 폴백 1이 항상 이겨 hasImage:false(이미지 없음)인 자료까지 "이미지 1장"이라고
// 말했다 — 서버가 이미 주는 hasImage 신호를 읽지 않은 것이 원인이다.
describe('round10a Task4-A 이미지 건수', () => {
  test('hasImage:false 카드는 "이미지 없음"을 표시하고 거짓 건수를 보이지 않는다', () => {
    const noImage = [
      { id: 'x1', title: '이미지 없는 자료', image: '', type: '사진', category: '사진', eraText: '1980', pageUrl: '', score: 0.5, hasImage: false },
    ]
    renderLive({ liveResults: noImage, liveTotal: 1 })
    expect(screen.getByText(/이미지 없음/)).toBeInTheDocument()
    expect(screen.queryByText(/이미지 1장/)).not.toBeInTheDocument()
  })

  test('hasImage:true 카드는 기존과 같이 건수를 표시한다(회귀 없음)', () => {
    const hasImage = [
      { id: 'x2', title: '이미지 있는 자료', image: 'https://x/images/x2', type: '사진', category: '사진', eraText: '1980', pageUrl: '', score: 0.5, hasImage: true },
    ]
    renderLive({ liveResults: hasImage, liveTotal: 1 })
    expect(screen.getByText(/이미지 1장/)).toBeInTheDocument()
  })
})

// ── round10a Task4-B — 카드 썸네일 축소 ───────────────────────────────────
// 실측: 카드 표시 크기(130px 안팎)에 원본 해상도(예 4233×6349) 이미지를 그대로
// 붙여 페이지당 13.41MB가 나갔다. 카드는 서버(api.py get_image)의 width
// 인자로 축소본을 요청해야 한다 — 다운로드 경로(/artifacts/{id}/download)는
// 원본을 그대로 줘야 하므로 이 변경과 무관하다(위 다운로드 describe 참고).
describe('round10a Task4-B 카드 썸네일 축소 요청', () => {
  test('카드 썸네일 img src에 폭 파라미터가 붙는다(원본이 아니라 축소본을 요청)', () => {
    const hasImage = [
      { id: 'x3', title: '썸네일 자료', image: 'https://cdn.example/images/x3', type: '사진', category: '사진', eraText: '1980', pageUrl: '', score: 0.5, hasImage: true },
    ]
    const { container } = renderLive({ liveResults: hasImage, liveTotal: 1 })
    const img = container.querySelector('.result_card_thumb_img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toMatch(/[?&]width=\d+/)
    // 원본 URL 자체가 훼손되면 안 된다 — 쿼리만 덧붙는다
    expect(img.getAttribute('src')).toMatch(/^https:\/\/cdn\.example\/images\/x3/)
  })
})

describe('라이브: 다운로드(round06e 갈래 D)', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; vi.clearAllMocks() })

  const withImage = [
    { id: 'has-1', title: '이미지 있는 자료', image: 'img1', type: '사진', category: '사진', eraText: '1990', pageUrl: 'p1', score: 0.9, hasImage: true },
  ]
  const withoutImage = [
    { id: 'no-1', title: '무이미지 자료', image: '', type: '사진', category: '사진', eraText: '1990', pageUrl: 'p2', score: 0.5, hasImage: false },
  ]

  test('hasImage:true면 다운로드 버튼이 활성이고 클릭 시 실다운로드가 트리거된다', async () => {
    const fakeBlob = new Blob(['x'])
    global.fetch = vi.fn().mockResolvedValue({ status: 200, blob: () => Promise.resolve(fakeBlob) })
    renderLive({ liveResults: withImage, liveTotal: 1 })

    const dlBtn = screen.getByLabelText('다운로드')
    expect(dlBtn).not.toBeDisabled()
    fireEvent.click(dlBtn)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/artifacts/has-1/download'),
      expect.objectContaining({ credentials: 'include' }),
    ))
    await waitFor(() => expect(triggerBrowserDownload).toHaveBeenCalledWith(fakeBlob, 'has-1.jpg'))
    expect(screen.queryByText('준비 중입니다')).not.toBeInTheDocument()
  })

  test('hasImage:false면 다운로드 버튼이 disabled고 클릭해도 아무 일도 일어나지 않는다', async () => {
    global.fetch = vi.fn()
    renderLive({ liveResults: withoutImage, liveTotal: 1 })

    const dlBtn = screen.getByLabelText('다운로드')
    expect(dlBtn).toBeDisabled()
    fireEvent.click(dlBtn)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  test('다운로드 실패(404)면 서버 사유를 토스트로 보여준다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404, json: () => Promise.resolve({ detail: '이미지가 없는 자료입니다' }),
    })
    renderLive({ liveResults: withImage, liveTotal: 1 })

    fireEvent.click(screen.getByLabelText('다운로드'))

    expect(await screen.findByText('이미지가 없는 자료입니다')).toBeInTheDocument()
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  // round06e 최종리뷰 I-1 — fetch 자체가 reject(네트워크 단절·CORS 실패)하면
  // downloadArtifactImage의 await가 던지고, try/catch 없이는 onClick의 async 함수가
  // unhandled rejection으로 사라져 사용자에게 아무 반응도 없었다. 토스트로 드러나야 한다.
  test('다운로드 중 네트워크 실패(fetch reject)면 조용히 사라지지 않고 토스트로 안내한다', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    renderLive({ liveResults: withImage, liveTotal: 1 })

    fireEvent.click(screen.getByLabelText('다운로드'))

    expect(await screen.findByText('다운로드에 실패했습니다. 잠시 후 다시 시도하세요.')).toBeInTheDocument()
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })
})

// ── round07d — 검색결과의 축을 주제로 옮겼다 ──────────────────────────────
// 이 describe 가 잠그는 것은 **한 화면에 한 축만 남는가**다. 스크린샷에서 「의 3」
// 옆에 「문화예술 13」이 있던 상태가 재현되지 않아야 한다.
//
// 라벨·트리거 텍스트는 screen.getByText가 아니라 dropdown-trigger에 scoped된
// querySelector로 확인한다 — DropdownCheckBox.jsx는 패널을 조건부 렌더가 아니라
// hidden 속성으로만 감추므로(퍼블 .dropdown_box_panel[hidden] 규칙을 죽이지 않기 위해),
// 트리거와 패널 머리글 둘 다에 같은 라벨 텍스트가 DOM에 존재해 getByText('주제')는
// "여러 요소가 일치한다"로 실패한다(ResultsTab.filter.test.jsx의 기존 관행과 동일).
describe('round07d 주제 필터·배지', () => {
  const SIX = [
    { value: '정치행정', count: 12 }, { value: '경제산업', count: 0 },
    { value: '사회환경', count: 5 }, { value: '교육과학', count: 0 },
    { value: '문화예술', count: 3 }, { value: '미분류', count: 7 },
  ]

  it('필터 라벨이 「주제」다', () => {
    // round07m — 라벨은 「주제」다(사용자 결정 8, 2026-09-15 피그마 스크린샷). round07h 가
    // 「자료유형」으로 되돌렸던 것을 다시 뒤집었다.
    renderLive({ facets: { subject: SIX } })
    const trigger = screen.getByTestId('dropdown-trigger')
    expect(trigger.querySelector('.dropdown_box_label').textContent).toBe('주제')
  })

  it('0건 항목도 목록에 남는다', () => {
    renderLive({ facets: { subject: SIX } })
    fireEvent.click(screen.getByTestId('dropdown-trigger'))
    expect(screen.getByText(/경제산업/)).toBeInTheDocument()
  })

  it('round07m — 카드에는 주제 배지를 그리지 않는다(주제는 필터로만 남는다)', () => {
    const { container } = renderLive({
      facets: { subject: SIX, media_type: [], holder: [] },
      liveResults: [{ id: 'a', title: '선언문', subject: ['정치행정 > 정치', '문화예술 > 미술'] }],
      liveTotal: 1,
    })
    expect(container.querySelectorAll('.result_card_badges .tag')).toHaveLength(0)
  })
})

// ── round07h 공개/미공개 뱃지 ──────────────────────────────────────────────
const publicityResults = [
  { id: 'p1', title: '공개자료', image: '', type: '사진', category: '사진', eraText: '1980', pageUrl: '', score: 0.9, isPublic: true },
  { id: 'p2', title: '미공개자료', image: '', type: '사진', category: '사진', eraText: '1980', pageUrl: '', score: 0.8, isPublic: false },
  { id: 'p3', title: '모름자료', image: '', type: '사진', category: '사진', eraText: '1980', pageUrl: '', score: 0.7, isPublic: null },
]

// 리뷰 반영(I4/Critical) — LabeledSelect(공개여부) 의 옵션 목록에 "공개"·"미공개"라는 같은
// 글자가 있고, 그 패널은 이제 DropdownCheckBox 관행대로 hidden 속성으로만 감춰 항상
// DOM 에 있다(조건부 렌더가 아니다). getByText/getAllByText 는 hidden 요소를 걸러내지
// 않으므로 문서 전체를 훑으면 카드 뱃지와 드롭다운 옵션 둘 다 걸린다. 카드 뱃지
// (.result_card_badges .tag)로 좁혀 컴포넌트를 숨기지 않고 쿼리만 정확히 한다.
test('라이브: 공개 자료에 「공개」 뱃지를 그린다', () => {
  const { container } = renderLive({ liveResults: publicityResults, liveTotal: 3 })
  const badges = [...container.querySelectorAll('.result_card_badges .tag')].map((s) => s.textContent)
  expect(badges).toContain('공개')
})

test('라이브: 미공개 자료에 「미공개」 뱃지를 그린다', () => {
  const { container } = renderLive({ liveResults: publicityResults, liveTotal: 3 })
  const badges = [...container.querySelectorAll('.result_card_badges .tag')].map((s) => s.textContent)
  expect(badges).toContain('미공개')
})

test('라이브: 공개여부를 모르면 어느 뱃지도 그리지 않는다', () => {
  // ★ isPublic 이 null 인 경우다(보강 조회 실패·자료 없음).
  //   「모름」을 「공개」로 단정해 찍으면 학예사가 오해한다.
  //   뱃지를 `{material.isPublic && …}` 로 쓰면 미공개가 사라지고,
  //   `{material.isPublic !== false && …}` 로 쓰면 모름이 공개가 된다.
  //   둘 다 이 세 테스트 중 하나를 빨갛게 만든다.
  const { container } = renderLive({ liveResults: publicityResults, liveTotal: 3 })
  const badges = [...container.querySelectorAll('.result_card_badges .tag')].map((s) => s.textContent)
  expect(badges.filter((b) => b === '공개')).toHaveLength(1)     // p1 뿐 — p3 는 없다
  expect(badges.filter((b) => b === '미공개')).toHaveLength(1)   // p2 뿐
})

// ── round07m — 컨트롤 순서: 정렬기준 → 공개여부 → 종류 → 주제(피그마) ──────────────
test('라이브: result_meta_filters 안의 컨트롤은 정렬기준 → 공개여부 → 종류 → 주제 순이다', () => {
  const { container } = renderLive({
    liveResults, liveTotal: 2,
    facets: {
      subject: [{ value: '정치행정', count: 12 }],
      media_type: [{ value: '이미지', count: 2 }, { value: '영상', count: 0 }, { value: '음원', count: 0 }, { value: '도서', count: 0 }, { value: '기타', count: 0 }],
      holder: [],
    },
  })
  const children = [...container.querySelector('.result_meta_filters').children]
  expect(children).toHaveLength(4)
  expect(children[0]).toHaveAttribute('role', 'radiogroup')
  expect(children[1].querySelector('.dropdown_box_label')?.textContent).toBe('공개여부')
  expect(children[2].querySelector('.dropdown_box_label')?.textContent).toBe('종류')
  expect(children[3].querySelector('[data-testid="dropdown-trigger"]')).not.toBeNull()
})

test('라이브: 종류에서 「전체」를 고르면 setMediaType(null), 값을 고르면 그 값', () => {
  const setMediaType = vi.fn()
  const media = [{ value: '이미지', count: 2 }, { value: '영상', count: 0 }, { value: '음원', count: 0 }, { value: '도서', count: 1 }, { value: '기타', count: 0 }]
  const { container } = renderLive({
    liveResults, liveTotal: 2, mediaType: '이미지', setMediaType,
    facets: { subject: [], media_type: media, holder: [] },
  })
  const box = [...container.querySelectorAll('.dropdown_box')].find(
    (b) => b.querySelector('.dropdown_box_label')?.textContent === '종류',
  )
  fireEvent.click(box.querySelector('.dropdown_box_trigger'))
  fireEvent.click(within(box).getByRole('button', { name: '도서' }))
  expect(setMediaType).toHaveBeenLastCalledWith('도서')
  fireEvent.click(box.querySelector('.dropdown_box_trigger'))
  fireEvent.click(within(box).getByRole('button', { name: '전체' }))
  expect(setMediaType).toHaveBeenLastCalledWith(null)
})

test('라이브: 종류 파셋이 없으면 종류 드롭다운을 그리지 않는다', () => {
  const { container } = renderLive({ liveResults, liveTotal: 2, facets: { subject: [], media_type: [], holder: [] } })
  const labels = [...container.querySelectorAll('.dropdown_box_label')].map((n) => n.textContent)
  expect(labels).not.toContain('종류')
})
