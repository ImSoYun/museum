import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { vi } from 'vitest'
import { LibraryProvider } from './LibraryProvider.jsx'
import { useLibrary } from './useLibrary.js'

// round10 Task5 — mock 리듀서(useReducer + data/searchHistory.js)를 걷어내고
// listProjects(lib/projectsApi.js, Task4 완성)를 부르는 서버 연결로 바꾼다. 옛 계약
// (addProject/renameProject/removeProject/setEncryption/updateShare로 로컬 배열을
// 조작)은 전부 사라진다 — 프로젝트는 이제 서버가 유일한 정본이고, 이 Provider는
// 그 목록을 조회·페이지·검색어로만 다시 부른다.
//
// round10 Task5 리뷰 fix — LibraryProvider가 useLocation()으로 현재 경로를 보고
// 정확히 '/library'(목록 화면)일 때만 조회하도록 바뀌었다(AppShell.jsx가 모든 라우트를
// 이 Provider로 감싸므로, 게이트가 없으면 라이브러리와 무관한 화면에서도 매번 버려질
// /projects 요청이 나간다). useLocation()은 Router 컨텍스트 안에서만 동작하므로,
// 이 파일의 render는 반드시 MemoryRouter로 감싼다(이전에는 Provider가 라우팅을 몰라도
// 됐으니 감싸지 않았다).
vi.mock('../lib/projectsApi.js', () => ({ listProjects: vi.fn() }))
import { listProjects } from '../lib/projectsApi.js'

const FIXTURE = [
  { id: 'p1', title: '민주화운동 자료', description: '설명1', author: '김연구', has_password: true, output_count: 5, created_at: '2026-06-24' },
  { id: 'p2', title: '경제개발 자료', description: '설명2', author: '한실무', has_password: false, output_count: 2, created_at: '2026-06-18' },
]

function Probe() {
  const nav = useNavigate()
  const { projects, loading, error, query, setQuery, page, setPage, hasMore, reload } = useLibrary()
  return (
    <div>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="query">{query}</span>
      <span data-testid="page">{page}</span>
      <span data-testid="hasMore">{String(hasMore)}</span>
      <button onClick={() => setQuery('민주화')}>검색</button>
      <button onClick={() => setPage(1)}>다음페이지</button>
      <button onClick={() => reload()}>새로고침</button>
      <button onClick={() => nav('/library')}>목록으로</button>
      <button onClick={() => nav('/library/p1')}>상세로</button>
      <button onClick={() => nav('/search')}>다른화면으로</button>
    </div>
  )
}

// initialEntries 기본값 '/library' — 기존 6건(마운트·검색·페이지·실패·hasMore·reload)은
// 전부 "목록 화면에 떠 있다"를 전제로 짠 테스트라, 게이트가 늘 열려 있어야 옛 단언이
// 그대로 성립한다. 게이트 자체(경로별 분기)는 아래 별도 describe가 잠근다.
function renderProbe(initialEntries = ['/library']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LibraryProvider><Probe /></LibraryProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  listProjects.mockReset()
  listProjects.mockResolvedValue({ ok: true, projects: FIXTURE, hasMore: false })
})

test('마운트하면 listProjects 를 부르고 그 결과를 담는다', async () => {
  renderProbe()
  expect(screen.getByTestId('loading')).toHaveTextContent('true')
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
  expect(listProjects).toHaveBeenCalledWith({ q: '', limit: 20, offset: 0 })
  expect(screen.getByTestId('count')).toHaveTextContent('2')
  expect(screen.getByTestId('error')).toHaveTextContent('')
})

test('검색어를 바꾸면 그 q 로 다시 부르고 페이지를 1페이지로 되돌린다', async () => {
  renderProbe()
  await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByText('다음페이지'))
  await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('1'))
  listProjects.mockClear()
  fireEvent.click(screen.getByText('검색'))
  await waitFor(() => expect(listProjects).toHaveBeenCalledWith({ q: '민주화', limit: 20, offset: 0 }))
  expect(screen.getByTestId('page')).toHaveTextContent('0')
})

test('페이지를 바꾸면 offset 을 반영해 다시 부른다', async () => {
  renderProbe()
  await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1))
  listProjects.mockClear()
  fireEvent.click(screen.getByText('다음페이지'))
  await waitFor(() => expect(listProjects).toHaveBeenCalledWith({ q: '', limit: 20, offset: 20 }))
})

test('listProjects 가 실패하면 조용히 비우지 않고 error 를 세운다(코딩표준 §6)', async () => {
  listProjects.mockResolvedValue({ ok: false, status: 0, notice: '서버에 연결하지 못했습니다' })
  renderProbe()
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('서버에 연결하지 못했습니다'))
  expect(screen.getByTestId('count')).toHaveTextContent('0')
})

test('hasMore 를 그대로 노출한다', async () => {
  listProjects.mockResolvedValue({ ok: true, projects: FIXTURE, hasMore: true })
  renderProbe()
  await waitFor(() => expect(screen.getByTestId('hasMore')).toHaveTextContent('true'))
})

test('reload 는 같은 조건으로 다시 조회한다', async () => {
  renderProbe()
  await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByText('새로고침'))
  await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(2))
})

test('useLibrary는 Provider 밖에서 에러', () => {
  function Bare() { useLibrary(); return null }
  expect(() => render(<Bare />)).toThrow()
})

// ── 리뷰 fix: 조회를 라이브러리 목록 화면(정확히 '/library')으로 한정한다 ──────────
describe('경로 게이트 — 목록 화면일 때만 조회한다', () => {
  test('라이브러리 목록 경로가 아니면 마운트해도 listProjects 를 부르지 않는다', () => {
    renderProbe(['/search'])
    expect(listProjects).not.toHaveBeenCalled()
  })

  test('상세 경로(/library/:id)에서는 부르지 않는다 — startsWith 로 넓게 잡지 않는다(Task6 상세는 목록이 필요 없다)', () => {
    renderProbe(['/library/p1'])
    expect(listProjects).not.toHaveBeenCalled()
  })

  test('목록 화면을 떠났다가 다시 들어오면 다시 조회한다(저장 직후 새 카드가 보여야 한다)', async () => {
    renderProbe(['/library'])
    await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1))

    listProjects.mockClear()
    fireEvent.click(screen.getByText('다른화면으로'))
    // 목록 화면을 떠난 직후에는 다시 부르지 않는다.
    expect(listProjects).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('목록으로'))
    await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1))
  })
})
