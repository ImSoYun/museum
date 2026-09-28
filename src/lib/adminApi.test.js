import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// BASE(=isLive)는 모듈 로드 시 import.meta.env.VITE_API_BASE_URL을 한 번만 읽으므로,
// 값을 바꿔 테스트하려면 vi.stubEnv → vi.resetModules → 동적 import 순서를 지킨다
// (searchApi.test.js·chatApi.test.js와 같은 관행).

describe('adminApi — 기본(VITE_API_BASE_URL 미설정, mock 모드)', () => {
  // round06c-ext D2d — 데모 데이터가 모듈 스코프의 지연 복사 store로 바뀌어(approve·
  // reject·disable·unblock이 store를 실제로 변이한다) 테스트 간 상태가 새는 것을 막는다.
  // 이 describe 안의 모든 `await import('./adminApi.js')`는 동일한 모듈 인스턴스를
  // 가리키므로(파일 스코프에서 vi.resetModules()를 호출하지 않는 한) __resetDemoStore로
  // 매 테스트 시작 전 원본 데모 데이터로 되돌린다.
  beforeEach(async () => {
    const { __resetDemoStore } = await import('./adminApi.js')
    __resetDemoStore()
  })

  test('listUsers: status 없이 부르면 데모 전체(승인대기+활성)를 반환한다', async () => {
    const { listUsers } = await import('./adminApi.js')
    const { users } = await listUsers()
    expect(users.length).toBeGreaterThan(0)
    expect(users.some((u) => u.status === 'pending')).toBe(true)
    expect(users.some((u) => u.status === 'approved')).toBe(true)
  })

  test('listUsers("pending"): pending 상태만 반환한다', async () => {
    const { listUsers } = await import('./adminApi.js')
    const { users } = await listUsers('pending')
    expect(users.length).toBeGreaterThan(0)
    users.forEach((u) => expect(u.status).toBe('pending'))
  })

  test('listUsers("approved"): approved 상태만 반환한다', async () => {
    const { listUsers } = await import('./adminApi.js')
    const { users } = await listUsers('approved')
    expect(users.length).toBeGreaterThan(0)
    users.forEach((u) => expect(u.status).toBe('approved'))
  })

  test('listUsers: 반환된 user에 password_hash가 없다(백엔드 계약과 동형)', async () => {
    const { listUsers } = await import('./adminApi.js')
    const { users } = await listUsers()
    users.forEach((u) => expect(u).not.toHaveProperty('password_hash'))
  })

  test('approveUser: 200과 status="approved"로 갱신된 user를 반환한다', async () => {
    const { listUsers, approveUser } = await import('./adminApi.js')
    const { users } = await listUsers('pending')
    const target = users[0]
    const res = await approveUser(target.id)
    expect(res.status).toBe(200)
    expect(res.user.id).toBe(target.id)
    expect(res.user.status).toBe('approved')
  })

  test('rejectUser: 200을 반환하고 user는 돌려주지 않는다(행 DELETE 시맨틱, B6)', async () => {
    const { listUsers, rejectUser } = await import('./adminApi.js')
    const { users } = await listUsers('pending')
    const target = users[0]
    const res = await rejectUser(target.id)
    expect(res.status).toBe(200)
    expect(res.user).toBeUndefined()
  })

  test('disableUser: 200과 status="disabled"로 갱신된 user를 반환한다', async () => {
    const { listUsers, disableUser } = await import('./adminApi.js')
    const { users } = await listUsers('approved')
    const target = users[0]
    const res = await disableUser(target.id)
    expect(res.status).toBe(200)
    expect(res.user.status).toBe('disabled')
  })

  test('resetPassword: 200과 temporary_password를 1회성으로 반환한다', async () => {
    const { listUsers, resetPassword, DEMO_TEMP_PASSWORD } = await import('./adminApi.js')
    const { users } = await listUsers('approved')
    const target = users[0]
    const res = await resetPassword(target.id)
    expect(res.status).toBe(200)
    expect(res.user.id).toBe(target.id)
    expect(res.temporary_password).toBe(DEMO_TEMP_PASSWORD)
  })

  test('listAccounts({status:"disabled"}): disabled 상태만 반환한다', async () => {
    const { listAccounts } = await import('./adminApi.js')
    const { users } = await listAccounts({ status: 'disabled' })
    expect(users.length).toBeGreaterThan(0)
    users.forEach((u) => expect(u.status).toBe('disabled'))
  })

  test('listAccounts({role:"관리자"}): 관리자 역할만 반환한다', async () => {
    const { listAccounts } = await import('./adminApi.js')
    const { users } = await listAccounts({ role: '관리자' })
    expect(users.length).toBeGreaterThan(0)
    users.forEach((u) => expect(u.role).toBe('관리자'))
  })

  test('listAccounts: unblocked_at이 있는 계정은 blocked_at도 있고 그보다 이르다(F9 시각 정합)', async () => {
    // 실서버 unblock(adapters/postgres/auth.py:221-226)은 status·unblocked_at만 갱신하고
    // blocked_at은 지우지 않는다 — blocked_at:null + unblocked_at:설정 조합은 실데이터에 없다.
    const { listAccounts } = await import('./adminApi.js')
    const { users } = await listAccounts()
    const withUnblock = users.filter((u) => u.unblocked_at)
    expect(withUnblock.length).toBeGreaterThan(0)
    withUnblock.forEach((u) => {
      expect(u.blocked_at).not.toBeNull()
      expect(new Date(u.blocked_at).getTime()).toBeLessThan(new Date(u.unblocked_at).getTime())
    })
  })

  test('unblockUser: DEMO_ACCOUNTS id(401번대)로 호출해도 실제 username을 채운 user를 반환한다(F4)', async () => {
    // demoSummary가 예전엔 DEMO_USERS(301-304)만 탐색해, E4 계정·권한 화면이 실제로 쓰는
    // DEMO_ACCOUNTS(401-404) id로 부르면 빈 껍데기(username:'')가 나왔다(F4 회귀 가드).
    const { unblockUser } = await import('./adminApi.js')
    const res = await unblockUser(403) // DEMO_ACCOUNTS의 박수영(disabled)
    expect(res.status).toBe(200)
    expect(res.user.username).toBe('park_su')
    expect(res.user.display_name).toBe('박수영')
    expect(res.user.status).toBe('approved')
  })

  test('subordinateRolesAll: 통합관리자(비root)는 [관리자,사용자]를 반환한다', async () => {
    const { subordinateRolesAll } = await import('./adminApi.js')
    expect(subordinateRolesAll('통합관리자', false)).toEqual(['관리자', '사용자'])
  })

  test('subordinateRolesAll: 통합관리자(root)는 [통합관리자,관리자,사용자]를 반환한다', async () => {
    const { subordinateRolesAll } = await import('./adminApi.js')
    expect(subordinateRolesAll('통합관리자', true)).toEqual(['통합관리자', '관리자', '사용자'])
  })

  test('subordinateRolesAll: 관리자는 [사용자]를 반환한다', async () => {
    const { subordinateRolesAll } = await import('./adminApi.js')
    expect(subordinateRolesAll('관리자', false)).toEqual(['사용자'])
  })

  test('subordinateRolesAll: 사용자는 빈 배열을 반환한다', async () => {
    const { subordinateRolesAll } = await import('./adminApi.js')
    expect(subordinateRolesAll('사용자', false)).toEqual([])
  })

  test('directSubordinateRole: root면 "통합관리자"를 반환한다', async () => {
    const { directSubordinateRole } = await import('./adminApi.js')
    expect(directSubordinateRole('통합관리자', true)).toBe('통합관리자')
  })

  test('directSubordinateRole: 비root 통합관리자는 "관리자"를 반환한다', async () => {
    const { directSubordinateRole } = await import('./adminApi.js')
    expect(directSubordinateRole('통합관리자', false)).toBe('관리자')
  })

  test('directSubordinateRole: 관리자는 "사용자"를 반환한다', async () => {
    const { directSubordinateRole } = await import('./adminApi.js')
    expect(directSubordinateRole('관리자', false)).toBe('사용자')
  })

  test('directSubordinateRole: 사용자는 null을 반환한다', async () => {
    const { directSubordinateRole } = await import('./adminApi.js')
    expect(directSubordinateRole('사용자', false)).toBeNull()
  })

  // round06c-ext D2d 회귀 가드 — Accounts.jsx(E4)가 액션 성공 후 load()로 재조회했을 때
  // 데모 모드에서도 실제로 목록에 반영돼야 한다(§ 정직성 원칙: 성공한 척 금지).
  describe('데모 액션이 store를 실변이한다(재조회 시 반영)', () => {
    test('rejectUser(401) 후 listAccounts({})에서 401번 행이 사라진다', async () => {
      const { rejectUser, listAccounts } = await import('./adminApi.js')
      const before = await listAccounts({})
      expect(before.users.some((u) => u.id === 401)).toBe(true)

      const res = await rejectUser(401)
      expect(res.status).toBe(200)

      const after = await listAccounts({})
      expect(after.users.some((u) => u.id === 401)).toBe(false)
    })

    test('disableUser(402) 후 listAccounts({})에서 402번 행의 status가 disabled로 반영된다', async () => {
      const { disableUser, listAccounts } = await import('./adminApi.js')
      const res = await disableUser(402)
      expect(res.status).toBe(200)
      expect(res.user.status).toBe('disabled')

      const after = await listAccounts({})
      const row = after.users.find((u) => u.id === 402)
      expect(row).toBeDefined()
      expect(row.status).toBe('disabled')
      expect(row.blocked_at).not.toBeNull()
    })

    test('__resetDemoStore 후 이전 테스트의 변이가 사라지고 원본 데모 데이터로 복구된다', async () => {
      const { rejectUser, disableUser, listAccounts, listUsers, __resetDemoStore } = await import('./adminApi.js')
      // 이 테스트 자체가 변이를 일으켜도 다음 테스트의 beforeEach가 되돌린다는 것을
      // 스스로 증명한다 — 변이 후 수동으로 초기화하고 원상복구를 즉시 확인한다.
      await rejectUser(401)
      await disableUser(402)
      __resetDemoStore()

      const accounts = await listAccounts({})
      expect(accounts.users.some((u) => u.id === 401)).toBe(true)
      const row402 = accounts.users.find((u) => u.id === 402)
      expect(row402.status).toBe('approved')

      // listUsers(DEMO_USERS 301-304)도 함께 초기화됐는지 교차 확인.
      const { users: pending } = await listUsers('pending')
      expect(pending.length).toBe(2)
    })
  })
})

describe('adminApi — 라이브 모드(VITE_API_BASE_URL 설정)', () => {
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

  test('listUsers: GET /admin/users?status=에 credentials:"include"가 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ users: [] }),
    })
    const { listUsers } = await import('./adminApi.js')
    await listUsers('pending')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/admin/users?status=pending',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('listUsers: status 인자가 없으면 쿼리스트링 없이 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ users: [] }),
    })
    const { listUsers } = await import('./adminApi.js')
    await listUsers()
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/admin/users',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('listUsers: 401이면 notifyUnauthorized()가 호출된다(!res.ok 아닌 좁은 판정)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { listUsers } = await import('./adminApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await listUsers('pending')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('listUsers: 200이면 notifyUnauthorized()가 호출되지 않는다(오탐 방지 회귀)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ users: [] }) })
    const { listUsers } = await import('./adminApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await listUsers('pending')
    expect(onUnauthorized).not.toHaveBeenCalled()
    unregister()
  })

  describe.each([
    ['approveUser', 'approve'],
    ['rejectUser', 'reject'],
    ['disableUser', 'disable'],
    ['resetPassword', 'reset-password'],
    ['unblockUser', 'unblock'], // F7: unblockUser도 나머지 POST 액션과 동일한 401 가드 커버리지를 받는다.
  ])('%s → POST /admin/users/{id}/%s', (fnName, path) => {
    test('credentials:"include"로 정확한 경로를 호출한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ user: { id: 7, status: 'approved' } }),
      })
      const mod = await import('./adminApi.js')
      await mod[fnName](7)
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.example.com/admin/users/7/${path}`,
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      )
    })

    test('401이면 notifyUnauthorized()가 호출된다', async () => {
      global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
      const mod = await import('./adminApi.js')
      const { registerUnauthorizedHandler } = await import('./authEvents.js')
      const onUnauthorized = vi.fn()
      const unregister = registerUnauthorizedHandler(onUnauthorized)
      await mod[fnName](7)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
      unregister()
    })

    test('200이면 notifyUnauthorized()가 호출되지 않고 { status, ...body }를 반환한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ user: { id: 7, status: 'approved' } }),
      })
      const mod = await import('./adminApi.js')
      const { registerUnauthorizedHandler } = await import('./authEvents.js')
      const onUnauthorized = vi.fn()
      const unregister = registerUnauthorizedHandler(onUnauthorized)
      const res = await mod[fnName](7)
      expect(onUnauthorized).not.toHaveBeenCalled()
      expect(res).toEqual({ status: 200, user: { id: 7, status: 'approved' } })
      unregister()
    })

    test('403(직속 하위가 아닌 대상)이면 { status:403, ...body }를 그대로 반환한다(호출부가 분기)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 403,
        json: () => Promise.resolve({ detail: '해당 계정을 관리할 권한이 없습니다' }),
      })
      const mod = await import('./adminApi.js')
      const res = await mod[fnName](7)
      expect(res.status).toBe(403)
      expect(res.detail).toBe('해당 계정을 관리할 권한이 없습니다')
    })
  })

  test('listAccounts: GET /admin/users?status=&role=에 credentials:"include"가 실린다(encode 포함)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ users: [] }),
    })
    const { listAccounts } = await import('./adminApi.js')
    await listAccounts({ status: 'approved', role: '사용자' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/admin/users?status=approved&role=%EC%82%AC%EC%9A%A9%EC%9E%90',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('unblockUser: POST /admin/users/{id}/unblock을 credentials:"include"로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ user: { id: 7, status: 'approved' } }),
    })
    const { unblockUser } = await import('./adminApi.js')
    await unblockUser(7)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/admin/users/7/unblock',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  test('listAccounts: 401이면 notifyUnauthorized()가 호출된다(F7)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { listAccounts } = await import('./adminApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await listAccounts({ status: 'pending' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('deleteUser: method:"DELETE"로 /admin/users/{id}를 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    const { deleteUser } = await import('./adminApi.js')
    await deleteUser(7)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/admin/users/7',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    )
  })

  test('deleteUser: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { deleteUser } = await import('./adminApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await deleteUser(7)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })
})
