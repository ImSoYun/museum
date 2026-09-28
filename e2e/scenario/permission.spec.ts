import { test, expect } from '../support/flows.ts'
import { STORAGE_STATE, ADMIN, tmpUsername, createApprovedAccount } from '../support/accounts.ts'

test.describe('E-PERM-01: 사용자가 /system/* URL 직접 입력 → 접근거부', () => {
  test.use({ storageState: STORAGE_STATE.user })

  test('SystemAccessDenied 화면(접근 권한 제한)이 뜬다', async ({ page }) => {
    await page.goto('/system/monitoring')
    await expect(page.getByText('접근 권한 제한')).toBeVisible()
    await expect(page.getByText('통합관리자에게 있습니다')).toBeVisible()
  })
})

test.describe('E-PERM-02: 인접 단계만 승인 — 관리자가 통합관리자 가입 승인 시도 → 403', () => {
  test.use({ storageState: STORAGE_STATE.admin })

  test('엄격 인접 위반은 403이다(UI에는 애초에 노출되지 않는다 — API로 직접 검증)', async ({ page }) => {
    const username = tmpUsername('perm02')
    const joinRes = await page.request.post('/api/auth/join', {
      data: {
        username, password: 'perm02-pw-01', role: '통합관리자',
        display_name: username, dept: 'e2e',
      },
    })
    expect(joinRes.status()).toBe(200)
    const user = (await joinRes.json()).user as { id: number }

    // 관리자(admin storageState)는 '통합관리자' 신청 목록 자체를 볼 수 없다(list_accounts
    // 가시 집합이 role별로 스코프됨) — 그래도 직접 승인 API를 호출하면 403이어야 한다.
    const approve = await page.request.post(`/api/admin/users/${user.id}/approve`)
    expect(approve.status()).toBe(403)
  })
})

test.describe('E-PERM-03: 자기 자신 차단 방지', () => {
  test.use({ storageState: STORAGE_STATE.admin })

  test('자기 자신에게는 차단/승인 등을 수행할 수 없다(403)', async ({ page }) => {
    const me = await page.request.get('/api/auth/me').then((r) => r.json())
    const disable = await page.request.post(`/api/admin/users/${me.id}/disable`)
    expect(disable.status()).toBe(403)
  })
})

test.describe('E-PERM-04: 차단된 계정 로그인 → 거부 + 사유', () => {
  test.use({ storageState: STORAGE_STATE.admin })

  test('차단중 로그인은 403 + "비활성화된 계정입니다"', async ({ page }) => {
    const username = tmpUsername('perm04')
    const password = 'perm04-pw-01'
    const user = await createApprovedAccount(page.request, {
      role: '사용자', username, password,
      approverUsername: ADMIN.username, approverPassword: ADMIN.password,
    })
    const disable = await page.request.post(`/api/admin/users/${user.id}/disable`)
    expect(disable.status()).toBe(200)

    const login = await page.request.post('/api/auth/login', {
      data: { login_id: username, login_pw: password },
    })
    expect(login.status()).toBe(403)
    expect((await login.json()).detail).toContain('비활성화된 계정입니다')
  })
})

test.describe('E-PERM-05: 승인 대기 계정 로그인 → 거부 + 안내', () => {
  test.use({ storageState: STORAGE_STATE.manager })

  test('pending 로그인은 403 + "가입 승인 대기 중인 계정입니다"', async ({ page }) => {
    const username = tmpUsername('perm05')
    const password = 'perm05-pw-01'
    const joinRes = await page.request.post('/api/auth/join', {
      data: {
        username, password, role: '관리자',
        display_name: username, dept: 'e2e',
      },
    })
    expect(joinRes.status()).toBe(200)

    const login = await page.request.post('/api/auth/login', {
      data: { login_id: username, login_pw: password },
    })
    expect(login.status()).toBe(403)
    expect((await login.json()).detail).toContain('가입 승인 대기 중인 계정입니다')
  })
})
