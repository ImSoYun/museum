import { useLocation, useSearchParams } from 'react-router-dom'

/**
 * 이 파일의 책임: 「지금 이 화면이 보고 있는 대화」를 **한 곳에서** 정한다.
 *
 * round07g 는 산출물을 대화 단위로 가뒀다 — 목록·총계·뱃지·탭 링크가 전부 이 값을
 * 쓴다. 그 값을 두 화면(SearchFlowLayout·OutputTab)이 각자 계산하고 있었고, 규칙이
 * 늘어나는 순간 갈릴 자리였다. 갈리면 「뱃지가 세는 대화」와 「목록이 보여 준 대화」가
 * 서로 다른 것을 말한다 — 이 라운드가 OutputList 에서 이미 한 번 막은 종류의 결함이다.
 *
 * ── 규칙 ────────────────────────────────────────────────────────────────────
 * ① 주소의 `?c=` 가 최우선. 재개·딥링크·탭 링크가 전부 그 값을 실어 주고, F5 를
 *    눌러도 살아남는 유일한 자리다.
 * ② 그 다음이 컨텍스트의 `conversationId`. 새 검색 직후처럼 주소에 아직 없을 때를 받는다.
 * ③ **단, 그 컨텍스트 값이 「이 화면에 올 때 두고 온 대화」면 없는 것으로 친다.**
 *
 * ③ 이 이 라운드 최종 리뷰(프론트 Important-1)가 잡은 결함이다. 라이브러리의 시드
 * 프로젝트(`s1`·`s4`·`s5`)를 열면 `setScenarioById` 가지를 타는데 그 함수는
 * `conversationId` 를 손대지 않는다 — 그래서 **직전 대화가 컨텍스트에 그대로 남고**,
 * 대화 없는 `/search/output` 에 착지해도 ②가 그 대화를 집어 「누른 프로젝트와 다른
 * 산출물」을 보여 줬다. 라이브러리 프로젝트에는 대화가 없으므로(더미 시드다) 붙일
 * 대화를 **지어내지 않고**, 두고 온 대화를 이름으로 지목해 무효화한다.
 *
 * ── 왜 「대화 없음」 깃발이 아니라 두고 온 **id** 인가 ───────────────────────
 * 깃발(`{ conversationUnknown: true }`)이면 그 히스토리 항목에 영원히 붙는다. 셸의
 * 검색바는 **이동 없이** 새 검색을 하므로(SearchFlowLayout.handleSubmit), 그 자리에서
 * 새 대화가 서도 깃발이 남아 **새 대화의 산출물까지 가린다.** id 로 지목하면 새 대화가
 * 서는 순간 `conversationId !== stale` 이 되어 저절로 풀린다.
 *
 * ── 왜 컨텍스트(ScenarioContext)를 고치지 않았나 ───────────────────────────
 * 「라이브러리를 열면 컨텍스트의 대화를 끊는다」가 더 짧지만, 그 값은 채팅 전송
 * (`sendChatMessage` 가드)까지 함께 보는 값이라 대화 기계장치를 건드리게 된다. 이
 * 라운드는 그 다섯을 무손상으로 두기로 했고, 여기서 막아도 **틀린 데이터는 똑같이
 * 막힌다** — 대화를 지어내지도, 라이브러리에 없는 연결을 만들지도 않는다.
 */

/** 라우터 state 키 — 「이 화면에 올 때 두고 온 대화」. */
export const STALE_CONVERSATION_KEY = 'staleConversationId'

/** 라이브러리처럼 **대화가 없는 곳으로 이동할 때** 실어 보낼 라우터 state.
 *  `leftBehind` 가 null 이어도 그대로 싣는다 — 「두고 온 대화가 없다」는 사실이고,
 *  그때는 아래 훅이 아무것도 무효화하지 않는다(둘 다 null 이면 판정이 같다). */
export function leavingConversation(leftBehind) {
  return { [STALE_CONVERSATION_KEY]: leftBehind ?? null }
}

/**
 * @param {string|null} conversationId 컨텍스트가 들고 있는 대화
 * @returns {{scope: string|null, fromContext: string|null, carryState: object|undefined}}
 *   scope      이 화면이 보여 줄 대화(모르면 null — 화면은 조회를 멈추고 사유를 낸다)
 *   fromContext ②③만 적용한 값 — 「주소를 빼고, 컨텍스트가 실제로 들고 있는 대화」.
 *              round07g 라이브 수정이 쓰는 값이다: 셸이 `?c=` 를 **새 id 로 갈아끼울지**
 *              판단하려면 「주소가 가리키는 대화」와 「컨텍스트가 선 대화」를 갈라 봐야
 *              하는데, scope 는 그 둘을 이미 합쳐 버려서 구분이 불가능하다. 두고 온
 *              대화 규칙(③)은 여기에도 그대로 걸린다 — 그래야 라이브러리 딥링크에서
 *              두고 온 대화가 주소로 되살아나지 않는다.
 *   carryState 다음 위치로 넘길 라우터 state. 탭을 오가도 판정이 유지되게 한다 —
 *              없으면 탭 링크 한 번에 ②가 다시 살아나 같은 결함이 재발한다.
 */
export default function useConversationScope(conversationId) {
  const [searchParams] = useSearchParams()
  const { state } = useLocation()
  const staleConversationId = state?.[STALE_CONVERSATION_KEY] ?? null
  const fromContext =
    conversationId && conversationId !== staleConversationId ? conversationId : null
  return {
    scope: searchParams.get('c') || fromContext || null,
    fromContext,
    carryState: staleConversationId ? { [STALE_CONVERSATION_KEY]: staleConversationId } : undefined,
  }
}
