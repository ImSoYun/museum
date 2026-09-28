import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import useBodyScrollLock from './useBodyScrollLock.js'
import useIsBottomOverlay from './useOverlayStack.js'

/**
 * 이 파일의 책임: 퍼블 alert_popup(제목·설명·확인 버튼 하나짜리 경고 대화상자).
 *
 * 왜 페이지가 아니라 셸에 하나만 두는가 — 퍼블은 같은 4블록을 7개 페이지 body 끝에
 * 바이트 단위로 복붙해 두었다(main.html:110-129 = manage_list.html:412-431). 정책이
 * 마크업에 새겨져 있어 정책이 바뀌면 7개 파일을 다 고쳐야 한다. 그래서 컴포넌트
 * 하나로 올리고, "어떤 팝업을 띄울지"는 라우트 메타·권한에서 파생한 kind로 받는다(§6.6.3).
 *
 * 왜 Modal.jsx를 재사용하지 않는가 — Modal.jsx:24~38은 [좌측 제목 + 우측 X] 헤더에
 * 구분선이 있고 하단 footer가 오른쪽 정렬인 범용 모달이며 role 선언이 없다.
 * alert_popup은 X도 구분선도 없고 전부 중앙정렬된 폭 24rem 카드에 버튼이 하나이며
 * width:100%다(component.css:28). 억지로 겹치면 두 컴포넌트가 모두 나빠진다(§6.6.4).
 */

/** 문구 정본. 퍼블 원문을 유지하되 역할 어휘 정본은 schema.sql의
 *  role CHECK(사용자/관리자/통합관리자)다(§13 U-3 참조). */
export const ALERTS = {
  system_access: {
    title: '접근 권한 제한',
    desc: (
      <>
        시스템관리 접근 권한은
        <br />
        통합관리자에게 있습니다.
      </>
    ),
  },
  wip: {
    title: '준비 중입니다',
    desc: '빠른 시일 내에 서비스할 예정입니다.',
  },
}

export default function AlertPopup({ kind, onClose, triggerRef }) {
  // 퍼블은 id를 4종 고정 문자열로 썼다. 셸에 인스턴스가 하나뿐이라 충돌은 없지만
  // 고정 문자열을 쓸 이유도 없으므로 useId로 생성해 aria 연결만 성립시킨다(§6.6.4).
  const uid = useId()
  const confirmRef = useRef(null)

  // 닫기 경로 3개(확인 버튼·Esc·dim)가 전부 이 함수를 지난다.
  // 퍼블 common.js:48-52의 closePopup과 순서까지 같다 — 닫고 나서 트리거로 복귀.
  function close() {
    onClose()
    triggerRef?.current?.focus()
  }

  // 열릴 때 확인 버튼으로 포커스(퍼블 common.js:45).
  // StrictMode에서 effect가 두 번 돌지만 focus() 호출 자체가 멱등이라 문제없다.
  // 그래서 이 자리에 스크롤 이동 같은 부수효과를 얹지 않는다(§6.8.2).
  useEffect(() => {
    if (kind) confirmRef.current?.focus()
  }, [kind])

  // Esc로 닫기(퍼블 common.js:66-68). 열려 있는 동안만 문서에 붙였다 뗀다.
  useEffect(() => {
    if (!kind) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [kind])

  // 열린 동안 배경 스크롤 잠금. 퍼블에는 없으나 dim이 position:fixed 전면이라
  // 뒤가 스크롤되면 시각적으로 모순이다(§6.8.3).
  //
  // round10c — 예전엔 이 자리에서 prev를 직접 저장·복원했다. ConfirmPopup도 같은
  // 방식으로 따로 잠갔는데, 공용 Modal이 body로 포털되며(round10b) 이 팝업들과
  // 같은 평면에서 겹쳐 뜰 수 있게 됐다. 겹쳐 열렸다가 닫히는 순서가 엇갈리면
  // (예: 이 팝업이 열린 채로 Modal이 열리고, 이 팝업이 먼저 닫히면) 남의 prev
  // 값을 제 것으로 기억해 두었다가 그 값으로 되돌리면서 아직 열려 있는 Modal의
  // 잠금을 풀어 버리고, 반대로 Modal이 나중에 닫히면 아무도 없는데 hidden에
  // 영영 갇힌다(useBodyScrollLock.js 머리주석 참조). 이 훅의 모듈 스코프 참조
  // 계수로 넷(useBodyScrollLock·Modal·AlertPopup·ConfirmPopup)을 하나로 합쳐
  // 이 문제를 없앤다 — 훅은 Rules of Hooks 때문에 아래 조기반환보다 먼저 부른다.
  useBodyScrollLock(Boolean(kind))

  // round10c Task A3 — 겹쳐 열려도 딤은 한 겹만. useOverlayStack.js 머리주석 참조:
  // 판정은 스택의 현재 상태에서 매번 파생되므로, 닫는 순서가 엇갈려도 남은 위엣것이
  // 딤을 되찾는다. useBodyScrollLock 의 참조 계수(몇 개 열렸나)와는 다른 관심사라
  // (누가 맨 아래인가) 별도 훅을 쓴다 — 한 상태에 묶지 않는다.
  const isBottom = useIsBottomOverlay(Boolean(kind))

  if (!kind) return null
  const alert = ALERTS[kind]
  if (!alert) return null

  const titleId = `${uid}-tit`
  const descId = `${uid}-desc`

  /**
   * 포커스 트랩 — 퍼블 common.js에는 Tab을 가두는 코드가 한 줄도 없다.
   * 그런데 퍼블 마크업은 aria-modal="true"를 선언하고, 이 속성은 "이 요소 바깥은
   * 보조기술에서 비활성"이라는 약속이다. 트랩이 없으면 그 선언이 거짓이 되고
   * 스크린리더 사용자는 읽을 수 있다고 안내받은 것에 키보드로 도달할 수 없거나
   * 그 반대가 된다. 그래서 이것은 디자인 변경이 아니라 퍼블 마크업이 이미 선언한
   * 계약의 이행이며, "퍼블 준수"에 해당한다(§6.8.3).
   *
   * 팝업 안의 포커스 가능 요소가 확인 버튼 하나뿐이므로 순환 로직 없이 Tab을 막는
   * 것으로 족하다. 범용 트랩 유틸을 지금 만들지 않는 이유는 대상이 1개인데
   * 일반화하면 검증할 수 없는 코드가 생기기 때문이다. 요소가 늘면 순환으로 교체한다.
   */
  const onTrapKeyDown = (e) => {
    if (e.key === 'Tab') e.preventDefault()
  }

  // 반드시 document.body로 포털한다 — ConfirmPopup.jsx:78-83에 이미 적힌 결함과
  // 같은 자리·같은 원인이다. 이 컴포넌트의 소비처(Lnb.jsx의 onBlocked)도 nav.lnb
  // 안이다 — position:sticky + z-index:1 스태킹 컨텍스트라, 그 안에서 fixed
  // z-102를 줘도 페이지 기준으로는 z:1로 취급돼 본문 콘텐츠가 dim과 팝업 위로
  // 비친다. ConfirmPopup은 그 결함을 이미 포털로 고쳤고 이 컴포넌트만 남아
  // 있었다 — round10c에서 나란히 정리한다.
  // round10c Task A3 — 맨 아래가 아니면 dim 배경만 투명으로 덮어쓴다(NodeModal.jsx와
  // 같은 관행). `.dim`의 position:fixed·크기·z-index는 CSS가 그대로 유지한다.
  const dimClass = isBottom ? 'dim is_active' : 'dim is_active bg-transparent'
  return createPortal(
    <>
      {/* dim은 팝업의 부모가 아니라 형제다(퍼블 구조). 따라서 팝업 카드에
          stopPropagation을 두지 않는다 — 애초에 전파되지 않는다(§6.8.1).
          키보드 사용자의 닫기 경로는 Esc와 확인 버튼이 담당한다. */}
      <div className={dimClass} onClick={close} />

      <div
        className="alert_popup is_active"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onTrapKeyDown}
      >
        <div className="alert_popup_head">
          <p className="alert_popup_tit" id={titleId}>{alert.title}</p>
          <p className="alert_popup_desc" id={descId}>{alert.desc}</p>
        </div>
        <button
          type="button"
          className="btn btn_lg btn_outline_primary"
          ref={confirmRef}
          onClick={close}
        >
          확인
        </button>
      </div>
    </>,
    document.body,
  )
}
