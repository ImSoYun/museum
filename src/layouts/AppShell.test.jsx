/**
 * 이 파일의 책임: AppShell이 퍼블 publish-v2의 3단 셸(.intro_wrap | .library_wrap | .mng_wrap)로
 * 렌더되는지, 그리고 폐기한 5겹 chrome이 DOM에서 완전히 사라졌는지를 지킨다.
 * library_wrap 분기는 round06c-ext A3에서 추가했다(퍼블 v2 library.html 최상위).
 *
 * 삭제된 2건(round06d R6d-14):
 *  - 구 #3 「알림 버튼 → 알림 패널」  : NotificationPanel 폐기. 퍼블에 알림 UI가 없어 옮겨갈 동작이 없다(spec §6.4).
 *  - 구 #5 「홈에서 브레드크럼 숨김」 : 빵부스러기가 사라지면 항상 참이 되는 유령 테스트다.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, Outlet } from 'react-router-dom'
import { ToastProvider } from '../components/Toast.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { routes } from '../router.jsx'
import AppShell from './AppShell.jsx'

// round06c F2(spec §9.6): AppShell이 접힘 상태를 localStorage에 읽고 쓴다. vitest는 테스트
// 파일 하나에 jsdom window 하나를 공유하므로, 앞 테스트의 토글이 뒤 테스트로 새지 않도록
// 매 테스트 전에 비운다.
beforeEach(() => {
  window.localStorage.clear()
})

function renderAt(path = '/') {
  const r = createMemoryRouter(
    [{ element: <AppShell />, children: [
      { path: '/', element: <div>홈본문</div> },
      { path: '/account', element: <div>계정본문</div> },
      { path: '/library', element: <div>라이브러리본문</div> },
    ] }],
    { initialEntries: [path] },
  )
  render(
    <ToastProvider>
      <ScenarioProvider><RouterProvider router={r} /></ScenarioProvider>
    </ToastProvider>,
  )
  return r
}

// round06c F2: Lnb가 CURRENT_USER(하드코딩 '사용자') 대신 useAuth()를 읽으므로, 전체 routes
// 트리(RequireAuth 포함)로 렌더할 때는 role을 명시로 시드해야 시스템관리 차단을 재현할 수 있다
// (raw routes를 그대로 쓰면 AuthProvider 기본값=DEMO_MOCK_USER=통합관리자라 차단되지 않는다).
function renderRoutesAsRole(role, path = '/') {
  const shell = routes[0].children.find((r) => r.id === 'app')
  const auth = routes[0].children.find((r) => r.id === 'auth')
  // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": email 키를 뺐다.
  const seededUser = { username: 'test', display_name: '김연구', role }
  const router = createMemoryRouter(
    [{ element: <AuthProvider seed={{ user: seededUser, status: 'authed' }}><Outlet /></AuthProvider>, children: [auth, shell] }],
    { initialEntries: [path] },
  )
  render(
    <ToastProvider>
      <ScenarioProvider>
        <RouterProvider router={router} />
      </ScenarioProvider>
    </ToastProvider>,
  )
  return router
}

test('AppShell: 인트로 경로(/)는 intro_wrap 2단 셸로 렌더된다', () => {
  renderAt('/')
  expect(document.querySelector('.intro_wrap')).not.toBeNull()
  expect(document.querySelector('main.intro_main')).not.toBeNull()
  expect(document.querySelector('.mng_wrap')).toBeNull()
  // 사이드바가 셸 안에 함께 있다(round06c-ext A2: LNB가 v2 4항목으로 바뀌어 '자료검색'이
  // 사라졌다 — 남은 항목 중 하나인 '라이브러리'로 사이드바 존재를 확인한다)
  expect(screen.getByText('라이브러리')).toBeInTheDocument()
  expect(screen.getByText('홈본문')).toBeInTheDocument()
})

test('AppShell: 앱 경로(/account)는 mng_wrap으로 전환되고 셸 직계 자식은 skip link·사이드바·main 셋뿐이다', () => {
  renderAt('/account')
  const wrap = document.querySelector('.mng_wrap')
  expect(wrap).not.toBeNull()
  expect(document.querySelector('main.mng_main')).not.toBeNull()
  expect(document.querySelector('.intro_wrap')).toBeNull()
  // 퍼블 body 최상위는 [사이드바, main] 둘뿐이고(spec §6.2), 여기에 접근성 skip link 하나를
  // 맨 앞에 더한 것이 이 라운드의 셸 계약이다(spec §6.8.5 · §13 U-29 — 퍼블 .skip_menu 를
  // 가져오지 않고 Tailwind 로 신설한다). 즉 직계 자식은 정확히 3개다.
  // 헤더·빵부스러기·푸터가 되살아나면 4개 이상이 되어 여기서 잡힌다.
  expect(wrap.children).toHaveLength(3)
  expect(screen.getByText('계정본문')).toBeInTheDocument()
})

// round06c-ext A3: /library만 별도의 .library_wrap/.library_main 으로 갈라진다(퍼블 v2
// library.html 최상위가 .library_wrap — layout.css:179-182, 구조는 mng_wrap과 동일).
test('AppShell: 라이브러리 경로(/library)는 library_wrap 셸로 전환된다', () => {
  renderAt('/library')
  const wrap = document.querySelector('.library_wrap')
  expect(wrap).not.toBeNull()
  expect(document.querySelector('main.library_main')).not.toBeNull()
  expect(document.querySelector('.mng_wrap')).toBeNull()
  expect(document.querySelector('.intro_wrap')).toBeNull()
  expect(wrap.children).toHaveLength(3)
  expect(screen.getByText('라이브러리본문')).toBeInTheDocument()
})

test('AppShell: skip link가 셸 최상단에 있고 main을 가리킨다', () => {
  renderAt('/account')
  const wrap = document.querySelector('.mng_wrap')
  const skip = screen.getByRole('link', { name: '본문 바로가기' })
  // 키보드 사용자가 LNB 메뉴 전체를 지나치지 않고 본문으로 건너뛸 수 있어야 하므로
  // DOM 순서상 셸의 첫 자식이어야 한다(포커스 순서 = DOM 순서).
  expect(wrap.firstElementChild).toBe(skip)
  expect(skip).toHaveAttribute('href', '#main')
  // 목적지가 실제로 존재해야 한다 — href 만 있고 대상이 없으면 죽은 링크다.
  expect(document.querySelector('main.mng_main')).toHaveAttribute('id', 'main')
})

test('AppShell: 폐기한 5겹 chrome이 DOM에 없다', () => {
  renderAt('/account')
  expect(screen.getByText('계정본문')).toBeInTheDocument()                                     // 본문은 살아 있다
  expect(screen.queryByText(/대한민국역사박물관 근현대사 지능형 학예 지식 플랫폼/)).toBeNull() // GovUtilityBar
  expect(screen.queryByText('근현대사 지능형 학예 지식 플랫폼')).toBeNull()                    // Masthead
  expect(screen.queryByText(/세종대로 198/)).toBeNull()                                       // OfficialFooter
  expect(screen.queryByRole('navigation', { name: '브레드크럼' })).toBeNull()                  // AppBreadcrumb
  expect(screen.queryByRole('button', { name: '알림' })).toBeNull()                            // NotificationPanel 트리거
})

// ── R6d-26: LNB 시스템관리 클릭 → 차단 팝업 (셸 결선의 유일한 통합 관측점) ──
// 단위 테스트 둘(permissions·Lnb)은 각각 정책과 호출만 본다.
// "실제로 팝업이 뜨고 문구가 통합관리자이며 URL이 그대로인가"는 여기서만 확인된다.
// round06c F2: 차단을 재현하려면 admin 권한이 없는 role(사용자)을 명시로 시드해야 한다.
test('LNB 시스템관리 클릭: 라우트 이동 없이 접근 권한 제한 alertdialog가 열린다', async () => {
  const router = renderRoutesAsRole('사용자', '/')

  // 열리기 전에는 존재하지 않는다(AlertPopup은 kind=null이면 언마운트)
  expect(screen.queryByRole('alertdialog')).toBeNull()

  fireEvent.click(screen.getByRole('link', { name: '시스템관리' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(within(dialog).getByText('접근 권한 제한')).toBeInTheDocument()
  // 퍼블 원문 '총괄 관리자'를 '통합관리자'로 교정한 것의 회귀 가드(spec §13 U-3)
  expect(dialog.textContent).toContain('통합관리자에게 있습니다.')
  expect(dialog.textContent).not.toContain('총괄 관리자')

  // 라우트는 그대로 '/' 여야 한다
  expect(router.state.location.pathname).toBe('/')
})

// ── D15 회귀: 차단 팝업을 닫으면 포커스가 트리거로 복귀한다 ──
// AlertPopup.test는 자체 triggerRef를 직접 만들어 넘기는 격리 harness라
// Lnb→AppShell→AlertPopup 사이의 실제 배선이 끊겨도 잡지 못한다(D15).
// AppShell은 그 세 컴포넌트가 실제로 조립되는 유일한 통합 지점이므로 여기서만 확인된다.
test('LNB 시스템관리 클릭 후 팝업을 닫으면 포커스가 트리거 링크로 복귀한다(D15 회귀)', async () => {
  renderRoutesAsRole('사용자', '/')

  const trigger = screen.getByRole('link', { name: '시스템관리' })
  fireEvent.click(trigger)

  await screen.findByRole('alertdialog')

  // Esc로 닫는다(dim 클릭·확인 버튼과 동일한 close() 경로를 탄다).
  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('alertdialog')).toBeNull()
  // 배선이 끊기면(AppShell이 trigger를 ref에 담지 않으면) activeElement는 body에 남는다.
  expect(document.activeElement).toBe(trigger)
})

// ── round06c F2: LNB 접힘 상태 localStorage 영속(spec §9.6·R7) ──
test('LNB 접힘 토글 시 localStorage(lnb.collapsed)에 기록된다', () => {
  renderAt('/')
  // 마운트 시점에 현재 상태(펼침=false)를 곧바로 동기화하므로 초기값은 'false'다(null이 아니다).
  expect(window.localStorage.getItem('lnb.collapsed')).toBe('false')

  fireEvent.click(screen.getByRole('button', { name: '메뉴 접기' }))
  expect(window.localStorage.getItem('lnb.collapsed')).toBe('true')

  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }))
  expect(window.localStorage.getItem('lnb.collapsed')).toBe('false')
})

test('localStorage에 저장된 접힘 상태(true)를 초기 렌더에 반영한다', () => {
  window.localStorage.setItem('lnb.collapsed', 'true')
  renderAt('/')
  // 접힘 상태에서는 메뉴 라벨이 조건부 렌더로 숨는다(Lnb.jsx 계약) — '메뉴 펼치기' 버튼이 보이면
  // 초기값이 실제로 localStorage에서 읽혔다는 뜻이다.
  expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '메뉴 접기' })).toBeNull()
})
