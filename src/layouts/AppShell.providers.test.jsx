import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import AppShell from './AppShell.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { useLibrary } from '../state/useLibrary.js'
import { useManage } from '../state/useManage.js'
import { useAdmin } from '../state/useAdmin.js'

// round10 Task5 — LibraryProvider가 이제 마운트 시 listProjects(서버)를 부른다. 이
// 테스트의 관심사는 "세 Provider 중첩이 살아 있는가"이지 라이브러리 데이터 내용이
// 아니므로, 목(mock)하지 않으면 매 실행 real fetch가 나가 결과를 알 수 없는 네트워크
// 오류에 기대게 된다(다른 화면 테스트들이 outputsApi.js를 목하는 것과 같은 이유).
vi.mock('../lib/projectsApi.js', () => ({
  listProjects: vi.fn().mockResolvedValue({ ok: true, projects: [], hasMore: false }),
}))

function Consumer() {
  const { projects } = useLibrary()
  const { ocr } = useManage()
  const { criteria } = useAdmin()
  return (
    <div>
      <span data-testid="lib">{projects.length}</span>
      <span data-testid="ocr">{ocr.length}</span>
      <span data-testid="adm">{criteria.length}</span>
    </div>
  )
}

test('AppShell 하위 라우트에서 세 Provider를 모두 소비할 수 있다', async () => {
  render(
    <ToastProvider>
      <ScenarioProvider>
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/x" element={<Consumer />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ScenarioProvider>
    </ToastProvider>
  )
  // listProjects 응답이 act() 밖에서 정착하지 않도록 기다린 뒤(경고 없는 깨끗한 출력)
  // 세 Provider 모두 값을 내려주는지 확인한다 — 위 목이 빈 배열을 주므로 '0'이 맞다.
  await waitFor(() => expect(screen.getByTestId('lib').textContent).toBe('0'))
  expect(screen.getByTestId('ocr').textContent).toBe('23')
  expect(screen.getByTestId('adm').textContent).toBe('10')
})
