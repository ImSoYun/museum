/**
 * 발표자료용 실화면 캡처 — AX 공유회 (2026-09-18)
 *
 * 왜 별도 스펙인가
 *   발표 슬라이드에 넣을 실제 화면을 «라이브 배포본»에서 그대로 찍는다. 더미 데이터가
 *   아니라 진짜 29.7만 건 위에서 돌아가는 화면이어야 공유회에서 설명이 선다.
 *
 * 왜 이 파일이 자격증명을 갖지 않는가
 *   비밀번호는 레포에도, 명령줄에도 쓰지 않는다. 크롬 창을 띄워 두고 사람이 직접
 *   로그인하면 그때부터 스크립트가 이어받아 사진만 찍는다. 쉘 기록에도 남지 않는다.
 *
 * ⚠️ 1차 실행이 1장에서 멈춘 이유 (2026-09-18)
 *   `getByRole('button', { name: '검색' })` 가 3개를 잡았다 — Playwright 의 이름 매칭은
 *   기본이 **부분 일치**라 「새로운 검색」·「검색 대상 선택」까지 걸렸다. 그 뒤 단계가
 *   줄줄이 막혀 20분을 날렸다. 그래서 지금은:
 *     · 역할+이름 대신 **실측한 클래스 선택자**를 쓴다(라이브 검증에서 확인한 것)
 *     · 단계마다 짧은 상한을 둔다 — 한 단계가 막혀도 전체를 잡아먹지 않는다
 *
 * 실행
 *   cd workspace/app/web
 *   npx playwright test -c playwright.capture.config.ts
 *
 * 결과
 *   e2e/.captures/*.png — 슬라이드에 넣을 순서대로 번호가 붙는다.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 이 레포의 web 은 ESM("type":"module")이라 __dirname 이 없다 — import.meta 로 얻는다.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '.captures')
const BASE = process.env.E2E_BASE_URL || 'https://sai.landsoft.co.kr'

/** 사람이 직접 로그인할 때까지 기다리는 상한. 넉넉히 준다 — 재촉할 이유가 없다. */
const LOGIN_WAIT_MS = 10 * 60 * 1000
/** 한 단계가 막혔을 때 포기하는 시간. 짧게 — 실패가 전체를 잡아먹지 않게. */
const STEP_MS = 60_000
/** LLM 답변만 예외적으로 길게. 그래도 상한을 둔다. */
const CHAT_MS = 240_000

const QUERY = '민주화운동에 관련된 자료 찾아줘'

test.describe.configure({ mode: 'serial' })

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  // eslint-disable-next-line no-console
  console.log(`  [찍음] ${name}.png`)
}

/** 실패해도 나머지 컷은 계속 찍는다 — 한 장 때문에 전체를 잃지 않게. */
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`  [건너뜀] ${name} — ${(e as Error).message.split('\n')[0].slice(0, 110)}`)
  }
}

test('발표자료용 화면 캡처', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000)

  // ── 로그인 — 사람이 직접 한다 ─────────────────────────────
  //
  // ⚠️ 주소 변화로 감지하지 않는다. 2차 실행이 그것 때문에 실패했다 —
  //    사용자는 로그인했는데 `waitForURL` 이 못 알아챘다. 이 앱은 SPA 라 주소가
  //    pushState 로 바뀌고, 무엇보다 **평소 쓰는 크롬 창과 캡처용 창이 똑같이 생겨서**
  //    엉뚱한 창에 로그인했을 수도 있다.
  //    그래서 **이 창의 세션을 직접 물어본다** — /auth/me 가 200 이면 로그인된 것이다.
  await page.goto(`${BASE}/login`)

  // 어느 창에 로그인해야 하는지 화면에 대놓고 알려 준다.
  await page.addStyleTag({
    content: `
      #capture-banner{position:fixed;left:0;right:0;top:0;z-index:2147483647;
        background:#1B6FFF;color:#fff;font:700 18px/1.5 'Malgun Gothic',sans-serif;
        padding:14px 20px;text-align:center;letter-spacing:-0.3px}
      body{padding-top:56px!important}`,
  })
  await page.evaluate(() => {
    const b = document.createElement('div')
    b.id = 'capture-banner'
    b.textContent = '발표자료 캡처용 창입니다 — 여기에 로그인해 주세요'
    document.body.appendChild(b)
  })

  // eslint-disable-next-line no-console
  console.log(
    '\n  ==================================================\n' +
    '   파란 띠가 있는 크롬 창에 로그인해 주세요.\n' +
    '   (평소 쓰는 크롬 창이 아니라 새로 열린 창입니다)\n' +
    '  ==================================================\n',
  )

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          try {
            const r = await fetch('/api/auth/me', { credentials: 'include' })
            return r.status
          } catch {
            return 0
          }
        }),
      { timeout: LOGIN_WAIT_MS, intervals: [2000], message: '로그인을 기다리는 중' },
    )
    .toBe(200)

  // eslint-disable-next-line no-console
  console.log('  로그인 확인 — 캡처를 시작합니다.\n')
  await page.waitForTimeout(2500)

  // ── 01 홈 ─────────────────────────────────────────────────
  await step('홈', async () => {
    await page.goto(`${BASE}/`)
    await page.waitForTimeout(2500)
    await shot(page, '01_홈')
  })

  // ── 02·03 검색결과 ────────────────────────────────────────
  // 버튼을 누르지 않고 Enter 로 제출한다 — 폼이 <form onSubmit> 이고,
  // Playwright 의 키 입력은 브라우저가 신뢰하는 진짜 이벤트라 제출이 걸린다.
  await step('검색결과', async () => {
    const input = page.locator('input[placeholder="검색어 입력"]').first()
    await input.waitFor({ state: 'visible', timeout: STEP_MS })
    await input.fill(QUERY)
    await input.press('Enter')
    await expect(page.locator('.result_card').first()).toBeVisible({ timeout: 120_000 })
    await page.waitForTimeout(3500) // 카드 이미지·AI 브리핑이 자리를 잡을 시간
    await shot(page, '02_검색결과')

    await page.mouse.wheel(0, 340)
    await page.waitForTimeout(1200)
    await shot(page, '03_검색결과_필터')
    await page.mouse.wheel(0, -340)
    await page.waitForTimeout(800)
  })

  // ── 04·05 AI 학예 도우미 ──────────────────────────────────
  await step('대화 시작', async () => {
    await page.locator('a.page_tabs_link[href*="/search/chat"]').first().click({ timeout: STEP_MS })
    await page.waitForTimeout(3000)
    await shot(page, '04_대화_시작')
  })

  await step('대화 답변', async () => {
    const box = page.locator('input[placeholder="내용을 입력해주세요"]').first()
    await box.waitFor({ state: 'visible', timeout: STEP_MS })
    await box.fill('1987년 민주화 운동의 전개 과정을 알려줘. 근거 자료도 같이 보여줘')
    await page.locator('button.chat_input_send').first().click({ timeout: STEP_MS })
    // 인용 칩이 뜨면 답변이 끝난 것이다
    await expect(page.locator('.chat_cite_item').first()).toBeVisible({ timeout: CHAT_MS })
    await page.waitForTimeout(2000)
    await shot(page, '05_대화_답변_인용')
  })

  // ── 06·07 산출물생성 ──────────────────────────────────────
  await step('산출물 노드그래프', async () => {
    await page.locator('a.page_tabs_link[href*="/search/output"]').first().click({ timeout: STEP_MS })
    await expect(page.locator('button.node_graph_node').first()).toBeVisible({ timeout: 120_000 })
    await page.waitForTimeout(3000)
    await shot(page, '06_산출물_노드그래프')
  })

  await step('노드 상세모달', async () => {
    await page.locator('button.node_graph_node').first().click({ timeout: STEP_MS })
    await page.waitForTimeout(4500)
    await shot(page, '07_노드_상세모달')
    await page.locator('.popup_close, button[aria-label="닫기"]').first().click({ timeout: 15_000 })
    await page.waitForTimeout(1200)
  })

  // ── 08 라이브러리 ─────────────────────────────────────────
  await step('라이브러리', async () => {
    await page.goto(`${BASE}/library`)
    await page.waitForTimeout(3500)
    await shot(page, '08_라이브러리')
  })

  // ── 09 자료 상세 모달 ─────────────────────────────────────
  await step('자료 상세', async () => {
    await page.goto(`${BASE}/search/results`)
    await expect(page.locator('.result_card_tit').first()).toBeVisible({ timeout: STEP_MS })
    await page.locator('.result_card_tit').first().click()
    await page.waitForTimeout(4000)
    await shot(page, '09_자료상세')
  })

  const made = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.png')) : []
  // eslint-disable-next-line no-console
  console.log(`\n캡처 ${made.length}장 -> ${OUT}\n`)
  expect(made.length, '한 장도 못 찍었다면 선택자를 다시 봐야 한다').toBeGreaterThan(0)
})
