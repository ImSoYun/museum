import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioProvider, ScenarioContext } from '../context/ScenarioContext.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { getScenario } from '../data/scenarios.js'
import SearchResults from './SearchResults.jsx'

// round06c-ext D1-5: SearchResults는 검색결과 **본문**(result_wrap)만 그린다. 상단 검색바
// (result_query_bar)·하위 탭(page_tabs)·`프로젝트로 저장`은 공용 셸 SearchFlowLayout(D1-3)로
// 이관됐다 — 그 헤더/탭 전환/저장 관련 단언은 이 파일에서 제거하고 SearchFlowLayout 테스트가
// 담당한다. 여기서는 본문 동작(카드→모달·시나리오 명칭·무매칭 안내)만 검증한다.
function renderSR() {
  return render(
    <ToastProvider>
      <ScenarioProvider>
        <MemoryRouter>
          <SearchResults />
        </MemoryRouter>
      </ScenarioProvider>
    </ToastProvider>
  )
}

// matched/isLive 등 본문 분기를 직접 검증하기 위한 컨텍스트 주입 하네스(검색바 이관으로
// 더 이상 화면에서 검색을 트리거할 수 없으므로 상태를 직접 주입한다).
function renderWith(overrides) {
  const value = {
    activeScenario: getScenario('democracy'), scenarioKey: 'democracy',
    matched: true, isLive: false, liveResults: null, liveStatus: null,
    liveTotal: 0, liveRewritten: null, liveNotice: null, loading: false,
    page: 1, pageSize: 20,
    changePage: () => {}, setScenarioByQuery: () => {}, setScenarioById: () => {},
    ...overrides,
  }
  return render(
    <ToastProvider>
      <ScenarioContext.Provider value={value}>
        <MemoryRouter>
          <SearchResults />
        </MemoryRouter>
      </ScenarioContext.Provider>
    </ToastProvider>
  )
}

test('본문에서 카드 클릭 시 자료상세 모달이 열린다', () => {
  renderSR()
  fireEvent.click(screen.getAllByText(/6월 민주항쟁 거리시위 현장 사진/)[0])
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

test('결과 헤더에 활성 시나리오 명칭(민주화운동)이 노출된다', () => {
  renderSR()
  expect(screen.getByTestId('scenario-name').textContent).toContain('민주화운동')
})

test('비매칭(matched=false) 상태면 무매칭 안내가 뜬다', () => {
  renderWith({ matched: false })
  expect(screen.getByText(/대표 컬렉션/)).toBeInTheDocument()
})

test('매칭(matched=true) 상태면 무매칭 안내 없이 시나리오 명칭이 노출된다', () => {
  renderWith({ matched: true })
  expect(screen.queryByText(/대표 컬렉션/)).not.toBeInTheDocument()
  expect(screen.getByTestId('scenario-name').textContent).toContain('민주화운동')
})
