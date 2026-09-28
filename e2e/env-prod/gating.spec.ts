import { test, expect } from '../support/flows.ts'
import { STORAGE_STATE } from '../support/accounts.ts'

// APP_ENV=prod 백엔드(8011)를 바라보는 env-prod project 전용(R6B-13 — 로컬 원안).
// storageState는 scenario-setup 산출물을 재사용한다(host-only 쿠키 — 첫 실행에서
// 로그인 유지를 실측한다, 원본 Task 11 Step 4 유지).
//
// [개정] admin이 아니라 **manager**다 — /system/monitoring·nodes·log는 system-ops
// (통합관리자 전용, permissions.js:40-41)라 admin이면 RequireAuth가 EnvGate보다 먼저
// SystemAccessDenied('접근 권한 제한')를 그려 '준비 중입니다'에 도달할 수 없다.
test.use({ storageState: STORAGE_STATE.manager })

const HIDDEN_ROUTES = [
  '/search/output',      // 페이지 레벨(SearchFlowLayout 안 EnvGate — 탭줄 보존)
  // A8(round06b) — '/library'·'/manage/ocr'는 더 이상 셸 레벨이 아니다. 셸은
  // PAGE_LEVEL_PREFIXES(=/search·/system·/library·/manage)를 전부 페이지 레벨
  // EnvGate로 넘겼다(envGates.js). '/library'는 Library.jsx, '/manage/ocr'는
  // Ocr.jsx가 각각 EnvGate를 마운트한다 — manage 5경로 중 대표 1개만 여기서
  // 확인한다(나머지 4개 — meta·embedding·history·materials — 는 R-11 정합
  // 테스트(envGates.test.js)가 소스 텍스트 레벨로 이미 잠그고 있다).
  '/library',            // 페이지 레벨(Library.jsx 안 EnvGate — 탭줄은 원래 없다)
  '/manage/ocr',         // 페이지 레벨(Ocr.jsx 안 EnvGate — ManageTabs 보존)
  '/system/monitoring',  // 페이지 레벨(Monitoring.jsx 안 EnvGate — SystemTabs 보존)
  '/system/nodes',       // 페이지 레벨(Nodes.jsx)
  '/system/log',         // 페이지 레벨(Log.jsx)
]

test('E-ENV-01: prod에서 6화면이 준비중 + 페이지 레벨은 탭줄 보존 + 시스템관리 진입점=/system/accounts', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.lnb_profile_name')).toBeVisible() // 세션 재사용 확인.

  for (const route of HIDDEN_ROUTES) {
    await page.goto(route)
    await expect(page.getByText('준비 중입니다')).toBeVisible()
  }

  // round06f 갈래 E의 요체 — 페이지 레벨 게이트는 "탭은 남기고 본문만 준비중"이다
  // (spec §2-5). 대표 3곳에서 탭줄 보존을 함께 잠근다.
  await page.goto('/search/output')
  await expect(page.getByRole('navigation', { name: '검색 결과 하위 메뉴' })).toBeVisible()
  await page.goto('/system/monitoring')
  await expect(page.getByText('준비 중입니다')).toBeVisible() // SystemTabs 아래 본문만 게이트.
  // A8(round06b) — manage 5페이지는 셸 게이트 시절엔 ManageTabs까지 통째로 사라졌다.
  // 이제 페이지 레벨로 옮겨 탭줄이 prod에서도 살아남는다(실질적 UX 개선의 핵심 증거).
  await page.goto('/manage/ocr')
  await expect(page.getByRole('navigation', { name: '자료관리 하위 메뉴' })).toBeVisible()
  await expect(page.getByText('준비 중입니다')).toBeVisible()

  // 시스템관리 LNB 진입점은 prod에서 /system/accounts 고정(Lnb.jsx:84-88 systemNavItem).
  await page.goto('/')
  await page.getByRole('link', { name: '시스템관리' }).click()
  await expect(page).toHaveURL(/\/system\/accounts$/)
})
