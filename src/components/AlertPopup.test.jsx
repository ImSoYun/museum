import { useRef, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AlertPopup from './AlertPopup.jsx'

/**
 * 트리거 → 열림 → 닫힘 → 트리거 복귀까지를 한 트리에서 재현하는 하네스.
 * 퍼블 common.js의 lastTrigger 동작(:39·:51)을 React ref로 옮긴 것이 맞는지 본다.
 */
function Harness({ kind = 'system_access' }) {
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>시스템관리</button>
      <AlertPopup kind={open ? kind : null} onClose={() => setOpen(false)} triggerRef={triggerRef} />
    </>
  )
}

test('AlertPopup: kind가 null이면 아무것도 렌더하지 않는다', () => {
  const { container } = render(<AlertPopup kind={null} onClose={() => {}} />)
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

test('AlertPopup: role=alertdialog + aria-modal + 제목·설명 id 연결 (2종 모두)', () => {
  const { unmount } = render(<AlertPopup kind="system_access" onClose={() => {}} />)
  const dialog = screen.getByRole('alertdialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')))
    .toHaveTextContent('접근 권한 제한')
  // 퍼블 원문 "총괄 관리자"를 역할 어휘 정본에 맞춰 "통합관리자"로 교정한 값이다(§13 U-3)
  expect(document.getElementById(dialog.getAttribute('aria-describedby')))
    .toHaveTextContent('통합관리자에게 있습니다.')
  unmount()

  render(<AlertPopup kind="wip" onClose={() => {}} />)
  const wip = screen.getByRole('alertdialog')
  expect(wip).toHaveAttribute('aria-modal', 'true')
  expect(document.getElementById(wip.getAttribute('aria-labelledby')))
    .toHaveTextContent('준비 중입니다')
  expect(document.getElementById(wip.getAttribute('aria-describedby')))
    .toHaveTextContent('빠른 시일 내에 서비스할 예정입니다.')
})

test('AlertPopup: 확인 버튼을 누르면 닫힌다', () => {
  const onClose = vi.fn()
  render(<AlertPopup kind="wip" onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('AlertPopup: Escape로 닫힌다', () => {
  const onClose = vi.fn()
  render(<AlertPopup kind="wip" onClose={onClose} />)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('AlertPopup: dim을 클릭하면 닫힌다', () => {
  const onClose = vi.fn()
  // round10c — dim도 팝업과 함께 document.body로 포털된다. 마운트 지점(render
  // 컨테이너) 안에는 더 이상 없으므로 body에서 찾는다(ConfirmPopup.test.jsx와 동형).
  render(<AlertPopup kind="wip" onClose={onClose} />)
  const dim = document.body.querySelector('.dim')
  expect(dim).not.toBeNull()
  fireEvent.click(dim)
  expect(onClose).toHaveBeenCalledTimes(1)
})

// round10c 포털 계약 — AlertPopup의 소비처(Lnb.jsx onBlocked)도 ConfirmPopup의
// 소비처(LnbHistory)와 같은 nav.lnb(position:sticky + z-index:1) 안이라 같은 결함을
// 겪는다. ConfirmPopup.test.jsx의 포털 시험과 같은 계약을 이 파일에도 잠근다.
test('AlertPopup: dim·alert_popup 모두 document.body의 자식이고, dim은 alert_popup의 형제다', () => {
  const { container } = render(<AlertPopup kind="wip" onClose={() => {}} />)

  // 마운트 지점 안에는 없다
  expect(container.querySelector('.dim')).toBeNull()
  expect(container.querySelector('.alert_popup')).toBeNull()

  const dialog = screen.getByRole('alertdialog')
  const dim = document.body.querySelector('.dim.is_active')
  expect(dialog.parentElement).toBe(document.body)
  expect(dim).not.toBeNull()
  expect(dim.parentElement).toBe(document.body)
  // 형제 관계 — 퍼블 구조(dim이 팝업의 부모가 아니다)가 포털 이후에도 유지된다
  expect(dim.nextElementSibling).toBe(dialog)
})

test('AlertPopup: 닫히면 배경 스크롤 잠금도 풀린다', () => {
  const { unmount } = render(<AlertPopup kind="wip" onClose={() => {}} />)
  expect(document.body.style.overflow).toBe('hidden')
  unmount()
  expect(document.body.style.overflow).not.toBe('hidden')
})

test('AlertPopup: 열리면 확인 버튼에 포커스, 닫히면 트리거로 복귀하며 Tab이 밖으로 새지 않는다', () => {
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: '시스템관리' })
  fireEvent.click(trigger)

  const confirm = screen.getByRole('button', { name: '확인' })
  expect(document.activeElement).toBe(confirm)

  // aria-modal="true" 계약 이행 — Tab은 preventDefault 되므로 dispatch가 false를 반환한다
  expect(fireEvent.keyDown(confirm, { key: 'Tab' })).toBe(false)

  fireEvent.click(confirm)
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
