// round10 Task5 — 이 파일은 원래 "'산출물 N건' 카운트 버튼 클릭 → /search/output
// 딥링크"(round06c-ext D1-2 형제 라우트 재편분)를 잠갔다. 그 딥링크 자체가 이번
// 라운드에서 사라진다 — 카드에는 이제 목적지가 하나뿐이다(has_password에 따라
// PasswordModal을 거치거나 곧장 /library/:id로). 산출물 수는 그 상세 화면 안에서 볼
// 것이므로 라이브러리 카드에서 따로 이동할 곳이 아니고, 그래서 더 이상 버튼이 아니라
// 카드의 표시값일 뿐이다.
//
// 옮길 수 있는 단언 → 상세 계약으로 옮겨 적는다(지우지 않고 여기 기록만 남긴다. 실행은
// Task 6의 상세 화면 테스트가 맡는다):
//  - "산출물 N건" 형식의 표시(과거 접근성 이름 문구)는 상세 화면에서도 그대로 쓰는 것이
//    자연스럽다 — Task 6은 project.output_count를 그 형식으로 보여줄지 검토할 것.
//  - "카드 딥링크는 대화를 함께 실어야 한다"(round07g)는 조건은 사라진다 — 상세 화면은
//    conversation_id가 아니라 project_id로 조회하므로 "두고 온 대화" 개념 자체가
//    적용되지 않는다. 상세 화면은 openProject가 이미 돌려준 project·outputIds를 그대로
//    쓰면 되고(아래 첫 테스트), 별도로 대화를 실어 나를 필요가 없다.
//
// 옮길 수 없어서 지우는 것과 이유:
//  - round07g "대화가 있는 프로젝트는 ?c=로 실어 보낸다" describe 블록 전체 — 이 테스트가
//    쓰던 `useLibrary().addProject`(로컬 목록에 항목을 주입하는 mock 전용 변이 액션)가
//    Task5의 새 useLibrary() 계약({projects, loading, error, query, setQuery, page,
//    setPage, hasMore, reload})에서 완전히 빠졌다 — 프로젝트는 이제 서버가 유일한
//    정본이라 클라이언트가 로컬로 항목을 지어 넣을 방법 자체가 없다. 재현할 도구가
//    없으므로 지운다.
//  - "카드 본문 클릭 시에는 검색결과 라우트로 이동" — 목적지가 더 이상 /search/results가
//    아니다(Library.restore.test.jsx가 새 목적지 /library/:id를 잠근다).
//  - "공유 카운트 클릭은 준비중 토스트만" — 공유(shared) 카운트 UI 자체가 사라졌다(서버
//    프로젝트 응답에 그 필드가 없다 — Library.test.jsx 머리주석 참조).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import Library from './Library.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { LibraryProvider } from '../state/LibraryProvider.jsx'
import { ToastProvider } from '../components/Toast.jsx'

vi.mock('../lib/projectsApi.js', () => ({ listProjects: vi.fn(), openProject: vi.fn() }))
import { listProjects, openProject } from '../lib/projectsApi.js'

const PROJECT = {
  id: 'p1', title: '민주화운동 관련 자료 정리', description: '설명', author: '김연구',
  has_password: false, output_count: 5, created_at: '2026-06-24',
}

function DetailStub() {
  const { state } = useLocation()
  return <div data-testid="detail-state">{JSON.stringify(state)}</div>
}

// round10 Task5 리뷰 fix — LibraryProvider가 useLocation()으로 현재 경로를 보고 정확히
// '/library'일 때만 조회한다. useLocation()은 Router 컨텍스트 안에서만 동작하므로,
// createMemoryRouter의 route element 안(= RouterProvider가 실제로 렌더하는 트리 내부)에
// LibraryProvider를 둔다 — 이전처럼 RouterProvider 밖(조상)에 두면 Router 컨텍스트가
// 없어 useLocation()이 던진다. DetailStub은 useLibrary()를 쓰지 않으므로 감쌀 필요가
// 없다(상세 화면은 목록 조회가 필요 없다는 계약과도 맞는다).
function renderLibrary() {
  const router = createMemoryRouter(
    [
      { path: '/library', element: <LibraryProvider><Library /></LibraryProvider> },
      { path: '/library/:id', element: <DetailStub /> },
    ],
    { initialEntries: ['/library'] },
  )
  render(
    <ToastProvider>
      <ScenarioProvider>
        <RouterProvider router={router} />
      </ScenarioProvider>
    </ToastProvider>
  )
  return router
}

beforeEach(() => {
  listProjects.mockReset()
  openProject.mockReset()
  listProjects.mockResolvedValue({ ok: true, projects: [PROJECT], hasMore: false })
})

test('상세로 넘어갈 때 방금 받은 openProject 응답을 state로 함께 싣는다(같은 요청을 두 번 하지 않게)', async () => {
  openProject.mockResolvedValue({
    ok: true, status: 200,
    project: { id: 'p1', title: PROJECT.title },
    outputIds: ['o1', 'o2'],
  })
  const router = renderLibrary()
  fireEvent.click(await screen.findByText(PROJECT.title))
  await waitFor(() => expect(router.state.location.pathname).toBe('/library/p1'))
  const carried = JSON.parse(screen.getByTestId('detail-state').textContent)
  expect(carried.project).toEqual({ id: 'p1', title: PROJECT.title })
  expect(carried.outputIds).toEqual(['o1', 'o2'])
})

test('산출물 수는 더 이상 버튼(딥링크)이 아니다 — 카드의 표시값일 뿐이다', async () => {
  renderLibrary()
  await screen.findByText(PROJECT.title)
  expect(screen.queryByRole('button', { name: /산출물 \d+건/ })).not.toBeInTheDocument()
  const card = screen.getByText(PROJECT.title).closest('.library_card')
  expect(within(card).getByText(/산출물\s*5건/)).toBeInTheDocument()
})
