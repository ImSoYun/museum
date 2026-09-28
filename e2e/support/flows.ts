import { test as base, expect, type Page } from '@playwright/test'

/**
 * 이 파일의 책임: 스펙 공용 흐름 헬퍼 + 확장 test 픽스처.
 *
 * ① Maze 차단(06b spec R-5) — `web/index.html`의 Maze UT 스니펫은 키가 주입된
 *    환경에서 외부 로더(https://snippet.maze.co)를 붙인다. 로컬 dev 서버는
 *    VITE_MAZE_API_KEY가 없어 플레이스홀더 가드(`charAt(0) === '%'`)에 걸려
 *    **요청이 아예 나가지 않으므로 이 route는 평소 무동작**이다. 그럼에도 두는
 *    이유는 키가 주입된 대상(배포 URL을 E2E_BASE_URL로 겨냥하는 경우)에서
 *    외부 네트워크 의존이 flaky·스냅샷 오염의 씨앗이기 때문이다(06f R-4).
 *    모든 스펙이 이 파일의 `test`를 import하는 이유다(Global Constraints C-4).
 *
 * ② 탭 게이트 대기(round06f R6F-27, SearchFlowLayout.jsx:35) — 라이브 검색·재개는
 *    항상 AI 브리핑 SSE(실 Gemini)를 발화하고(ScenarioContext.jsx:310·442), 검색
 *    로딩 또는 브리핑 스트리밍 중에는 '결과기반 AI 대화'·'산출물생성' 탭이
 *    aria-disabled <a>(클릭 preventDefault)가 된다. 검색 직후 곧바로 탭을 클릭하면
 *    아무 일도 일어나지 않는다 — 원본 계획(round06e 시점)에는 이 게이트가 없었다.
 *    브리핑이 종결되면(ok든 error든) 게이트가 풀리므로 aria-disabled 해제를 기다린다.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://snippet.maze.co/**', (route) => route.abort())
    await use(page)
  },
})
export { expect }

/** 홈에서 라이브 검색을 수행하고 결과 URL 진입까지 기다린다(원본 Task 7의 search와 동일). */
export async function search(page: Page, query: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('searchbox').fill(query)
  await page.getByRole('searchbox').press('Enter')
  await page.waitForURL('**/search/results**')
}

/** R6F-27 탭 게이트 해제 대기 — 브리핑 SSE 종결(첫 실행은 실 LLM이라 넉넉히 60s). */
export async function waitForTabsUnlocked(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: '결과기반 AI 대화' }))
    .not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 })
}

/** 게이트 해제를 기다린 뒤 '결과기반 AI 대화' 탭으로 이동한다. */
export async function openChatTab(page: Page): Promise<void> {
  await waitForTabsUnlocked(page)
  await page.getByRole('link', { name: '결과기반 AI 대화' }).click()
  await page.waitForURL('**/search/chat**')
}
