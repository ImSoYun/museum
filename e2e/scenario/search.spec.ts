import { test, expect, search } from '../support/flows.ts'
import { STORAGE_STATE } from '../support/accounts.ts'

test.use({ storageState: STORAGE_STATE.user })

test('E-SEARCH-01: 기본 검색 → 카드 20건 → 다음 페이지', async ({ page }) => {
  await search(page, '박물관')
  // 교차검증 F3(원 계획) — hybrid_search에 점수 컷오프가 없어 50건 픽스처에서는
  // total이 코퍼스 크기에 수렴한다. 리터럴 값 대신 "1페이지를 넘는다"만 단언한다.
  const totalText = await page.getByTestId('total-count').innerText()
  expect(Number(totalText.replace(/,/g, ''))).toBeGreaterThan(20)

  // [개정] round06f 갈래 A — "모두 보기" 중간 단계는 폐기됐다(SearchResults.jsx:91-99
  // 주석 명시). Pagination(ResultsTab.jsx:399-401)이 라이브에서 항상 렌더된다
  // (totalPages>1일 때) — 클릭 스텝 자체가 사라진다.
  const firstPageCards = page.locator('.result_card')
  await expect(firstPageCards).toHaveCount(20)
  const firstPageFirstTitle = await firstPageCards.first().locator('.result_card_tit').innerText()

  // [개정] 접근명은 '다음'이 아니라 '다음 페이지'다(Pagination.jsx:78 aria-label).
  // 페이지 이동은 '불러오는 중…' 스피너(loadingKind='restore')를 거친다 — 아래
  // 단언의 자동 재시도가 그 구간을 흡수한다.
  await page.getByRole('button', { name: '다음 페이지' }).click()
  await expect(page.locator('.result_card').first().locator('.result_card_tit'))
    .not.toHaveText(firstPageFirstTitle)
})

// ★ round06b 단계1 경합 조사(worker-contention-report.md) 판정 — 이중 결함으로 fixme 강등.
test('E-SEARCH-02: 모드 분기 실증 — 메타 1페이지엔 없음 / 본문 모드에선 첫 카드로 등장', async ({ page }) => {
  test.fixme(true,
    '★ round06b 단계3-B B8 완료(2026-07-30) — fetchPage 세대 가드(원인 A)는 정정됨. ' +
    '그러나 원인 B(유사도 컷오프 부재, MilvusVectorStore.hybrid_search — store_adapters.py' +
    ':165-205, 수정 금지 대상)는 그대로 남아 있어 이 테스트는 여전히 상시 실패한다 — ' +
    'B가 해소되지 않는 한 재활성화 불가. 재활성화 조건 = 컷오프 도입(후속 라운드/ADR).')

  const word = '마구버린' // round05b T9 실측 본문 전용어 — 메타 텍스트엔 전혀 없다.
  const t9Title = '근현대 자료 1호' // scripts/e2e_fixture.py _t9_ocr_only_rows() 1번째 행 이름.

  await search(page, word)
  await expect(page.locator('.result_card_tit', { hasText: t9Title })).toHaveCount(0)

  await page.getByRole('button', { name: '검색 대상 선택' }).click()
  // [실측 교정] SearchModeToggle.jsx의 체크박스는 reset-forms.css의
  // `.form_check input[type=checkbox]{position:absolute;width:1px;height:1px;clip-path:inset(50%)}`
  // 로 시각적으로 숨기고 형제 <label>의 :before가 실제 표시되는 정사각형이다(접근성
  // 표준 패턴). 그 결과 실제 클릭 판정 지점에서 label이 input 위에 그려져 Playwright의
  // 기본 액셔너빌리티 체크(".check()")가 "label intercepts pointer events"로 무한
  // 재시도하다 타임아웃한다 — 실제 사용자는 label을 클릭해 정상 동작하므로 앱 결함이
  // 아니다. force로 액셔너빌리티 가시성 검사를 건너뛰고 input에 직접 이벤트를 발화한다.
  await page.getByRole('checkbox', { name: '본문 내 기반' }).check({ force: true })
  await page.getByRole('checkbox', { name: '메타기반' }).uncheck({ force: true })
  await page.getByRole('searchbox').press('Enter')
  // round07m — 결과 헤더의 검색모드 병기 라벨(search-mode-label, '본문 내 검색'/'메타 +
  // 본문 내 검색')은 피그마·사용자 리포트에 따라 아예 삭제됐다(85690a1) — 더 이상 이
  // 문구를 단언할 수 없으니 그 testid 자체가 없음을 확인한다. 바로 아래 카드 제목
  // 단언(t9Title 등장)이 본문 내 기반 검색이 실제로 적용됐음을 증명하는 역할을 이어받는다.
  await expect(page.getByTestId('search-mode-label')).toHaveCount(0)
  await expect(page.locator('.result_card').first().locator('.result_card_tit'))
    .toHaveText(t9Title)
})

test('E-SEARCH-03: 본문 모드에서 무이미지 누출 0(has_text 구조적 차단)', async ({ page }) => {
  await search(page, '박물관')
  await page.getByRole('button', { name: '검색 대상 선택' }).click()
  // [실측 교정] 위 E-SEARCH-02와 동일 사유(label이 시각 체크박스, input은 clip 숨김) — force.
  await page.getByRole('checkbox', { name: '본문 내 기반' }).check({ force: true })
  await page.getByRole('checkbox', { name: '메타기반' }).uncheck({ force: true })
  await page.getByRole('searchbox').press('Enter')

  // [실측 교정 — 리뷰 변이 검증에서 발견] 검색 중에는 SearchResults.jsx가 스피너만
  // 그리고 `.result_card`가 0개다. 순서를 바꿔 먼저 "카드가 채워졌다"(스피너 구간을
  // 지나 실제 OCR 모드 응답이 반영됐다)를 기다린 뒤 누출 여부를 확인해야 한다 — 원래
  // 순서(누출 단언을 먼저 둠)는 `toHaveCount(0)`이 스피너의 일시적 0건 상태에서 조기
  // 통과해 버려, has_text 뮤테이션으로 실제 누출이 생겨도 테스트가 뒤늦게 도착하는 진짜
  // 응답을 다시 확인하지 않아 그린으로 남는 거짓양성을 냈다(변이 검증으로 실측).
  await expect(page.locator('.result_card')).not.toHaveCount(0)
  const leaked = page.locator('.result_card_tit', { hasText: '박물관 무이미지 자료' })
  await expect(leaked).toHaveCount(0)
})

// ★ 교차검증 F3 — 구조적 불가. round06b 재확인(2026-07-29) 후 사유·단언 갱신.
test('E-SEARCH-04: 결과 0건 빈 상태', async ({ page }) => {
  test.fixme(true,
    '구조적으로 불가(round06b 재확인) — MilvusVectorStore.hybrid_search(store_adapters.py' +
    ':165-205, 수정 금지 대상)는 limit=top_k ANN에 유사도 컷오프가 없고, search/graph.py' +
    ':93-96 소프트 필터가 필터 0건을 해제 재검색으로 복구한다. 질의만으로 total=0이 되는 ' +
    '경로는 여전히 없다. round06f의 category 후필터(api.py:591-596)로 categories를 실은 ' +
    'API 호출은 total=0이 가능해졌지만, UI는 facets에 존재하는 값만 노출하므로 사용자 ' +
    '여정으로는 도달 불가다. 해소는 저장소 계층 유사도 임계값 도입(후속 라운드/ADR) 대기.')

  await search(page, '존재하지않는검색어절대매치불가999')
  // [개정] liveResults 0건이면 LiveResultsPanel이 EmptyState만 그리고 ResultsTab
  // (total-count 포함)은 렌더되지 않는다(SearchResults.jsx:38-45) — 구 단언
  // toHaveText('0')은 도달 불가라 제거하고 빈 상태 문구만 남긴다.
  await expect(page.getByText('검색 결과가 없습니다')).toBeVisible()
})

// [개정] fixme 제거 — 계획 3 Task 2(라이트박스) 구현 완료, 추정 셀렉터 실측 적중
// (MaterialModal.jsx:328-331 role=dialog aria-label='이미지 크게 보기'·z-[110],
//  Escape 닫기 :91-95, .detail_popup_gallery_img :221, 모달 닫기 aria-label '닫기').
test('E-SEARCH-05: 상세 모달 → 이미지 확대(z-index 실측) → 닫기', async ({ page }) => {
  // [실측 교정 — 픽스처 결함, 앱 아님] scripts/e2e_fixture.py의 _SAMPLE_JPEG_BYTES가
  // 실제로는 디코드 불가한 바이트였다(PIL.Image.load() 재현: "broken data stream").
  // HTTP 전송(200)은 성공해도 브라우저 <img> 디코드가 실패해 onError로 떨어져
  // 갤러리가 항상 "이미지를 불러오지 못했습니다" 플레이스홀더로 대체됐다 — 이 테스트가
  // 열려는 .detail_popup_gallery_img 자체가 렌더되지 않는 구조적 실패였다(다운로드만
  // 검증하는 E-SEARCH-06은 바이트 유효성을 안 따져 이 결함을 못 잡았다). round06b
  // 재확인(2026-07-29)에서 유효한 2x2 JPEG로 교체하고 픽스처를 재시드했다(앱 소스·
  // 백엔드·설정은 무수정 — 순수 테스트 픽스처 바이너리 상수만 교정).
  await search(page, '국립박물관 소장 자료 1호')
  await page.locator('.result_card').first().click()
  const modal = page.getByRole('dialog', { name: /국립박물관 소장 자료/ })
  await expect(modal).toBeVisible()

  const galleryImg = modal.locator('.detail_popup_gallery_img')
  await galleryImg.click()
  const lightbox = page.getByRole('dialog', { name: '이미지 크게 보기' })
  await expect(lightbox).toBeVisible()

  // .detail_popup 은 z-index:102(component.css) — 라이트박스는 그 위(실측 z-[110]).
  const lightboxZ = await lightbox.evaluate((el) => Number(getComputedStyle(el).zIndex))
  expect(lightboxZ).toBeGreaterThan(102)

  await page.keyboard.press('Escape')
  await expect(lightbox).toBeHidden()
  await expect(modal).toBeVisible() // 라이트박스만 닫히고 상세 모달은 유지된다.

  await modal.getByRole('button', { name: '닫기' }).click()
  await expect(modal).toBeHidden()
})

// [개정] fixme 제거 — 계획 3(다운로드) 구현 완료, 추정 경로 실측 적중
// (GET /artifacts/{idnbr}/download api.py:1228 · hasImage disabled ResultsTab.jsx:380
//  · 버튼 aria-label '다운로드' :148). 프론트는 blob 수신 후 <a download>를 발화하므로
// Playwright 'download' 이벤트로 실 바이트 수신을 검증할 수 있다.
// [진단 보강 — 2026-07-30, round06b 단계3-B] 이 테스트의 두 검색은 각각 rate
// limiter가 세는 요청을 발생시킨다 — POST /search + 결과 화면이 자동 발화하는
// POST /search/brief/stream(api.py에서 _check_rate_limit이 걸린 5개 라우트 중 2개).
// limiter의 키는 호출자 IP(`client_key = request.client.host`)이고 e2e 전 트래픽은
// vite 프록시를 거쳐 127.0.0.1 하나로 모이므로, **스위트 자신의 트래픽**이 분당
// 60건(settings.rate_limit_per_min) 한도를 넘을 수 있다(E-HIST-03만 해도 12연속
// /search를 쏜다). 그러면 검색이 429로 끊겨 `요청이 너무 많습니다 — 잠시 후 다시
// 시도하세요`만 뜨고 결과 카드가 **하나도 렌더되지 않는다**.
//
// 그 상태에서 곧바로 다운로드 버튼을 누르면 "카드가 없다"는 사실이 60초 뒤
// `page.waitForEvent: waiting for event "download"` 타임아웃으로 나타나 원인을
// 완전히 오도한다(실측 — 이 형태로 실패해 MinIO 커넥션 풀·ETag·픽스처 오브젝트를
// 먼저 의심하게 됐고, 실제로는 그 어느 것도 원인이 아니었다). 그래서 각 검색 뒤
// **결과가 실제로 떴는지를 먼저 단언**해 실패를 1초 안에 정확한 이름으로 드러낸다.
// 아래 두 `.result_card` 단언이 깨지면 원인은 다운로드가 아니라 검색이다(대개 429).
test('E-SEARCH-06: 다운로드 — 이미지 있는 유물 저장 / 무이미지 버튼 disabled', async ({ page }) => {
  // 이미지 있는 유물(e2efix-generic-001, 실 MinIO 오브젝트 보유).
  await search(page, '국립박물관 소장 자료 1호')
  await expect(page.locator('.result_card').first()).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.result_card').first().getByRole('button', { name: '다운로드' }).click()
  const download = await downloadPromise
  expect(await download.path()).toBeTruthy()

  // 무이미지 유물(e2efix-noimg-001) — hasImage:false라 버튼이 disabled(툴팁
  // '이미지가 없는 자료입니다', ResultsTab.jsx:149-152).
  await search(page, '박물관 무이미지 자료 1호')
  await expect(page.locator('.result_card').first()).toBeVisible()
  const noImageBtn = page.locator('.result_card').first().getByRole('button', { name: '다운로드' })
  await expect(noImageBtn).toBeDisabled()
})
