import { test, expect } from '../support/flows.ts'
import {
  ROOT, MANAGER, ADMIN, USER, STORAGE_STATE,
  tmpUsername, apiJoin, apiLogin, apiLogout, createApprovedAccount, isolatedApiContext,
} from '../support/accounts.ts'

/**
 * E-AUTH-01~07 — 계정 생명주기(spec §11.1). 각 시나리오는 자신이 만든 계정만
 * 건드려(R6E-15) fullyParallel 하에서도 데이터 경합이 없다.
 *
 * [실측 — 이 환경만의 결함, 앱 소스 아님] `context.browser()!.newContext({baseURL})`로
 * 만든 "새" 컨텍스트가 이 환경에서는 완전히 쿠키 비어있는 상태로 시작하지 않고,
 * 같은 브라우저의 다른(형제) 컨텍스트가 가진 `session_token` 쿠키를 그대로 물려받는
 * 채로 생성될 때가 있다(2026-07-29 실측: 서로 다른 컨텍스트 객체인데 동일한
 * session_token 값을 즉시 보유). 원인은 미확정이다 — 이 개발 PC 고유의 격리 이상일
 * 수도, 앱 AuthContext 부팅 /auth/me 경로의 타이밍 경합일 수도 있다(후자는 round06b
 * 단계3 재검증 스윕에서 조사). 정상이라면 무쿠키 상태라 부팅 GET /auth/me가 즉시 401을 반환해
 * 로그인 완료 전에 안전하게 끝나지만, 물려받은 쿠키가 있으면 그 요청이 실제 세션
 * 조회(DB 왕복)를 타 느려지고, 동시에 여러 워커가 백엔드를 두드리는 부하 아래서는
 * 그 응답이 로그인 완료 **이후에** 도착해 화면 상태를 되돌리는 경합이 관찰됐다(응답
 * 자체는 로그인 전 시점에 물려받은 관리자 쿠키로 조회된 것이라 관리자 계정을 다시
 * 보여준다 — 두 계정 다 실재하고 서버 응답도 각각 정확했다, DB·백엔드 결함이 아님).
 * 이 파일의 "익명이어야 하는" 컨텍스트(가입·로그인 전용)마다 생성 직후
 * `clearCookies()`로 명시적으로 비워 이 환경 결함을 스펙 레벨에서 방어한다.
 */

test.describe('E-AUTH-01: 사용자 가입 → 관리자 승인 → 로그인', () => {
  test.use({ storageState: STORAGE_STATE.admin })

  test('가입 신청 후 관리자가 승인하면 로그인할 수 있다', async ({ page, context }) => {
    const username = tmpUsername('auth01')
    const password = 'auth01-pw-01'

    // [리뷰 교정] 수동 newContext는 project baseURL을 상속하지 않는다 — 명시 전달.
    const baseURL = test.info().project.use.baseURL as string
    // 가입은 비로그인 흐름이므로 별도 컨텍스트로(관리자 storageState 오염 방지).
    // [환경 결함 방어] 위 파일 상단 주석 참고 — 형제 컨텍스트의 쿠키를 물려받을 수
    // 있어 생성 직후 명시적으로 비운다.
    const anon = await context.browser()!.newContext({ baseURL })
    await anon.clearCookies()
    const anonPage = await anon.newPage()
    await anonPage.goto('/join')
    await anonPage.locator('#join_name').fill('E2E 사용자01')
    await anonPage.locator('#join_dept').fill('e2e')
    // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": #join_email
    // 입력 자체가 사라졌다(Join.jsx) — 더 이상 채울 필드가 없다.
    await anonPage.locator('#join_id').fill(username)
    await anonPage.locator('#join_pw').fill(password)
    await anonPage.locator('#join_pw_confirm').fill(password)
    await anonPage.locator('#join_role').selectOption('사용자')
    await anonPage.getByRole('button', { name: '가입신청' }).click()
    await expect(anonPage.getByText('신청이 접수되었습니다')).toBeVisible()
    await anon.close()

    // 관리자(admin storageState)가 승인.
    await page.goto('/system/accounts')
    await page.locator('#accounts_status_filter').selectOption('pending')
    const row = page.getByRole('row', { name: new RegExp(username) })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: '승인' }).click()
    await expect(page.getByText(`계정을 승인했습니다`)).toBeVisible()

    // 신규 계정으로 로그인.
    const fresh = await context.browser()!.newContext({ baseURL })
    await fresh.clearCookies()
    const freshPage = await fresh.newPage()
    await freshPage.goto('/login')
    await freshPage.locator('#login_id').fill(username)
    await freshPage.locator('#login_pw').fill(password)
    await freshPage.getByRole('button', { name: '로그인' }).click()
    await expect(freshPage).toHaveURL('/')
    await expect(freshPage.locator('.lnb_profile_role')).toHaveText('사용자')
    await fresh.close()
  })
})

test.describe('E-AUTH-02: 관리자 가입 → 통합관리자 승인 → 로그인', () => {
  test.use({ storageState: STORAGE_STATE.manager })

  test('가입 신청한 관리자를 통합관리자가 승인하면 로그인할 수 있다', async ({ page, context }) => {
    const username = tmpUsername('auth02')
    const password = 'auth02-pw-01'
    await apiJoin(page.request, { username, password, role: '관리자' })

    await page.goto('/system/accounts')
    await page.locator('#accounts_status_filter').selectOption('pending')
    await page.locator('#accounts_role_filter').selectOption('관리자')
    const row = page.getByRole('row', { name: new RegExp(username) })
    await row.getByRole('button', { name: '승인' }).click()
    await expect(page.getByText('계정을 승인했습니다')).toBeVisible()

    // 교차검증 F2 — page.request는 page의 브라우저 컨텍스트와 쿠키 저장소를
    // 공유한다. 아래 apiLogin은 실제로 page의 세션을 방금 승인한 신규 관리자로
    // 바꿔 버린다("영향 없다"는 원래 주석은 틀렸다). 이 테스트는 로그인 성공
    // 여부만 확인하고 이후 page를 다시 쓰지 않으므로 결과에는 영향이 없지만,
    // 뒤에 매니저 권한으로 뭔가를 더 해야 하는 테스트를 여기 이어붙이면 반드시
    // isolatedApiContext()를 써야 한다(아래 blockCycleTest 참고).
    const login = await apiLogin(page.request, username, password)
    expect(login.status()).toBe(200)
  })
})

test.describe('E-AUTH-03: 통합관리자 가입 → root 승인 → 로그인', () => {
  test.use({ storageState: STORAGE_STATE.root })

  test('가입 신청한 통합관리자를 root가 승인하면 로그인할 수 있다', async ({ page }) => {
    const username = tmpUsername('auth03')
    const password = 'auth03-pw-01'
    await apiJoin(page.request, { username, password, role: '통합관리자' })

    await page.goto('/system/accounts')
    await page.locator('#accounts_status_filter').selectOption('pending')
    await page.locator('#accounts_role_filter').selectOption('통합관리자')
    const row = page.getByRole('row', { name: new RegExp(username) })
    await row.getByRole('button', { name: '승인' }).click()
    await expect(page.getByText('계정을 승인했습니다')).toBeVisible()

    const login = await apiLogin(page.request, username, password)
    expect(login.status()).toBe(200)
  })
})

test.describe('E-AUTH-04: 임시비번 발급 → 로그인 → 셀프 비번 변경(8자 정책) → 새 비번 로그인', () => {
  test.use({ storageState: STORAGE_STATE.admin })

  test('임시비번으로 로그인 후 8자 미만은 거부되고 8자 이상은 통과하며 타 세션이 무효화된다', async ({ page, context }) => {
    const username = tmpUsername('auth04')
    const initialPassword = 'auth04-initial-01'
    await createApprovedAccount(page.request, {
      role: '사용자', username, password: initialPassword,
      approverUsername: ADMIN.username, approverPassword: ADMIN.password,
    })

    // 관리자가 임시비번 발급 — Accounts.jsx 실측: '임시비번' → ConfirmDialog(제목
    // '비밀번호 초기화', 확정 '초기화') → Modal '임시 비밀번호 발급'(.font-mono 비번 +
    // footer '확인'). 승인 완료 계정은 '활성화' 상태라 상태 필터를 전체('')로 먼저 푼다.
    await page.goto('/system/accounts')
    await page.locator('#accounts_status_filter').selectOption('')
    const row = page.getByRole('row', { name: new RegExp(username) })
    await row.getByRole('button', { name: '임시비번' }).click()
    await page.getByRole('button', { name: '초기화' }).click()
    const tempPassword = (await page.locator('.font-mono').innerText()).trim()
    // [실측 교정 — round06b] 새 e2e_admin history.spec.ts E-HIST-01이 admin
    // storageState로 "기록확인-admin-<timestamp>" LNB 항목을 남기면, 그 버튼의
    // 접근명이 부분일치로 '확인'을 포함해 unscoped getByRole(exact 미지정)이 2개에
    // 매치돼 strict mode 위반이 난다(같은 admin 계정을 이 스펙과 history.spec.ts가
    // 공유). exact:true로 Modal footer 버튼('확인' 그 자체)만 짚는다 — 같은 파일의
    // C-3 관행(새 비밀번호/새 비밀번호 확인 접두 모호성에 exact 적용)과 동일 처방이다.
    await page.getByRole('button', { name: '확인', exact: true }).click()

    // 임시비번으로 로그인하는 본 세션(이 세션에서 비번을 바꾼다 — 자기 세션은 유지돼야 한다).
    // [리뷰 교정] project use.baseURL은 기본 픽스처에만 적용된다 — 수동
    // browser.newContext()에는 상속되지 않아 goto('/login') 같은 상대경로가
    // 깨진다(accounts.ts isolatedApiContext가 인지한 것과 같은 함정). 명시 전달.
    const baseURL = test.info().project.use.baseURL as string
    const oldSession = await context.browser()!.newContext({ baseURL })
    await oldSession.clearCookies()
    const oldPage = await oldSession.newPage()
    await oldPage.goto('/login')
    await oldPage.locator('#login_id').fill(username)
    await oldPage.locator('#login_pw').fill(tempPassword)
    await oldPage.getByRole('button', { name: '로그인' }).click()
    await expect(oldPage).toHaveURL('/')

    // [개정 — 원본 순서 결함 교정] 무효화를 증명할 "다른 세션"은 비번을 바꾸기
    // **전에** 만들어 둔다. 변경 후에 만들면 무효화 대상 자체가 없다.
    const anotherSession = await context.browser()!.newContext({ baseURL })
    await anotherSession.clearCookies()
    const preLogin = await anotherSession.request.post('/api/auth/login', {
      data: { login_id: username, login_pw: tempPassword },
    })
    expect(preLogin.status()).toBe(200)

    // 셀프 비번 변경 — 8자 미만 거부(Account.jsx 클라 검증 '새 비밀번호는 8자 이상이어야
    // 합니다'). aria-label이 '새 비밀번호'/'새 비밀번호 확인' 접두 관계라 exact 필수(C-3).
    await oldPage.goto('/account')
    await oldPage.getByLabel('현재 비밀번호', { exact: true }).fill(tempPassword)
    await oldPage.getByLabel('새 비밀번호', { exact: true }).fill('짧음')
    await oldPage.getByLabel('새 비밀번호 확인', { exact: true }).fill('짧음')
    await oldPage.getByRole('button', { name: '비밀번호 변경' }).click()
    await expect(oldPage.getByText(/8자 이상/)).toBeVisible()

    // 8자 이상 새 비번 — 성공 메시지는 role=status '비밀번호가 변경되었습니다'(Account.jsx).
    const newPassword = 'auth04-new-pw-02'
    await oldPage.getByLabel('새 비밀번호', { exact: true }).fill(newPassword)
    await oldPage.getByLabel('새 비밀번호 확인', { exact: true }).fill(newPassword)
    await oldPage.getByRole('button', { name: '비밀번호 변경' }).click()
    await expect(oldPage.getByText('비밀번호가 변경되었습니다')).toBeVisible()

    // 타 세션 무효화(delete_others_for_user — auth/routes.py) — 미리 만든 세션의
    // 쿠키로 /auth/me가 401이어야 하고, 옛 비번 재로그인도 401이어야 한다.
    const meAfter = await anotherSession.request.get('/api/auth/me')
    expect(meAfter.status()).toBe(401)
    const relogin = await anotherSession.request.post('/api/auth/login', {
      data: { login_id: username, login_pw: tempPassword },
    })
    expect(relogin.status()).toBe(401)
    await anotherSession.close()

    // 새 비번으로 로그인 성공.
    const fresh = await context.browser()!.newContext({ baseURL })
    await fresh.clearCookies()
    const freshPage = await fresh.newPage()
    await freshPage.goto('/login')
    await freshPage.locator('#login_id').fill(username)
    await freshPage.locator('#login_pw').fill(newPassword)
    await freshPage.getByRole('button', { name: '로그인' }).click()
    await expect(freshPage).toHaveURL('/')
    await fresh.close()
    await oldSession.close()
  })
})

async function blockCycleTest(
  targetRole: '통합관리자' | '관리자' | '사용자',
  approver: { username: string; password: string },
) {
  return async ({ page }: { page: import('@playwright/test').Page }) => {
    const username = tmpUsername(`block-${targetRole}`)
    const password = 'block-target-pw-01'
    const user = await createApprovedAccount(page.request, {
      role: targetRole, username, password,
      approverUsername: approver.username, approverPassword: approver.password,
    })

    await page.goto('/system/accounts')
    await page.locator('#accounts_status_filter').selectOption('')
    await page.locator('#accounts_role_filter').selectOption(targetRole)

    /**
     * `status=disabled` 목록에서 이 계정의 blocked_at을 읽는다 — 없으면 null.
     *
     * `.find(...)`가 undefined를 돌려줄 때 곧바로 `.blocked_at`을 읽어
     * `TypeError: Cannot read properties of undefined`로 죽지 않게 한다(그 형태의
     * 실패는 "무엇을 기다려야 했는가"를 전혀 알려주지 않는다). null과 실제 값을
     * 구분해 돌려주므로 아래 `expect.poll`이 "아직 반영 안 됨"과 "값이 그대로"를
     * 갈라 판정할 수 있다.
     */
    const blockedAtOf = async (): Promise<string | null> => {
      const res = await page.request.get('/api/admin/users?status=disabled')
      const found = (await res.json()).users
        .find((u: { username: string }) => u.username === username)
      return found?.blocked_at ?? null
    }

    // 1회차 차단.
    let row = page.getByRole('row', { name: new RegExp(username) })
    await row.getByRole('button', { name: '차단' }).click()
    await page.getByRole('button', { name: '차단하기' }).click()
    await expect(page.getByText('계정을 차단했습니다')).toBeVisible()

    // 이 시점의 토스트는 이 테스트의 첫 토스트라 혼동 대상이 없다(2회차와 다른
    // 점 — 아래 주석 참고). 그래도 값 조회는 폴링으로 감싼다: UPDATE 반영을
    // UI 렌더 타이밍이 아니라 API 상태로 직접 확인하는 편이 결정적이고, 실패해도
    // TypeError가 아니라 "null에서 벗어나지 못했다"는 진단이 남는다.
    await expect.poll(blockedAtOf, { message: '1회차 차단의 blocked_at 반영 대기' })
      .not.toBe(null)
    const firstBlockedAt = await blockedAtOf()

    // 대상 계정으로 로그인/로그아웃을 찔러보는 아래 두 확인은 반드시 독립
    // 컨텍스트(isolatedApiContext)로 한다(교차검증 F2) — page.request를 쓰면
    // page(승인자 storageState)의 쿠키가 대상 계정으로 바뀌었다가 로그아웃으로
    // 지워져 버려서, 뒤이은 "2회차 차단"·"삭제" UI 클릭이 승인자 세션 없이
    // 401로 죽는다.
    const probe = await isolatedApiContext()
    try {
      // 차단중 로그인 거부.
      const blocked = await apiLogin(probe, username, password)
      expect(blocked.status()).toBe(403)

      // 차단 해제 → 로그인 성공.
      row = page.getByRole('row', { name: new RegExp(username) })
      await row.getByRole('button', { name: '차단해제' }).click()
      await expect(page.getByText('계정을 차단 해제했습니다')).toBeVisible()
      const unblockedLogin = await apiLogin(probe, username, password)
      expect(unblockedLogin.status()).toBe(200)
      await apiLogout(probe)
    } finally {
      await probe.dispose()
    }

    // 2회차 차단 — blocked_at이 갱신돼야 한다. (page는 승인자 세션 그대로다.)
    //
    // [결정적 대기로 재작성 — 2026-07-30, round06b 단계3-B]
    // 종전 구현은 2회차에도 `getByText('계정을 차단했습니다')`의 노출을 기다려
    // 백엔드 UPDATE 완료를 보장했다. 그 대기는 **1회차 토스트가 그 사이에 이미
    // 사라져 있을 것**이라는 타이밍 가정에 정확성을 걸고 있었다 — 두 토스트의
    // 문구가 완전히 같아서(`계정을 차단했습니다`) 1회차 토스트가 아직 화면에
    // 남아 있으면 이 단언이 **낡은 토스트에 즉시 매치**되고, 그러면 아무것도
    // 기다리지 않은 채 다음 줄의 조회가 UPDATE를 앞질러 `undefined.blocked_at`
    // TypeError로 죽는다. 토스트 수명은 2.5초(Toast.jsx duration)이고 그 사이
    // 구간(probe 로그인·차단해제·재로그인·로그아웃)은 백엔드가 빨라질수록
    // 짧아지므로, 이 가정은 성능이 좋아질수록 더 자주 깨진다 — 실제로 단계3-B의
    // 성능 작업 뒤 3건 모두가 이 경로로 실패했다(trace 실측: 1회차 토스트 노출
    // 2.95s → 2회차 단언 5.34s, 즉 2.5초 수명 안이라 단언이 12ms만에 통과).
    //
    // 그래서 UI 타이밍에 기대는 대기를 없애고 두 축으로 나눠 확인한다:
    //  ① UI — 행이 실제로 '차단중' 상태로 갱신됐는지. '차단해제' 버튼은
    //     status==='disabled'인 행에만 렌더되므로(Accounts.jsx renderActions)
    //     직전 상태(활성화: 차단·임시비번)와 절대 혼동되지 않는다. 문구가 같아
    //     구분이 안 되던 토스트와 달리 이 단언은 모호하지 않다.
    //  ② 값 — blocked_at 자체를 `expect.poll`로 폴링해 DB 반영을 직접 기다린다.
    //     UI 렌더·토스트 수명과 무관하게 결정적이다.
    // 고정 대기(sleep)는 넣지 않는다 — 그건 원인을 숨기고 CI에서 다시 터진다.
    row = page.getByRole('row', { name: new RegExp(username) })
    await row.getByRole('button', { name: '차단' }).click()
    await page.getByRole('button', { name: '차단하기' }).click()
    await expect(page.getByRole('row', { name: new RegExp(username) })
      .getByRole('button', { name: '차단해제' })).toBeVisible()

    // `.not.toBe(firstBlockedAt)`만으로 폴링하면 안 된다 — 차단해제 직후에는 이
    // 계정이 애초에 disabled 목록에 없어 null이고, null !== firstBlockedAt이라
    // "아직 반영 안 됨"이 즉시 통과해 버린다. null(미반영)과 firstBlockedAt(값
    // 그대로) 둘 다 pending으로 묶어 갱신된 경우만 통과시킨다.
    await expect.poll(
      async () => {
        const v = await blockedAtOf()
        return v !== null && v !== firstBlockedAt ? 'updated' : 'pending'
      },
      { message: '2회차 차단의 blocked_at UPDATE가 DB에 반영되기를 기다린다' },
    ).toBe('updated')

    // 폴링이 통과했으므로 아래는 같은 사실의 명시적 재확인이다(무엇을 검증하는
    // 테스트인지 코드에 남긴다 — E-AUTH-05~07의 제목 그대로).
    const secondBlockedAt = await blockedAtOf()
    expect(secondBlockedAt).not.toBe(firstBlockedAt)

    // 삭제.
    row = page.getByRole('row', { name: new RegExp(username) })
    await row.getByRole('button', { name: '삭제' }).click()
    await page.getByRole('button', { name: '삭제하기' }).click()
    await expect(page.getByRole('row', { name: new RegExp(username) })).toHaveCount(0)

    // 함수가 여기서 끝나 page를 더 쓰지 않지만, 습관을 통일해 여기서도
    // page.request 대신 독립 컨텍스트를 쓴다(F2 — 패턴을 일관되게 유지).
    const finalProbe = await isolatedApiContext()
    const afterDelete = await apiLogin(finalProbe, username, password)
    expect(afterDelete.status()).toBe(401)
    await finalProbe.dispose()
    void user
  }
}

test.describe('E-AUTH-05: root가 통합관리자를 차단→해제→차단→삭제', () => {
  test.use({ storageState: STORAGE_STATE.root })
  test('2회차 차단에서 blocked_at이 갱신된다', async ({ page }) => {
    await (await blockCycleTest('통합관리자', ROOT))({ page })
  })
})

test.describe('E-AUTH-06: 통합관리자가 관리자를 차단→해제→차단→삭제', () => {
  test.use({ storageState: STORAGE_STATE.manager })
  test('2회차 차단에서 blocked_at이 갱신된다', async ({ page }) => {
    await (await blockCycleTest('관리자', MANAGER))({ page })
  })
})

test.describe('E-AUTH-07: 관리자가 사용자를 차단→해제→차단→삭제', () => {
  test.use({ storageState: STORAGE_STATE.admin })
  test('2회차 차단에서 blocked_at이 갱신된다', async ({ page }) => {
    await (await blockCycleTest('사용자', ADMIN))({ page })
  })
})
