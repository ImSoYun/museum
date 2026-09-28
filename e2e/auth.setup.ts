import { test as setup, expect } from './support/flows.ts'
import {
  ROOT,
  MANAGER,
  ADMIN,
  USER,
  STORAGE_STATE,
  apiJoin,
  apiLogin,
  apiLogout,
  DuplicateJoinError,
  findAccountByUsername,
} from './support/accounts.ts'

/**
 * 이 파일의 책임: 고정 4계정(root·e2e_manager·e2e_admin·e2e_user)을 승인 체인
 * 순서대로 만들고 storageState를 저장한다(spec §10.4, R6E-15).
 *
 * root는 백엔드 기동 시 BOOTSTRAP_ADMIN_USERNAME/PASSWORD로 이미 존재한다
 * (museum/api.py _run_cloud_startup) — 로그인만 하면 된다.
 *
 * **[2026-07-29 리뷰 수정] 순서 보증 정정 — 이전 문구("fullyParallel은 파일
 * 간에만 적용된다")는 실측과 다르다.** playwright/types/test.d.ts의
 * `describe.configure` 문서: mode: 'default'가 "the default mode. It can be
 * useful to set it explicitly to **override project configuration that uses
 * fullyParallel**" — 즉 전역 `fullyParallel: true`는 **같은 파일 안 테스트의
 * 선언순서 보증까지 제거**하고 서로 다른 워커로 흩어 실행할 수 있다. 실측
 * (2026-07-29, `TEST_PG_PORT=15432 npx playwright test --project=scenario-setup`):
 * root·manager 2건은 PASS, admin·user 2건은 403으로 FAIL — 승인 체인이 아직
 * 완료되지 않은 앞 단계 계정으로 로그인을 시도하는 워커 경합이었다. 아래
 * `setup.describe.configure({ mode: 'serial' })`로 이 파일의 4테스트를
 * **한 워커에서 선언 순서대로**(project의 fullyParallel과 무관하게) 강제한다.
 * 순서가 바뀌면(Step 5 변이 확인) e2e_admin이 아직 없는 e2e_manager로 승인을
 * 시도해 실패한다.
 *
 * **재실행 멱등성** — museum_test에 계정이 이미 있어도(가입만 되고 미승인,
 * 또는 이미 승인 완료) 다시 통과해야 한다. `apiJoin`의 409(중복)는
 * `DuplicateJoinError`로 무시하고, 승인 여부는 `findAccountByUsername`으로
 * 목록에서 실제 status를 조회해 이미 'approved'면 승인 호출 자체를 건너뛴다
 * (가입 응답의 id에 의존하지 않는다 — 이미 존재하는 계정은 가입 응답이 없다).
 */

setup.describe.configure({ mode: 'serial' })

setup('root 로그인', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login_id').fill(ROOT.username)
  await page.locator('#login_pw').fill(ROOT.password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('/')
  await page.context().storageState({ path: STORAGE_STATE.root })
})

setup('e2e_manager 계정 준비(root 승인)', async ({ page }) => {
  try {
    await apiJoin(page.request, { username: MANAGER.username, password: MANAGER.password, role: MANAGER.role })
  } catch (err) {
    if (!(err instanceof DuplicateJoinError)) throw err
  }
  const login = await apiLogin(page.request, ROOT.username, ROOT.password)
  expect(login.status()).toBe(200)
  const account = await findAccountByUsername(page.request, MANAGER.role, MANAGER.username)
  if (!account) throw new Error(`e2e_manager 계정을 목록에서 찾을 수 없다(가입 직후 미반영?)`)
  if (account.status !== 'approved') {
    const approve = await page.request.post(`/api/admin/users/${account.id}/approve`)
    expect(approve.status()).toBe(200)
  }
  await apiLogout(page.request)

  await page.goto('/login')
  await page.locator('#login_id').fill(MANAGER.username)
  await page.locator('#login_pw').fill(MANAGER.password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('/')
  await page.context().storageState({ path: STORAGE_STATE.manager })
})

setup('e2e_admin 계정 준비(e2e_manager 승인)', async ({ page }) => {
  try {
    await apiJoin(page.request, { username: ADMIN.username, password: ADMIN.password, role: ADMIN.role })
  } catch (err) {
    if (!(err instanceof DuplicateJoinError)) throw err
  }
  const login = await apiLogin(page.request, MANAGER.username, MANAGER.password)
  expect(login.status()).toBe(200)
  const account = await findAccountByUsername(page.request, ADMIN.role, ADMIN.username)
  if (!account) throw new Error(`e2e_admin 계정을 목록에서 찾을 수 없다(가입 직후 미반영?)`)
  if (account.status !== 'approved') {
    const approve = await page.request.post(`/api/admin/users/${account.id}/approve`)
    expect(approve.status()).toBe(200)
  }
  await apiLogout(page.request)

  await page.goto('/login')
  await page.locator('#login_id').fill(ADMIN.username)
  await page.locator('#login_pw').fill(ADMIN.password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('/')
  await page.context().storageState({ path: STORAGE_STATE.admin })
})

setup('e2e_user 계정 준비(e2e_admin 승인)', async ({ page }) => {
  try {
    await apiJoin(page.request, { username: USER.username, password: USER.password, role: USER.role })
  } catch (err) {
    if (!(err instanceof DuplicateJoinError)) throw err
  }
  const login = await apiLogin(page.request, ADMIN.username, ADMIN.password)
  expect(login.status()).toBe(200)
  const account = await findAccountByUsername(page.request, USER.role, USER.username)
  if (!account) throw new Error(`e2e_user 계정을 목록에서 찾을 수 없다(가입 직후 미반영?)`)
  if (account.status !== 'approved') {
    const approve = await page.request.post(`/api/admin/users/${account.id}/approve`)
    expect(approve.status()).toBe(200)
  }
  await apiLogout(page.request)

  await page.goto('/login')
  await page.locator('#login_id').fill(USER.username)
  await page.locator('#login_pw').fill(USER.password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('/')
  await page.context().storageState({ path: STORAGE_STATE.user })
})
