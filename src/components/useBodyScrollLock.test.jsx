import { render, cleanup } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import useBodyScrollLock from './useBodyScrollLock.js'
import ConfirmPopup from './ConfirmPopup.jsx'

function Probe({ locked }) {
  useBodyScrollLock(locked)
  return null
}

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

test('locked=true 면 body 스크롤이 잠기고, false 로 바뀌면 풀린다', () => {
  const { rerender } = render(<Probe locked />)
  expect(document.body.style.overflow).toBe('hidden')
  rerender(<Probe locked={false} />)
  expect(document.body.style.overflow).not.toBe('hidden')
})

test('언마운트되면 풀린다 — 모달이 사라지며 잠금이 남으면 화면 전체가 굳는다', () => {
  const { unmount } = render(<Probe locked />)
  expect(document.body.style.overflow).toBe('hidden')
  unmount()
  expect(document.body.style.overflow).not.toBe('hidden')
})

// 이 테스트가 이 훅의 존재 이유다. OutputDetailPage 는 공용 Modal(노드 목록) 안에서
// MaterialModal 을 연다 — 안쪽이 닫힐 때 바깥이 아직 열려 있는데 잠금이 풀리면
// 배경이 다시 스크롤된다. 단순 useEffect 구현은 이 케이스에서만 빨개진다.
test('겹쳐 잠갔다가 하나만 풀면 아직 잠겨 있다', () => {
  const { unmount: unmountOuter } = render(<Probe locked />)
  const { unmount: unmountInner } = render(<Probe locked />)
  expect(document.body.style.overflow).toBe('hidden')

  unmountInner()
  expect(document.body.style.overflow).toBe('hidden')   // 바깥이 남아 있다

  unmountOuter()
  expect(document.body.style.overflow).not.toBe('hidden')
})

test('원래 값이 있었으면 그 값으로 되돌린다', () => {
  document.body.style.overflow = 'scroll'
  const { unmount } = render(<Probe locked />)
  expect(document.body.style.overflow).toBe('hidden')
  unmount()
  expect(document.body.style.overflow).toBe('scroll')
})

// round10c — 이 시험이 이 태스크의 존재 이유다(task-A2-brief.md §깨지는 순서 ①~④).
// ConfirmPopup은 이 훅을 쓰지 않는 독립 잠금 장치였고, round10b가 공용 Modal을
// body로 포털하면서 ConfirmPopup과 같은 평면에 겹쳐 뜰 자리가 생겼다. Probe는
// "이 훅을 쓰는 아무 소비처"(Modal·MaterialModal과 동형)를 대표한다 — 실제 Modal.jsx
// 는 다른 작업자가 같은 라운드에서 건드리고 있어 이 파일에서 임포트하지 않는다.
//
// 고치기 전(ConfirmPopup이 직접 prev를 저장·복원)에는:
//   ① ConfirmPopup 열림 — prev="" 저장, body.overflow="hidden"
//   ② Probe(훅) 열림 — lockCount 0→1, savedOverflow="hidden"(남의 값을 제 것으로 기억)
//   ③ ConfirmPopup 닫힘 — body.overflow=prev="" ← Probe가 열려 있는데 잠금이 샌다
//   ④ Probe 닫힘 — lockCount 1→0, body.overflow=savedOverflow="hidden" ← 영영 갇힌다
// 이었다. ConfirmPopup이 이 훅(참조 계수)으로 갈아끼워진 뒤에는 ③에서 여전히
// hidden이어야 하고 ④에서 비로소 풀려야 한다.
test('ConfirmPopup과 훅 소비처가 겹쳐 열렸다가 엇갈려 닫혀도 잠금이 새지도 영영 갇히지도 않는다', () => {
  // ① ConfirmPopup 열림
  const { unmount: unmountConfirm } = render(
    <ConfirmPopup open quote="자료" onConfirm={() => {}} onCancel={() => {}} />,
  )
  expect(document.body.style.overflow).toBe('hidden')

  // ② 그 상태에서 훅을 쓰는 다른 소비처(Modal 등)가 겹쳐 열림
  const { unmount: unmountProbe } = render(<Probe locked />)
  expect(document.body.style.overflow).toBe('hidden')

  // ③ ConfirmPopup만 닫힘 — Probe가 아직 열려 있으므로 잠금이 유지돼야 한다
  unmountConfirm()
  expect(document.body.style.overflow).toBe('hidden')

  // ④ 남은 Probe도 닫힘 — 이제야 풀려야 한다
  unmountProbe()
  expect(document.body.style.overflow).not.toBe('hidden')
})
