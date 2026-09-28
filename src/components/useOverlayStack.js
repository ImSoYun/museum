// 이 파일의 책임: 겹쳐 열린 오버레이(모달·팝업) 중 "맨 아래" 하나만 딤(배경 어둡게)을
// 그리도록 판정한다.
//
// [왜 필요한가 — round10c Task A3]
// 라이브 실측(2026-09-18, 배포본): 검색결과 → 선택자료 목록 모달(공용 Modal) → 유물
// 한 건(MaterialModal)을 열면 오버레이가 2겹 겹친다. 각자 rgba(20,26,46,.5) 딤을
// 그리므로 합성 결과가 1-(0.5×0.5)=75% 로, 한 겹(50%)보다 눈에 띄게 어두워진다.
// `.dim` 을 형제로 그리는 NodeModal·AlertPopup·ConfirmPopup 도 같은 문제를 안는다.
// 이 훅은 "열려 있는 오버레이 스택의 맨 아래" 하나만 골라 딤을 그리게 한다.
//
// ⚠️ ⚠️ ⚠️ 단순 계수(mount 시점 1회 판정)로는 틀린다 — 다음 사람이 이 파일을
// "카운터 하나면 되지 않나"로 되돌리는 것을 막기 위해 여기 못박아 둔다. ⚠️ ⚠️ ⚠️
//
// 「내가 열릴 때 이미 열린 게 있으면 나는 투명」처럼 **마운트 시점에 한 번만** 판정하면,
// **닫는 순서가 엇갈릴 때 깨진다.** 바깥(먼저 연 것)이 안쪽보다 먼저 닫히면, 안쪽은
// 열릴 때 이미 "나는 투명"으로 고정해 둔 판정을 다시 계산하지 않으므로 그대로 투명한
// 채 남는다 — 결과는 **딤이 하나도 없는 모달**이다. 그래서 "내가 맨 아래인가"는
// **스택의 현재 상태에서 매 렌더 다시 파생**되어야 하고, 스택이 바뀔 때마다(무엇이든
// push/pop 될 때마다) 모든 소비처가 다시 계산해야 한다 — 그래서 모듈 스코프 리스너로
// 전원에게 재렌더를 강제한다.
//
// [useBodyScrollLock.js 의 참조 계수를 재사용하지 않는 이유]
// 그 훅은 "몇 개 열렸나"만 알고 "누가 맨 아래인가"는 모른다. 서로 다른 두 관심사를
// 한 상태에 묶으면 한쪽(스크롤 잠금 개수)을 고칠 때 다른 쪽(딤 소유자 판정)이 조용히
// 깨진다. 그래서 별도 모듈 스코프 스택을 둔다.
import { useLayoutEffect, useReducer, useRef } from 'react'

const stack = []              // 열린 순서대로 쌓인 토큰(빈 객체 — 참조 동일성만 쓴다)
const listeners = new Set()   // 스택이 바뀌면 모든 소비처를 다시 그리게 한다

function notify() {
  listeners.forEach((l) => l())
}

/**
 * @param {boolean} active 이 오버레이가 지금 열려 있는지
 * @returns {boolean} true 면 스택 맨 아래(딤을 그려야 함), false 면 그 위(투명해야 함)
 */
export default function useIsBottomOverlay(active) {
  const [, force] = useReducer((x) => x + 1, 0)
  const tokenRef = useRef(null)

  // 리스너 등록도 useEffect 가 아니라 **레이아웃 이펙트**로 한다.
  //
  // [왜 — 동시에 처음 여는 두 오버레이에서 드러난 실측 결함]
  // 일반 useEffect(수동 효과)는 같은 커밋의 모든 레이아웃 이펙트가 끝난 **뒤**,
  // 브라우저가 화면을 그린 **다음에** 스케줄러 콜백으로 돈다(그래서 "passive" 다 —
  // round10c 전브랜치 리뷰 M2 가 "페인트 직전"이라 적힌 옛 문장을 잡았다. 결론은
  // 바뀌지 않고 오히려 더 강해진다: 등록이 push 보다 늦다). 소비처 둘이
  // **같은 렌더**에서 동시에 처음 열리면(예: 겹친 두 NodeModal 을 흉내 낸 시험
  // 하네스), 아래쪽 push 이펙트가 자신의 notify() 를 부르는 시점에 두 소비처
  // 어느 쪽도 아직 리스너를 등록하지 못한 상태다(등록은 그 뒤에 오는 수동
  // 효과 단계라서). 그래서 notify() 가 허공에 대고 울리고, 최초 렌더에서
  // tokenRef.current 가 아직 null 이라 계산됐던 "나는 맨 아래"(i=-1 폴백) 값이
  // 아무도 재계산하지 않은 채 굳어버려 **둘 다 딤을 그리는** 결과가 났다.
  // 리스너 등록을 레이아웃 이펙트로 올리면, 같은 커밋 안에서 먼저 선언된
  // 형제가 먼저 등록을 마치므로 나중 형제의 push+notify() 가 그 형제에게
  // 닿아 다시 계산하게 만든다(Modal.jsx의 always-mounted 패턴처럼 서로 다른
  // 커밋에서 열리는 흔한 경우는 애초에 이 문제가 없다 — 이건 동시 마운트라는
  // 더 드문 경로까지 정직하게 맞추기 위한 보강이다).
  //
  // ⚠️ 이 순서 보장은 **형제 마운트에서만** 성립한다. React 의 레이아웃 이펙트는
  //    자식이 부모보다 먼저 돌기 때문에, 오버레이 A 가 오버레이 B 를 `children` 으로
  //    품으면 push 순서가 [B, A] 가 되어 **안쪽 B 가 「맨 아래」로 판정**된다 —
  //    바깥 A 가 투명해져 이 파일이 막겠다고 한 바로 그 결과가 난다.
  //    그래서 계약은 이것이다: **오버레이를 다른 오버레이의 children 으로 넣지 않는다.**
  //    지금 레포는 전부 형제다(OutputDetailPage.jsx:232·258, ChatTab.jsx:966,
  //    ResultsTab.jsx:461). 중첩이 필요해지면 이 훅을 "여는 시점에 소비처가 직접
  //    부르는 명시적 API" 로 바꿔야 한다 — 마운트 순서에 기대는 지금 구조로는 안 된다.
  //    (round10c 전브랜치 리뷰 I1 — 지금 깨지는 결함은 아니고, 문서화되지 않았던 함정이다.)
  useLayoutEffect(() => {
    listeners.add(force)
    return () => { listeners.delete(force) }
  }, [])

  // ★ 이 이펙트도 useLayoutEffect 다 — useEffect 로 하면 「딤 두 겹」이 한 프레임 보였다 사라진다.
  //    레이아웃 이펙트는 브라우저가 그리기 전에 돌아 재렌더가 화면에 안 보인다.
  //
  // push/pop 은 **[active] 하나만** 보고 한다 — Modal.jsx:15-22 의 useEscapeToClose 가
  // 같은 교훈을 남겼다. 콜백 identity 같은 것을 deps 에 넣으면 부모가 리렌더할 때마다
  // 토큰이 빠졌다 다시 맨 위로 올라가 순서가 뒤집힌다.
  useLayoutEffect(() => {
    if (!active) return undefined
    const token = {}
    tokenRef.current = token
    stack.push(token)
    notify()
    return () => {
      const i = stack.indexOf(token)
      if (i !== -1) stack.splice(i, 1)
      tokenRef.current = null
      notify()
    }
  }, [active])

  // 스택에 아직 안 들어갔으면(첫 렌더, 위 레이아웃 이펙트가 아직 안 돌았다) 맨 아래로
  // 쳐서 딤이 없는 순간을 만들지 않는다.
  const i = tokenRef.current ? stack.indexOf(tokenRef.current) : -1
  return i <= 0
}
