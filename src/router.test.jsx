import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from './router.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { ScenarioProvider } from './context/ScenarioContext.jsx'

// round06b B4 — NotFound.jsx는 React.lazy로 스플리팅됐다 — 마운트 직후엔 Suspense
// fallback(null)뿐이라 청크 로드를 기다려야 본문이 보인다. findBy*는 내부적으로 waitFor와
// 같은 폴링을 한다.
test('미정의 경로는 NotFound(404)로 폴백된다', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/이런경로없음'] })
  render(
    <ToastProvider>
      <ScenarioProvider>
        <RouterProvider router={router} />
      </ScenarioProvider>
    </ToastProvider>
  )
  expect(await screen.findByText('404')).toBeInTheDocument()
})

test('알 수 없는 경로는 404 NotFound를 셸 안에서 렌더한다', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/zzz-not-exist'] })
  render(
    <ToastProvider>
      <ScenarioProvider>
        <RouterProvider router={router} />
      </ScenarioProvider>
    </ToastProvider>
  )
  expect(await screen.findByText('404')).toBeInTheDocument()
  expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeInTheDocument()
  // 셸은 유지된다 — round06d에서 유틸바가 폐기됐으므로 앵커를 퍼블 2단 래퍼로 옮긴다(spec §9.2.3).
  expect(document.querySelector('.mng_wrap')).not.toBeNull()
})

// round06c F1: 루트에 AuthProvider pathless 레이아웃이 하나 더 얹혀 계층이 3단이 됐다
// (routes[0] = 루트 레이아웃, 그 children이 auth/app — spec §9.1). 최상위 배열에서 바로
// id를 찾으면(구 코드) 더 이상 매치되지 않으므로, 루트의 children에서 찾는다.
function findRoute(id) {
  return routes[0].children.find((r) => r.id === id)
}

test('router: /manage/materials/:id 고아 라우트가 제거되었다', () => {
  // AuthLayout 도입 후에는 children을 가진 라우트가(루트 아래) 둘이다.
  // Array.isArray(children)로 찾으면 AuthLayout을 집어 엉뚱한 대상에 대해 통과한다(위양성).
  // 그래서 셸 라우트를 id로 명시 지목한다(spec §9.2.3 ③).
  const shell = findRoute('app')
  const paths = shell.children.map((c) => c.path)
  expect(paths).not.toContain('/manage/materials/:id')
})

test('router: 2계층으로 분리되고 셸 라우트 지목이 AuthLayout을 집지 않는다', () => {
  const auth = findRoute('auth')
  const shell = findRoute('app')
  expect(auth).toBeDefined()
  expect(shell).toBeDefined()
  expect(auth).not.toBe(shell)
  // 인증 계층에는 셸 없는 3경로만 있다
  expect(auth.children.map((c) => c.path)).toEqual(['/login', '/join', '/find'])
  // 404 폴백은 앱 계층에 남는다(로그인 후 오타 URL에서 LNB로 복귀할 수 있어야 한다 — spec §7.0.1)
  expect(shell.children.map((c) => c.path)).toContain('*')
  expect(auth.children.map((c) => c.path)).not.toContain('*')
})

// round06c F1: 루트 pathless 레이아웃이 AuthProvider를 얹었는지 자체를 지킨다(spec §9.1).
// children 보유 여부가 아니라 routes 배열 길이·최상위 라우트가 정확히 하나(루트)임을 본다 —
// 최상위에 auth/app이 직접 노출되면(회귀) 이 테스트가 잡는다.
test('router: 최상위는 루트 레이아웃 라우트 하나뿐이고 auth/app은 그 children이다', () => {
  expect(routes).toHaveLength(1)
  expect(routes[0].children.map((r) => r.id)).toEqual(['auth', 'app'])
})

test('router: 검색 흐름은 /search 레이아웃의 형제 라우트다', () => {
  const shell = findRoute('app')
  const search = shell.children.find((c) => c.path === '/search')
  expect(search).toBeDefined()
  const childPaths = search.children.map((c) => (c.index ? 'index' : c.path))
  // round07f Task 5 — 산출물 상세 화면이 'output'의 **평면 형제**로 들어왔다
  // (중첩 자식이 아니다 — 상세는 목록의 하위 화면이 아니라 독립 화면이다).
  expect(childPaths).toEqual(['index', 'results', 'chat', 'output', 'output/:outputId'])
})

test('router: /admin·/approvals·자료검색 랜딩이 제거되고 /system/*로 이관됐다', () => {
  const shell = findRoute('app')
  const paths = shell.children.flatMap((c) => (c.path ? [c.path] : []))
  expect(paths).toContain('/system/monitoring')
  expect(paths).toContain('/system/nodes')
  expect(paths).toContain('/system/accounts')
  expect(paths).toContain('/system/log')
  expect(paths).not.toContain('/admin/monitoring')
  expect(paths).not.toContain('/approvals')
})
