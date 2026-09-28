/**
 * 이 파일의 책임: prod에서 감출 라우트 레지스트리(round06e 갈래 B, spec §7.2).
 *
 * 축이 두 개다 — 이 파일은 "경로(라우트)" 축만 다룬다. 검색모드 같은 "기능" 축은
 * 백엔드 Settings.search_modes_enabled가 별도로 소유한다(spec §7.5, 계획 1에서 완성) —
 * 이 레지스트리에 기능을 끼워 넣지 말 것. isEnvHidden은 pathname.startsWith 매칭이라
 * 범용 접두사 매처다 — 예를 들어 '/search/mode' 같은 가짜 경로를 넣으면 '/search'로
 * 시작하는 흐름 전체(홈 재검색·결과·대화)가 통째로 준비중이 된다.
 *
 * '/system/accounts'는 의도적으로 빠져 있다 — 관리자·통합관리자가 prod에서도 접근해야
 * 하는 유일한 시스템관리 화면이다(Lnb.jsx의 systemNavItem이 prod에서 이 경로로 직행한다).
 *
 * '/search/output'(산출물)만 유일하게 area 단위가 아니라 경로 단위로 지정한다 —
 * permissions.js의 AREA_BY_PREFIX상 '/search/output'의 area는 'search'다. area
 * 단위로 잘라 숨기면 '/search' 전체(홈 재검색·결과·대화)가 함께 사라진다.
 */
export const HIDDEN_BY_ENV = {
  prod: [
    '/search/output',    // 대화 시 산출물 생성
    '/library',
    '/manage',            // 하위 전부(ocr·meta·embedding·history·materials)
    '/system/monitoring',
    '/system/nodes',      // 복수 — 실제 라우트다(router.jsx:100)
    '/system/log',
  ],
}

export function isEnvHidden(pathname, env) {
  return (HIDDEN_BY_ENV[env] ?? []).some((prefix) => pathname.startsWith(prefix))
}

// ── 판정 지점 분배 (round06f 갈래 E · R6F-19 · spec §10.2) ─────────────────────
// 위 HIDDEN_BY_ENV가 "무엇을 숨기는가"라면 아래 둘은 "누가 판정하는가"다.
// 항목은 round06e에서 한 글자도 바뀌지 않았다 — 바뀐 것은 판정 지점뿐이다.
//
// 셸(AppShell)이 <Outlet>을 통째로 <ComingSoon/>으로 바꾸면 그 경로가 속한 탭줄까지
// 함께 사라진다: '/search/output'이면 SearchFlowLayout의 검색바·page_tabs가,
// '/system/*'이면 각 페이지가 그리는 SystemTabs가, '/manage/*'이면 각 페이지가
// 그리는 ManageTabs가 그렇다. 사용자 요구는 "탭은 남기고 본문만 준비중"이므로
// (spec §2-5), 보존할 탭줄이 있는 경로는 페이지 레벨 <EnvGate>가 맡고 셸은
// 손대지 않는다.
//
// A8(round06b) — '/library'·'/manage'는 애초에 "보존할 탭줄이 없다"고 판단해
// 셸이 맡아 왔으나, 재검증 결과 manage 5개 페이지는 전부 ManageTabs를 이미
// 렌더하고 있었다(셸 게이트가 그 탭까지 통째로 가리는 배치 불일치). '/library'는
// 실제로 탭줄이 없지만, 판정 지점을 두 축(셸/페이지)으로 나누지 않고 하나로
// 통일하는 편이 R-11 정합을 지키기 쉬워 함께 페이지 레벨로 옮긴다.
//
// ⚠️ 여기에 접두를 더하면 그 접두 아래 **모든** 숨김 경로가 셸 게이트에서 빠진다.
// 해당 페이지에 <EnvGate>를 실제로 달지 않으면 prod에 그대로 노출된다(R-11).
// 그 정합(레지스트리 항목 · 이 접두 · 실제 EnvGate를 마운트한 파일)은 주석이 아니라
// envGates.test.js의 정합 테스트가 소스 파일을 읽어 잠근다.
export const PAGE_LEVEL_PREFIXES = ['/search', '/system', '/library', '/manage']

// 경계를 명시한 접두 비교(`p` 자체이거나 `p + '/'`로 시작)를 쓴다.
// 위 isEnvHidden은 순수 startsWith라 '/libraryXYZ' 같은 값도 삼키는데, 레지스트리
// 항목이 전부 실재 라우트라 지금은 무해하다. 그러나 이 술어에서 같은 실수를 하면
// 무해하지 않다 — 예컨대 '/systemsettings'를 숨기려고 등록했을 때 '/system' 접두에
// 걸려 페이지 레벨로 오분류되고, 그 페이지엔 <EnvGate>가 없어 셸도 페이지도 막지
// 않는다(조용한 prod 노출). 그래서 여기서는 경계를 명시한다.
export const isShellLevelGated = (pathname, env) =>
  isEnvHidden(pathname, env) &&
  !PAGE_LEVEL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
