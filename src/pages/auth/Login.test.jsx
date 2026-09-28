import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext.jsx'
import Login from './Login.jsx'

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="pathname">{pathname}</div>
}

// AuthContext.Provider 직접 주입 — RequireAuth.test.jsx와 동일 관행(login/logout까지
// 완전히 mock으로 갈아끼운다). login 기본값은 아무 것도 하지 않는 async no-op이고,
// 각 테스트가 필요한 만큼만 override한다.
const renderLogin = (authOverrides = {}) =>
  render(
    <AuthContext.Provider value={{ user: null, status: 'anon', login: async () => {}, logout: async () => {}, ...authOverrides }}>
      <MemoryRouter initialEntries={['/login']}>
        <Login />
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>
  )

test('login: 눈아이콘 토글이 type·aria-pressed·aria-label 세 값을 함께 뒤집는다', () => {
  renderLogin()
  // 퍼블 클래스 실사용(D14)
  expect(document.querySelector('.form_input_box')).not.toBeNull()

  expect(document.getElementById('login_pw')).toHaveAttribute('type', 'password')
  const off = screen.getByRole('button', { name: '비밀번호 표시' })
  expect(off).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(off)
  expect(document.getElementById('login_pw')).toHaveAttribute('type', 'text')
  const on = screen.getByRole('button', { name: '비밀번호 숨기기' })
  expect(on).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(on)
  expect(document.getElementById('login_pw')).toHaveAttribute('type', 'password')
  expect(screen.getByRole('button', { name: '비밀번호 표시' }))
    .toHaveAttribute('aria-pressed', 'false')
})

test('login: 하단 링크는 회원가입 → /join, 아이디·비밀번호 찾기 → /find', () => {
  renderLogin()
  expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/join')
  expect(screen.getByRole('link', { name: '아이디·비밀번호 찾기' })).toHaveAttribute('href', '/find')
})

test('login: 제출 성공 시 login(id, pw)을 호출하고 홈("/")으로 이동한다', async () => {
  const login = vi.fn().mockResolvedValue({ id: 1, username: 'kim' })
  renderLogin({ login })

  fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'kim' } })
  fireEvent.change(document.getElementById('login_pw'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/'))
  expect(login).toHaveBeenCalledWith('kim', 'secret123')
})

test('login: 401(자격 불일치) 시 안내 문구를 보여주고 라우트는 그대로다', async () => {
  const login = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 401, detail: '아이디 또는 비밀번호가 올바르지 않습니다' }))
  renderLogin({ login })

  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect(await screen.findByText('아이디 또는 비밀번호를 확인하세요')).toBeInTheDocument()
  expect(screen.getByTestId('pathname').textContent).toBe('/login')
})

test('login: 403(pending) 시 승인 대기 안내를 로그인 흐름 안에서 보여준다(별도 라우트 아님)', async () => {
  const login = vi.fn().mockRejectedValue(Object.assign(new Error('pending'), { status: 403, detail: '가입 승인 대기 중인 계정입니다' }))
  renderLogin({ login })

  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect(await screen.findByText('승인 대기 중입니다')).toBeInTheDocument()
  // 라우트 신설이 아니라 로그인 흐름 내 상태다 — 여전히 /login이고 폼도 그대로 남아 있다.
  expect(screen.getByTestId('pathname').textContent).toBe('/login')
  expect(document.getElementById('login_id')).not.toBeNull()
})

test('login: 403(rejected) 시 거부 안내를 보여준다', async () => {
  const login = vi.fn().mockRejectedValue(Object.assign(new Error('rejected'), { status: 403, detail: '가입이 거절된 계정입니다' }))
  renderLogin({ login })

  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect(await screen.findByText('가입이 거부되었습니다')).toBeInTheDocument()
})

test('login: 403(disabled) 시 비활성화 안내를 보여준다', async () => {
  const login = vi.fn().mockRejectedValue(Object.assign(new Error('disabled'), { status: 403, detail: '비활성화된 계정입니다' }))
  renderLogin({ login })

  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect(await screen.findByText('계정이 비활성화되었습니다')).toBeInTheDocument()
})
