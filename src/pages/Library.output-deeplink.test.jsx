/**
 * Library.output-deeplink.test.jsx — round10 Task5 이전에는 "라이브러리 '산출물 N건' →
 * 산출물 화면(/search/output)" 통합 커버리지였다(실제 routes 테이블 위에서 셸·탭·
 * OutputTab 렌더까지 검증했다, round06c-ext 리뷰 C2).
 *
 * 그 딥링크 자체가 이번 라운드에서 없어진다 — Library.deeplink.test.jsx 머리주석 참조.
 * 카드의 유일한 목적지는 이제 /library/:id(Task 6이 만들 상세 화면)이고, has_password
 * 여부에 따라 PasswordModal을 거칠 뿐이다.
 *
 * 옮길 수 있는 것 → 상세 계약으로 옮겨 적는다(실행은 Task 6 몫):
 *  - "실제 routes 테이블 위에서 셸(LNB)이 그대로 유지된 채 상세 화면이 렌더된다"는
 *    이 파일의 핵심 가치였다 — Task 6의 상세 화면 테스트도 스텁 라우트가 아니라 실제
 *    routes(router.jsx)로 검증하는 편이 "그 경로가 앱에 정말 존재하는가"까지 함께 본다.
 *  - round07g "대화 격리"(직전 대화의 산출물이 다른 프로젝트에 새는 결함) 자체는 상세
 *    화면에 적용되지 않는다 — 상세는 conversation_id가 아니라 project_id로 조회하므로
 *    "두고 온 대화"라는 개념이 성립하지 않는다(Library.deeplink.test.jsx 머리주석과 동일
 *    결론). Task 6은 이 격리를 다시 걱정할 필요가 없다.
 *
 * 옮길 수 없어서 지우는 것과 이유:
 *  - OutputTab·SearchFlowLayout·「산출물생성」 탭 렌더 검증 전체 — 목적지가 그 화면이
 *    아니므로 검증 대상 자체가 사라졌다.
 *  - round07g `ConversationProbe`/`listOutputs` 목 기반 시나리오 전체 — 라이브러리 카드가
 *    더 이상 대화(conversationId)를 이동에 실어 보내지 않으므로(project_id만 싣는다)
 *    재현할 조건이 없다.
 *
 * 남기는 것: 이 파일만이 가졌던 "실제 routes 테이블 위에서" 라는 강점을 살려, 옛
 * 딥링크(/search/output)가 정말 사라졌는지를 실제 셸 통합으로 회귀 감시한다.
 *
 * round10 Task6 갱신 — router.jsx에 '/library/:projectId'가 실제로 등록됐으므로, 아래
 * 마지막 테스트를 예고대로 "404" 단언에서 "상세 화면이 렌더된다" 단언으로 바꾼다.
 * 상세 화면 자체의 세부 계약(머리·3탭·읽기 전용 안내 등)은 ProjectDetail.test.jsx가
 * 촘촘히 잠근다 — 여기서는 "실제 routes 테이블 위에서 그 화면이 정말 붙는가"만 본다.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { routes } from '../router.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { ToastProvider } from '../components/Toast.jsx'

vi.mock('../lib/projectsApi.js', () => ({ listProjects: vi.fn(), openProject: vi.fn() }))
import { listProjects, openProject } from '../lib/projectsApi.js'

const PROJECT = {
  id: 'p1', title: '경제개발 계획 자료 정리', description: '설명', author: '한실무',
  has_password: false, output_count: 2, created_at: '2026-06-18',
}

// round10 Task5 리뷰 fix — 이 파일이 렌더하는 routes(router.jsx)는 AppShell을 통해
// 이미 자체 LibraryProvider를 갖고 있다(layouts/AppShell.jsx:78). 이 테스트가 별도로
// 얹던 <LibraryProvider>는 RouterProvider "밖"(조상)이라 useLibrary()를 쓰는
// Library.jsx에게는 어차피 안쪽(AppShell) 것이 우선이라 원래도 무의미했다 — 그리고
// LibraryProvider가 이제 useLocation()을 쓰므로 Router 컨텍스트 밖에 두면 그 자체로
// 던진다. 죽은 이중 wrap을 걷어낸다.
function renderApp(entry) {
  const router = createMemoryRouter(routes, { initialEntries: [entry] })
  render(
    <ToastProvider>
      <ScenarioProvider>
        <RouterProvider router={router} />
      </ScenarioProvider>
    </ToastProvider>,
  )
  return router
}

beforeEach(() => {
  listProjects.mockReset()
  openProject.mockReset()
  listProjects.mockResolvedValue({ ok: true, projects: [PROJECT], hasMore: false })
  openProject.mockResolvedValue({ ok: true, status: 200, project: PROJECT, outputIds: [] })
})

// round06b B4 — Library.jsx가 React.lazy로 스플리팅되어 마운트 직후엔 Suspense
// fallback뿐이다 — findByText로 청크 로드를 기다린다.
test('라이브러리 카드 클릭은 더 이상 /search/output 으로 보내지 않는다(옛 딥링크 회귀 감시)', async () => {
  const router = renderApp('/library')

  fireEvent.click(await screen.findByText(PROJECT.title))

  await waitFor(() => expect(router.state.location.pathname).not.toBe('/library'))
  expect(router.state.location.pathname).not.toBe('/search/output')
  expect(router.state.location.pathname).not.toBe('/search/results')
  // 셸(LNB)은 라우트가 바뀌어도 그대로 남아 있다 — AppShell이 언마운트되지 않았다는 뜻.
  expect(screen.getByRole('navigation', { name: '주요메뉴' })).toBeInTheDocument()
})

test('카드 클릭은 실제 routes 테이블에서 프로젝트 상세 화면(/library/:id)으로 이어진다', async () => {
  const router = renderApp('/library')
  fireEvent.click(await screen.findByText(PROJECT.title))
  await waitFor(() => expect(router.state.location.pathname).toBe('/library/p1'))
  // 목록 클릭이 openProject 응답을 state로 실어 보내므로(Library.jsx openDetail), 상세는
  // 같은 요청을 다시 하지 않고 곧장 제목을 그린다 — ProjectDetail.test.jsx가 머리·탭·
  // 안내문 세부는 이미 촘촘히 잠갔으므로 여기서는 "셸 위에서 실제로 붙는가"만 본다.
  expect(await screen.findByText(PROJECT.title)).toBeInTheDocument()
  // 셸(LNB)은 그대로 유지된다.
  expect(screen.getByRole('navigation', { name: '주요메뉴' })).toBeInTheDocument()
})
