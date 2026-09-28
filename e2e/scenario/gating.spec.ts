import { test, expect } from '../support/flows.ts'
import { STORAGE_STATE } from '../support/accounts.ts'

// APP_ENV=local 백엔드(scenario, 8010) — 같은 화면들이 정상 노출돼야 한다.
// env-prod 쪽과 같은 역할(manager)로 맞춰 "환경만 다르고 나머지는 동일" 조건을 만든다.
test.use({ storageState: STORAGE_STATE.manager })

test('E-ENV-02: 같은 화면들이 APP_ENV=local에서는 정상 노출된다', async ({ page }) => {
  await page.goto('/library')
  await expect(page.getByText('준비 중입니다')).toHaveCount(0)
  // [개정] .library_wrap은 실재하지 않는다 — 실존 마크업(Library.jsx:190)으로 단언.
  await expect(page.locator('.section_tit', { hasText: '라이브러리' })).toBeVisible()

  await page.goto('/system/monitoring')
  await expect(page.getByText('준비 중입니다')).toHaveCount(0)
  await expect(page.getByText('접근 권한 제한')).toHaveCount(0) // manager는 접근 가능해야 한다.
})
