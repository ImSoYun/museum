/**
 * scenario-flow.test.jsx
 *
 * End-to-end scenario-switch smoke test.
 * Renders ResultsTab + ChatTab + OutputTab inside ONE ScenarioProvider.
 * A Probe child exposes a button that calls setScenarioById('economy').
 * Asserts:
 *   BEFORE switch → democracy data is reflected in each tab
 *   AFTER switch  → economy data is reflected in each tab
 *
 * round07b-ext task-11 리뷰 Finding 1 — OutputTab이 이제 항상 OutputList를 마운트하고,
 * OutputList는 outputsApi.js를 목하지 않으면 real fetch를 부른다(VITE_API_BASE_URL이
 * 테스트에선 비어 있어 매번 나간다 — 이전엔 OutputTab 마운트가 네트워크를 전혀 건드리지
 * 않았다). OutputTab.test.jsx·OutputTab.live.test.jsx·OutputView.test.jsx와 같은 이유로
 * listOutputs를 빈 목록으로 즉시 resolve시킨다.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioProvider, useScenario } from './context/ScenarioContext.jsx'
import { AdminProvider } from './state/AdminProvider.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { getScenario } from './data/scenarios.js'
import ResultsTab from './pages/results/ResultsTab.jsx'
import ChatTab from './pages/results/ChatTab.jsx'

vi.mock('./lib/outputsApi.js', () => ({
  // isLive: 목 모듈이라 실제 env를 안 본다. true 로 둬야 OutputList·SearchFlowLayout의
  // 데모 모드 게이트를 통과해 기존 조회 경로가 그대로 검증된다.
  isLive: () => true,
  createOutput: vi.fn(),
  listOutputs: vi.fn().mockResolvedValue({ ok: true, data: { outputs: [], has_more: false } }),
  deleteOutputs: vi.fn(),
  downloadOutputFile: vi.fn(),
}))

const { default: OutputTab } = await import('./pages/results/OutputTab.jsx')

// Derive expected values from scenario data — no hardcoded literals
const democracy = getScenario('democracy')
const economy   = getScenario('economy')

// total-count는 단일 모수(pool 길이) 기준이다 (T6-2). typeFacets 합 대신 materialIds 길이로 파생.
const democracyTotal = democracy.materialIds.length
const economyTotal   = economy.materialIds.length

// First user message text for each scenario
const democracyFirstUser = democracy.chat.find((m) => m.role === 'user')?.text ?? ''
const economyFirstUser   = economy.chat.find((m) => m.role === 'user')?.text ?? ''

// Economy root node label (always-visible in OutputTab's NodeGraph, no generation needed)
const economyRootLabel = economy.nodes.find((n) => n.group === 'root')?.label ?? ''

// Probe: button that switches the active scenario to economy
function Probe() {
  const { setScenarioById } = useScenario()
  return (
    <button onClick={() => setScenarioById('economy')} data-testid="switch-economy">
      switch to economy
    </button>
  )
}

// round10 Task5 리뷰 fix — LibraryProvider가 이제 현재 경로를 보려고 useLocation()을
// 쓰는데, 이 파일은 Router 컨텍스트 밖(조상)에 그것을 얹고 있었다. ResultsTab·ChatTab·
// OutputTab 어느 것도 useLibrary()를 쓰지 않으므로(레포 전체 grep 확인) 애초에 죽은
// wrap이었다 — 걷어낸다(안 걷어내면 useLocation()이 Router 밖에서 던진다).
function renderAll() {
  return render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <Probe />
            {/* Each tab wrapped in a scoping div so within() can disambiguate */}
            <div data-testid="rt-wrapper">
              <ResultsTab />
            </div>
            <div data-testid="ct-wrapper">
              <ChatTab />
            </div>
            <div data-testid="ot-wrapper">
              <OutputTab />
            </div>
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )
}

// ── BEFORE switch: democracy ────────────────────────────────────────────────

test('BEFORE switch: ResultsTab total-count reflects democracy pool 길이', () => {
  renderAll()
  const rt = screen.getByTestId('rt-wrapper')
  const totalEl = within(rt).getByTestId('total-count')
  expect(totalEl.textContent).toBe(democracyTotal.toLocaleString())
})

// F7(round06c-ext D1-6 리뷰): chat_topic_bar 가 activeScenario.query 를 표시하는데 그 값이
// 각 시나리오의 첫 사용자 메시지 원문과 같은 문자열이라(scenarios.js) ct-wrapper 전체로 찾으면
// topic bar와 chat_thread 두 곳에 매치해 모호해진다. .chat_thread 로 범위를 좁힌다.
test('BEFORE switch: ChatTab shows democracy first user line', () => {
  renderAll()
  const ct = screen.getByTestId('ct-wrapper')
  const thread = ct.querySelector('.chat_thread')
  expect(within(thread).getByText(democracyFirstUser)).toBeInTheDocument()
})

test('BEFORE switch: OutputTab shows democracy root node label', () => {
  const democracyRoot = democracy.nodes.find((n) => n.group === 'root')?.label ?? ''
  renderAll()
  const ot = screen.getByTestId('ot-wrapper')
  expect(within(ot).getByText(democracyRoot)).toBeInTheDocument()
})

// ── AFTER switch: economy ───────────────────────────────────────────────────

test('AFTER switch: ResultsTab total-count reflects economy pool 길이', () => {
  renderAll()
  fireEvent.click(screen.getByTestId('switch-economy'))

  const rt = screen.getByTestId('rt-wrapper')
  // There may be multiple total-count nodes across tabs; scope to rt-wrapper
  const totalEl = within(rt).getByTestId('total-count')
  expect(totalEl.textContent).toBe(economyTotal.toLocaleString())
})

// F7: 위 BEFORE 테스트와 같은 이유로 .chat_thread 로 범위를 좁힌다.
test('AFTER switch: ChatTab shows economy first user line', () => {
  renderAll()
  fireEvent.click(screen.getByTestId('switch-economy'))

  const ct = screen.getByTestId('ct-wrapper')
  const thread = ct.querySelector('.chat_thread')
  expect(within(thread).getByText(economyFirstUser)).toBeInTheDocument()
})

test('AFTER switch: OutputTab shows economy root node label', () => {
  renderAll()
  fireEvent.click(screen.getByTestId('switch-economy'))

  const ot = screen.getByTestId('ot-wrapper')
  expect(within(ot).getByText(economyRootLabel)).toBeInTheDocument()
})

test('AFTER switch: democracy data is gone from ResultsTab total-count', () => {
  renderAll()
  const rt = screen.getByTestId('rt-wrapper')
  expect(within(rt).getByTestId('total-count').textContent).toBe(democracyTotal.toLocaleString())

  fireEvent.click(screen.getByTestId('switch-economy'))

  // Total should now be economy total, not democracy total (they differ)
  expect(within(rt).getByTestId('total-count').textContent).toBe(economyTotal.toLocaleString())
  expect(within(rt).getByTestId('total-count').textContent).not.toBe(democracyTotal.toLocaleString())
})
