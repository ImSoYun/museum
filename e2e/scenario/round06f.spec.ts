import { test, expect, search, waitForTabsUnlocked } from '../support/flows.ts'
import { STORAGE_STATE } from '../support/accounts.ts'

/**
 * 이 파일의 책임: round06b 단계1 e2e 열차의 마지막 벌 — round06f 신규 화면 4건
 * (AI 브리핑 SSE·검색 품질 만족도평가·자료유형 필터). Task 13(신규, 원본 없음).
 */
test.use({ storageState: STORAGE_STATE.user })

/** 브리핑 스트리밍 종결까지 대기 — 스켈레톤이 사라지면 첫 token 이후다(AiBriefCard.jsx:77-82). */
async function waitForBriefDone(page: import('@playwright/test').Page) {
  await expect(page.locator('.ai_brief_card')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('ai-brief-skeleton')).toHaveCount(0, { timeout: 60_000 })
}

/**
 * [실측 교정] waitForBriefDone은 "스켈레톤 소멸=첫 token"만 보장한다 — 그 뒤로도
 * 본문은 추가 token으로 계속 자란다(ScenarioContext.jsx onToken이 매 조각을
 * accumulated에 이어 붙인다, :236-244). 실제 저장(brief_store.put)은 스트림이
 * **완주**해야 일어나고(api.py:902 docstring — "저장은 스트림 완주 후"), onDone
 * 자체는 리액트 상태를 바꾸지 않아(ScenarioContext.jsx:245-251) 프론트에 "완주"를
 * 알리는 신호가 따로 없다.
 * 첫 실행에서 waitForBriefDone 직후 바로 재검색했더니(스켈레톤 소멸 시점의 본문은
 * 아직 부분 문자열) 첫 요청이 채 저장되기 전에 두 번째 요청이 나가 그것도 캐시
 * 미스가 되어 두 본문이 달라지는 것을 실측했다(E-BRIEF-02 최초 실행 FAIL). 그래서
 * 본문 텍스트가 더 이상 자라지 않을 때까지(연속 두 번의 읽기가 같을 때) 안정화를
 * 기다려 "완주"를 근사한다 — 캐시 히트(전문이 단일 token 1회)에서는 즉시 안정되어
 * 추가 대기가 사실상 없다.
 */
async function waitForBriefText(page: import('@playwright/test').Page): Promise<string> {
  await waitForBriefDone(page)
  let previous: string | null = null
  await expect
    .poll(
      async () => {
        const current = (await page.locator('.ai_brief_body').innerText()).trim()
        const stable = current.length > 0 && current === previous
        previous = current
        return stable
      },
      { timeout: 90_000, intervals: [1_500] },
    )
    .toBe(true)
  return previous as string
}

test('E-BRIEF-01: 검색 → 브리핑 스트리밍 → 본문·AI 고지 렌더 → 탭 게이트 해제', async ({ page }) => {
  // [교정] 브리핑 캐시는 search_briefs(DB, api.py:926 query_key=brief_query_key(query, mode))가
  // 세션·프로세스 재시작을 넘어 영속한다(TTL 없는 저장 — RankingCache와 다르다, api.py:943-958).
  // 고정 질의어 '박물관'을 쓰면 이 스펙을 반복 실행(Step2 "연속 2회")하거나 다른 스펙
  // (search.spec.ts 등)이 같은 문구로 먼저 검색해 둔 순간부터 캐시 히트가 되어, 이 테스트가
  // 이름대로 검증하려는 "실제 스트리밍(캐시 미스)" 경로를 더 이상 타지 않는다. history.spec.ts의
  // E-HIST-01/02가 이미 같은 이유(재실행 시 잔재)로 타임스탬프 접미를 쓰므로 그 선례를 따른다 —
  // '박물관' 부분 문자열은 남겨 아래 ai_brief_desc 단언이 그대로 성립하게 한다.
  const query = `박물관 브리핑-${Date.now()}`
  await search(page, query)
  // 카드는 briefStatus loading|ok에서만 렌더된다(AiBriefCard.jsx:37 — error/idle은 미렌더).
  // GOOGLE_API_KEY가 없으면 error로 접혀 카드가 안 뜬다 — 이 테스트는 실 키 전제다.
  await waitForBriefDone(page)

  const body = page.locator('.ai_brief_body')
  await expect(body).toBeVisible()
  expect((await body.innerText()).trim().length).toBeGreaterThan(0)
  await expect(page.locator('.ai_brief_tag')).toHaveText('AI 생성')
  // [단언 강화 — Step4 변이 확인] 브리프 원안은 'AI로 생성되었으므로'만 검사했는데,
  // 그 부분문자열은 고지 앞절이라 뒷절('오류가 있을 수 있습니다', AiBriefCard.jsx:89)이
  // 바뀌어도 여전히 통과한다(실측 — round06f Step4 변이③). 고지 전문을 검사해 뒷절 변경도
  // 잡히게 한다(브리프 §Step4 "단언 강화가 필요하면 추가" 반영).
  await expect(page.locator('.ai_brief_notice')).toContainText('AI로 생성되었으므로')
  await expect(page.locator('.ai_brief_notice')).toContainText('오류가 있을 수 있습니다')
  await expect(page.locator('.ai_brief_desc')).toContainText('박물관')

  // 브리핑 종결 = R6F-27 탭 게이트 해제 — 대화 탭이 다시 열려야 한다.
  await waitForTabsUnlocked(page)
})

test('E-BRIEF-02: 같은 질의 재검색 → 서버 브리핑 캐시 히트로 동일 본문', async ({ page }) => {
  // [교정] 위와 같은 이유(query_key 영속 캐시, api.py:926)로 질의어를 런마다 유일화한다 —
  // 단, 두 search() 호출은 반드시 **같은** query 변수를 재사용해야 검증 대상인 히트 경로
  // (동일 query_key 재조회)가 성립한다. 이 run 안에서 유일한 문자열이므로 첫 검색은 항상
  // 미스로 시작하고(의도된 전제), 재검색만 히트를 확인한다.
  // [실측 교정] 첫 생성(캐시 미스)이 완주해 저장될 때까지 기다려야 하므로(위
  // waitForBriefText 주석) 기본 60s 예산을 넘길 수 있다 — 여유를 둔다.
  test.setTimeout(150_000)
  const query = `국립박물관 소장 자료-${Date.now()}`
  await search(page, query)
  const first = await waitForBriefText(page)
  expect(first.length).toBeGreaterThan(0)

  // 같은 (query, mode) 재검색 — 캐시 히트는 전문이 단일 token 1회로 온다
  // (ScenarioContext.jsx:206-209 주석·spec §7.3a). 본문이 글자 그대로 같아야 한다 —
  // 실 LLM이 다시 돌았다면(캐시 미스) 문구가 달라져 이 단언이 잡는다.
  await search(page, query)
  const second = await waitForBriefText(page)
  expect(second).toBe(first)
})

test('E-RATE-01: 점수 선택 → 제출 → 감사 문구, 새 검색이면 폼 리마운트', async ({ page }) => {
  await search(page, '박물관')
  const widget = page.locator('.rating_widget')
  await expect(widget.locator('.rating_tit')).toContainText('검색 품질 만족도 평가')

  // 점수 radio의 접근명은 aria-label(툴팁 문구와 동일 — RatingWidget.jsx:117-125).
  // 캡션에도 같은 문구가 있어 role=radio로 스코프한다.
  // [실측 교정] .rating_score_input은 publish/component.css:857의 sr-only 패턴
  // (position:absolute·1px·clip-path:inset(50%))으로 시각적으로 숨고, 형제
  // .rating_score_num이 그 위에 그려져 기본 액셔너빌리티 체크가 "intercepts
  // pointer events"로 타임아웃한다 — search.spec.ts:43-50이 같은 clip 패턴
  // (reset-forms.css:82)에 이미 적용한 것과 동일한 force 관행을 따른다.
  await widget.getByRole('radio', { name: '매우 도움 됨' }).check({ force: true })
  await page.locator('#rating_comment').fill('e2e 자동 평가')
  await widget.getByRole('button', { name: '평가제출하기' }).click()
  // round10b B-2 — 제출 완료 문구가 피그마 전용 프레임 790:9311 원문으로 바뀌었다
  // (figma-3자대조.md #3). 구조(제목+설명 2줄)는 그대로다.
  await expect(page.locator('.rating_widget .rating_tit'))
    .toContainText('검색 품질 만족도 평가 완료')

  // [실측 교정 — Step4 변이 확인 중 발견] 새 검색 = 새 평가 대상 — key=searchGenId
  // 리마운트 + feedbackSent 리셋(SearchResults.jsx:63·ScenarioContext.jsx runLiveSearch의
  // R6F-22/F2)으로 폼이 돌아온다. 처음에는 공용 search() 헬퍼(page.goto('/') 포함)로
  // 재검색했는데, `setFeedbackSent(false)`를 제거하는 변이를 걸어도 이 테스트가 여전히
  // PASS했다 — page.goto('/')가 브라우저를 완전히 새로고침해 feedbackSent를 포함한 모든
  // React 상태가 useState 초기값(false)으로 되돌아가므로, 앱의 리셋 로직과 무관하게
  // 항상 통과했던 것이다(실측). 즉 원래 코드는 "같은 세션에서 새로 검색"을 검증하지
  // 못했다. 페이지를 새로고침하지 않고 헤더 검색바(SearchFlowLayout.jsx:72
  // #result_query_input, type=search라 role=searchbox)로 재검색하도록 고쳐 실제
  // feedbackSent 리셋 경로를 태운다 — 이 교정 후 같은 변이가 올바르게 FAIL함을
  // 확인했다(round06f Step4 변이 확인, report 참고).
  await page.getByRole('searchbox').fill('근현대 자료')
  await page.getByRole('searchbox').press('Enter')
  await expect(page.locator('.rating_widget .rating_tit'))
    .toContainText('검색 품질 만족도 평가')
})

test('E-FILTER-01: 주제 드롭다운 → 값 선택 → total이 그 파셋 건수로 갱신', async ({ page }) => {
  await search(page, '박물관')
  // [2026-07-30 flaky 교정] `search()`는 URL 전환에서 곧바로 돌아온다 — 그 시점엔
  // AI 브리핑 SSE(실 Gemini)가 아직 흐르고 검색 로딩도 완전히 정착하지 않았다.
  // 정착 전에 아래 체크박스를 누르면 두 가지가 겹친다:
  //   ⓐ 로딩 중 SearchResults 가 결과 서브트리를 스피너로 바꿔쳐 DropdownCheckBox 가
  //     언마운트·재마운트되는데(아래 .click 주석과 같은 기전), 그 창에 클릭이 떨어지면
  //     onChange 가 발화하지 않아 setCategories 가 아예 호출되지 않는다.
  //   ⓑ 브리핑 스트리밍이 같은 백엔드(로컬 단일 워커 + Node B 터널)를 물고 있어
  //     필터 재검색 응답이 expect 기본 상한(15s)을 넘길 수 있다.
  // 실측(전체 스위트 병렬 3회 중 1회 실패): total-count 를 15.7초간 33번 폴링했는데
  // 계속 필터 전 값이었다 — "너무 일찍 단언"이 아니라 **갱신이 아예 오지 않은** 것이다.
  // 단독 실행은 3/3 통과(1.6~4.2초)로, 전체 병렬에서만 나는 경합이다.
  // 탭 게이트는 `loading || briefStatus === 'loading'`에서 걸리므로(R6F-27), 그 해제가
  // 곧 "둘 다 끝났다"는 신호다 — ⓐ의 재마운트 창과 ⓑ의 경합을 한 번에 닫는다.
  await waitForTabsUnlocked(page)
  const totalBefore = Number((await page.getByTestId('total-count').innerText()).replace(/,/g, ''))

  await page.getByTestId('dropdown-trigger').click()
  const panel = page.getByTestId('dropdown-panel')
  await expect(panel).toBeVisible()

  // 첫 옵션(최다 건수 — facet_counts는 건수 내림차순, search/category.py:44-56)을 읽는다.
  // 옵션 라벨은 `${value} ${count}`(DropdownCheckBox.jsx:126-128), nth(0)은 '전체'라 nth(1).
  const firstOptionLabel = (await panel.locator('.form_check').nth(1).locator('label').innerText()).trim()
  const m = firstOptionLabel.match(/^(.+)\s(\d+)$/)
  expect(m).not.toBeNull()
  const value = m![1]
  const count = Number(m![2])

  // [실측 교정] .form_check input[type=checkbox]는 reset-forms.css:82의 동일한
  // sr-only clip 패턴이라 위 라디오와 같은 이유로 force가 필요하다. 게다가 이
  // 체크는 onChange→setCategories→fetchPage(로딩)를 태워, SearchResults.jsx가
  // loading===true 동안 결과 서브트리 전체(DropdownCheckBox 포함)를 스피너로
  // 바꿔치기했다가 되돌린다(RatingWidget.jsx 주석과 동일 패턴) — 그 사이
  // DropdownCheckBox가 언마운트·재마운트(로컬 open state 리셋)된다. .check()는
  // 클릭 후 "checked 상태 확정"까지 그 요소 참조로 재확인하는데, 재마운트 중
  // 요소가 사라져 무한 대기로 실측됐다(첫 실행 FAIL). .click()은 상태 재확인
  // 없이 클릭만 발화하므로 이 경합을 피한다 — 실제 검증은 아래 total-count로
  // 충분하다.
  await panel.getByRole('checkbox', { name: value }).click({ force: true })
  // 후필터(api.py:591-596·:666)와 파셋(:585 — 필터 전 동일 200건 모수)이 같은 랭킹에서
  // 계산되므로, 단일 대분류 선택 시 total은 그 파셋 건수와 **정확히 일치**해야 한다(R6F-16).
  //
  // 상한을 전역 기본(15s)보다 넉넉히 준다. 근거는 "느려서 봐준다"가 아니라 **이 값이
  // 도착하려면 실제 왕복이 필요하다**는 것이다 — 체크 → setCategories → fetchPage →
  // `/search`(로컬 단일 워커 uvicorn → SSH 터널 → Node B의 PostgreSQL·Milvus + Gemini
  // 임베딩). 전체 스위트는 이 경로를 여러 브라우저 컨텍스트가 동시에 물기 때문에
  // 개별 왕복이 단독 실행(1.6초)의 몇 배로 늘어난다. 단언 자체는 그대로 엄격하다
  // (건수가 정확히 일치해야 한다) — 기다리는 시간만 실측 경합에 맞춘다.
  await expect(page.getByTestId('total-count')).toHaveText(count.toLocaleString(), {
    timeout: 45_000,
  })
  expect(count).toBeLessThanOrEqual(totalBefore)
})
