/**
 * 이 파일의 책임: ConfirmPopup(퍼블 삭제 확인 — alert_popup 2버튼 변형)의 렌더·클래스
 * 계약과 닫기/확정 경로를 검증한다.
 *
 * 배경(사용자 신고 2026-07-28): 나의 기록 삭제 확인이 라운드4 시절 범용 Tailwind 모달
 * (ConfirmDialog→Modal, 좌측 제목+우측 X+전폭 바닥 footer)로 떠서 퍼블 디자인과 전혀
 * 달랐다. 퍼블 정본은 lnb.js가 body에 주입하는 #history_delete_alert — 중앙 24rem
 * alert_popup 카드에 [삭제 알림 / 기록명 인용 / 항목을 삭제하시겠습니까? / 아니오·네]
 * 구조다. 이 컴포넌트가 그 마크업을 미러링한다(styles/publish/component.css의
 * alert_popup 그룹 + 신규 반입 alert_popup_quote·popup_actions·btn_gray 소비).
 *
 * jsdom은 CSS를 로드하지 않으므로(§34) 표시 계약은 클래스 단언으로 잠근다 —
 * alert_popup·dim 모두 is_active 동봉이 표시 조건이다(케밥 메뉴와 같은 토글 계약).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ConfirmPopup from './ConfirmPopup.jsx'

const baseProps = () => ({
  open: true,
  quote: '민주화운동 관련 자료',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
})

test('open=false면 아무것도 렌더하지 않는다', () => {
  const { container } = render(<ConfirmPopup {...baseProps()} open={false} />)
  expect(container).toBeEmptyDOMElement()
})

// 포털 계약 — 퍼블은 팝업을 body 끝에 주입한다(lnb.js:134 insertAdjacentHTML).
// 이유가 dev 실측으로 드러났다: 소비처(LnbHistory)가 사는 nav.lnb가 position:sticky
// + z-index:1 스태킹 컨텍스트라, 안에서 fixed z-102를 줘도 페이지 기준으로는 z:1로
// 취급돼 본문이 팝업 위로 비친다. createPortal(document.body)가 그 퍼블 계약의
// React 번역이다 — 렌더 트리 안(마운트 지점 하위)에는 팝업이 없어야 한다.
test('팝업은 마운트 지점이 아니라 document.body로 포털된다(퍼블 body 주입 계약)', () => {
  const { container } = render(<ConfirmPopup {...baseProps()} />)

  // 마운트 지점(render 컨테이너) 안에는 없다
  expect(container.querySelector('.alert_popup')).toBeNull()
  expect(container.querySelector('.dim')).toBeNull()
  // document.body 직계로 나가 있다
  expect(screen.getByRole('alertdialog').parentElement).toBe(document.body)
})

test('퍼블 #history_delete_alert 구조로 렌더된다 — 제목·인용·설명·아니오/네', () => {
  render(<ConfirmPopup {...baseProps()} />)

  const dialog = screen.getByRole('alertdialog')
  expect(dialog).toHaveClass('alert_popup', 'is_active')

  // 제목은 퍼블과 동일하게 section_tit(alert_popup_tit이 아님 — lnb.js:158 실측)
  expect(screen.getByText('삭제 알림')).toHaveClass('section_tit')
  // 기록명 인용 줄(퍼블 #history_delete_quote)
  expect(screen.getByText('민주화운동 관련 자료')).toHaveClass('alert_popup_quote')
  expect(screen.getByText('항목을 삭제하시겠습니까?')).toHaveClass('alert_popup_desc')

  // 하단 2버튼 — popup_actions 래퍼, 아니오=btn_gray / 네=btn_primary(퍼블 lnb.js:163-164)
  const cancel = screen.getByRole('button', { name: '아니오' })
  const confirm = screen.getByRole('button', { name: '네' })
  expect(cancel.parentElement).toHaveClass('popup_actions')
  expect(cancel).toHaveClass('btn', 'btn_lg', 'btn_gray')
  expect(confirm).toHaveClass('btn', 'btn_lg', 'btn_primary')
})

test('열리면 확정(네) 버튼에 포커스가 간다(퍼블 initModal focusTarget 계약)', () => {
  render(<ConfirmPopup {...baseProps()} />)
  expect(screen.getByRole('button', { name: '네' })).toHaveFocus()
})

test('네 클릭 → onConfirm, 아니오 클릭 → onCancel', () => {
  const props = baseProps()
  render(<ConfirmPopup {...props} />)

  fireEvent.click(screen.getByRole('button', { name: '네' }))
  expect(props.onConfirm).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('button', { name: '아니오' }))
  expect(props.onCancel).toHaveBeenCalledTimes(1)
})

test('dim 클릭·Escape 모두 onCancel로 간다(퍼블 initModal 닫기 경로)', () => {
  const props = baseProps()
  render(<ConfirmPopup {...props} />)

  // dim도 팝업과 함께 body로 포털된다 — render 컨테이너가 아니라 body에서 찾는다.
  const dim = document.body.querySelector('.dim')
  expect(dim).toHaveClass('is_active')
  fireEvent.click(dim)
  expect(props.onCancel).toHaveBeenCalledTimes(1)

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(props.onCancel).toHaveBeenCalledTimes(2)
})
