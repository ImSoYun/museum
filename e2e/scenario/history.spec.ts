import { test, expect, search, openChatTab } from '../support/flows.ts'
import { STORAGE_STATE, ADMIN, tmpUsername, createApprovedAccount, apiLogin } from '../support/accounts.ts'

test('E-HIST-01: 3역할 각각 검색·대화 후 나의 기록에 남는지', async ({ browser }) => {
  const cases = [
    { storageState: STORAGE_STATE.user, tag: 'user' },
    { storageState: STORAGE_STATE.admin, tag: 'admin' },
    { storageState: STORAGE_STATE.manager, tag: 'manager' },
  ]
  for (const { storageState, tag } of cases) {
    // [리뷰 교정] 수동 browser.newContext()는 project use.baseURL을 상속하지
    // 않는다 — 명시로 전달해야 search()의 goto('/')가 성립한다.
    const context = await browser.newContext({
      storageState,
      baseURL: test.info().project.use.baseURL as string,
    })
    const page = await context.newPage()
    // flows.ts의 Maze 차단은 test 픽스처의 page에만 적용된다 — 직접 만든 컨텍스트에는
    // 같은 route를 명시로 건다(외부 로더 의존 제거, C-4와 동일 취지).
    await page.route('https://snippet.maze.co/**', (route) => route.abort())
    const query = `기록확인-${tag}-${Date.now()}`
    await search(page, query)
    // [개정] R6F-27 탭 게이트 — 검색 직후 브리핑 스트리밍 동안 대화 탭이 잠긴다.
    await openChatTab(page)
    await page.locator('#chat_input').fill('이 자료들의 공통점을 한 문장으로 설명해줘')
    await page.getByRole('button', { name: '전송' }).click()
    await expect(page.locator('.chat_msg.ty_ai').first()).toBeVisible({ timeout: 45_000 })

    await expect(page.locator('.lnb_history_item', { hasText: query })).toBeVisible()
    await context.close()
  }
})

test.describe('E-HIST-02: 기록 삭제', () => {
  test.use({ storageState: STORAGE_STATE.user })

  test('삭제하면 나의 기록 목록에서 사라진다', async ({ page }) => {
    // [round06b 재발 가드] 고정 질의어 + unscoped toHaveCount(0)은 이전 실행이 삭제
    // 전에 실패해 잔재를 남기면 영구 FAIL이 된다 — E-HIST-01/03과 동일하게 타임스탬프
    // 접미로 질의어를 유일화해 원본 의도(검색→삭제→목록에서 사라짐)는 그대로 둔다.
    const query = `국립박물관 소장 자료 3호-${Date.now()}`
    await search(page, query)

    // [개정] 항목은 .lnb_history_item으로 스코프한다 — 결과 카드(role=button,
    // aria-label=제목)와의 모호성 제거. 케밥은 항목 내부의 .lnb_history_more다.
    const item = page.locator('.lnb_history_item', { hasText: query }).first()
    await expect(item).toBeVisible()
    await item.locator('.lnb_history_more').click()
    await page.getByRole('menuitem', { name: '삭제' }).click()
    // [개정] 확인 UI는 ConfirmDialog가 아니라 ConfirmPopup이다(2026-07-28 교체,
    // LnbHistory.jsx:370-383). 확정 버튼 '네' / 취소 '아니오'(ConfirmPopup.jsx:29-30).
    await page.getByRole('button', { name: '네' }).click()

    await expect(page.locator('.lnb_history_item', { hasText: query })).toHaveCount(0)
  })
})

// [개정] fixme 제거 — 계획 3(기록 페이지네이션) 구현 완료·실측 적중:
// GET /conversations?limit&offset → {conversations, has_more}(conversations/routes.py:92-113,
// limit 기본 10) · '기록 더 보기' 버튼 문구 그대로(LnbHistory.jsx:360-368).
test('E-HIST-03: 11건 이상에서 "기록 더 보기" → +10 누적, has_more false면 버튼 사라짐', async ({ page }) => {
  const username = tmpUsername('hist03')
  const password = 'hist03-pw-01'
  await createApprovedAccount(page.request, {
    role: '사용자', username, password,
    approverUsername: ADMIN.username, approverPassword: ADMIN.password,
  })
  const login = await apiLogin(page.request, username, password)
  expect(login.status()).toBe(200)

  // 12회 검색해 서로 다른 대화 12건을 만든다 — /search가 대화 행을 생성한다(api.py:634-648).
  // API 직접 호출이라 프론트 브리핑은 발화되지 않는다(비용은 rewrite 12회뿐).
  for (let i = 1; i <= 12; i += 1) {
    const res = await page.request.post('/api/search', { data: { query: `기록더보기 ${i}호` } })
    expect(res.status()).toBe(200)
  }

  await page.goto('/')
  await expect(page.locator('.lnb_history_item')).toHaveCount(10)
  await page.getByRole('button', { name: '기록 더 보기' }).click()
  await expect(page.locator('.lnb_history_item')).toHaveCount(12)
  await expect(page.getByRole('button', { name: '기록 더 보기' })).toHaveCount(0)
})
