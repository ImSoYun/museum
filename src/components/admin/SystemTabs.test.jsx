import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, AuthContext } from '../../context/AuthContext.jsx'
import SystemTabs from './SystemTabs.jsx'

// role별로 시드한 AuthProvider 아래에서 SystemTabs를 렌더한다(App.test.jsx의 renderGateAt과 같은 시드 관행).
function renderAs(role, path = '/system/monitoring') {
  return render(
    <AuthProvider seed={{ user: { username: 'u', role }, status: 'authed' }}>
      <MemoryRouter initialEntries={[path]}>
        <SystemTabs />
      </MemoryRouter>
    </AuthProvider>
  )
}

test('통합관리자: 4탭(모니터링/노드관리/이용로그/계정·권한) 모두 렌더', () => {
  renderAs('통합관리자')
  expect(screen.getByRole('link', { name: '모니터링' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '노드관리' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '이용로그' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '계정·권한' })).toBeInTheDocument()
})

test('관리자: 계정·권한 1탭만 렌더(나머지 3은 비노출) — system-ops 권한 없음', () => {
  renderAs('관리자', '/system/accounts')
  expect(screen.queryByRole('link', { name: '모니터링' })).toBeNull()
  expect(screen.queryByRole('link', { name: '노드관리' })).toBeNull()
  expect(screen.queryByRole('link', { name: '이용로그' })).toBeNull()
  expect(screen.getByRole('link', { name: '계정·권한' })).toBeInTheDocument()
})

test('사용자: 탭 0개 — system-ops·system-accounts 둘 다 권한 없음', () => {
  const { container } = renderAs('사용자')
  expect(screen.queryByRole('link', { name: '모니터링' })).toBeNull()
  expect(screen.queryByRole('link', { name: '노드관리' })).toBeNull()
  expect(screen.queryByRole('link', { name: '이용로그' })).toBeNull()
  expect(screen.queryByRole('link', { name: '계정·권한' })).toBeNull()
  // nav 자체는 렌더된다(PageTabs 계약 — tabs=[] 여도 골격은 남는다) — 여기선 SystemTabs
  // 자체 구현이 h2+nav를 직접 그리므로 그 골격이 유지되는지도 함께 본다.
  expect(container.querySelector('nav.page_tabs')).not.toBeNull()
  expect(screen.getByRole('heading', { level: 2, name: '시스템관리' })).toHaveClass('mng_page_tit')
})

test('제목·nav 구조는 자료관리 SystemTabs 규약과 동일 — 시스템관리 제목 + 시스템관리 하위 메뉴 nav', () => {
  renderAs('통합관리자')
  expect(screen.getByRole('navigation', { name: '시스템관리 하위 메뉴' })).toBeInTheDocument()
})

test('통합관리자: 모니터링 탭은 /system/monitoring 을 가리키고 현재 경로면 aria-current=page', () => {
  renderAs('통합관리자', '/system/monitoring')
  const tab = screen.getByRole('link', { name: '모니터링' })
  expect(tab).toHaveAttribute('href', '/system/monitoring')
  expect(tab).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '노드관리' })).not.toHaveAttribute('aria-current')
})

test('탭 링크마다 page_tabs_link 클래스가 붙는다(활성 탭이 없는 경로에서 확인 — NavLink가 활성 시 자체적으로 " active"를 덧붙이므로)', () => {
  renderAs('통합관리자', '/')
  for (const name of ['모니터링', '노드관리', '이용로그', '계정·권한']) {
    expect(screen.getByRole('link', { name }).className).toBe('page_tabs_link')
  }
})

// ── round06f 갈래 E(spec §10.3 · §10.4): prod에서도 role이 허용하는 탭은 전부 남는다 ──
// round06e는 여기서 env로 3탭을 뺐다 — 그때는 그 화면들이 AppShell에서 통째로 준비중이
// 되어 탭이 죽은 링크였기 때문이다. 이제 각 페이지가 <EnvGate>로 본문만 가리므로
// 탭줄은 살아남고, 탭은 "눌러 들어가면 탭줄은 그대로고 본문만 준비중"인 정상 링크다.
// AuthProvider의 seed는 appEnv를 지원하지 않으므로 AuthContext.Provider로 직접 감싼다.
function renderProd(role, path = '/system/accounts') {
  return render(
    <AuthContext.Provider value={{ user: { username: 'u', role }, appEnv: 'prod' }}>
      <MemoryRouter initialEntries={[path]}>
        <SystemTabs />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

// spec §10.4 — "4탭 전부"는 **통합관리자 기준**이다. 이 role만이 env 필터 제거의
// 진짜 red/green 신호다(관리자·사용자는 env가 있든 없든 role이 먼저 거른다).
test('prod 환경(통합관리자): 4탭이 모두 남는다(round06e의 env 필터를 되돌린다)', () => {
  renderProd('통합관리자')
  for (const name of ['모니터링', '노드관리', '이용로그', '계정·권한']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
})

// 이 테스트는 위와 목적이 다르다 — "env를 걷어냈다고 권한 경계가 넓어지지 않는다"는
// 회귀 가드다(spec §10.5). 관리자는 prod에서도 계정·권한 1탭이며, 그 판정 근거는
// env가 아니라 PERMISSION_MATRIX(관리자에게 system-ops가 없다)다.
test('prod 환경(관리자): 계정·권한 1탭만 — env가 아니라 role이 거른다(§10.4)', () => {
  renderProd('관리자')
  expect(screen.queryByRole('link', { name: '모니터링' })).toBeNull()
  expect(screen.queryByRole('link', { name: '노드관리' })).toBeNull()
  expect(screen.queryByRole('link', { name: '이용로그' })).toBeNull()
  expect(screen.getByRole('link', { name: '계정·권한' })).toBeInTheDocument()
})

test('prod 환경(사용자): 0탭 — 골격(h2 + nav)만 남는다', () => {
  const { container } = renderProd('사용자')
  for (const name of ['모니터링', '노드관리', '이용로그', '계정·권한']) {
    expect(screen.queryByRole('link', { name })).toBeNull()
  }
  expect(container.querySelector('nav.page_tabs')).not.toBeNull()
})
