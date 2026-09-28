// 이 파일의 책임: 모달이 열려 있는 동안 <body> 스크롤을 잠근다.
//
// [왜 훅 하나로 묶나]
// 공용 components/Modal.jsx 와, 그것을 쓰지 않고 퍼블 마크업(.detail_popup)을
// 직접 그리는 pages/results/MaterialModal.jsx 이 이 훅을 함께 쓴다. 한쪽에만
// 잠금을 넣으면 다른 쪽이 그대로 샌다(round07k 결함 ①의 실제 모습).
//
// [정정 — 「이 앱에는 모달이 두 종류다」는 최종 리뷰에서 틀린 것으로 확인됐다]
// document.body.style.overflow 를 건드리는 장치는 한때 **넷**이었다. 이 훅
// (Modal.jsx·MaterialModal.jsx 가 쓴다) 말고도 AlertPopup.jsx 와 ConfirmPopup.jsx
// 가 각자 열 때 hidden, 닫을 때 이전 값 복원을 손으로 하고 있었다 — 이 훅과 같은
// 문제(겹쳐 열리면 먼저 닫힌 쪽이 잠금을 풀어 버린다)를 갖고 있었지만, 이 훅처럼
// 참조 계수로 고쳐지지 않은 채였다.
//
// [round10c — 넷을 하나로 합쳤다]
// round10b 가 공용 Modal 을 body 로 포털하면서, AlertPopup·ConfirmPopup 이 그리는
// 전면 fixed dim 과 같은 평면에 겹쳐 뜰 자리가 생겼다. 그 상태에서 열고 닫는 순서가
// 엇갈리면(예: ConfirmPopup 이 열린 채로 Modal 이 열리고, ConfirmPopup 이 먼저
// 닫히면) 직접 구현 두 곳은 남의 prev 값을 제 것으로 기억했다가 그 값으로 되돌려
// 아직 열려 있는 쪽의 잠금을 풀어 버리고, 나중에 남은 쪽이 닫히면 아무도 없는데
// body 가 overflow:hidden 에 영영 갇혔다 — 새로고침 말고는 빠져나올 방법이 없었다.
// round10c 에서 AlertPopup·ConfirmPopup 도 이 훅(참조 계수)으로 갈아끼워 넷을
// 하나로 합쳤다 — 이제 열고 닫는 순서가 무엇이든 카운트가 0 이 될 때만 되돌린다.
//
// [왜 참조 계수인가 — 이것이 이 파일의 핵심이다]
// 모달이 겹친다. OutputDetailPage 는 공용 Modal(노드 자료 목록) 안에서
// MaterialModal 을 연다. 열릴 때 hidden, 닫힐 때 되돌리는 단순 구현이면
// **안쪽 모달이 닫히는 순간 바깥 모달이 아직 열려 있는데도 잠금이 풀린다.**
// 그래서 모듈 스코프에 열린 개수를 세고, 0 이 될 때만 되돌린다.
//
// [왜 '' 가 아니라 저장해 둔 값으로 되돌리나]
// 다른 코드가 이미 body 에 overflow 를 넣어 두었을 수 있다. 빈 문자열로
// 되돌리면 그 설정을 말없이 지운다. 첫 잠금 때의 값을 기억했다가 그대로 쓴다.
//
// [스크롤바 폭 보정은 하지 않는다]
// overflow:hidden 이 스크롤바를 없애면 배경이 그 폭만큼 움찔한다. 보정하려면
// padding-right 를 더해야 하는데 값이 브라우저·OS 마다 다르고 position:fixed
// 요소(모달 자신·토스트)까지 함께 밀어야 해서 새 결함이 생기기 쉽다.
// 이번 결함은 「배경이 스크롤된다」이지 「움찔한다」가 아니다(spec §1).
import { useEffect } from 'react'

let lockCount = 0
let savedOverflow = ''

export default function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined

    if (lockCount === 0) savedOverflow = document.body.style.overflow
    lockCount += 1
    document.body.style.overflow = 'hidden'

    return () => {
      lockCount -= 1
      if (lockCount === 0) document.body.style.overflow = savedOverflow
    }
  }, [locked])
}
