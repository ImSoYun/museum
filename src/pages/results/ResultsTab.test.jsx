import { render, screen, fireEvent } from '@testing-library/react'
import ResultsTab from './ResultsTab.jsx'
import { ScenarioProvider, ScenarioContext, useScenario } from '../../context/ScenarioContext.jsx'
import { AuthProvider, AuthContext, useAuth } from '../../context/AuthContext.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { getScenario } from '../../data/scenarios.js'
import { materials } from '../../data/materials.js'

// round06e S1 — searchMode(ScenarioContext)·searchModesEnabled(AuthContext) 오버라이드 브릿지.
// 실제 Provider 트리(ScenarioProvider·AuthProvider)는 그대로 통과시키고 이 두 필드만 테스트가
// 원하는 값으로 덮어써 하위(ResultsTab)에 노출한다 — ResultsTab.live.test.jsx의 renderLive처럼
// 컨텍스트 전체를 새로 조립하면 이 파일의 기존 더미모드 단정(기관 파셋·유형 칩 등)이 깨진다.
function Overrides({ searchMode, searchModesEnabled, children }) {
  const scenarioCtx = useScenario()
  const authCtx = useAuth()
  const scenarioValue = searchMode === undefined ? scenarioCtx : { ...scenarioCtx, searchMode }
  const authValue = searchModesEnabled === undefined ? authCtx : { ...authCtx, searchModesEnabled }
  return (
    <AuthContext.Provider value={authValue}>
      <ScenarioContext.Provider value={scenarioValue}>
        {children}
      </ScenarioContext.Provider>
    </AuthContext.Provider>
  )
}

// Helper: render ResultsTab wrapped in ToastProvider + AuthProvider + ScenarioProvider
// (default = democracy). searchMode/searchModesEnabled는 선택적으로 덮어쓸 수 있다(Overrides).
function renderRT({ searchMode, searchModesEnabled } = {}) {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ScenarioProvider>
          <Overrides searchMode={searchMode} searchModesEnabled={searchModesEnabled}>
            <ResultsTab />
          </Overrides>
        </ScenarioProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

test('ResultsTab renders card grid', () => {
  renderRT()
  // m1 ('6월 민주항쟁 거리시위 현장 사진') is first in democracy.materialIds → page 1
  expect(screen.getAllByRole('button', { name: /6월 민주항쟁/i }).length).toBeGreaterThan(0)
})

test('ResultsTab shows 총 N건 count', () => {
  renderRT()
  expect(screen.getByTestId('total-count')).toBeInTheDocument()
})

test('ResultsTab total-count equals pool length (단일 모수)', () => {
  renderRT()
  const democracy = getScenario('democracy')
  const poolLen = democracy.materialIds.length
  expect(screen.getByTestId('total-count').textContent).toBe(poolLen.toLocaleString())
})

test('ResultsTab 기관 필터 적용 시 total-count가 그 기관 pool 건수로 바뀐다', () => {
  renderRT()
  const democracy = getScenario('democracy')
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]))
  const pool = democracy.materialIds.map((id) => byId[id]).filter(Boolean)
  const archiveCount = pool.filter((m) => m.institution === '국가기록원').length
  fireEvent.click(screen.getAllByText('국가기록원')[0])
  expect(screen.getByTestId('total-count').textContent).toBe(archiveCount.toLocaleString())
})

test('ResultsTab 기관 칩 건수는 정적 institutions.count가 아니라 pool 파생값', () => {
  renderRT()
  const democracy = getScenario('democracy')
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]))
  const pool = democracy.materialIds.map((id) => byId[id]).filter(Boolean)
  // 국가기록원 정적 count(institutions.js)=67 이지만 pool 파생 건수는 그보다 작아야 한다
  const archiveBtn = screen.getAllByText('국가기록원')[0].closest('button')
  const derived = pool.filter((m) => m.institution === '국가기록원').length
  expect(archiveBtn.textContent).toContain(String(derived))
  expect(archiveBtn.textContent).not.toContain('67')
})

test('ResultsTab type filter pills render (이미지 pill exists)', () => {
  renderRT()
  expect(screen.getByText('이미지')).toBeInTheDocument()
})

test('ResultsTab type filter has 음성 pill', () => {
  renderRT()
  expect(screen.getByText('음성')).toBeInTheDocument()
})

test('ResultsTab 이미지 pill 건수는 pool 내 사진·포스터 수(단일 모수)', () => {
  renderRT()
  const democracy = getScenario('democracy')
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]))
  const pool = democracy.materialIds.map((id) => byId[id]).filter(Boolean)
  const imageCount = pool.filter((m) => m.type === '사진' || m.type === '포스터').length
  const imagePill = screen.getByText('이미지').closest('button')
  expect(imagePill.textContent).toContain(String(imageCount))
})

// 유형 배지 — 퍼블 팔레트는 4종(ty_image/ty_video/ty_book/ty_web)뿐이라 앱 유형을 그 4종에
// 접어 넣는다. '문서'는 더미 85건 중 48건(최다)인데 매핑이 없어 기본 회색으로 떨어져 있었다.
test('유형 배지: 최다 유형 문서도 퍼블 카테고리 클래스(ty_book)를 받는다', () => {
  const { container } = renderRT()
  const tags = [...container.querySelectorAll('.result_card_badges .tag')]
  const docTag = tags.find((el) => el.textContent.trim() === '문서')
  expect(docTag).toBeTruthy()          // 1페이지에 '문서' 카드가 존재
  expect(docTag.className).toContain('ty_book')
})

// round10a Task4-A — 더미(materials.js)는 hasImage가 없으므로 기존 건수
// 표시(material.imageCount, 없으면 1)가 그대로 나와야 한다. m1(6월 민주항쟁 …)은
// imageCount:7이다 — hasImage 분기를 잘못 넣으면 이 표시가 "이미지 없음"으로
// 바뀌거나 사라진다(브리프 경고: 더미 경로의 기존 표시가 바뀌면 안 된다).
test('ResultsTab 더미 카드는 hasImage 없이 기존 imageCount 그대로 표시한다(회귀 없음)', () => {
  renderRT()
  expect(screen.getByText(/이미지 7장/)).toBeInTheDocument()
})

test('ResultsTab card click opens MaterialModal', () => {
  renderRT()
  const cards = screen.getAllByRole('button', { name: /6월 민주항쟁/i })
  fireEvent.click(cards[0])
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

// ── 키보드 조작: 카드(role=button)와 그 안의 다운로드 버튼이 서로를 침범하지 않는다 ──
// 카드는 li[role=button] + onKeyDown 이고 그 안에 다운로드 버튼이 들어 있다. keydown 은
// 버블링하므로 target 가드가 없으면 버튼에 포커스를 둔 Enter/Space 가 "토스트 + 상세 모달"을
// 동시에 발동한다(마우스는 버튼 onClick 의 stopPropagation 으로 막혀 있어 키보드에서만 난다).
test('키보드: 다운로드 버튼에서 Enter → 준비중 토스트만, 상세 모달은 열리지 않는다', () => {
  renderRT()
  const dlBtn = screen.getAllByLabelText('다운로드')[0]
  // 브라우저는 포커스된 button 에서 Enter 를 누르면 keydown 에 이어 click 을 함께 발생시킨다.
  // jsdom 의 fireEvent 는 그 연쇄를 만들어 주지 않으므로 두 이벤트를 순서대로 직접 보낸다.
  fireEvent.keyDown(dlBtn, { key: 'Enter' })
  fireEvent.click(dlBtn)
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  // 모달이 열렸다면 상세 라벨이 문서에 있다
  expect(screen.queryByText('소장처/유물번호')).not.toBeInTheDocument()
})

test('키보드: 다운로드 버튼에서 Space 도 상세 모달을 열지 않는다', () => {
  renderRT()
  fireEvent.keyDown(screen.getAllByLabelText('다운로드')[0], { key: ' ' })
  expect(screen.queryByText('소장처/유물번호')).not.toBeInTheDocument()
})

test('키보드: 카드 자체 Enter 는 여전히 상세 모달을 연다', () => {
  renderRT()
  const card = screen.getAllByRole('button', { name: /6월 민주항쟁/i })[0]
  fireEvent.keyDown(card, { key: 'Enter' })
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

test('키보드: 카드 자체 Space 도 상세 모달을 연다', () => {
  renderRT()
  const card = screen.getAllByRole('button', { name: /6월 민주항쟁/i })[0]
  fireEvent.keyDown(card, { key: ' ' })
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

test('ResultsTab renders InstitutionFilter aside with institution names', () => {
  renderRT()
  // 기관 목록은 pool 파생이라 pool에 자료가 있는 기관만 노출된다 (T6-2: 0건 기관 숨김)
  expect(screen.getByText('국가기록원')).toBeInTheDocument()
  expect(screen.getByText('대한민국역사박물관')).toBeInTheDocument()
  expect(screen.getByText('국사편찬위원회')).toBeInTheDocument()
})

test('ResultsTab: 필터 교집합 0건이면 무결과 EmptyState 노출', () => {
  renderRT()
  // '음성' 유형 핀을 누르면 기본 시나리오 풀에서 매칭 카드가 없어 무결과가 된다
  fireEvent.click(screen.getByRole('button', { name: /음성/ }))
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
})

test('ResultsTab: 무결과에서 필터 초기화 시 결과 복귀', () => {
  renderRT()
  fireEvent.click(screen.getByRole('button', { name: /음성/ }))
  fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
  expect(screen.queryByText('검색 결과가 없습니다')).not.toBeInTheDocument()
})

// round07m — 결과 머리의 검색 모드 병기(「본문 내 검색」·「메타 + 본문 내 검색」)를 없앴다.
// round06e S1 이 결과 급감을 고장으로 오해하지 않게 넣었지만 피그마에 없는 문구이고,
// .result_meta_bar(space-between) 가운데에 떠 사용자가 결함으로 제보했다(2026-09-15).
test.each(['meta', 'ocr', 'both'])('ResultsTab: 검색 모드(%s)를 결과 머리에 병기하지 않는다', (mode) => {
  renderRT({ searchMode: mode, searchModesEnabled: true })
  expect(screen.queryByTestId('search-mode-label')).toBeNull()
  expect(screen.queryByText(/본문 내 검색/)).toBeNull()
})
