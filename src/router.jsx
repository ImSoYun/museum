import { Suspense, lazy } from 'react'
import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom'
import AppShell from './layouts/AppShell.jsx'
import AuthLayout from './layouts/AuthLayout.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import RequireAuth from './context/RequireAuth.jsx'

// round06b B4 — 페이지 컴포넌트를 React.lazy로 스플리팅한다(번들 크기 절감, 픽셀 불변).
// 레이아웃(AppShell·AuthLayout)과 인증 게이트(RequireAuth)는 최초 진입에 항상 필요하므로
// 정적 import를 유지한다. Suspense fallback은 null — 청크 로드는 로컬/배포 모두
// 수백ms 내로, 로딩 표시가 오히려 깜빡임을 유발한다는 기존 프론트 관행(스피너 최소화)과 맞춘다.
const Login = lazy(() => import('./pages/auth/Login.jsx'))
const Join = lazy(() => import('./pages/auth/Join.jsx'))
const FindAccount = lazy(() => import('./pages/auth/FindAccount.jsx'))
const Account = lazy(() => import('./pages/account/Account.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const Monitoring = lazy(() => import('./pages/admin/Monitoring.jsx'))
const Nodes = lazy(() => import('./pages/admin/Nodes.jsx'))
const SearchFlowLayout = lazy(() => import('./pages/SearchFlowLayout.jsx'))
const SearchResults = lazy(() => import('./pages/SearchResults.jsx'))
const ChatView = lazy(() => import('./pages/ChatView.jsx'))
const OutputView = lazy(() => import('./pages/OutputView.jsx'))
const OutputDetail = lazy(() => import('./pages/OutputDetail.jsx'))
const Library = lazy(() => import('./pages/Library.jsx'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.jsx'))
const Ocr = lazy(() => import('./pages/manage/Ocr.jsx'))
const Meta = lazy(() => import('./pages/manage/Meta.jsx'))
const Embedding = lazy(() => import('./pages/manage/Embedding.jsx'))
const History = lazy(() => import('./pages/manage/History.jsx'))
const Materials = lazy(() => import('./pages/manage/Materials.jsx'))
const Accounts = lazy(() => import('./pages/system/Accounts.jsx'))
const Log = lazy(() => import('./pages/system/Log.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const withSuspense = (el) => <Suspense fallback={null}>{el}</Suspense>

// 라우트 계층은 3단이다(round06c F1 — 루트에 AuthProvider 레이아웃이 하나 더 얹혔다, spec §9.1).
// id를 붙이는 이유는 테스트가 "셸 라우트"를 명시적으로 지목하기 위함이다 —
// children 보유 여부로 찾으면 AuthLayout을 집는 위양성이 생긴다(spec §9.2.3 ③).
export const routes = [
  // 계층 0: 루트 pathless 레이아웃 — AuthProvider가 auth 계층(login/join/find)과
  // app 계층(AppShell) 둘 다를 감싼다. path가 없으므로 매칭에 관여하지 않고 항상 렌더된다.
  // 왜 여기(App.jsx가 아니라 router.jsx)인가: (1) Login/Join의 login()이 useAuth를 필요로 하는데
  // 이들은 auth 계층에 있다 — App.jsx에만 두면 auth 계층이 못 받는다. (2) routes를 직접 렌더하는
  // 기존 테스트(App.test.jsx 등, createMemoryRouter(routes))가 Provider를 상속해야 한다 —
  // App.jsx에만 두면 그 테스트들은 RouterProvider만 보고 App.jsx를 거치지 않아 못 받는다(spec §9.1).
  {
    id: 'root',
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      // 계층 1: 셸 없는 인증 계층. 퍼블 login/join/find.html 의 최상위는 .auth_wrap 하나뿐이라
      // LNB도 Library/Manage/Admin 컨텍스트도 필요 없다. 배열 앞에 둔 것은 매칭 순서 때문이 아니라
      // (react-router는 랭킹으로 매칭한다) 사람이 읽을 때 "셸 밖 계층이 먼저"임을 드러내기 위함이다.
      {
        id: 'auth',
        element: <AuthLayout />,
        children: [
          { path: '/login', element: withSuspense(<Login />) },
          { path: '/join', element: withSuspense(<Join />) },
          { path: '/find', element: withSuspense(<FindAccount />) },
        ],
      },
      // 계층 2: 셸 있는 앱 계층. round06c-ext D1-2 — 검색 흐름을 형제 라우트로 재편하고
      // (/search 자체는 랜딩 없이 자식 index에서 '/'로 redirect), /admin/*·/approvals를
      // /system/*·/system/accounts로 이관한다. 구 경로는 라우트 테이블에서 완전히 제거했다
      // — permissions.js의 임시 우회 매핑(D1-1이 남긴 두 줄)도 이 커밋에서 함께 지웠다.
      // 404를 인증 계층으로 옮기지 않는 이유: 로그인 전 404 처리는 round06c 게이트가 정할 문제이고,
      // 로그인한 사용자가 오타 URL을 쳤을 때 LNB로 복귀할 수 있어야 한다(spec §7.0.1).
      // RequireAuth(F2, spec §9.2)가 AppShell만 감싼다 — auth 계층(위 children)은 게이트 밖이다.
      {
        id: 'app',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: '/', element: withSuspense(<Home />) },
          {
            // 검색 세션: 하나의 conversation 컨텍스트를 공유하는 형제 라우트.
            // result_query_bar + page_tabs는 레이아웃(SearchFlowLayout)이 그리고 본문만 스왑한다.
            // SearchFlowLayout은 지금은 Outlet만 통과시키는 잠정 placeholder다 — D1-3이
            // result_query_bar·page_tabs 셸로 전면 교체한다(task-D1-3-brief). ChatView·
            // OutputView도 같은 이유로 기존 ChatTab·OutputTab을 그대로 렌더하는 잠정
            // 래퍼다(D1-6·D1-7이 v2 마크업으로 재퍼블하며 내용을 채운다).
            path: '/search',
            element: withSuspense(<SearchFlowLayout />),
            children: [
              { index: true, element: <Navigate to="/" replace /> },   // 자료검색 랜딩 제거(#3) → 홈으로
              { path: 'results', element: withSuspense(<SearchResults />) },
              { path: 'chat', element: withSuspense(<ChatView />) },
              { path: 'output', element: withSuspense(<OutputView />) },
              { path: 'output/:outputId', element: withSuspense(<OutputDetail />) },
            ],
          },
          { path: '/library', element: withSuspense(<Library />) },
          // round10 Task6 — 상세는 목록의 형제 라우트다(중첩 자식이 아니다 — OutputDetail이
          // '/search/output/:outputId'를 'output'의 평면 형제로 둔 것과 같은 결정, router.test.jsx
          // 참조). envGates.js의 접두 게이팅이 '/library'로 이미 걸려 있어 새 접두를 만들지 않는다.
          { path: '/library/:projectId', element: withSuspense(<ProjectDetail />) },
          { path: '/manage/ocr', element: withSuspense(<Ocr />) },
          { path: '/manage/meta', element: withSuspense(<Meta />) },
          { path: '/manage/embedding', element: withSuspense(<Embedding />) },
          { path: '/manage/history', element: withSuspense(<History />) },
          { path: '/manage/materials', element: withSuspense(<Materials />) },
          // 시스템관리 4탭 — /admin/*·/approvals 이관. monitoring·nodes는 기존 컴포넌트 재사용
          // (시스템관리 part가 v2 재퍼블). accounts는 Task E4가 Accounts.jsx로 교체했다 — 구
          // AccountApprovals.jsx는 A6(round06b)에서 완전히 삭제했다(어떤 라우트도 참조하지
          // 않는 고아로 06c부터 남아 있었으나, 재검증 결과 다른 소비처가 끝내 없어 제거).
          { path: '/system/monitoring', element: withSuspense(<Monitoring />) },
          { path: '/system/nodes', element: withSuspense(<Nodes />) },
          { path: '/system/accounts', element: withSuspense(<Accounts />) },
          { path: '/system/log', element: withSuspense(<Log />) },
          { path: '/account', element: withSuspense(<Account />) },
          { path: '*', element: withSuspense(<NotFound />) },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
