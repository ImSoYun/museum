// 이 파일의 책임: round06f 갈래 D → round07d 축 전환의 ResultsTab 배선 — result_meta_bar 의
// 주제 드롭다운(렌더 조건·선택 전달·라벨)과 라이브 카드 배지(round07m — 공개여부 + 종류)(R6F-18 계승).
//
// 기존 ResultsTab.live.test.jsx 와 별도 파일이다(테스트 파일 간 import 금지 관례) —
// renderLive 헬퍼가 겹치지만 facets·subjects 를 주입하는 버전을 이 파일 안에 다시 둔다.
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ResultsTab from './ResultsTab.jsx'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { getScenario } from '../../data/scenarios.js'

// round07d — 서버 facets.subject는 항상 고정 6개(0건 포함), 순서는 CLASS_ORDER와 같다.
const FACETS = {
  subject: [
    { value: '정치행정', count: 12 }, { value: '경제산업', count: 0 },
    { value: '사회환경', count: 5 }, { value: '교육과학', count: 0 },
    { value: '문화예술', count: 3 }, { value: '미분류', count: 7 },
  ],
}

function renderLive(overrides = {}) {
  const value = {
    activeScenario: getScenario('democracy'),
    scenarioKey: 'democracy',
    matched: true,
    isLive: true,
    liveResults: [],
    liveStatus: 'ok',
    liveTotal: 0,
    liveRewritten: null,
    liveNotice: null,
    loading: false,
    page: 1,
    pageSize: 20,
    changePage: () => {},
    setScenarioByQuery: () => {},
    setScenarioById: () => {},
    searchMode: 'meta',
    subjects: [],
    setSubjects: vi.fn(),
    facets: FACETS,
    // round07h — 정렬·등록유형. 이 파일의 초점은 주제 필터라 기본값(무필터)만 채운다.
    sort: 'relevance',
    setSort: vi.fn(),
    visibility: 'all',
    setVisibility: vi.fn(),
    // round07m — 종류·소장처. 이 파일의 초점은 주제 필터라 기본값(무필터)만 채운다.
    mediaType: null,
    setMediaType: vi.fn(),
    holder: null,
    setHolder: vi.fn(),
    ...overrides,
  }
  return { value, ...render(
    <ToastProvider>
      <ScenarioContext.Provider value={value}>
        <ResultsTab />
      </ScenarioContext.Provider>
    </ToastProvider>,
  ) }
}

// ── 드롭다운 렌더 조건·라벨 ──────────────────────────────────────────────────
test('라이브 + 파셋이 있으면 주제 드롭다운이 result_meta_bar에 뜬다', () => {
  const { container } = renderLive()
  const trigger = screen.getByTestId('dropdown-trigger')
  // round07m — 라벨은 「주제」다(사용자 결정 8, 2026-09-15 피그마 스크린샷). round07h 가
  // 「자료유형」으로 되돌렸던 것을 다시 뒤집었다.
  expect(trigger.querySelector('.dropdown_box_label').textContent).toBe('주제')
  // .result_meta_bar 는 space-between 이라 직계 자식을 늘리면 배치가 어긋난다 —
  // 반드시 result_meta_filters 래퍼 안이어야 한다(spec §9.4).
  expect(trigger.closest('.result_meta_filters')).not.toBeNull()
  expect(container.querySelector('.result_meta_bar > .result_meta_filters')).not.toBeNull()
})

test('0건 항목(경제산업·교육과학)도 목록에 남는다 — 고정 6개는 결과에서 파생하지 않는다', () => {
  renderLive()
  fireEvent.click(screen.getByTestId('dropdown-trigger'))
  expect(screen.getByText(/경제산업/)).toBeInTheDocument()
  expect(screen.getByText(/교육과학/)).toBeInTheDocument()
  // 「미분류」도 필터 항목으로는 남는다 — 그 자료에 도달할 유일한 경로다.
  expect(screen.getByText(/미분류/)).toBeInTheDocument()
})

test('파셋이 비면 드롭다운을 렌더하지 않는다(고를 것이 없는 죽은 UI 방지)', () => {
  renderLive({ facets: { subject: [] } })
  expect(screen.queryByTestId('dropdown-trigger')).toBeNull()
})

test('facets 자체가 없어도(구 응답·mock) 크래시하지 않는다', () => {
  renderLive({ facets: undefined })
  expect(screen.queryByTestId('dropdown-trigger')).toBeNull()
  expect(screen.getByTestId('total-count')).toBeInTheDocument()
})

test('비라이브(더미)에는 드롭다운이 없고 기존 유형 칩 줄이 그대로다', () => {
  renderLive({ isLive: false })
  expect(screen.queryByTestId('dropdown-trigger')).toBeNull()
  expect(screen.getByTestId('type-pills')).toBeInTheDocument()
})

test('드롭다운에서 대분류를 고르면 setSubjects가 그 값으로 불린다', () => {
  const { value } = renderLive()
  fireEvent.click(screen.getByTestId('dropdown-trigger'))
  fireEvent.click(screen.getByLabelText('정치행정'))
  expect(value.setSubjects).toHaveBeenCalledWith(['정치행정'])
})

test('현재 선택은 트리거 요약에 반영된다', () => {
  renderLive({ subjects: ['문화예술'] })
  expect(screen.getByTestId('dropdown-trigger').querySelector('.dropdown_box_value').textContent)
    .toBe('문화예술')
})

// ── 카드 배지 — round07m: 공개여부 + 종류(사용자 결정 6) ─────────────────────
// round07d 가 넣은 주제 뱃지를 뺐다. 주제는 필터로만 남는다. 주제가 여러 개인 자료에서
// 뱃지가 넘쳐 잘리던 문제도 함께 사라진다.
const liveResults = [
  { id: 'a1', title: '선언문', image: 'imgA', subject: ['정치행정 > 정치', '문화예술 > 미술'], eraText: '1980', pageUrl: 'pA', score: 0.9, isPublic: true, mediaType: '이미지' },
  { id: 'p1', title: '유물 B', image: 'imgB', subject: [], eraText: '1987', pageUrl: 'pB', score: 0.8, isPublic: false, mediaType: null },
  { id: 'a2', title: '녹음 C', image: 'imgC', subject: [], eraText: '1990', pageUrl: 'pC', score: 0.7, isPublic: true, mediaType: '음원' },
]

function badgesOf(card) {
  return [...card.querySelectorAll('.result_card_badges .tag')]
}

test('라이브 카드 배지는 공개여부 + 종류이고 주제 배지는 없다', () => {
  const { container } = renderLive({ liveResults, liveTotal: 3 })
  const cards = container.querySelectorAll('.result_card')
  expect(badgesOf(cards[0]).map((b) => b.textContent)).toEqual(['공개', '이미지'])
  expect(screen.queryByText('정치행정', { selector: '.result_card_badges .tag' })).toBeNull()
})

test('종류가 없는 자료(문화유산)는 공개여부 배지 하나뿐이다(무근거 신호 방지)', () => {
  const { container } = renderLive({ liveResults, liveTotal: 3 })
  const cards = container.querySelectorAll('.result_card')
  expect(badgesOf(cards[1]).map((b) => b.textContent)).toEqual(['미공개'])
})

test('종류 배지는 종류별 색 클래스를 탄다 — 음원은 ty_audio', () => {
  const { container } = renderLive({ liveResults, liveTotal: 3 })
  const cards = container.querySelectorAll('.result_card')
  expect(badgesOf(cards[0])[1].className).toContain('ty_image')
  expect(badgesOf(cards[2])[1].className).toContain('ty_audio')
})

// ── 왼쪽 소장처 목록 — round07m ───────────────────────────────────────────
const HOLDER = [
  { value: '대한민국역사박물관', count: 2 }, { value: '국가기록원', count: 1 }, { value: '정보 없음', count: 3 },
]

test('라이브 + facets.holder 가 있으면 왼쪽에 소장처 목록이 뜬다', () => {
  const { container } = renderLive({ liveResults, liveTotal: 3, facets: { ...FACETS, holder: HOLDER } })
  const list = container.querySelector('.result_body > .result_filter_list')
  expect(list).not.toBeNull()
  expect(list.textContent).toContain('대한민국역사박물관')
  expect(list.textContent).toContain('정보 없음')
})

test('소장처를 누르면 setHolder 가 그 값으로 불린다', () => {
  const { value } = renderLive({ liveResults, liveTotal: 3, facets: { ...FACETS, holder: HOLDER } })
  fireEvent.click(screen.getByRole('button', { name: /국가기록원/ }))
  expect(value.setHolder).toHaveBeenCalledWith('국가기록원')
})

test('facets.holder 가 비면 소장처 목록을 그리지 않는다', () => {
  const { container } = renderLive({ liveResults, liveTotal: 3, facets: { ...FACETS, holder: [] } })
  expect(container.querySelector('.result_filter_list')).toBeNull()
})
