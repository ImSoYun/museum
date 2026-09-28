import type { Page } from '@playwright/test'
import { test, expect, search, openChatTab } from '../support/flows.ts'
import { STORAGE_STATE } from '../support/accounts.ts'

test.use({ storageState: STORAGE_STATE.user })

/**
 * [개정 공통] round06f R6F-27 — 라이브 검색·재개는 항상 AI 브리핑 SSE를 발화하고
 * 그동안 '결과기반 AI 대화' 탭이 aria-disabled로 잠긴다(SearchFlowLayout.jsx:35·83-93).
 * 검색 직후 곧바로 탭을 클릭하던 원본 코드는 클릭이 preventDefault로 삼켜져 타임아웃
 * 난다 — 모든 대화 진입을 openChatTab(게이트 해제 대기 포함)으로 바꾼다.
 */

/**
 * [실측 교정 — round06b] ChatTab.jsx의 진행 배지(renderPendingRow, '답변 작성 중 …'
 * 등)는 실제 답변 말풍선과 완전히 같은 클래스 `.chat_msg.ty_ai`를 쓴다(차이는 배지엔
 * `.chat_msg_bubble`이 없다는 점뿐 — ChatTab.jsx 소스 확인). sendChatMessage가
 * 사용자·빈 AI 자리표시자를 동기로 먼저 넣고 chatStatus를 'rewrite'로 바꾸므로, 배지
 * <li>는 네트워크 왕복 전에 이미 DOM에 있다. 그래서 `.chat_msg.ty_ai`를 그대로
 * `.first()/.nth(n)`으로 기다리면 아직 토큰 하나도 안 온 이 배지에 즉시 매치돼
 * "답변 도착"이 실제보다 훨씬 일찍 통과해 버리고, 그 상태에서 곧장 다음 턴을
 * 전송하면 sendChatMessage의 가드(`['bootstrap','rewrite','retrieve','generate']
 * .includes(chatStatus)`)에 걸려 두 번째 전송이 조용히 무시된다 — 실측 실패
 * (E-CHAT-02: 2턴째 사용자 메시지가 DOM에 전혀 나타나지 않음, ty_user count 1).
 * 그래서 "말풍선이 있다"(.chat_msg_bubble 보유)와 "배지가 하나도 안 남았다"(스트림
 * onDone으로 chatStatus가 idle로 돌아가 배지 <li>가 사라짐) 둘 다 확인한다.
 */
async function waitForAiReplyDone(page: Page, nth: number): Promise<void> {
  const bubble = page.locator('.chat_msg.ty_ai').filter({ has: page.locator('.chat_msg_bubble') })
  await expect(bubble.nth(nth)).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.chat_msg.ty_ai').filter({ hasNot: page.locator('.chat_msg_bubble') }))
    .toHaveCount(0, { timeout: 45_000 })
}

/**
 * [실측 교정 — round06b] 대화 탭에서는 상단 검색바(SearchFlowLayout 셸)의 모드 토글과
 * 대화 입력창(ChatTab) 자체의 모드 토글(SearchModeToggle) 두 인스턴스가 동시에
 * DOM에 있다 — 둘 다 접근명이 '검색 대상 선택'으로 같아 getByRole만으로 클릭하면
 * strict mode 위반(2개 매치)이 난다. searchMode 값 자체는 ScenarioContext 전역이라
 * 어느 쪽을 클릭해도 최종 상태는 같지만, 팝오버 열림(open)은 컴포넌트별 로컬 state라
 * 반드시 하나의 트리거 버튼을 짚어 클릭해야 그 팝오버가 열린다 — 대화 입력창 쪽
 * (form.chat_input_bar)으로 스코프한다.
 */
function chatModeButton(page: Page) {
  return page.locator('form.chat_input_bar').getByRole('button', { name: '검색 대상 선택' })
}

test('E-CHAT-01: 검색 → 대화 진입 → 첫 답변(SSE 완료)', async ({ page }) => {
  await search(page, '박물관')
  await openChatTab(page)
  await page.locator('#chat_input').fill('이 자료들의 공통점을 한 문장으로 요약해줘')
  await page.getByRole('button', { name: '전송' }).click()

  await waitForAiReplyDone(page, 0)
  const answer = await page.locator('.chat_msg.ty_ai').last().locator('.chat_msg_bubble_txt').first().innerText()
  expect(answer.trim().length).toBeGreaterThan(0)
})

test('E-CHAT-02: 멀티턴 2턴 — 맥락 이어받음', async ({ page }) => {
  await search(page, '국립박물관 소장 자료 1호')
  await openChatTab(page)

  await page.locator('#chat_input').fill('이 자료는 어떤 자료야?')
  await page.getByRole('button', { name: '전송' }).click()
  await waitForAiReplyDone(page, 0)

  await page.locator('#chat_input').fill('방금 답변을 한 문장으로 더 줄여줘')
  await page.getByRole('button', { name: '전송' }).click()
  await waitForAiReplyDone(page, 1)

  await expect(page.locator('.chat_msg.ty_user')).toHaveCount(2)
  await expect(page.locator('.chat_msg.ty_ai')).toHaveCount(2)
})

test('E-CHAT-03: 인용 [n] → 출처 칩 → 유물 모달', async ({ page }) => {
  await search(page, '국립박물관 소장 자료')
  await openChatTab(page)

  await page.locator('#chat_input').fill('출처를 인용해서 자료 하나를 설명해줘')
  await page.getByRole('button', { name: '전송' }).click()
  const cite = page.locator('.chat_cite_item').first()
  await expect(cite).toBeVisible({ timeout: 45_000 })
  await cite.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

// ★ [실측 교정 — round06b] 구조적으로 불가 확인. 브리프는 첫 턴(메타 모드) 인용
// 0건을 "LLM 응답과 무관하게 결정적"이라 전제했지만, 실측(2/2 재현 100%, 매번
// 동일하게 doc_index n=37 "근현대 자료 1호" 인용)은 그 전제를 반증한다. 근원:
// ① chat/graph.py bootstrap_node(:96-116)가 대화 첫 턴에 lastQuery('박물관')를
//   현재 mode로 재검색해 candidates 풀을 만든다 — 이 검색 자체가 유사도 컷오프가
//   없어(E-SEARCH-04와 동일 근거, MilvusVectorStore.hybrid_search) '박물관'을
//   메타 어디에도 담지 않은 T9 문서도 풀에 들어간다.
// ② retrieve_node(:148-181)의 mode=META 랭킹(_plan_ann_requests, store_adapters
//   .py:71-85 — dense_meta+sparse_meta만 쓰고 OCR 필드는 아예 빼는 것은 맞다)도
//   컷오프가 없다. T9 4건이 datadc="현장 조사 기록 문서."를 통째로 공유해
//   (e2e_fixture.py:124 _t9_ocr_only_rows) dense_meta 임베딩이 서로 거의 같고,
//   코퍼스가 작아(픽스처 50건) 무관한 질의로도 top_k 안에 들어온다.
// ③ fetch_docs(:174)는 일단 선택된 문서의 12필드 전문을 모드 구분 없이 그대로
//   가져온다 — doc_index에 든 순간 ocr_text까지 모델에 노출되므로, 모델이 실제로
//   "마구버린 형태로 훼손되어"를 읽고 정확히 인용한다(할루시네이션이 아니라 실제
//   근거 텍스트 인용). 즉 "메타 모드에선 이 문서가 doc_index에 절대 못 들어간다"는
//   전제가 이 픽스처+실 임베딩 조합에서는 성립하지 않는다 — 두 턴 모두 같은 문서를
//   인용해 대조(0→1) 자체가 관측 불가능해진다.
// 해소는 저장소 계층 유사도 임계값 도입 또는 T9 4건 datadc를 서로 다르게 만드는
// 픽스처 조정 대기(둘 다 이번 라운드 수정 금지 대상 — 앱 소스·픽스처).
test('E-CHAT-04: 대화 중 모드 변경 = 후보풀 내 재랭킹(재검색 아님) — 인용 구성이 바뀐다', async ({ page }) => {
  test.fixme(true,
    '구조적으로 불가(round06b 실측, 2/2 재현) — 첫 턴(메타 모드)에서 인용 0건을 기대했으나 ' +
    'bootstrap_node·retrieve_node의 유사도 컷오프 부재(store_adapters.py hybrid_search, ' +
    'E-SEARCH-04와 동일 근거) + T9 4건의 datadc 전문 공유(e2e_fixture.py _t9_ocr_only_rows)로 ' +
    '메타 모드에서도 T9 문서가 doc_index에 들어가 fetch_docs가 ocr_text까지 그대로 노출한다. ' +
    '모델은 실제로 그 텍스트를 읽고 정확히 인용하므로(할루시네이션 아님) 매번 1건이 나오고, ' +
    '본문 모드 전환 후에도 같은 문서를 인용해 0→1 대조 자체가 관측 불가능하다. 해소는 저장소 ' +
    '계층 유사도 임계값 도입 또는 T9 픽스처 datadc 차별화 대기(둘 다 수정 금지 대상).')

  const t9Word = '마구버린'
  const t9TitlePattern = /근현대 자료/

  await search(page, '박물관')
  const poolTotalBefore = await page.getByTestId('total-count').innerText()
  await openChatTab(page)

  // 메타 모드(기본값) 첫 턴 — doc_index에 없는 문서는 [n] 인용이 구조적으로 불가.
  await page.locator('#chat_input').fill(`'${t9Word}'라는 표현이 등장하는 자료가 있으면 인용해서 알려줘`)
  await page.getByRole('button', { name: '전송' }).click()
  await waitForAiReplyDone(page, 0)
  await expect(page.locator('.chat_cite_item', { hasText: t9TitlePattern })).toHaveCount(0)

  // R6E-19: 모드 변경은 후보풀을 재구성하지 않는다 — 검색결과 탭 총건수 불변.
  // ('검색결과' 탭은 게이트 대상이 아니다 — SearchFlowLayout.jsx:81-82.)
  // [실측 교정] '검색 대상 선택' 버튼은 대화 탭에서 2인스턴스라 chatModeButton으로 스코프.
  // 체크박스는 search.spec.ts E-SEARCH-02/03과 동일 사유(label이 시각 요소, input은
  // clip 숨김)로 force가 필요하다 — 같은 SearchModeToggle 컴포넌트를 재사용한다.
  await chatModeButton(page).click()
  await page.getByRole('checkbox', { name: '본문 내 기반' }).check({ force: true })
  await page.getByRole('link', { name: '검색결과' }).click()
  await expect(page.getByTestId('total-count')).toHaveText(poolTotalBefore)
  // [개정] 탭 복귀도 openChatTab으로 — 새 검색이 없었으므로 게이트는 이미 열려 있어
  // 대기는 즉시 통과하지만, 진입 관행을 하나로 유지한다.
  await openChatTab(page)

  // 같은 질문을 BOTH 모드로 — sparse_ocr BM25 정확 매치로 이번 턴 doc_index에 들어간다.
  await page.locator('#chat_input').fill(`'${t9Word}'라는 표현이 등장하는 자료가 있으면 인용해서 알려줘`)
  await page.getByRole('button', { name: '전송' }).click()
  await waitForAiReplyDone(page, 1)
  await expect(page.locator('.chat_cite_item', { hasText: t9TitlePattern })).toHaveCount(1)
})

test('E-CHAT-05: 대화 재개 — 이전 턴 + conversations.mode 복원', async ({ page }) => {
  await search(page, '국립박물관 소장 자료 2호')
  await openChatTab(page)
  // [실측 교정] '검색 대상 선택' 버튼은 대화 탭에서 2인스턴스라 chatModeButton으로 스코프.
  // 체크박스는 search.spec.ts E-SEARCH-02/03과 동일 사유로 force가 필요하다.
  await chatModeButton(page).click()
  await page.getByRole('checkbox', { name: '본문 내 기반' }).check({ force: true })
  // 팝오버를 닫는다(바깥 클릭) — 열린 채면 아래 chat_input 클릭을 가릴 수 있다.
  await page.locator('#chat_input').click()

  await page.locator('#chat_input').fill('이 자료를 설명해줘')
  await page.getByRole('button', { name: '전송' }).click()
  await waitForAiReplyDone(page, 0)

  // [개정] LNB "나의 기록" 항목은 .lnb_history_item으로 스코프한다 — 결과 카드도
  // role=button + 같은 제목이라 name만으로는 모호하다. 재개는 /search/results?c=로
  // 착지하고(LnbHistory.jsx:209) 재개도 브리핑을 재발화하므로(ScenarioContext.jsx:442)
  // 대화 확인 전에 openChatTab(게이트 대기 포함)으로 대화 탭에 다시 들어간다.
  await page.locator('.lnb_history_item', { hasText: '국립박물관 소장 자료 2호' }).first().click()
  await page.waitForURL('**/search/results**')
  await openChatTab(page)
  await expect(page.locator('.chat_msg.ty_user').first()).toHaveText('이 자료를 설명해줘')
  // 재개 후 토글이 '본문 내 기반'으로 복원돼 있어야 한다(R6E-19 — conversations.mode).
  // [실측 교정] 여기서도 대화 탭 2인스턴스 문제가 동일하게 적용된다.
  await chatModeButton(page).click()
  await expect(page.getByRole('checkbox', { name: '본문 내 기반' })).toBeChecked()
})
