import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// BASE는 모듈 로드 시 import.meta.env.VITE_API_BASE_URL을 한 번만 읽으므로,
// 값을 바꿔 테스트하려면 vi.stubEnv → vi.resetModules → 동적 import 순서를 지킨다
// (adminApi.test.js·searchApi.test.js·chatApi.test.js와 같은 관행).
//
// 이 파일이 존재하지 않던 것 자체가 결함이었다(round06e-finishing Critical #1) —
// Account.test.jsx는 authApi.js를 통째로 vi.mock해 { status: 200 }을 직접 주입하므로
// authApi.js의 실제 스프레드 로직과 백엔드의 실제 응답 바디(성공 시 {"status":"ok"})가
// 만나는 지점을 한 번도 실행하지 않았다. 아래 테스트는 그 지점을 실제 백엔드 응답
// 모양(museum/auth/routes.py)으로 직접 검증한다.

describe('changePasswordRequest — POST /auth/password (museum/auth/routes.py:195-220)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.resetModules()
  })

  test('성공(200)이면 res.status는 숫자 200이다 — 바디의 {"status":"ok"}에 덮이지 않는다(회귀 가드)', async () => {
    // 백엔드 성공 바디는 정확히 {"status": "ok"}다(routes.py:220 `return {"status": "ok"}`).
    // 이전 구현 { status: res.status, ...body }는 이 바디의 status:"ok"가 뒤에 스프레드되며
    // 숫자 200을 덮어써 res.status === 200이 "ok" === 200이 되어 항상 거짓이었다.
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    })
    const { changePasswordRequest } = await import('./authApi.js')
    const res = await changePasswordRequest({ current_password: 'old1234', new_password: 'new12345' })
    expect(res.status).toBe(200)
    expect(typeof res.status).toBe('number')
  })

  test('실패(400)이면 res.status는 400이고 res.detail에 사유가 실린다', async () => {
    // 검증 실패 바디는 {"detail": "..."}다(routes.py:204-211 HTTPException).
    global.fetch = vi.fn().mockResolvedValue({
      status: 400,
      json: () => Promise.resolve({ detail: '새 비밀번호는 8자 이상이어야 합니다' }),
    })
    const { changePasswordRequest } = await import('./authApi.js')
    const res = await changePasswordRequest({ current_password: 'old1234', new_password: 'short' })
    expect(res.status).toBe(400)
    expect(res.detail).toBe('새 비밀번호는 8자 이상이어야 합니다')
  })

  test('POST /auth/password를 credentials:"include"·JSON 바디로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ status: 'ok' }) })
    const { changePasswordRequest } = await import('./authApi.js')
    await changePasswordRequest({ current_password: 'old1234', new_password: 'new12345' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/auth/password',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: 'old1234', new_password: 'new12345' }),
      }),
    )
  })
})

describe('joinRequest — POST /auth/join (museum/auth/routes.py:96-117)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.resetModules()
  })

  test('성공(200)이면 res.status는 숫자 200이고 user를 담는다(같은 스프레드 패턴 안전 확인)', async () => {
    // join의 성공 바디는 {"user": {...}}로 status가 user 안에 중첩돼(routes.py:117
    // `return {"user": _summarize(user)}`) 최상위 status와 우연히 충돌하지 않았을 뿐이다.
    // 스프레드 순서를 changePasswordRequest와 동일하게 고쳐도 이 계약이 안전한지 확인한다.
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ user: { id: 1, username: 'kim', status: 'pending' } }),
    })
    const { joinRequest } = await import('./authApi.js')
    const res = await joinRequest({ username: 'kim', password: 'pw12345', role: '사용자' })
    expect(res.status).toBe(200)
    expect(typeof res.status).toBe('number')
    expect(res.user).toEqual({ id: 1, username: 'kim', status: 'pending' })
  })

  test('중복 아이디(409)이면 res.status는 409이고 res.detail에 사유가 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 409,
      json: () => Promise.resolve({ detail: '이미 사용 중인 아이디입니다' }),
    })
    const { joinRequest } = await import('./authApi.js')
    const res = await joinRequest({ username: 'kim', password: 'pw12345', role: '사용자' })
    expect(res.status).toBe(409)
    expect(res.detail).toBe('이미 사용 중인 아이디입니다')
  })

  test('POST /auth/join을 credentials:"include"·JSON 바디로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ user: { id: 1 } }),
    })
    const { joinRequest } = await import('./authApi.js')
    const payload = { username: 'kim', password: 'pw12345', role: '사용자' }
    await joinRequest(payload)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/auth/join',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )
  })
})
