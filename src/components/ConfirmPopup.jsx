import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import useBodyScrollLock from './useBodyScrollLock.js'
import useIsBottomOverlay from './useOverlayStack.js'

/**
 * 이 파일의 책임: 퍼블 삭제 확인 팝업 — alert_popup의 2버튼 변형(#history_delete_alert
 * 미러). 중앙 24rem 카드에 [제목(section_tit) / 대상 인용(alert_popup_quote) /
 * 설명(alert_popup_desc) / 아니오·네(popup_actions)] 구조다(lnb.js:156-165).
 *
 * 왜 ConfirmDialog(Modal)를 쓰지 않는가 — 그쪽은 라운드4 시절 범용 Tailwind 모달
 * ([좌측 제목 + 우측 X] 헤더·구분선·우측 정렬 footer·max-w-lg=512px)이라 퍼블 디자인과
 * 전혀 다르다. 나의 기록 삭제는 퍼블에 정확한 정본(#history_delete_alert)이 있는
 * 화면이므로 퍼블을 따른다(사용자 신고 2026-07-28 "삭제할 때 UI가 매우 이상하다").
 * 다른 ConfirmDialog 소비처(관리 화면들)는 이번 범위 밖 — 그대로 둔다.
 *
 * 왜 AlertPopup을 확장하지 않는가 — 그 컴포넌트는 "kind 사전(ALERTS) 기반 1버튼 알림"
 * 이라는 좁은 계약을 도크스트링으로 못박았다(§6.6.4 — Modal과 억지로 겹치면 둘 다
 * 나빠진다는 같은 논리). 2버튼 확인은 대상 인용·확정 콜백이 필요해 계약이 다르다.
 * 대신 a11y 관행(Esc·dim 클릭 닫기·스크롤 잠금·포커스 이동·트랩)은 그대로 미러링한다.
 *
 * 표시 계약(§34): alert_popup·dim 모두 CSS 기본이 display:none이고 is_active에서만
 * 보인다. 조건부 렌더(open)와 겹치지만 클래스를 상시 동봉한다 — 케밥 메뉴 결함과
 * 같은 함정을 피하기 위한 이 파일의 불변식이다.
 */
export default function ConfirmPopup({
  open,
  title = '삭제 알림',
  quote,
  desc = '항목을 삭제하시겠습니까?',
  cancelLabel = '아니오',
  confirmLabel = '네',
  onConfirm,
  onCancel,
}) {
  const uid = useId()
  const confirmRef = useRef(null)

  // 열릴 때 확정 버튼으로 포커스(퍼블 initModal focusTarget '#history_delete_confirm').
  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  // Esc 닫기 — 열려 있는 동안만 문서에 붙였다 뗀다(AlertPopup과 동형).
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  // 열린 동안 배경 스크롤 잠금(AlertPopup §6.8.3과 동형 — dim이 전면 fixed인데
  // 뒤가 스크롤되면 시각적으로 모순이다).
  //
  // round10c — 예전엔 이 자리에서 prev를 직접 저장·복원했다(AlertPopup도 마찬가지).
  // 공용 Modal이 body로 포털되며(round10b) 이 팝업과 같은 평면에서 겹쳐 뜰 수
  // 있게 됐는데, 겹쳐 열렸다가 닫히는 순서가 엇갈리면(이 팝업이 열린 채로 Modal이
  // 열리고 이 팝업이 먼저 닫히면) 남의 prev 값으로 되돌리면서 아직 열린 Modal의
  // 잠금을 풀어 버리고, Modal이 나중에 닫히면 아무도 없는데 hidden에 영영 갇힌다
  // (useBodyScrollLock.js 머리주석 참조). 이 훅의 모듈 스코프 참조 계수로 넷
  // (useBodyScrollLock·Modal·AlertPopup·ConfirmPopup)을 하나로 합쳐 없앤다.
  useBodyScrollLock(open)

  // round10c Task A3 — 겹쳐 열려도 딤은 한 겹만(AlertPopup.jsx와 동형 — useOverlayStack.js
  // 머리주석 참조: 판정은 스택의 현재 상태에서 매번 파생되므로 닫는 순서가 엇갈려도
  // 남은 위엣것이 딤을 되찾는다).
  const isBottom = useIsBottomOverlay(open)

  if (!open) return null

  const titleId = `${uid}-tit`
  const descId = `${uid}-desc`

  // 포커스 가능 요소가 아니오·네 2개뿐이므로 Tab을 둘 사이 순환으로 가둔다 —
  // aria-modal="true" 선언(퍼블 마크업)의 이행이다(AlertPopup 도크스트링 참조.
  // 그쪽은 대상이 1개라 차단으로 족했고, 여기는 2개라 토글이 곧 순환이다).
  const onTrapKeyDown = (e) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const current = document.activeElement
    const buttons = e.currentTarget.querySelectorAll('button')
    const next = current === buttons[0] ? buttons[1] : buttons[0]
    next?.focus()
  }

  // 반드시 document.body로 포털한다 — 퍼블이 팝업을 body 끝에 주입하는(lnb.js:134)
  // 계약의 React 번역이다. 소비처(LnbHistory)가 사는 nav.lnb가 position:sticky +
  // z-index:1 스태킹 컨텍스트라, 그 안에서 fixed z-102를 줘도 페이지 기준 z:1로
  // 취급돼 본문 콘텐츠가 dim과 팝업 위로 비친다(2026-07-28 dev 실측 — 사용자 신고
  // "삭제할 때 UI가 매우 이상하다"의 두 번째 원인).
  // round10c Task A3 — 맨 아래가 아니면 dim 배경만 투명으로 덮어쓴다(AlertPopup.jsx와
  // 같은 관행). `.dim`의 position:fixed·크기·z-index는 CSS가 그대로 유지한다.
  const dimClass = isBottom ? 'dim is_active' : 'dim is_active bg-transparent'
  return createPortal(
    <>
      {/* dim은 팝업의 형제다(퍼블 구조 — AlertPopup과 동일). 클릭 닫기는 취소로 취급. */}
      <div className={dimClass} onClick={onCancel} />

      <div
        className="alert_popup is_active"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onTrapKeyDown}
      >
        <div className="alert_popup_head">
          {/* 제목 클래스는 퍼블 실측 그대로 section_tit(alert_popup_tit이 아님 — lnb.js:158). */}
          <p className="section_tit" id={titleId}>{title}</p>
          {quote && <p className="alert_popup_quote">{quote}</p>}
          <p className="alert_popup_desc" id={descId}>{desc}</p>
        </div>
        <div className="popup_actions">
          <button type="button" className="btn btn_lg btn_gray" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn_lg btn_primary" ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
