import { test, expect } from '../support/flows.ts'
import type { Page } from '@playwright/test'

/**
 * 이 파일의 책임: 디자인 이식이 "브라우저에서 실제로 적용됐는가"를 확인한다.
 *
 * 단위 테스트(vitest/jsdom)가 말하지 못하는 것만 담는다.
 *  ① 인트로가 렌더된다        — 퍼블 이식이 런타임에 살아 있는가(자산 404·import 누락 검출)
 *  ② LNB 접힘이 폭을 바꾼다   — CSS 가 실제로 적용됐는지를 보는 유일한 지점(spec §9.5.2-2)
 *  ③ 루트폰트 20/18/16        — §5.4 의 유일한 실증 수단. jsdom 에서는 원리상 불가능하다.
 *  ④ 작업선택이 **위로** 열린다 — round07g Task4. ②와 같은 부류다(실제 렌더 좌표).
 *
 * 로컬(기본)에서는 백엔드가 필요 없다. 인트로는 mock 시나리오로도 렌더되고, ②③은 CSS 만 본다.
 * (prototype/e2e/search.spec.ts 는 실인프라를 전제하므로 이 라운드에 이식하지 않는다.
 *  나중에 이식할 때 getByRole('textbox') → getByRole('searchbox') 교정이 필요하다.)
 *
 * ── 배포 URL 대상 실행(E2E_BASE_URL) — round06b 단계4 실측으로 드러난 전제 ──
 * playwright.config.ts 의 R6B-13 계약은 `E2E_SMOKE_ONLY=1 E2E_BASE_URL=https://…`로 이
 * 프로젝트를 배포본에 겨냥하는 것인데, **그 조합은 인증 없이는 성립하지 않는다.**
 * round06c 가 전면 게이트를 넣은 뒤 배포본의 `/`·`/library` 는 미인증 방문 시 로그인
 * 화면이므로 ①의 wordmark·searchbox 와 ②의 `nav.lnb` 가 아예 존재하지 않는다
 * (2026-07-30 실측: ①② 실패, ③만 통과 — ③은 CSS 전역이라 로그인 화면에서도 성립한다).
 * 로컬 기본 실행은 `npm run dev` + 백엔드 없음 → `isLive()`가 false 라 mock 모드로
 * 게이트가 없어 그대로 통과한다 — 그래서 이 어긋남이 로컬에서는 드러나지 않았다.
 *
 * 그러므로 배포본을 겨냥할 때는 **먼저 로그인**한다. 자격은 코드에 두지 않고
 * `E2E_DEPLOY_LOGIN_ID`/`E2E_DEPLOY_LOGIN_PW` env 로 받는다(C-2 — 실자격 하드코딩 금지).
 * 둘이 없으면 ①②는 **skip** 한다(거짓 실패로 게이트를 오염시키지 않는다). ③은 인증과
 * 무관하므로 언제나 돈다.
 */

const DEPLOYED = Boolean(process.env.E2E_BASE_URL)
const DEPLOY_LOGIN_ID = process.env.E2E_DEPLOY_LOGIN_ID
const DEPLOY_LOGIN_PW = process.env.E2E_DEPLOY_LOGIN_PW

/** 배포본 대상일 때만 로그인한다. 로컬(mock)에서는 아무 것도 하지 않는다. */
async function signInWhenDeployed(page: Page): Promise<void> {
  if (!DEPLOYED) return
  test.skip(
    !DEPLOY_LOGIN_ID || !DEPLOY_LOGIN_PW,
    'E2E_BASE_URL 로 배포본을 겨냥했지만 E2E_DEPLOY_LOGIN_ID/PW 가 없다 — ' +
      '배포본은 전면 게이트라 미인증으로는 인트로·LNB 를 볼 수 없다(위 파일 주석).',
  )
  await page.goto('/login')
  await page.locator('#login_id').fill(DEPLOY_LOGIN_ID as string)
  await page.locator('#login_pw').fill(DEPLOY_LOGIN_PW as string)
  await page.getByRole('button', { name: '로그인' }).click()
  // 게이트를 통과했는지를 URL 이 아니라 **앱 셸의 존재**로 확인한다 — 로그인 성공 시
  // 리다이렉트 목적지는 화면·이력에 따라 달라질 수 있지만, LNB 는 앱 계층 공통이다.
  await expect(page.locator('nav.lnb')).toBeVisible()
}

test('스모크 ①: 인트로가 wordmark·검색창·질문카드 3개로 렌더된다', async ({ page }) => {
  await signInWhenDeployed(page)
  await page.goto('/')

  // 로고 워드마크 — 자산 반입(R6d-01)이 런타임 404 없이 끝났는지가 여기서 드러난다.
  const wordmark = page.locator('.intro_wordmark img, img.intro_wordmark').first()
  await expect(wordmark).toBeVisible()

  // 검색 입력 — role 은 searchbox 다(type="search"). textbox 로 찾으면 걸리지 않는다.
  await expect(page.getByRole('searchbox')).toBeVisible()

  // 추천 질문 카드 3개(퍼블 main.html 고정 3개).
  await expect(page.locator('.intro_question_card')).toHaveCount(3)

  // round06c 부터 회귀 판정에 쓰는 기준선. 이 라운드에서는 --update-snapshots 로 "채택"만 한다.
  //
  // 배포본 대상일 때는 비교하지 않는다. 기준선은 **로컬 mock 렌더**로 잡혀 있고, 배포본은
  // 실데이터를 그린다 — LNB 나의 기록 목록·계정명처럼 환경마다 다른 내용이 화면에 들어가
  // 픽셀이 필연적으로 어긋난다. 여기서 비교하면 "기준선이 틀렸다"가 아니라 "환경이 다르다"를
  // 회귀로 오보하게 되고, 그걸 피하려 기준선을 배포본으로 갱신하면 로컬 회귀 검출을 잃는다.
  // 배포본에서 확인할 것은 **퍼블 이식이 런타임에 살아 있는가**이고 그건 위 3개 단언이 이미 한다.
  if (!DEPLOYED) {
    await expect(page).toHaveScreenshot('intro.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  }
})

test('스모크 ②: LNB 토글이 실제 렌더 폭을 줄인다', async ({ page }) => {
  await signInWhenDeployed(page)
  await page.goto('/library')          // LNB 가 있는 앱 계층 화면

  const lnb = page.locator('nav.lnb')
  await expect(lnb).toBeVisible()

  const before = await lnb.evaluate((el) => el.getBoundingClientRect().width)

  await page.getByRole('button', { name: '메뉴 접기' }).click()

  // [2026-07-23 정정, 리뷰 T31 실계측] 이 자리의 옛 주석은 "토글 라벨이 바뀌는 것을
  // 기다려 전환 애니메이션 중간값을 읽지 않게 한다"고 적혀 있었으나 틀렸다 — aria-label 은
  // CSS 클래스(.lnb.is_collapsed, layout.css)와 같은 React 커밋에서 함께 뒤집히므로 실제
  // 경과 시간을 전혀 보장하지 않는다. 실측(토글 직후 경과시간별 lnb 폭): 0ms=320px(전
  // 값 그대로 — CSS Transitions 스펙상 클래스 스왑과 같은 프레임은 old value 를 유지한다)
  // · 16ms=265px · 50ms=121px · 100ms=72px(최종값 = 3.6rem × 20px 루트폰트, 정확히 일치).
  // --workers=1(지연 없는 단일 워커)로 돌리면 라벨 대기 직후 t≈0 을 그대로 읽어 100%
  // 재현되는 경합이었고, 병렬 워커는 스케줄링 지연 덕에 우연히 통과했을 뿐이다 — CSS 접힘
  // 자체는 정상 동작한다(테스트 결함이지 코드 결함이 아니다).
  await expect(page.getByRole('button', { name: '메뉴 펼치기' })).toBeVisible()

  // expect.poll 로 "전환이 끝나 값이 더 이상 변하지 않을 때까지" 유계 재시도한다(권장 —
  // transitionend 이벤트 대기도 대안이지만, 애니메이션이 사라지는 환경(예:
  // prefers-reduced-motion 대응)에서는 이벤트가 아예 오지 않아 타임아웃으로 새로 깨진다;
  // expect.poll 은 그 경우 최종값이 즉시 관측되어 통과하므로 애니메이션 존재 여부에
  // 의존하지 않는다). 20ms 간격 두 실측이 같고 + before 보다 작을 때만 "수렴"으로
  // 인정한다 — 단순히 w1===w2 만 보면 t≈0 에서 두 번 다 before 값을 읽어 "안 변했다"는
  // 오탐이 나온다. 유계 상한은 playwright.config.ts 의 expect.timeout(15s).
  let after = before
  await expect
    .poll(
      async () => {
        const w1 = await lnb.evaluate((el) => el.getBoundingClientRect().width)
        await new Promise((resolve) => setTimeout(resolve, 20))
        const w2 = await lnb.evaluate((el) => el.getBoundingClientRect().width)
        after = w2
        return Math.abs(w1 - w2) < 0.5 && w1 < before
      },
      { message: 'LNB 접힘 전환(.2s ease, layout.css)이 끝나 폭이 최종값으로 수렴하길 대기' },
    )
    .toBe(true)

  // 퍼블 .lnb.is_collapsed 는 3.6rem 으로 줄어든다(layout.css). 정확한 px 를 박지 않는 이유는
  // 루트폰트가 뷰포트에 따라 20/18/16 으로 달라져 rem→px 환산이 함께 달라지기 때문이다.
  // "줄었다"만 단언해도 CSS 미적용은 잡힌다 — 미적용이면 before 와 after 가 같아 위
  // expect.poll 이 만료(타임아웃)로 먼저 실패한다.
  expect(after).toBeLessThan(before)
})

test('스모크 ③: 루트 폰트가 20px / 1024폭 18px / 768폭 16px 이다', async ({ page }) => {
  // documentElement 를 읽는다. 퍼블은 html,body 둘 다 지정하지만(§5.4) rem 의 기준은 html 이고,
  // body 를 읽으면 상속 때문에 우연히 맞는 값이 나와 미적용을 놓칠 수 있다.
  const rootFontSize = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize)

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  expect(await rootFontSize()).toBe('20px')

  await page.setViewportSize({ width: 1024, height: 800 })
  expect(await rootFontSize()).toBe('18px')

  await page.setViewportSize({ width: 768, height: 800 })
  expect(await rootFontSize()).toBe('16px')
})

// ── round07g Task4 수정 R1 ────────────────────────────────────────────────────
// 「작업선택」 드롭다운의 「위로 열림」은 구현 당시 **마크업 층**(패널이 트리거보다 DOM
// 앞 — TaskSelect.test.jsx)과 **CSS 층**(.chat_task_select_panel 이 bottom 기준 절대배치
// 이고 top 오프셋이 없다 — styles/css-contract.test.js) 두 겹으로만 잠갔다. 둘 다 위를
// 가리키지만 어느 쪽도 **실제 픽셀**을 본 것이 아니다(jsdom 은 레이아웃을 계산하지 않아
// getBoundingClientRect 가 전부 0이고, CSS 층은 파일을 텍스트로 읽을 뿐이라 셀렉터 오타·
// 캐스케이드 패배처럼 "파일에는 있으나 화면에는 안 먹는" 경우를 못 잡는다).
//
// 그 빈자리를 메우는 곳이 여기다 — ②가 LNB 폭으로 하는 일과 같은 부류이고, 이 파일은
// 백엔드 없이(E2E_SMOKE_ONLY=1 · VITE_API_BASE_URL='') 도는 유일한 실브라우저 지점이다.
//
// ⚠️ 이 건은 앞선 두 층을 **대체하지 않는다**. 세 층이 서로 다른 회귀를 막는다(전부 실측):
//  · 「CSS 파일에는 bottom 이 있는데 다른 규칙이 이겨 화면에서는 아래로 열린다」
//    (`.chat_input_bar .chat_task_select_panel { top: … }` 를 뒤에 덧붙이는 변이) —
//    CSS 층·마크업 층은 **둘 다 초록**이고 여기서만 red 다. 이 테스트를 넣은 진짜 이유다.
//  · 「JSX 에서 패널을 트리거 뒤로 옮긴다」 — 여기서는 **초록**이다. 절대배치가 살아 있는 한
//    DOM 순서를 뒤집어도 화면 좌표는 그대로다. 그 회귀는 마크업 층(TaskSelect.test.jsx)이
//    잡는다 — 그 층이 지키는 것은 「CSS 가 통째로 죽어도 위에 그려진다」이기 때문이다.
test('스모크 ④: 「작업선택」 패널이 트리거보다 위에 그려진다(실제 렌더 좌표)', async ({ page }) => {
  // 이 건은 **더미(mock) 모드 전용**이다. 트리거는 "AI 답변이 하나라도 있을 때"만 활성인데
  // (ChatTab.jsx `disabled={!shown.some((m) => m.role === 'ai' && m.text)}`), 그 답변을
  // 공짜로 주는 것은 더미 시나리오의 캔드 대화뿐이다. 배포본(E2E_BASE_URL)은 로그인 직후
  // 대화가 비어 있어 트리거가 disabled 라 여기서 재면 **거짓 실패**가 된다 — §52 가 남긴
  // 교훈("전제가 어느 환경에서만 참인지를 주석에 박는다")을 그대로 따른다.
  test.skip(
    DEPLOYED,
    '더미 시나리오의 캔드 대화가 있어야 「작업선택」이 활성이다 — 배포본은 대화가 비어 있다.',
  )

  await page.goto('/search/chat')

  const trigger = page.getByRole('button', { name: '작업선택' })
  await expect(trigger).toBeEnabled()
  await trigger.click()

  // 접근명으로 찾는 것 자체가 M5(리스트박스 이름이 항목 이름과 겹치던 문제)의 실브라우저 확인이다.
  const panel = page.getByRole('listbox', { name: '수행할 작업' })
  await expect(panel).toBeVisible()

  const panelBox = await panel.boundingBox()
  const triggerBox = await trigger.boundingBox()
  if (!panelBox || !triggerBox) throw new Error('패널·트리거가 렌더되지 않아 좌표를 잴 수 없다')

  // 핵심 단언 — 패널의 **아래끝**이 트리거의 **위끝**보다 위에 있다. 아래로 열리면
  // (마크업이 뒤집히거나 CSS 가 top 기준이 되면) 이 부등식이 곧바로 깨진다.
  // 퍼블 규칙은 bottom: calc(100% + 0.4rem) 이라 실제로는 8px(0.4rem × 루트폰트 20px)
  // 만큼 더 위에 있지만, 그 간격 자체를 박지는 않는다 — 루트폰트가 뷰포트에 따라
  // 20/18/16 으로 달라져 rem→px 환산이 함께 달라진다(②의 3.6rem 을 안 박는 것과 같은 이유).
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(triggerBox.y)

  // 위로 열려도 화면 밖으로 잘리면 못 쓴다 — "아래로 열면 잘린다"가 애초에 위로 여는
  // 이유였으므로, 그 목적이 달성됐는지까지 본다(jsdom 이 원리상 볼 수 없던 셋 중 하나).
  expect(panelBox.y).toBeGreaterThanOrEqual(0)
})
