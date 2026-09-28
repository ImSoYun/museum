/**
 * AuthContext.test.jsx — round06c F1 (spec §9.1·§9.5, C-D2/C-D3).
 *
 * BASE(=isLive)는 searchApi.js가 모듈 로드 시 import.meta.env.VITE_API_BASE_URL을 한 번만
 * 읽으므로, 라이브 시나리오는 vi.stubEnv → vi.resetModules → 동적 import 순서를 지킨다
 * (searchApi.test.js·ScenarioContext.test.jsx와 동일 관행).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

function AuthProbe({ useAuthHook }) {
  const { user, status } = useAuthHook()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="username">{user?.username ?? ''}</span>
      <span data-testid="role">{user?.role ?? ''}</span>
    </div>
  )
}

describe('AuthProvider — 기본(!isLive, C-D3 데모 authed)', () => {
  test('부팅 fetch 없이 즉시 authed + 데모 사용자로 렌더된다', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn()
    const { AuthProvider, useAuth, DEMO_MOCK_USER } = await import('./AuthContext.jsx')
    render(
      <AuthProvider>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('authed')
    expect(screen.getByTestId('username').textContent).toBe(DEMO_MOCK_USER.username)
    expect(screen.getByTestId('role').textContent).toBe(DEMO_MOCK_USER.role)
    // C-D3: !isLive()면 GET /auth/me를 아예 부르지 않는다(데모/테스트에서 act 경고·네트워크 없음)
    expect(global.fetch).not.toHaveBeenCalled()
    global.fetch = originalFetch
  })

  test('useAuth()는 Provider 밖에서도 안전하다(기본값)', async () => {
    const { useAuth, DEMO_MOCK_USER } = await import('./AuthContext.jsx')
    render(<AuthProbe useAuthHook={useAuth} />)
    expect(screen.getByTestId('status').textContent).toBe('authed')
    expect(screen.getByTestId('username').textContent).toBe(DEMO_MOCK_USER.username)
  })
})

describe('AuthProvider — seed prop(테스트 시드 override)', () => {
  test('seed={{user:null, status:"anon"}}로 anon을 직접 시드할 수 있다', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn()
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    render(
      <AuthProvider seed={{ user: null, status: 'anon' }}>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('anon')
    expect(screen.getByTestId('username').textContent).toBe('')
    // seed가 있으면 부팅 fetch도 건너뛴다(isLive 여부와 무관)
    expect(global.fetch).not.toHaveBeenCalled()
    global.fetch = originalFetch
  })

  test('seed={{user:{...role:"사용자"}}}로 특정 role을 시드할 수 있다', async () => {
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    render(
      <AuthProvider seed={{ user: { username: 'u1', role: '사용자' } }}>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('authed')
    expect(screen.getByTestId('role').textContent).toBe('사용자')
  })

  test('AuthContext.Provider 직접 주입으로 login/logout까지 완전히 mock할 수 있다', async () => {
    const { AuthContext, useAuth } = await import('./AuthContext.jsx')
    const mockLogin = vi.fn()
    render(
      <AuthContext.Provider value={{ user: { username: 'mock' }, status: 'authed', login: mockLogin, logout: vi.fn() }}>
        <AuthProbe useAuthHook={useAuth} />
      </AuthContext.Provider>,
    )
    expect(screen.getByTestId('username').textContent).toBe('mock')
  })
})

describe('AuthProvider — 라이브 모드(isLive, GET /auth/me 부팅)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  test('200(bare user summary) → authed로 전환된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 1, username: 'kim', role: '관리자' }),
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    render(
      <AuthProvider>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('loading')
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authed'))
    expect(screen.getByTestId('username').textContent).toBe('kim')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('401 → anon으로 전환된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    render(
      <AuthProvider>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anon'))
    expect(screen.getByTestId('username').textContent).toBe('')
  })

  test('네트워크 오류(fetch reject) → anon으로 전환된다', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    render(
      <AuthProvider>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anon'))
  })

  test('round06e — 부팅 시 /auth/me 의 app_env·search_modes_enabled 를 컨텍스트에 보관한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({
        id: 1, username: 'a', role: '사용자', status: 'approved', is_root: false,
        app_env: 'prod', search_modes_enabled: false,
      }),
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function Probe() { ctx = useAuth(); return null }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(ctx.appEnv).toBe('prod'))
    expect(ctx.searchModesEnabled).toBe(false)
  })

  test('/auth/me 200 응답에 app_env가 없으면(버전 스큐) console.warn으로 침묵 실패를 알린다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 1, username: 'kim', role: '사용자' }), // app_env 없음
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function Probe() { ctx = useAuth(); return null }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(ctx.status).toBe('authed'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/auth/me'))
    warnSpy.mockRestore()
  })
})

describe('login() — round06e 최종 리뷰 F1(부팅 401 → 로그인 경로에서 appEnv가 무력화되던 결함)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  test('부팅 401(비로그인) 후 login() 성공 시 응답에 실린 app_env·search_modes_enabled가 즉시 반영된다', async () => {
    // 운영의 지배적 경로: 세션 쿠키 없는 방문자 → 부팅 GET /auth/me 401 → RequireAuth →
    // 로그인 화면 → 로그인 성공. navigate()는 리로드가 없으므로 부팅 effect가 재실행되지
    // 않는다 — appEnv는 오직 login() 응답에서만 얻을 수 있다.
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ status: 401, json: () => Promise.resolve({}) }) // 부팅 GET /auth/me
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({
          user: { id: 1, username: 'kim', role: '관리자' },
          app_env: 'prod',
          search_modes_enabled: false,
        }),
      })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function Probe() { ctx = useAuth(); return null }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(ctx.status).toBe('anon')) // 부팅 401 완료 대기
    expect(ctx.appEnv).toBeNull() // 결함 재현: 부팅 401만으로는 appEnv가 여전히 null

    await act(async () => { await ctx.login('kim', 'pw') })

    expect(ctx.status).toBe('authed')
    expect(ctx.appEnv).toBe('prod')
    expect(ctx.searchModesEnabled).toBe(false)
  })

  test('login() 응답에 app_env가 없으면(버전 스큐) console.warn으로 침묵 실패를 알린다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ user: { id: 1, username: 'kim', role: '사용자' } }), // app_env 없음
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function Probe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: null, status: 'anon' }}>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => { await ctx.login('kim', 'pw') })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/auth/login'))
    warnSpy.mockRestore()
  })
})

describe('login()', () => {
  test('200 성공: { user } 래핑을 벗겨 authed로 전환하고 user를 반환한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ user: { id: 1, username: 'kim', role: '사용자' } }),
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function LoginProbe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: null, status: 'anon' }}>
        <LoginProbe />
      </AuthProvider>,
    )
    let resolved
    await act(async () => { resolved = await ctx.login('kim', 'pw') })
    expect(resolved).toEqual({ id: 1, username: 'kim', role: '사용자' })
    expect(ctx.status).toBe('authed')
    expect(ctx.user.username).toBe('kim')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ login_id: 'kim', login_pw: 'pw' }),
      }),
    )
  })

  test('401(자격불일치): status+detail을 담은 Error를 throw하고 상태는 anon 그대로다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      json: () => Promise.resolve({ detail: '아이디 또는 비밀번호가 올바르지 않습니다' }),
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function LoginProbe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: null, status: 'anon' }}>
        <LoginProbe />
      </AuthProvider>,
    )
    await expect(ctx.login('kim', 'wrong')).rejects.toMatchObject({
      status: 401,
      detail: '아이디 또는 비밀번호가 올바르지 않습니다',
    })
    expect(ctx.status).toBe('anon')
  })

  test('403(승인대기 등): status+detail을 담은 Error를 throw한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 403,
      json: () => Promise.resolve({ detail: '승인 대기 중인 계정입니다' }),
    })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function LoginProbe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: null, status: 'anon' }}>
        <LoginProbe />
      </AuthProvider>,
    )
    await expect(ctx.login('kim', 'pw')).rejects.toMatchObject({ status: 403, detail: '승인 대기 중인 계정입니다' })
  })
})

describe('logout()', () => {
  test('성공 시 anon으로 전환된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function LogoutProbe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: { username: 'kim' }, status: 'authed' }}>
        <LogoutProbe />
      </AuthProvider>,
    )
    await act(async () => { await ctx.logout() })
    expect(ctx.status).toBe('anon')
    expect(ctx.user).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST', credentials: 'include' }))
  })

  test('네트워크 실패여도 클라 상태는 anon으로 정리된다(finally)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'))
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function LogoutProbe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: { username: 'kim' }, status: 'authed' }}>
        <LogoutProbe />
      </AuthProvider>,
    )
    await act(async () => { await ctx.logout().catch(() => {}) })
    expect(ctx.status).toBe('anon')
  })
})

describe('401 인터셉트(authEvents) — searchApi/chatApi가 401을 만나면 anon으로 전환', () => {
  test('notifyUnauthorized() 호출 시 authed에서 anon으로 전환된다', async () => {
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    const { notifyUnauthorized } = await import('../lib/authEvents.js')
    render(
      <AuthProvider seed={{ user: { username: 'kim' }, status: 'authed' }}>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('authed')
    act(() => { notifyUnauthorized() })
    expect(screen.getByTestId('status').textContent).toBe('anon')
  })
})

// ── round10a 최종리뷰 I-3 — clearOpenedProjects() 를 계정 경계에서 실제로 부른다 ──
// openedProjects.js 머리주석은 "로그아웃·세션 만료 경로가 부르는 clearOpenedProjects()로
// 통째로 비운다(AuthProvider가 배선한다)"고 적어 왔는데, 전수 검색 결과 호출부는 테스트
// (ProjectDetail.test.jsx의 beforeEach)뿐이고 이 파일에는 import조차 없었다. SPA 내
// 로그아웃→다른 계정 로그인은 페이지를 다시 읽지 않으므로(RequireAuth.jsx의 <Navigate>)
// 모듈 메모리가 남아, 앞 사람이 연 프로젝트가 다음 사람에게 그대로 열릴 수 있었다.
describe('clearOpenedProjects 배선(round10a 최종리뷰 I-3) — 계정 경계에서 열람 프로젝트 기억을 비운다', () => {
  test('logout() 은 이번 방문에서 기억해 둔 프로젝트를 함께 비운다', async () => {
    const { rememberOpenedProject, recallOpenedProject } = await import('../state/openedProjects.js')
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    let ctx
    function LogoutProbe() { ctx = useAuth(); return null }
    render(
      <AuthProvider seed={{ user: { username: 'kim' }, status: 'authed' }}>
        <LogoutProbe />
      </AuthProvider>,
    )
    rememberOpenedProject('p1', { id: 'p1', title: '앞 사람이 연 프로젝트' })
    expect(recallOpenedProject('p1')).not.toBeNull()

    await act(async () => { await ctx.logout() })

    expect(recallOpenedProject('p1')).toBeNull()
  })

  test('401 인터셉트(notifyUnauthorized)도 같은 계정 경계다 — 세션이 끊기면 함께 비운다', async () => {
    const { rememberOpenedProject, recallOpenedProject } = await import('../state/openedProjects.js')
    const { AuthProvider, useAuth } = await import('./AuthContext.jsx')
    const { notifyUnauthorized } = await import('../lib/authEvents.js')
    render(
      <AuthProvider seed={{ user: { username: 'kim' }, status: 'authed' }}>
        <AuthProbe useAuthHook={useAuth} />
      </AuthProvider>,
    )
    rememberOpenedProject('p2', { id: 'p2', title: '세션이 끊기기 전에 연 프로젝트' })
    expect(recallOpenedProject('p2')).not.toBeNull()

    act(() => { notifyUnauthorized() })

    expect(recallOpenedProject('p2')).toBeNull()
  })
})
