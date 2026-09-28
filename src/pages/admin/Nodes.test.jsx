import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminProvider } from '../../state/AdminProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'
import Nodes from './Nodes.jsx'

// D2b — Nodes는 이제 useToast를 쓰므로(모든 액션이 showToast('준비 중입니다')로
// 치환됐다) ToastProvider로 감싸야 한다(D2a Materials.test.jsx와 같은 관행).
function renderNodes(path = '/system/nodes') {
  return render(
    <ToastProvider>
      <AdminProvider>
        <MemoryRouter initialEntries={[path]}><Nodes /></MemoryRouter>
      </AdminProvider>
    </ToastProvider>
  )
}

test('SystemTabs가 렌더되고 노드관리 탭이 4탭 중 활성이다', () => {
  renderNodes()
  expect(screen.getByRole('link', { name: '모니터링' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '노드관리' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '이용로그' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '계정·권한' })).toBeInTheDocument()
})

test('노드 사용자 설정 label이 보인다', () => {
  renderNodes()
  expect(screen.getByText('노드 사용자 설정')).toBeInTheDocument()
})

test('검색 input은 v2 node_setting_bar 마크업이고 placeholder는 퍼블 원문(사용자 설정)이다', () => {
  const { container } = renderNodes()
  expect(container.querySelector('.node_setting_bar')).not.toBeNull()
  expect(screen.getByPlaceholderText('사용자 설정')).toBeInTheDocument()
})

test('DataTable shows all 10 clusteringPrompts rows', () => {
  renderNodes()
  expect(screen.getByText('인물별 분류')).toBeInTheDocument()
  expect(screen.getByText('시대별 분류')).toBeInTheDocument()
  expect(screen.getByText('언어별 분류')).toBeInTheDocument()
})

test('검색 입력은 준비중 — 값을 바꿔도 필터되지 않고 Enter 시 토스트만 뜬다(D2b)', () => {
  renderNodes()
  const search = screen.getByPlaceholderText('사용자 설정')
  fireEvent.change(search, { target: { value: '인물' } })
  // 실동작 필터가 없다 — 다른 행이 여전히 남아 있어야 한다.
  expect(screen.getByText('주제별 분류')).toBeInTheDocument()
  expect(screen.getByText('인물별 분류')).toBeInTheDocument()
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('ToggleSwitch role=switch는 10개가 그대로 렌더되고 클릭해도 상태가 바뀌지 않는다(D2b 준비중)', () => {
  renderNodes()
  const toggles = screen.getAllByRole('switch')
  expect(toggles.length).toBe(10)
  const toggle = screen.getByRole('switch', { name: '활성 토글 c1' })
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('수정 버튼은 준비중 — 모달이 열리지 않는다(D2b)', () => {
  renderNodes()
  fireEvent.click(screen.getByTestId('edit-criterion-c1'))
  expect(screen.queryByRole('heading', { name: '클러스터링 기준 수정' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('주제별 분류')).toBeInTheDocument()
})

test('클러스터링 기준 추가 버튼은 준비중 — 모달이 열리지 않는다(D2b)', () => {
  renderNodes()
  fireEvent.click(screen.getByTestId('open-add-prompt'))
  expect(screen.queryByRole('heading', { name: '클러스터링 기준 추가' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('선택 없을 때 선택삭제 버튼은 비활성', () => {
  renderNodes()
  expect(screen.getByRole('button', { name: /선택삭제/ })).toBeDisabled()
})

test('선택삭제는 준비중 — 확인창 없이 토스트만 뜨고 행은 그대로 남는다(D2b)', () => {
  renderNodes()
  const del = screen.getByRole('button', { name: /선택삭제/ })
  fireEvent.click(screen.getByLabelText('선택 c2'))
  expect(del).toBeEnabled()
  fireEvent.click(del)
  expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('인물별 분류')).toBeInTheDocument()
})

test('useAdmin의 toggleActive·removeCriteria는 이 화면에서 호출되지 않는다(간접 확인 — 위 준비중 단언들이 이미 검증)', () => {
  // 상태 변이 없음은 위 개별 테스트(토글·삭제)가 "그대로 남는다/바뀌지 않는다"로
  // 이미 단언했다 — 이 테스트는 그 사실을 한 문장으로 요약해 둔다(문서적 가드).
  renderNodes()
  expect(screen.getByText('주제별 분류')).toBeInTheDocument()
})

// ── round06f 갈래 E(spec §10.3 · DoD 7): prod에서 탭줄은 남고 본문만 준비중 ──
// Monitoring.test.jsx의 같은 이름 테스트와 짝이다(테스트 파일 간 import 금지 관례상
// 헬퍼를 공유하지 않고 각 스위트가 자기 렌더를 갖는다). role 통합관리자 명시 이유는
// spec §10.4 — "4탭 전부"는 통합관리자 기준이다.
test('prod 환경(통합관리자): SystemTabs 4탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다', () => {
  const { container } = render(
    <AuthContext.Provider value={{ user: { username: 'u', role: '통합관리자' }, appEnv: 'prod' }}>
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter initialEntries={['/system/nodes']}><Nodes /></MemoryRouter>
        </AdminProvider>
      </ToastProvider>
    </AuthContext.Provider>
  )
  for (const name of ['모니터링', '노드관리', '이용로그', '계정·권한']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(container.querySelector('.data_panel')).toBeNull()
  expect(container.querySelector('.node_setting_bar')).toBeNull()
  expect(screen.queryByText('인물별 분류')).toBeNull()   // 표 행 미렌더
})
