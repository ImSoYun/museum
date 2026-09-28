/**
 * 이 파일의 책임: EnvGate(round06f 갈래 E, spec §10.1)의 분기 계약.
 *
 * AppShell.envgate.test.jsx와 무엇이 다른가 — 저쪽은 "셸이 <Outlet>을 통째로 바꾸는가"를
 * 보고, 이 파일은 "탭줄 안쪽 본문만 바뀌는가"를 본다. 게이트가 두 계층이 된 뒤로
 * 두 질문은 서로 다른 답을 갖는다(/system/* 는 셸이 막지 않고 페이지가 막는다).
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext.jsx'
import EnvGate from './EnvGate.jsx'

// appEnv를 명시 주입한다. AuthProvider를 쓰지 않는 이유는 seed가 appEnv를 지원하지
// 않기 때문이다(SystemTabs.test.jsx·Lnb.test.jsx와 같은 관행).
function renderAt(path, appEnv) {
  return render(
    <AuthContext.Provider value={{ appEnv }}>
      <MemoryRouter initialEntries={[path]}>
        <EnvGate><div>실제본문</div></EnvGate>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

test('prod: 숨김 경로에서는 children 대신 준비중 화면판이 나온다', () => {
  renderAt('/system/monitoring', 'prod')
  expect(screen.queryByText('실제본문')).toBeNull()
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(screen.getByText('빠른 시일 내에 서비스할 예정입니다.')).toBeInTheDocument()
})

test('prod: /search/output도 숨김 경로다(검색플로우 탭줄 안쪽에서 쓰인다)', () => {
  renderAt('/search/output', 'prod')
  expect(screen.queryByText('실제본문')).toBeNull()
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
})

test('prod: 숨김 대상이 아닌 경로는 children을 그대로 통과시킨다', () => {
  renderAt('/system/accounts', 'prod')
  expect(screen.getByText('실제본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

test('local: 같은 경로여도 아무것도 숨기지 않는다', () => {
  renderAt('/system/monitoring', 'local')
  expect(screen.getByText('실제본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

test('appEnv 미정(부팅 중 null·dev)에서도 통과시킨다 — fail-open이 이 게이트의 계약이다', () => {
  renderAt('/system/monitoring', null)
  expect(screen.getByText('실제본문')).toBeInTheDocument()
  renderAt('/system/monitoring', 'dev')
  expect(screen.getAllByText('실제본문')).toHaveLength(2)
})

test('AuthContext Provider 밖에서도 죽지 않는다 — useAuth 폴백이 local이라 통과시킨다', () => {
  render(
    <MemoryRouter initialEntries={['/system/monitoring']}>
      <EnvGate><div>실제본문</div></EnvGate>
    </MemoryRouter>
  )
  expect(screen.getByText('실제본문')).toBeInTheDocument()
})
