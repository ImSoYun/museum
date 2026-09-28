// 이 파일의 책임: D1-5 검색결과 v2 재퍼블의 계약 — publish-v2 미렌더 계약(D10:
// ai_brief_card·rating_widget 부재)과 실다운로드(round06e T5, hasImage:true) ·
// 자료상세 모달 live 유지.
//
// 상태는 ScenarioProvider/실 fetch를 거치지 않고 <ScenarioContext.Provider value={...}> 로
// 직접 주입한다(SearchResults.live.test.jsx와 동일 패턴 — 라이브 결과 1건 이상 주입).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioContext } from '../context/ScenarioContext.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { getScenario } from '../data/scenarios.js'
import SearchResults from './SearchResults.jsx'

// round06e T5: 다운로드가 준비중 토스트에서 실배선(fetch + triggerBrowserDownload)으로
// 바뀌면서, 이 파일처럼 isLive:true를 주입하지만 fetch는 mock하지 않던 기존 테스트가
// 실제 네트워크 호출을 시도해 깨진다(ResultsTab.live.test.jsx와 같은 방식으로 mock한다).
vi.mock('../lib/downloadFile.js', () => ({ triggerBrowserDownload: vi.fn() }))
import { triggerBrowserDownload } from '../lib/downloadFile.js'

// ResultsTab.live.test.jsx와 동일 패턴 — afterEach로 복원해, 중간 단언이 실패해도
// global.fetch mock이 다음 테스트로 새지 않게 한다(테스트 본문 안 복원은 그 지점에서
// throw하면 건너뛴다).
const originalFetch = global.fetch
afterEach(() => { global.fetch = originalFetch })

const liveResults = [
  // hasImage: true — T3 계약(has_image)을 거친 실제 라이브 결과를 흉내낸다.
  { id: 'a1', title: '사진자료 A', image: 'imgA', type: '사진', category: '사진', eraText: '1980', pageUrl: 'pA', score: 0.9, hasImage: true },
]

function baseValue(overrides = {}) {
  return {
    activeScenario: getScenario('democracy'),
    scenarioKey: 'democracy',
    matched: true,
    isLive: true,
    liveResults,
    liveStatus: 'ok',
    liveTotal: 1,
    liveRewritten: null,
    liveNotice: null,
    loading: false,
    page: 1,
    pageSize: 20,
    changePage: () => {},
    setScenarioByQuery: () => {},
    setScenarioById: () => {},
    // ── round06f 3갈래(B·D·C) 컨텍스트 키 ──────────────────────────────────
    // 이 파일은 ScenarioProvider 를 거치지 않고 value 를 손으로 주입하므로, 신규 키를
    // 여기에 채워야 브리핑 카드·만족도 위젯이 실제로 그려진다(D10 미렌더 계약 해제 검증).
    lastQuery: '민주화운동',
    brief: 'AI 요약 본문입니다.',
    briefStatus: 'ok',
    briefNotice: null,
    subjects: [],
    setSubjects: () => {},
    facets: { subject: [] },
    searchGenId: 0,
    liveRequestId: 'req-1',
    conversationId: 'c-1',
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

// ── round06f: D10 미렌더 계약 해제 — 두 마크업이 이제 라이브 결과 화면에 실제로 그려진다 ──
test('AI 브리핑 카드를 렌더한다(round06f 갈래 B — D10 미렌더 계약 해제)', () => {
  renderLive()
  expect(document.querySelector('.ai_brief_card')).not.toBeNull()
  // ai_brief_tit 은 제목 텍스트 + 태그 배지를 함께 담아 정확일치가 되지 않는다.
  // round10b B-2 — 제목이 피그마 원문 「SA:I 브리핑」으로 바뀌었다(figma-3자대조.md #4).
  expect(document.querySelector('.ai_brief_tit').textContent).toContain('SA:I 브리핑')
  expect(screen.getByText('AI 요약 본문입니다.')).toBeInTheDocument()
})

test('브리핑은 LiveResultsPanel 안에 있다 — 결과 0건 화면에는 카드가 없다(§7.5.2)', () => {
  renderLive({ liveResults: [], liveTotal: 0 })
  expect(document.querySelector('.ai_brief_card')).toBeNull()
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
})

test('검색 품질 만족도 평가 위젯을 렌더한다(round06f 갈래 C — D10 미렌더 계약 해제)', () => {
  renderLive()
  const widget = document.querySelector('.rating_widget')
  expect(widget).not.toBeNull()
  expect(screen.getByText('검색 품질 만족도 평가')).toBeInTheDocument()
  // round07h 후속 — SortSelect가 드롭다운에서 role=radio 버튼 셋으로 바뀌면서 같은
  // 페이지에 라디오가 늘었다(정렬기준 3개). document 전체가 아니라 .rating_widget
  // 안으로 좁혀야 만족도 점수 라디오 7개만 센다 — 그렇지 않으면 이 단언이 SortSelect의
  // 존재 여부에 우연히 얽매인다.
  expect(within(widget).getAllByRole('radio')).toHaveLength(7)
})

test('만족도 위젯도 LiveResultsPanel 안에 있다 — 결과 0건 화면에는 없다(§7.5.2)', () => {
  renderLive({ liveResults: [], liveTotal: 0 })
  expect(document.querySelector('.rating_widget')).toBeNull()
})

// ── 리마운트 키 계약(R6F-22) — 폼 상태가 언제 살아남고 언제 초기화되는가 ──────────
// request_id 를 key 로 쓰면 페이지 이동마다 폼이 리셋돼 중복 제출 방어선이 무너진다.
// 그래서 key 는 searchGenId 여야 한다. 여기서는 "점수 선택"이라는 로컬 state 의 생존으로
// 그것을 관측한다(제출까지 가지 않아도 같은 축을 검증한다).
test('페이지를 넘겨도(request_id·page 변경) 만족도 폼 상태가 살아남는다', () => {
  const { rerender } = renderLive({ page: 1, liveRequestId: 'req-1', searchGenId: 3 })
  fireEvent.click(screen.getByLabelText('매우 도움 됨'))
  expect(screen.getByLabelText('매우 도움 됨')).toBeChecked()

  rerender(
    <ToastProvider>
      <ScenarioContext.Provider value={baseValue({ page: 2, liveRequestId: 'req-2', searchGenId: 3 })}>
        <MemoryRouter>
          <SearchResults />
        </MemoryRouter>
      </ScenarioContext.Provider>
    </ToastProvider>,
  )
  expect(screen.getByLabelText('매우 도움 됨')).toBeChecked()
})

test('새 검색(searchGenId 증가)에서는 만족도 폼이 초기화된다', () => {
  const { rerender } = renderLive({ searchGenId: 3 })
  fireEvent.click(screen.getByLabelText('매우 도움 됨'))
  expect(screen.getByLabelText('매우 도움 됨')).toBeChecked()

  rerender(
    <ToastProvider>
      <ScenarioContext.Provider value={baseValue({ searchGenId: 4 })}>
        <MemoryRouter>
          <SearchResults />
        </MemoryRouter>
      </ScenarioContext.Provider>
    </ToastProvider>,
  )
  expect(screen.getByLabelText('매우 도움 됨')).not.toBeChecked()
})

// ── 다운로드 = round06e T5부터 실배선(hasImage:true → fetch + triggerBrowserDownload) ──
test('자료 카드 다운로드 클릭 시 실다운로드가 트리거된다(hasImage:true)', async () => {
  const fakeBlob = new Blob(['x'])
  global.fetch = vi.fn().mockResolvedValue({ status: 200, blob: () => Promise.resolve(fakeBlob) })

  renderLive()
  fireEvent.click(screen.getAllByLabelText('다운로드')[0])
  await waitFor(() => expect(triggerBrowserDownload).toHaveBeenCalledWith(fakeBlob, 'a1.jpg'))
  expect(screen.queryByText('준비 중입니다')).not.toBeInTheDocument()
})

// ── 결과 그리드·자료상세 모달 live 유지 ──
test('결과 카드 클릭 시 자료상세 모달이 열린다', () => {
  renderLive()
  fireEvent.click(screen.getByRole('button', { name: '사진자료 A' }))
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

// ── 이관된 헤더(검색바·탭·프로젝트로 저장)는 본문에서 사라졌다 ──
test('본문은 검색바·탭·프로젝트로 저장 헤더를 렌더하지 않는다(SearchFlowLayout으로 이관)', () => {
  renderLive()
  expect(screen.queryByRole('button', { name: '프로젝트로 저장' })).toBeNull()
  expect(screen.queryByText('AI 학예 도우미')).toBeNull()
  expect(screen.queryByText('산출물 생성')).toBeNull()
})
