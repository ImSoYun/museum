import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal, { useEscapeToClose } from './Modal.jsx'

test('Modal: size="doc" renders wide class max-w-[1180px]', () => {
  render(
    <Modal open title="Doc Modal" onClose={() => {}} size="doc">
      content
    </Modal>
  )
  // The panel div should have the doc-tier wide class
  const panel = screen.getByText('content').closest('[class*="max-w-"]')
  expect(panel).not.toBeNull()
  expect(panel.className).toContain('max-w-[1180px]')
})

test('Modal: clicking overlay calls onClose', () => {
  const onClose = vi.fn()
  render(
    <Modal open title="Overlay Test" onClose={onClose}>
      body
    </Modal>
  )
  // The overlay is the outermost fixed div; click it directly
  const overlay = screen.getByText('body').closest('[class*="fixed inset-0"]')
  expect(overlay).not.toBeNull()
  fireEvent.click(overlay)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('Modal: clicking panel does NOT call onClose (stopPropagation)', () => {
  const onClose = vi.fn()
  render(
    <Modal open title="Panel Test" onClose={onClose}>
      panel-content
    </Modal>
  )
  const panel = screen.getByText('panel-content').closest('[class*="rounded-2xl"]')
  expect(panel).not.toBeNull()
  fireEvent.click(panel)
  expect(onClose).not.toHaveBeenCalled()
})

test('Modal: animate-overlayIn class on overlay', () => {
  render(
    <Modal open title="Anim Test" onClose={() => {}}>
      anim
    </Modal>
  )
  const overlay = screen.getByText('anim').closest('[class*="fixed inset-0"]')
  expect(overlay.className).toContain('animate-overlayIn')
})

test('Modal: animate-modalIn class on panel', () => {
  render(
    <Modal open title="Anim Panel" onClose={() => {}}>
      panel
    </Modal>
  )
  const panel = screen.getByText('panel').closest('[class*="rounded-2xl"]')
  expect(panel.className).toContain('animate-modalIn')
})

// ── round10a 최종리뷰 I-5 — escapeStack 이 콜백 identity 한 번에 뒤집힌다 ──────────
// 겹쳐 열린 두 레이어(예: 모달 위의 라이트박스)를 흉내 낸다. 선언 순서가 실제 버그의
// 핵심이다 — MaterialModal.jsx는 나중에 여는 라이트박스용 useEscapeToClose를 먼저
// 선언하고, 바깥(상세)용을 나중에 선언한다(:111·:118). 순서를 바꾸면 이 시험이
// 재현하려는 결함 자체가 사라지므로 여기서도 같은 순서를 지킨다.
function Layers({ onOuterEscape }) {
  const [innerOpen, setInnerOpen] = useState(false)
  useEscapeToClose(innerOpen, () => setInnerOpen(false))
  useEscapeToClose(true, onOuterEscape)
  return (
    <div>
      <button onClick={() => setInnerOpen(true)}>안쪽 레이어 열기</button>
      <div data-testid="inner-state">{innerOpen ? 'open' : 'closed'}</div>
    </div>
  )
}

// ⚠️ 이 시험이 지금 green인 이유가 "onEscape가 고정 identity vi.fn()이고 리렌더가
// 없어서"이면 안 된다 — 그래서 Host는 매 리렌더 새 클로저를 onOuterEscape로 내려보낸다
// (ChatTab.jsx onClose={() => setOpenMaterial(null)}처럼 매 렌더 새 함수를 만드는
// 흔한 패턴). 고정 identity로 시험하면 이 결함이 절대 드러나지 않는다.
test('I-5: 바깥 핸들러의 identity가 부모 리렌더로 바뀌어도, 나중에 연 안쪽 레이어가 계속 스택 맨 위다', () => {
  const outerCalls = []
  function Host() {
    const [, setTick] = useState(0)
    return (
      <>
        <button onClick={() => setTick((t) => t + 1)}>부모 리렌더</button>
        <Layers onOuterEscape={() => outerCalls.push('outer')} />
      </>
    )
  }
  render(<Host />)

  fireEvent.click(screen.getByRole('button', { name: '안쪽 레이어 열기' }))
  expect(screen.getByTestId('inner-state')).toHaveTextContent('open')

  // 부모가 리렌더해 onOuterEscape의 identity가 바뀐다(안쪽 레이어는 열린 채로).
  fireEvent.click(screen.getByRole('button', { name: '부모 리렌더' }))

  fireEvent.keyDown(document, { key: 'Escape' })

  // 안쪽 레이어가 여전히 스택 맨 위라 Escape를 먼저 먹는다 — 바깥은 불리지 않는다.
  expect(screen.getByTestId('inner-state')).toHaveTextContent('closed')
  expect(outerCalls).toEqual([])
})

// ── round10b 라이브 결함 L1 — 모달을 body 로 포털한다 ────────────────────────
//
// 배포본에서 재현(2026-09-18, 사용자 신고): 홈에서 「나의 기록 → 라이브러리 저장」을 열면
// **홈의 검색 영역과 추천 카드가 모달 위로 그려졌다.** z-index 경합이 아니었다 —
// 모달 위에 그려진 홈 요소들은 z-index 가 아예 없었다.
//
// 원인은 쌓임 맥락(stacking context)이다:
//     모달 → .lnb_history 안에 렌더 → 조상 .lnb        { position: sticky; z-index: 1 }
//     홈   →                          조상 .intro_main  { position: relative; z-index: 1 }
// 둘 다 1 로 동률이고 동률이면 DOM 뒤쪽이 이긴다. `.intro_main` 이 뒤에 있어 홈이 이겼다.
// 모달의 z-index:50 은 **`.lnb` 맥락 안에서만** 의미가 있어 `.lnb` 자체를 넘지 못한다.
//
// 그래서 오버레이를 document.body 로 포털한다 — 맥락이 루트가 되어 z-50 이 제 뜻대로 된다.
// `.lnb` 나 `.intro_main` 의 z-index 를 만지는 것은 대증요법이다(다음 맥락에서 또 난다).
describe('L1 — 오버레이는 body 로 포털된다', () => {
  it('오버레이가 렌더 위치가 아니라 document.body 의 자식으로 붙는다', () => {
    const { container } = render(
      <div id="host" style={{ position: 'relative', zIndex: 1 }}>
        <Modal open title="T" onClose={() => {}}>본문</Modal>
      </div>,
    )
    // 렌더한 자리(container)에는 오버레이가 없다
    expect(container.querySelector('.fixed.inset-0')).toBeNull()
    // body 아래에서는 찾아진다
    const overlay = document.body.querySelector('.fixed.inset-0.z-50')
    expect(overlay).not.toBeNull()
    expect(overlay.parentElement).toBe(document.body)
  })

  it('닫으면 body 에서 사라진다', () => {
    const { rerender } = render(<Modal open title="T" onClose={() => {}}>본문</Modal>)
    expect(document.body.querySelector('.fixed.inset-0.z-50')).not.toBeNull()
    rerender(<Modal open={false} title="T" onClose={() => {}}>본문</Modal>)
    expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
  })
})
