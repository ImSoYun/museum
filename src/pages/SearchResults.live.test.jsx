import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioContext } from '../context/ScenarioContext.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { getScenario } from '../data/scenarios.js'
import SearchResults from './SearchResults.jsx'

// T20: SearchResults 라이브 상태 UI — ScenarioContext.Provider에 라이브 상태값을 직접 mock 주입해
// (ScenarioProvider/실 fetch를 거치지 않고) loading/ok/degraded/error/0건 분기를 검증한다.
// round04부터 서버 페이지네이션 상태(page/pageSize)도 함께 주입한다.
// round06f 갈래 A: showAll·setShowAll은 컨텍스트에서 폐기됐으므로 주입하지 않는다.
function baseValue(overrides = {}) {
  return {
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
    loadingKind: 'search',
    page: 1,
    pageSize: 20,
    changePage: () => {},
    setScenarioByQuery: () => {},
    setScenarioById: () => {},
    // 최종 전체 브랜치 리뷰 I-1 — 기본값은 서버 기본값과 같다(무필터·적합도순).
    // ResultsTab.live.test.jsx의 동일 baseValue 관행을 그대로 따른다.
    sort: 'relevance',
    setSort: () => {},
    visibility: 'all',
    setVisibility: () => {},
    // round07m — 종류·소장처·주제. 이 파일의 기본값은 전부 무필터다.
    subjects: [],
    setSubjects: () => {},
    facets: { subject: [], media_type: [], holder: [] },
    mediaType: null,
    setMediaType: () => {},
    holder: null,
    setHolder: () => {},
    ...overrides,
  }
}

// round10 Task5 리뷰 fix — LibraryProvider가 이제 useLocation()을 쓰는데, SearchResults가
// useLibrary()를 쓰지 않으므로(레포 전체 grep 확인) 이 wrap은 애초에 죽은 코드였다 —
// 걷어낸다(안 걷어내면 Router 컨텍스트 밖이라 useLocation()이 던진다).
function renderLive(overrides = {}) {
  return render(
    <ToastProvider>
      <ScenarioContext.Provider value={baseValue(overrides)}>
        <MemoryRouter>
          <SearchResults />
        </MemoryRouter>
      </ScenarioContext.Provider>
    </ToastProvider>
  )
}

const liveResults = [
  { id: 'a1', title: '사진자료 A', image: 'imgA', type: '사진', category: '사진', eraText: '1980', pageUrl: 'pA', score: 0.9 },
]

test('라이브: loading=true면 스피너가 뜨고 결과는 렌더되지 않는다', () => {
  renderLive({ loading: true, liveStatus: 'ok', liveResults, liveTotal: 1 })
  expect(screen.getByRole('status', { name: '로딩 중' })).toBeInTheDocument()
  expect(screen.queryByText('사진자료 A')).not.toBeInTheDocument()
})

// round06f R6F-26(spec §5) — 로딩 문구 분기. loadingKind는 ScenarioContext가 진입부별로
// 정하고(runLiveSearch만 'search'), 이 컴포넌트는 그 값을 그대로 문구로 옮기기만 한다.
test('라이브: loadingKind=search면 "검색 중…" 문구가 뜬다(최초 검색)', () => {
  renderLive({ loading: true, loadingKind: 'search', liveStatus: null, liveResults: null })
  expect(screen.getByText('검색 중…')).toBeInTheDocument()
})

test('라이브: loadingKind=restore면 "불러오는 중…" 문구가 뜬다(기록 재개·페이지 이동·필터 변경)', () => {
  renderLive({ loading: true, loadingKind: 'restore', liveStatus: 'ok', liveResults, liveTotal: 1 })
  expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
  expect(screen.queryByText('검색 중…')).not.toBeInTheDocument()
})

test('라이브: status=ok + 결과 있음 → 결과가 렌더된다', () => {
  renderLive({ liveStatus: 'ok', liveResults, liveTotal: 1 })
  expect(screen.getByRole('button', { name: '사진자료 A' })).toBeInTheDocument()
  expect(screen.getByTestId('total-count')).toBeInTheDocument()
})

test('라이브: status=degraded + 결과 있음 → EmptyState가 아니라 결과 + notice 배너가 함께 뜬다', () => {
  renderLive({
    liveStatus: 'degraded',
    liveResults,
    liveTotal: 1,
    liveNotice: '질의 재작성에 실패하여 원문으로 검색했습니다.',
  })
  // 결과 카드가 렌더됨 (EmptyState 아님)
  expect(screen.getByRole('button', { name: '사진자료 A' })).toBeInTheDocument()
  expect(screen.queryByText('검색 결과가 없습니다')).not.toBeInTheDocument()
  // notice 배너도 함께 노출
  expect(screen.getByTestId('live-notice-banner').textContent).toBe('질의 재작성에 실패하여 원문으로 검색했습니다.')
})

test('라이브: status=error → 오류 EmptyState(+liveNotice)가 뜨고 결과는 렌더되지 않는다', () => {
  renderLive({
    liveStatus: 'error',
    liveResults: [],
    liveTotal: 0,
    liveNotice: '서버와 통신할 수 없습니다.',
  })
  expect(screen.getByText('검색 중 오류가 발생했습니다')).toBeInTheDocument()
  expect(screen.getByText('서버와 통신할 수 없습니다.')).toBeInTheDocument()
  expect(screen.queryByTestId('total-count')).not.toBeInTheDocument()
})

test('라이브: 결과 0건(ok, 빈 배열) → "검색 결과가 없습니다" EmptyState', () => {
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0 })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
})

// ── 최종 전체 브랜치 리뷰 I-1 — 결과 0건이어도 걸어 둔 필터를 되돌릴 UI가 있어야 한다 ──

test('최종 전체 리뷰 I-1: 필터(공개여부)가 기본값이 아닌 채 0건이면 되돌릴 셀렉트가 함께 뜬다', () => {
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, visibility: 'private' })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
  // LabeledSelect·SortSelect 트리거·패널머리가 각각 "공개여부"·"정렬기준" 라벨을
  // 두 벌(트리거 + 항상 DOM에 있는 패널 head) 갖는다 — getAllByText로 존재만 확인한다.
  expect(screen.getAllByText('공개여부').length).toBeGreaterThan(0)
  expect(screen.getAllByText('정렬기준').length).toBeGreaterThan(0)
})

test('최종 전체 리뷰 I-1: 필터(정렬)가 기본값이 아닌 채 0건이면 되돌릴 셀렉트가 함께 뜬다', () => {
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, sort: 'recent' })
  expect(screen.getAllByText('공개여부').length).toBeGreaterThan(0)
  expect(screen.getAllByText('정렬기준').length).toBeGreaterThan(0)
})

// round07h 후속(재지적) → round07m — 이 되돌림 UI는 ResultsTab.jsx의 result_meta_filters와 같은
// 컨트롤 쌍이 렌더되는 두 번째 자리다. ResultsTab.live.test.jsx의 '컨트롤은 정렬기준 →
// 공개여부 → 종류 → 주제 순이다' 테스트와 같은 방식으로 여기도 순서를 잠근다 — 한 곳만
// 뒤집혀도(공개여부 먼저) 이 테스트가 빨개져야 결과 있음/0건 화면의 순서 어긋남을 막는다.
//
// round07m — 최종 전체 리뷰 M-3: 아래 주석이 예전엔 "0건 화면엔 facets가 비어 종류·주제는
// 안 그려진다"고 적었지만 실제 서버는 0건이어도 주제 6종·종류 5종을 항상 고정으로
// 돌려준다(search/facets.py 고정 목록) — 그러면 종류·주제 드롭다운도 함께 그려져 children이
// 4개가 된다(아래 새 테스트). 이 테스트는 그 실제 모양과 무관하게 **정렬기준·공개여부만
// 남기려고 facets를 일부러 빈 값으로 주입**해 둘만 격리해서 잠근다 — 그래서 길이가 2다.
test('최종 전체 리뷰 I-1: 되돌릴 셀렉트의 순서는 ResultsTab과 같다(정렬기준 → 공개여부, facets 의도적 공백)', () => {
  const { container } = renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, sort: 'recent' })
  const filters = container.querySelector('.result_meta_filters')
  const children = [...filters.children]
  expect(children).toHaveLength(2)
  // 1) 정렬기준 — SortSelect는 role=radiogroup 컨테이너다.
  expect(children[0]).toHaveAttribute('role', 'radiogroup')
  // 2) 공개여부 — LabeledSelect는 드롭다운이다(라벨 텍스트로 식별).
  expect(children[1].querySelector('.dropdown_box_label')?.textContent).toBe('공개여부')
})

// round07m — 최종 전체 리뷰 M-3: 위 테스트의 짝 — 이번엔 실제 서버가 0건에도 늘 돌려주는
// 파셋(주제 6종·종류 5종, 값은 고정 어휘라 순서까지 고정)을 그대로 주입해 실제 화면 모양을
// 잠근다. ResultsTab.live.test.jsx의 '컨트롤은 정렬기준 → 공개여부 → 종류 → 주제 순이다'와
// 같은 방식이다.
test('최종 전체 리뷰 I-1: 실제 파셋(주제 6·종류 5)이 있으면 되돌릴 컨트롤은 4개, 순서는 그대로다', () => {
  const { container } = renderLive({
    liveStatus: 'ok', liveResults: [], liveTotal: 0, sort: 'recent',
    facets: {
      subject: [
        { value: '정치행정', count: 0 }, { value: '경제산업', count: 0 },
        { value: '사회환경', count: 0 }, { value: '교육과학', count: 0 },
        { value: '문화예술', count: 0 }, { value: '미분류', count: 0 },
      ],
      media_type: [
        { value: '이미지', count: 0 }, { value: '영상', count: 0 },
        { value: '음원', count: 0 }, { value: '도서', count: 0 }, { value: '기타', count: 0 },
      ],
      holder: [],
    },
  })
  const filters = container.querySelector('.result_meta_filters')
  const children = [...filters.children]
  expect(children).toHaveLength(4)
  expect(children[0]).toHaveAttribute('role', 'radiogroup')
  expect(children[1].querySelector('.dropdown_box_label')?.textContent).toBe('공개여부')
  expect(children[2].querySelector('.dropdown_box_label')?.textContent).toBe('종류')
  expect(children[3].querySelector('[data-testid="dropdown-trigger"]')).not.toBeNull()
})

test('최종 전체 리뷰 I-1: 필터가 기본값(all/relevance)인 채 0건이면 기존처럼 셀렉트 없이 안내만 뜬다(회귀 방지)', () => {
  // "검색어 자체와 일치하는 자료가 없는" 경로 — 되돌릴 필터가 없으므로 셀렉트를 새로 그리지 않는다.
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0 })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
  expect(screen.queryByText('공개여부')).not.toBeInTheDocument()
  expect(screen.queryByText('정렬기준')).not.toBeInTheDocument()
})

// ── 최종 전체 브랜치 리뷰 I-2 — notice가 결과 0건 화면에도 실제로 보여야 한다 ──

test('최종 전체 리뷰 I-2: 결과 0건이어도 liveNotice가 있으면 안내 문구로 노출된다', () => {
  const notice = '일시적으로 정렬·필터를 적용하지 못했습니다 — 적합도순 전체 결과입니다'
  // 백엔드가 notice만 채우고 status를 "ok"로 남겼던 실제 버그를 그대로 재현한다
  // (liveStatus==='degraded' 배너 조건에 기대지 않고도 notice가 화면에 닿아야 한다).
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, visibility: 'public', liveNotice: notice })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
  expect(screen.getByText(notice)).toBeInTheDocument()
})

test('최종 전체 리뷰 I-2: liveNotice가 없으면 결과 0건 화면은 기존 기본 문구를 그대로 쓴다(회귀 방지)', () => {
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0 })
  expect(screen.getByText('다른 검색어로 다시 시도해 보세요.')).toBeInTheDocument()
})

test('라이브: 검색 전(liveResults=null) → 오류 없이 무결과 안내로 처리된다', () => {
  renderLive({ liveStatus: null, liveResults: null, liveTotal: 0 })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
})

test('라이브: 비라이브 전용 무매칭 안내("대표 컬렉션")는 라이브에서 노출되지 않는다', () => {
  renderLive({ liveStatus: 'error', liveResults: [], liveTotal: 0, matched: false })
  expect(screen.queryByText(/대표 컬렉션/)).not.toBeInTheDocument()
})

test('라이브: 컬렉션 배지(scenario-name)는 노출되지 않는다 — 추천 질의가 하단에 있어 비운다', () => {
  renderLive({ liveStatus: 'ok', liveResults, liveTotal: 1 })
  expect(screen.queryByTestId('scenario-name')).not.toBeInTheDocument()
  expect(screen.queryByText('컬렉션')).not.toBeInTheDocument()
})

// (제거) '검색결과 탭에서도 AI 대화·산출물 탭이 전환된다' — page_tabs가 SearchFlowLayout(D1-3)로
// 이관되면서 SearchResults 본문은 더 이상 탭을 렌더하지 않는다. 탭 전환은 형제 라우트
// (/search/{results,chat,output})의 몫이며 SearchFlowLayout 테스트가 담당한다.

// ── round04: 결과 개수(top_k) 드롭다운 제거 + 서버 페이지네이션 ────────────────
// round06f 갈래 A(spec §6.1): "모두 보기"(showAll) 단계 자체를 폐기했다. 라이브는 검색
// 직후부터 서버 total 기준 페이지네이션을 곧바로 노출한다. 그래서 이 파일은 "그 버튼이
// 어떤 조건에서도 없다"와 "버튼이 빠진 자리에 빈 래퍼가 남지 않는다"만 지킨다 —
// 페이지네이션이 실제로 어떻게 그려지는지(페이지 수·현재 페이지·클릭 위임)는
// ResultsTab.live.test.jsx가 담당한다(같은 단언을 두 파일에 중복하지 않는다).

test('라이브: 결과 개수 드롭다운(topk-select)은 더 이상 렌더되지 않는다', () => {
  renderLive({ liveStatus: 'ok', liveResults, liveTotal: 1 })
  expect(screen.queryByTestId('topk-select')).not.toBeInTheDocument()
  expect(screen.queryByText('결과 개수')).not.toBeInTheDocument()
})

test('라이브: 유형 칩 줄(type-pills)은 렌더되지 않는다', () => {
  renderLive({ liveStatus: 'ok', liveResults, liveTotal: 1 })
  expect(screen.queryByTestId('type-pills')).not.toBeInTheDocument()
})

// 서버가 준 "현재 페이지 분량"(1페이지 20건)을 흉내낸 픽스처.
const twentyResults = Array.from({ length: 20 }, (_, i) => ({
  id: `id-${i}`, title: `자료 ${i}`, image: `img-${i}`, type: '사진', category: '사진', eraText: '2000', pageUrl: `p-${i}`, score: 0.5,
}))

test('라이브: 총 건수가 페이지 크기를 넘어도 "모두 보기" 버튼은 렌더되지 않는다(round06f 갈래 A — 단계 폐기)', () => {
  renderLive({ liveStatus: 'ok', liveResults: twentyResults, liveTotal: 100, pageSize: 20 })
  expect(screen.queryByTestId('show-all-btn')).not.toBeInTheDocument()
  expect(screen.queryByText('모두 보기')).not.toBeInTheDocument()
})

test('라이브: 총 건수가 한 페이지 이하여도 "모두 보기" 버튼은 없다(조건 분기 자체가 사라졌다)', () => {
  renderLive({ liveStatus: 'ok', liveResults, liveTotal: 12, pageSize: 20 })
  expect(screen.queryByTestId('show-all-btn')).not.toBeInTheDocument()
})

test('라이브: 결과 헤더 래퍼(컬렉션 배지 줄)가 통째로 사라진다 — mb-3만 남은 빈 div 금지', () => {
  const { container } = renderLive({ liveStatus: 'ok', liveResults, liveTotal: 1 })
  // 버튼을 지운 뒤에도 래퍼를 무조건 렌더하면, 라이브에서는 자식이 0개인 채
  // mb-3(=16px) 만큼의 죽은 여백이 결과 상단에 남는다.
  expect(container.querySelector('.result_wrap > .items-center.gap-2.mb-3')).toBeNull()
})

test('라이브: 검색 직후 본문에 페이지네이션이 곧바로 보인다(모두 보기 클릭 없이 — round06f 갈래 A)', () => {
  renderLive({ liveStatus: 'ok', liveResults: twentyResults, liveTotal: 100, pageSize: 20 })
  expect(screen.getByLabelText('다음 페이지')).toBeInTheDocument()
  expect(screen.queryByTestId('show-all-btn')).not.toBeInTheDocument()
})

test('round07m: 종류·소장처·주제 필터가 걸린 채 0건이어도 되돌릴 컨트롤이 뜬다', () => {
  for (const override of [{ mediaType: '도서' }, { holder: '국가기록원' }, { subjects: ['정치행정'] }]) {
    const { unmount } = renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, ...override })
    expect(screen.getAllByText('공개여부').length).toBeGreaterThan(0)
    unmount()
  }
})

test('round07m: 소장처가 걸린 채 0건이면 「소장처 필터 해제」가 setHolder(null) 을 부른다', () => {
  const setHolder = vi.fn()
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, holder: '국가기록원', setHolder })
  fireEvent.click(screen.getByRole('button', { name: '소장처 필터 해제' }))
  expect(setHolder).toHaveBeenCalledWith(null)
})

test('round07m: 소장처가 안 걸려 있으면 「소장처 필터 해제」가 없다', () => {
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, mediaType: '도서' })
  expect(screen.queryByRole('button', { name: '소장처 필터 해제' })).toBeNull()
})

// ── round10a Task 3-C — 필터로 0건이 됐을 때의 안내가 검색어를 탓하면 안 된다 ──
// 라이브 재현: 「새마을운동 포스터」200건 → 종류에서 이미지 선택 → 0건. 검색어가
// 잘못된 게 아니라 필터가 좁힌 것인데, 화면은 "다른 검색어로 다시 시도해 보세요"라고
// 엉뚱한 곳을 가리켰다. 되돌릴 셀렉트(위 hasNonDefaultFilter 블록)는 이미 함께 뜨지만
// 안내 문구가 그것과 맞지 않았다 — 문구도 같은 판정(hasNonDefaultFilter)을 따라야 한다.
test('Task 3-C: 필터(종류)가 걸린 채 0건이면 "필터를 조정해 보세요" 안내로 바뀐다(다른 검색어 문구 아님)', () => {
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, mediaType: '이미지' })
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
  expect(screen.getByText(/필터를 조정해 보세요/)).toBeInTheDocument()
  expect(screen.queryByText('다른 검색어로 다시 시도해 보세요.')).not.toBeInTheDocument()
})

// liveNotice는 백엔드가 "일시적으로 정렬·필터를 적용하지 못했습니다"를 보내는 자리다
// (위 :70-75 주석). 필터가 걸려 있어도 liveNotice가 있으면 그것이 우선이어야 한다 —
// 필터 안내로 덮어써서는 안 된다.
test('Task 3-C: 필터가 걸려 있어도 liveNotice가 있으면 liveNotice가 우선한다(덮지 않는다)', () => {
  const notice = '일시적으로 정렬·필터를 적용하지 못했습니다 — 적합도순 전체 결과입니다'
  renderLive({ liveStatus: 'ok', liveResults: [], liveTotal: 0, mediaType: '이미지', liveNotice: notice })
  expect(screen.getByText(notice)).toBeInTheDocument()
  expect(screen.queryByText(/필터를 조정해 보세요/)).not.toBeInTheDocument()
})
