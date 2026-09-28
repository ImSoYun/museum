/**
 * 이 파일의 책임: 퍼블이 참조하지만 실제로 납품되지 않은 자산 파일명을
 * 한 곳에 모아 둔다(§14 결함 1·7).
 *
 * 왜 테스트 파일이 아니라 별도 모듈인가 —
 * 이 목록을 읽는 곳이 둘이다: src/assets/assets.test.js(R6d-01)와
 * src/styles/css-contract.test.js(R6d-04). 값을 두 곳에 적으면 재납품 때 한쪽만
 * 고쳐 조용히 갈라진다(토큰을 단일화한 D8과 같은 원리).
 * 그렇다고 테스트 파일끼리 import 하면 vitest 가 import 된 test() 블록을
 * import 쪽 스위트에도 등록해 같은 테스트가 두 번 세어지므로, 테스트가 아닌
 * 순수 데이터 모듈로 뺐다.
 *
 * 이 목록 자체가 퍼블 담당자 재요청 목록의 기계가독 형태다.
 * 자산이 재납품되면 여기서 이름을 빼는 것만으로 두 테스트의 가드가 동시에 켜진다.
 *
 * R6c-ext A1: publish-v2 반입으로 v1의 미납 3건(ic_close·ic_nav_library_active·
 * ic_nav_search_active)이 전부 재납품됐다(workspace/design/publish-v2/img/icon/ 실측
 * 존재 확인). 목록을 비운다 — assets.test.js·css-contract.test.js 두 가드가
 * 이제 "없음"이 아니라 "있음"을 전제로 통과한다. 빈 배열도 값은 그대로 여기 한 곳뿐이다.
 */
export const KNOWN_MISSING = []
