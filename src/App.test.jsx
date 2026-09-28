/**
 * App.test.jsx — 전 라우트 스모크 (round06d R6d-15b 재작성)
 *
 * 무엇이 바뀌었나
 *  ① 앵커를 문자열에서 랜드마크로 바꿨다.
 *     구: const CHROME_TEXT = '근현대사 지능형 학예 지식 플랫폼'  (Masthead가 공급하던 문구)
 *     신: getByRole('navigation', { name: '주요메뉴' })           (퍼블 nav.lnb, 전 화면 공통)
 *     근거: 텍스트 앵커는 카피가 바뀔 때마다 13건이 함께 죽는다. 실제로 그 일이 벌어져
 *           Masthead 폐기와 동시에 13건이 red가 됐다(spec §9.3).
 *  ② 라우트마다 그 화면 고유의 앵커를 하나씩 더 단언한다.
 *     구 13건은 chrome 존재만 봤을 뿐 라우트를 검증한 적이 없다 — /manage/materials/d1 이
 *     정의된 경로가 아닌데도(NotFound 폴백) 통과해 온 것이 그 증거다(spec §9.2.3).
 *     고유 앵커 문자열은 전부 기존 페이지 테스트에서 인용했다. 새 문구를 지어내지 않는다.
 *
 * 인증 3라우트(/login·/join·/find)는 LNB가 없으므로 여기에 없다 — AuthLayout.test.jsx가 맡는다.
 */
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, Outlet } from 'react-router-dom'
import { routes } from './router.jsx'
import { ScenarioProvider } from './context/ScenarioContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// round07b-ext T13 — /search/results가 실제 라우트 트리를 통해 SearchFlowLayout을
// 그리는데, 그 셸이 이제 탭 뱃지용으로 listOutputs를 직접 부른다. 목하지 않으면 이
// 전체 라우트 스모크가 real fetch를 내보낸다(OutputTab.test.jsx와 같은 이유 — 이
// 스위트는 이 셸을 실제 라우트로 마운트하는 유일한 파일이라 별도로 목이 필요하다).
vi.mock('./lib/outputsApi.js', () => ({
  // isLive: 목 모듈이라 실제 env를 안 본다. true 로 둬야 OutputList·SearchFlowLayout의
  // 데모 모드 게이트를 통과해 기존 조회 경로가 그대로 검증된다.
  isLive: () => true,
  listOutputs: vi.fn().mockResolvedValue({ ok: true, data: { outputs: [], has_more: false } }),
}))

// round10 Task5 — LibraryProvider가 mock 시드(searchHistory)를 걷어내고 listProjects
// (서버)를 부른다. 목하지 않으면 이 전체 라우트 스모크도 /library 진입마다 real fetch를
// 내보낸다(위 outputsApi.js와 같은 이유) — 그리고 아래 '/library' 앵커들이 카드 렌더를
// 확인하므로 최소 한 건은 있는 고정 응답으로 통제한다.
//
// round10 Task5 리뷰 fix — 이 파일이 렌더하는 routes(router.jsx)는 AppShell을 통해
// 이미 자체 LibraryProvider를 갖고 있다(layouts/AppShell.jsx:78). 예전에는 여기서
// <RouterProvider> "밖"에 별도로 <LibraryProvider>를 하나 더 얹었는데, useLibrary()를
// 쓰는 Library.jsx에게는 어차피 안쪽(AppShell) 것이 우선이라 원래도 무의미한 이중
// wrap이었다 — 그리고 LibraryProvider가 이제 현재 경로를 보려고 useLocation()을 쓰므로
// Router 컨텍스트 밖(RouterProvider의 조상)에 두면 그 자체로 던진다. 그래서 죽은 이중
// wrap을 걷어냈다(아래 세 곳: 전체 라우트 스모크·RequireAuth 게이트·/library 단독 렌더).
vi.mock('./lib/projectsApi.js', () => ({
  listProjects: vi.fn().mockResolvedValue({
    ok: true,
    hasMore: false,
    projects: [{
      id: 'p1', title: '근대 신문 호외 모음', description: '설명', author: '김연구',
      has_password: false, output_count: 1, created_at: '2026-06-20',
    }],
  }),
  openProject: vi.fn(),
}))

// 퍼블 nav.lnb 의 접근성 이름. 셸이 붙는 모든 라우트에서 공통이다.
const SHELL_LANDMARK = { name: '주요메뉴' }
const MANAGE_TABS = '자료관리 하위 메뉴'
// round06c-ext D2b: 이 nav는 이제 AdminTabs.jsx가 아니라 SystemTabs.jsx가 그린다
// (aria-label "시스템관리 하위 메뉴"는 그대로라 상수명은 유지한다).
const ADMIN_TABS = '시스템관리 하위 메뉴'

/** page_tabs 안에서 aria-current="page"인 링크가 기대 라벨인지 본다.
 *  LNB의 링크와 섞이지 않도록 반드시 nav 안으로 범위를 좁힌다. */
function expectActiveTab(navName, label) {
  const tabs = screen.getByRole('navigation', { name: navName })
  expect(within(tabs).getByRole('link', { current: 'page' })).toHaveTextContent(label)
}

const SMOKE_ROUTES = [
  // round06e §8.1: 추천질문 카드가 scenarios.query('경제개발...' 포함)에서 publish-v2 정본
  // 문구로 교체되어 이 앵커가 더 이상 '/'에 존재하지 않는다. Home.test.jsx가 이미 인용하는
  // IntroHero의 'SA:I' 이미지로 앵커를 옮긴다(같은 파일의 관행 — 새 문구를 지어내지 않는다).
  { path: '/',                       check: () => expect(screen.getByRole('img', { name: 'SA:I' })).toBeInTheDocument() },
  { path: '/search',                 check: () => expect(screen.getByPlaceholderText('검색어 입력')).toBeInTheDocument() },
  // D1-3: 공용 셸(SearchFlowLayout)이 '검색결과'를 sr_only 제목·page_tabs 링크 2곳에 넣고,
  // 레거시 SearchResults.Tabs 버튼에도 같은 라벨이 있어 getByText가 다중 매치된다. 셸에만 존재하는
  // 활성 탭 링크(aria-current=page)로 앵커를 좁힌다 — 라우트 특정적이며 D1-5가 레거시 헤더 제거 후에도 안정.
  { path: '/search/results',         check: () => expect(screen.getByRole('link', { name: '검색결과', current: 'page' })).toBeInTheDocument() },
  { path: '/library',                check: () => expect(screen.getByText('근대 신문 호외 모음')).toBeInTheDocument() },
  { path: '/manage/ocr',             check: () => expectActiveTab(MANAGE_TABS, '유물자료 OCR') },
  { path: '/manage/meta',            check: () => expectActiveTab(MANAGE_TABS, '메타 정보 등록') },
  { path: '/manage/embedding',       check: () => expectActiveTab(MANAGE_TABS, '데이터 임베딩 관리') },
  { path: '/manage/history',         check: () => expectActiveTab(MANAGE_TABS, '학습 반영 이력') },
  { path: '/manage/materials',       check: () => expectActiveTab(MANAGE_TABS, '자료관리') },
  { path: '/manage/materials/d1',    check: () => expect(screen.getByText('404')).toBeInTheDocument() },
  { path: '/system/monitoring',      check: () => expectActiveTab(ADMIN_TABS, '모니터링') },
  { path: '/system/nodes',           check: () => expectActiveTab(ADMIN_TABS, '노드관리') },
  // round06c-ext 시각 검증 fix — /account 는 **시스템관리 탭바를 렌더하지 않는다**.
  // D2b 직후에는 여기서 SystemTabs 가 렌더돼 활성 탭이 없다는 것을 단언했으나(구 AdminTabs
  // 의 "계정관리→/account" 탭이 "계정·권한→/system/accounts"로 대체된 결과), Playwright
  // 실측에서 그 상태가 "내 계정" 화면에 거대한 h2 "시스템관리" + 빈 탭바를 얹는 IA 혼란임이
  // 드러났다(제목 3중복, 사용자 role 은 탭 0개). /account 는 account area 이므로 system
  // 탭바가 있을 이유가 없다 — 탭바 부재 + 내 계정 화면 렌더를 단언한다.
  {
    path: '/account',
    check: () => {
      expect(screen.queryByRole('navigation', { name: ADMIN_TABS })).toBeNull()
      expect(screen.getByRole('heading', { level: 2, name: '내 계정' })).toBeInTheDocument()
    },
  },
  { path: '/system/log',             check: () => expectActiveTab(ADMIN_TABS, '이용로그') },
  // round06c-ext Task E4 — 구 AccountApprovals(자체설계, AdminTabs 밖 별도 area)를
  // Accounts.jsx로 교체했다. 새 화면은 SystemTabs 4탭 안에 들어와 다른 시스템관리 화면과
  // 동형이므로 앵커도 같은 관행(expectActiveTab)을 쓴다. 마운트 시 비동기 load() 이펙트가
  // 뜨는 것은 그대로다(listAccounts가 async) — act 경고 없이 끝내려면 그 이펙트가 정착
  // (스피너 소멸)할 때까지 기다린 뒤 테스트를 마쳐야 한다(구 F3b fix2와 같은 이유).
  {
    path: '/system/accounts',
    check: async () => {
      expectActiveTab(ADMIN_TABS, '계정·권한')
      await waitFor(() => expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument())
    },
  },
]

describe('Full-route smoke: 셸 랜드마크 + 라우트별 고유 앵커', () => {
  for (const { path, check } of SMOKE_ROUTES) {
    it(`renders ${path}`, async () => {
      const router = createMemoryRouter(routes, { initialEntries: [path] })
      render(
        <ToastProvider>
          <ScenarioProvider>
            <RouterProvider router={router} />
          </ScenarioProvider>
        </ToastProvider>
      )
      // ① 셸이 붙었다(AppShell은 정적 import라 lazy 대상이 아니다 — 즉시 렌더된다)
      expect(screen.getByRole('navigation', SHELL_LANDMARK)).toBeInTheDocument()
      // ② 그 라우트의 화면이 실제로 렌더됐다(일부는 비동기 정착까지 기다린다).
      // round06b B4 — 페이지 컴포넌트가 React.lazy로 스플리팅되어 check() 내부의
      // getBy*가 즉시 통과하지 않을 수 있다(청크 로드가 진짜 비동기라 마운트 직후엔
      // Suspense fallback뿐이다) — waitFor로 감싸 청크 로드를 기다린다.
      //
      // [round07g Task4 수정 R1] 상한을 기본 1000ms에서 3000ms로 올린다.
      // 이 대기가 기다리는 것은 **앱 로직이 아니라 청크 로드**다 — 즉 소요는 전적으로
      // 그 순간의 머신 부하에 달렸고, 전체 스위트(워커 병렬)에서만 1000ms를 넘길 수 있다.
      // 실제로 `renders /library`가 전체 실행에서 한 번 red였고 단독으로는 재현되지 않았다
      // (ops/recurring-gotchas.md §60).
      //  · 왜 3000인가: 이 파일은 vitest 기본 testTimeout 5000ms를 쓴다. 3000이면 진짜
      //    결함일 때 **테스트 타임아웃(무슨 단언이 실패했는지 안 보인다)이 아니라 waitFor의
      //    단언 실패**로 끝나 "무엇이 없었는지"가 그대로 남는다. 4000 이상은 render·act
      //    부대비용까지 더해지면 그 여유가 사라진다.
      //  · 왜 단언을 약화시키는 게 아닌가: check() 본문은 한 글자도 바뀌지 않았다. 화면이
      //    끝내 안 뜨면 3초 뒤 똑같이 red다 — 늘어난 것은 인내심뿐이다.
      await waitFor(() => check(), { timeout: 3000 })
    })
  }
})

// ── round06c F2: RequireAuth 전면 게이트(spec §9.2·§10) ──
// 위 스모크는 routes를 시드 없이 그대로 렌더해 AuthProvider 기본값(DEMO_MOCK_USER=통합관리자)이
// 전 라우트를 통과시킨다 — 그 자체가 "authed 컨텍스트 시드"다(§10). 여기서는 role을 낮추거나
// anon으로 시드해 게이트가 실제로 막는지를 별도로 검증한다(단일 통합관리자 스모크만으로는
// canAccess=false 분기가 한 번도 실행되지 않으므로 이 보강이 필요하다).
//
// routes[0].element가 시드 없는 AuthProvider를 이미 품고 있어(router.jsx) 그 인스턴스에는
// 밖에서 seed를 주입할 수 없다 — 그래서 auth/app 두 계층(routes[0].children)만 재사용하고
// 루트 레이아웃만 시드 가능한 AuthProvider로 새로 얹는다.
function renderGateAt(path, seed) {
  const auth = routes[0].children.find((r) => r.id === 'auth')
  const app = routes[0].children.find((r) => r.id === 'app')
  const router = createMemoryRouter(
    [{ element: <AuthProvider seed={seed}><Outlet /></AuthProvider>, children: [auth, app] }],
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

describe('RequireAuth 전면 게이트: anon → /login 리다이렉트(D13 근거)', () => {
  it('anon 시드로 "/" 에 진입하면 /login 으로 리다이렉트된다', async () => {
    const router = renderGateAt('/', { user: null, status: 'anon' })
    // 리다이렉트 자체(<Navigate>)는 RequireAuth가 직접 렌더하므로(lazy 아님) 동기로 확정된다.
    expect(router.state.location.pathname).toBe('/login')
    // Login은 round06b B4로 React.lazy 스플리팅됐다 — 청크 로드를 기다려야 화면 내용이 보인다.
    await waitFor(() => expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument())
    // 게이트 밖(auth 계층)이라 셸 랜드마크는 없다
    expect(screen.queryByRole('navigation', SHELL_LANDMARK)).toBeNull()
  })

  it('anon 시드로 "/search" 에 진입해도 /login 으로 리다이렉트된다', async () => {
    const router = renderGateAt('/search', { user: null, status: 'anon' })
    expect(router.state.location.pathname).toBe('/login')
    await waitFor(() => expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument())
  })
})

describe('RequireAuth 전면 게이트: 역할 부족 → 리다이렉트(D10 근거)', () => {
  // round06c-ext D1-1: manage area는 세 역할 전부에 허용된다(자료관리 화면은 전부
  // "준비중"이라 열람 자체를 막을 이유가 없다, §3.3) — 개명 전에는 사용자가 차단됐다.
  it('사용자 role 시드로는 /manage/ocr 에 그대로 머문다(manage 권한 있음)', async () => {
    const router = renderGateAt('/manage/ocr', { user: { username: 'u1', role: '사용자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/manage/ocr')
    // Ocr.jsx는 round06b B4로 lazy 스플리팅됐다 — 탭 라벨은 그 청크가 로드돼야 나온다.
    await waitFor(() => expectActiveTab(MANAGE_TABS, '유물자료 OCR'))
  })

  // round06c-ext D1-2: 구 /admin/monitoring이 /system/monitoring으로 이관됐다. area는
  // 'system-ops'로 정밀화됐다(구 'admin'과 같은 권한 폭 — 통합관리자 전용, permissions.js 참고).
  //
  // round06c-ext D2b: canAccess=false여도 area가 system-ops/system-accounts면 더 이상
  // '/'로 즉시 리다이렉트하지 않는다 — SystemAccessDenied(접근거부 알림)가 그 자리에서
  // 뜨고, 확인(또는 Esc)을 눌러야 비로소 홈으로 이동한다(RequireAuth.jsx 원장 주입
  // 사항 #2). URL은 접근거부 화면이 떠 있는 동안 원래 경로에 머문다 — 이것이 "약화"가
  // 아니라 "화면 노출 + 홈 이동 버튼 동작"이라는 더 구체적인 단언이다.
  it('사용자 role 시드로 /system/monitoring 에 진입하면 리다이렉트 대신 접근거부 화면이 뜨고, 확인 시 홈으로 이동한다(canAccess=false)', () => {
    const router = renderGateAt('/system/monitoring', { user: { username: 'u1', role: '사용자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/system/monitoring')
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('접근 권한 제한')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('관리자 role 시드로는 /manage/ocr 에 그대로 머문다(manage 권한 있음)', async () => {
    const router = renderGateAt('/manage/ocr', { user: { username: 'u2', role: '관리자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/manage/ocr')
    await waitFor(() => expectActiveTab(MANAGE_TABS, '유물자료 OCR'))
  })

  it('관리자 role 시드로 /system/monitoring 에 진입하면 리다이렉트 대신 접근거부 화면이 뜨고, 확인 시 홈으로 이동한다(system-ops 권한 없음)', () => {
    const router = renderGateAt('/system/monitoring', { user: { username: 'u2', role: '관리자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/system/monitoring')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('접근 권한 제한')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('통합관리자 role 시드로는 /system/monitoring 에 그대로 머문다(system-ops 권한 있음)', async () => {
    const router = renderGateAt('/system/monitoring', { user: { username: 'u3', role: '통합관리자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/system/monitoring')
    // Monitoring.jsx는 round06b B4로 lazy 스플리팅됐다.
    await waitFor(() => expectActiveTab(ADMIN_TABS, '모니터링'))
  })

  // round06c-ext D1-2: 구 '/approvals'가 '/system/accounts'로 이관됐다. area는
  // 'system-accounts'로 정밀화됐다(구 'approve'와 같은 권한 폭 — 관리자·통합관리자는 통과, 사용자는 차단).
  // round06c-ext D2b: system-accounts도 system-ops와 같은 접근거부 화면 배선을 탄다.
  it('사용자 role 시드로 /system/accounts 에 진입하면 리다이렉트 대신 접근거부 화면이 뜨고, 확인 시 홈으로 이동한다(canAccess=false)', () => {
    const router = renderGateAt('/system/accounts', { user: { username: 'u4', role: '사용자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/system/accounts')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('접근 권한 제한')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('관리자 role 시드로는 /system/accounts 에 그대로 머문다(system-accounts 권한 있음)', async () => {
    const router = renderGateAt('/system/accounts', { user: { username: 'u5', role: '관리자' }, status: 'authed' })
    expect(router.state.location.pathname).toBe('/system/accounts')
    // round06c-ext Task E4: Accounts.jsx로 교체 — 앵커도 다른 시스템관리 화면과 같은 관행.
    // Accounts.jsx는 round06b B4로 lazy 스플리팅됐다 — 청크 로드를 기다린다.
    await waitFor(() => expectActiveTab(ADMIN_TABS, '계정·권한'))
    // Accounts.jsx의 비동기 load() 이펙트가 정착할 때까지 기다려 act 경고를 없앤다.
    await waitFor(() => expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument())
  })
})

// Animation class assertions (cheap, no interaction needed)
describe('Animation / transition class presence', () => {
  it('Modal overlay has animate-overlayIn class and panel has animate-modalIn class', async () => {
    // Render a route that shows a modal trigger — use Library which has PasswordModal
    // But easier: import Modal directly and render it open
    const { default: Modal } = await import('./components/Modal.jsx')
    render(
      <Modal open title="test" onClose={() => {}}>
        <p>content</p>
      </Modal>
    )
    // Overlay div — fixed inset
    const overlay = document.querySelector('.animate-overlayIn')
    expect(overlay).not.toBeNull()
    // Panel div — bg-white rounded-2xl
    const panel = document.querySelector('.animate-modalIn')
    expect(panel).not.toBeNull()
  })

  // F1(round06c 배치 리뷰): 구 ProjectCard·transition-all은 D2c 재퍼블로 소멸했다(전
  // 소스 grep 결과 transition-all은 ToggleSwitch만 남는다) — 죽은 앵커였다. /library가
  // 실제로 렌더되는지로 재앵커한다. 호버 리프트 자체는 이제 퍼블 CSS(component.css)의
  // 소관이라 jsdom에서 굳이 클래스를 단언하지 않는다.
  //
  // round10c — 앵커에서 view_toggle을 뺐다. 뷰 토글과 목록형 표는 피그마에 없어 걷어냈다
  // (사용자 결정 2026-09-18: 「나는 카드형만 필요한건데」 — Library.jsx 머리주석 참조).
  // 이 시험의 목적은 「라우트가 실제로 렌더되는가」이므로 카드 목록 하나로 충분하다.
  it('/library 라우트가 실제로 렌더된다(.library_card 카드 목록)', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/library'] })
    render(
      <ToastProvider>
        <ScenarioProvider>
          <RouterProvider router={router} />
        </ScenarioProvider>
      </ToastProvider>
    )
    // Library.jsx는 round06b B4로 lazy 스플리팅됐다 — 청크 로드를 기다린다.
    await waitFor(() => {
      expect(document.querySelectorAll('.library_card').length).toBeGreaterThan(0)
    })
  })

  it('ToggleSwitch has transition-colors class', async () => {
    const { default: ToggleSwitch } = await import('./components/ToggleSwitch.jsx')
    render(<ToggleSwitch checked={false} onChange={() => {}} />)
    const toggle = document.querySelector('[role="switch"]')
    expect(toggle?.className).toMatch(/transition-colors/)
  })
})
