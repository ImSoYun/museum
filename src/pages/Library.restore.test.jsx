// round10 Task5 — 이 파일이 잠그던 계약이 바뀐다: "카드 클릭 → 시나리오 복원 →
// /search/results 이동"은 라이브러리가 mock(searchHistory)을 시나리오로 되살리던
// round06c-ext D2c 시절의 배선이었다. 이제 카드는 실제 서버 프로젝트를 열고
// (openProject) 그 결과를 들고 상세 화면(/library/:id, Task 6)으로 간다 — 시나리오
// 복원 개념 자체가 없어졌으므로 이관할 단언이 없다(scenarios.js·useScenario 어느 쪽도
// 더 이상 참조하지 않는다).
//
// 새 계약: has_password가 없는 카드는 openProject(id)를 부르고 성공(200)하면
// /library/:id로 그 응답(project·outputIds)을 state에 실어 이동한다. has_password가
// 있는 카드는 먼저 PasswordModal을 띄우고, 제출한 암호로 openProject(id, pw)를 불러
// 200이면 이동, 403이면 모달을 닫지 않고 오류만 채운다(브리프 Step4).
//
// "[이관: smoke] 저장된 카드 클릭 → 시나리오 복원 후 검색결과 본문(total-count)까지
// 렌더된다"(구 Library.smoke.test.jsx 이관분)도 같은 이유로 사라진다 — 목적지가
// SearchResults가 아니므로 그 화면까지 렌더해 검증할 이유가 없다.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import Library from './Library.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { LibraryProvider } from '../state/LibraryProvider.jsx'
import { ToastProvider } from '../components/Toast.jsx'

vi.mock('../lib/projectsApi.js', () => ({ listProjects: vi.fn(), openProject: vi.fn() }))
import { listProjects, openProject } from '../lib/projectsApi.js'

const PLAIN = {
  id: 'p2', title: '경제개발 계획 자료 정리', description: '설명', author: '한실무',
  has_password: false, output_count: 2, created_at: '2026-06-18',
}
const LOCKED = {
  id: 'p1', title: '민주화운동 관련 자료 정리', description: '설명', author: '김연구',
  has_password: true, output_count: 5, created_at: '2026-06-24',
}

// 상세 화면은 Task 6이 만든다 — 여기서는 "이 경로로 이동했고, 응답을 state로 받았다"만
// 확인하면 되므로 그 계약만 보이는 스텁으로 대신한다.
function DetailStub() {
  const { state } = useLocation()
  return <div>상세 화면 — {state?.project?.id}</div>
}

// round10 Task5 리뷰 fix — LibraryProvider가 useLocation()으로 현재 경로를 보고 정확히
// '/library'일 때만 조회한다. useLocation()은 Router 컨텍스트 안에서만 동작하므로
// MemoryRouter가 LibraryProvider의 조상이어야 한다(운영 코드의 AppShell.jsx와 같은
// 중첩 순서 — Provider가 Outlet 격인 Routes를 감싼다. 카드 클릭으로 '/library/:id'로
// 이동해도 Provider 자체는 그대로 마운트돼 있다).
function renderLibrary() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/library']}>
        <LibraryProvider>
          <ScenarioProvider>
            <Routes>
              <Route path="/library" element={<Library />} />
              <Route path="/library/:id" element={<DetailStub />} />
            </Routes>
          </ScenarioProvider>
        </LibraryProvider>
      </MemoryRouter>
    </ToastProvider>
  )
}

beforeEach(() => {
  listProjects.mockReset()
  openProject.mockReset()
  listProjects.mockResolvedValue({ ok: true, projects: [LOCKED, PLAIN], hasMore: false })
})

test('암호가 없는 카드를 클릭하면 openProject(id)를 부르고 성공 시 /library/:id로 이동한다', async () => {
  openProject.mockResolvedValue({ ok: true, status: 200, project: { id: 'p2' }, outputIds: [] })
  renderLibrary()
  fireEvent.click(await screen.findByText('경제개발 계획 자료 정리'))
  expect(openProject).toHaveBeenCalledWith('p2')
  expect(await screen.findByText('상세 화면 — p2')).toBeInTheDocument()
})

// round10 사용자 결정(2026-09-16) — 주인은 자기 프로젝트에 암호를 치지 않는다.
// 그래서 화면은 `has_password` 만 보고 모달을 먼저 띄우지 않는다. 일단 열어 보고
// 서버가 401(암호 필요)을 줄 때만 묻는다 — 누가 주인인지는 서버만 안다.
test('암호가 걸린 카드도 일단 열어 보고, 401 일 때만 암호 모달을 연다', async () => {
  openProject.mockResolvedValue({ ok: false, status: 401 })
  renderLibrary()
  fireEvent.click(await screen.findByText('민주화운동 관련 자료 정리'))
  expect(await screen.findByText('프로젝트 암호 입력')).toBeInTheDocument()
  expect(openProject).toHaveBeenCalledWith('p1')
})

test('주인이 연 잠긴 프로젝트는 암호를 묻지 않고 바로 상세로 간다', async () => {
  // 서버가 소유자로 판정해 200 을 준 경우 — has_password 가 true 여도 모달이 없다.
  openProject.mockResolvedValue({ ok: true, status: 200, project: { id: 'p1' }, outputIds: ['o1'] })
  renderLibrary()
  fireEvent.click(await screen.findByText('민주화운동 관련 자료 정리'))
  expect(await screen.findByText('상세 화면 — p1')).toBeInTheDocument()
  expect(screen.queryByText('프로젝트 암호 입력')).not.toBeInTheDocument()
  expect(openProject).toHaveBeenCalledTimes(1)
})

test('암호 제출이 맞으면 openProject(id, 암호)를 부르고 상세로 이동한다', async () => {
  openProject
    .mockResolvedValueOnce({ ok: false, status: 401 })      // 주인이 아니다 → 묻는다
    .mockResolvedValue({ ok: true, status: 200, project: { id: 'p1' }, outputIds: ['o1'] })
  renderLibrary()
  fireEvent.click(await screen.findByText('민주화운동 관련 자료 정리'))
  fireEvent.change(await screen.findByPlaceholderText('암호를 입력하세요'), { target: { value: '1234' } })
  fireEvent.click(screen.getByText('네'))
  expect(openProject).toHaveBeenCalledWith('p1', '1234')
  expect(await screen.findByText('상세 화면 — p1')).toBeInTheDocument()
})

test('암호가 틀리면(403) 모달을 닫지 않고 "암호가 맞지 않습니다"를 보여준다', async () => {
  openProject
    .mockResolvedValueOnce({ ok: false, status: 401 })      // 첫 시도 — 암호를 묻는다
    .mockResolvedValue({ ok: false, status: 403 })          // 제출한 암호가 틀렸다
  renderLibrary()
  fireEvent.click(await screen.findByText('민주화운동 관련 자료 정리'))
  fireEvent.change(await screen.findByPlaceholderText('암호를 입력하세요'), { target: { value: '0000' } })
  fireEvent.click(screen.getByText('네'))
  expect(await screen.findByText('암호가 맞지 않습니다')).toBeInTheDocument()
  expect(screen.getByText('프로젝트 암호 입력')).toBeInTheDocument()
  expect(screen.queryByText(/상세 화면/)).not.toBeInTheDocument()
})

test('"아니오" 클릭 시 모달이 닫히고 어디로도 이동하지 않는다', async () => {
  openProject.mockResolvedValue({ ok: false, status: 401 })
  renderLibrary()
  fireEvent.click(await screen.findByText('민주화운동 관련 자료 정리'))
  await screen.findByText('프로젝트 암호 입력')
  fireEvent.click(screen.getByText('아니오'))
  await waitFor(() => expect(screen.queryByText('프로젝트 암호 입력')).not.toBeInTheDocument())
  // 암호를 실은 두 번째 호출은 없다 — 첫 탐색 호출 하나뿐이다.
  expect(openProject).toHaveBeenCalledTimes(1)
  expect(openProject).toHaveBeenCalledWith('p1')
  expect(screen.queryByText(/상세 화면/)).not.toBeInTheDocument()
})

test('열람 실패는 조용히 삼키지 않고 토스트로 알린다(코딩표준 §6)', async () => {
  openProject.mockResolvedValue({ ok: false, status: 0 })
  renderLibrary()
  fireEvent.click(await screen.findByText('경제개발 계획 자료 정리'))
  expect(await screen.findByRole('status')).toHaveTextContent('프로젝트를 열지 못했습니다')
})
