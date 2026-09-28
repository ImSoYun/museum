/**
 * 이 파일의 책임: useOverlayStack(useIsBottomOverlay)이 "열린 오버레이 스택의 맨 아래"를
 * 매번 올바르게 파생하는지 검증한다.
 *
 * ★ 3번 시험이 이 파일의 존재 이유다 — 마운트 시점 1회 판정("내가 열릴 때 이미 열린 게
 * 있으면 나는 투명")이면 **닫는 순서가 엇갈릴 때** 깨진다. 바깥이 먼저 닫히면 남은
 * 안쪽은 "나는 투명"인 채로 고정돼 있어 딤이 하나도 없는 모달이 된다. 그래서 판정은
 * 스택의 현재 상태에서 매번 다시 파생돼야 한다(useOverlayStack.js 머리주석 참조).
 */
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import useIsBottomOverlay from './useOverlayStack.js'
import Modal from './Modal.jsx'
import MaterialModal from '../pages/results/MaterialModal.jsx'
import { ToastProvider } from './Toast.jsx'

afterEach(() => {
  cleanup()
})

// 훅을 쓰는 "아무 소비처"를 대표하는 프로브. active=false면 언마운트와 동형이 되도록
// 부모가 조건부 렌더로 마운트/언마운트를 직접 제어한다(아래 테스트가 그렇게 쓴다).
function Probe({ label, onClose }) {
  const isBottom = useIsBottomOverlay(true)
  return (
    <div data-testid={label} data-bottom={isBottom ? 'true' : 'false'} onClick={onClose}>
      {label}
    </div>
  )
}

function isBottom(label) {
  return screen.getByTestId(label).getAttribute('data-bottom') === 'true'
}

test('1. 오버레이가 하나면 딤이 있다(맨 아래다)', () => {
  render(<Probe label="a" onClose={() => {}} />)
  expect(isBottom('a')).toBe(true)
})

test('2. 둘이 겹쳐 열리면 아래 것만 딤이 있고 위엣것은 투명하다', () => {
  render(
    <>
      <Probe label="outer" onClose={() => {}} />
      <Probe label="inner" onClose={() => {}} />
    </>,
  )
  expect(isBottom('outer')).toBe(true)
  expect(isBottom('inner')).toBe(false)
})

// ★★★ 마운트 1회 판정이면 실패하는 시험 ★★★
test('3. 아래 것을 먼저 닫으면 남은 위엣것이 딤을 되찾는다', () => {
  function Host() {
    const [outerOpen, setOuterOpen] = useState(true)
    return (
      <>
        {outerOpen && <Probe label="outer" onClose={() => {}} />}
        <Probe label="inner" onClose={() => {}} />
        <button onClick={() => setOuterOpen(false)}>바깥 닫기</button>
      </>
    )
  }
  render(<Host />)
  expect(isBottom('outer')).toBe(true)
  expect(isBottom('inner')).toBe(false)

  // 바깥(스택 맨 아래)을 먼저 닫는다 — 닫는 순서가 엇갈리는 경로.
  fireEvent.click(screen.getByRole('button', { name: '바깥 닫기' }))

  // 남은 inner가 이제 스택 맨 아래이므로 딤을 되찾아야 한다.
  expect(screen.queryByTestId('outer')).toBeNull()
  expect(isBottom('inner')).toBe(true)
})

test('4. 셋이 겹쳐도 딤은 하나뿐이다', () => {
  render(
    <>
      <Probe label="a" onClose={() => {}} />
      <Probe label="b" onClose={() => {}} />
      <Probe label="c" onClose={() => {}} />
    </>,
  )
  const bottoms = ['a', 'b', 'c'].filter(isBottom)
  expect(bottoms).toEqual(['a'])
})

// 5번은 아래 「6.」 describe로 옮겼다 — round10c 전브랜치 리뷰 I3.
//
// 여기 있던 시험은 Probe(위 :24-31)를 클릭했는데, Probe는 isBottom을 data-속성에만 쓰고
// 요소는 늘 렌더한다. 그러니 **어떤 회귀에서도 빨개질 수 없었다.** 지켜야 할 제약
// (「딤 요소를 조건부로 없애지 않는다 — 배경 클릭 닫기가 거기 달려 있다」)이 사는 코드는
// Modal.jsx·MaterialModal.jsx·AlertPopup.jsx·ConfirmPopup.jsx·NodeModal.jsx의 오버레이
// 렌더 줄인데, Probe는 그중 하나도 거치지 않는다. 그래서 실제 Modal을 쓰는 6번으로 옮긴다.

// 6. Modal + MaterialModal을 실제로 겹쳐 렌더해 2·3을 다시 확인한다
// (OutputDetailPage가 그 조합을 쓴다 — 목록 Modal 안에서 유물 한 건을 MaterialModal로 연다).
vi.mock('../lib/searchApi.js', () => ({
  isLive: vi.fn(() => false),
  fetchArtifactDetail: vi.fn().mockResolvedValue({ ok: false }),
}))

const DUMMY_MATERIAL = {
  id: 'm1',
  title: '유물 상세',
  meta: { location: '서울', theme: '근현대사', period: '1960', detail: '설명' },
  source: '출처: 더미',
}

function overlayDims() {
  // Modal·MaterialModal 모두 body에 fixed inset-0 오버레이를 포털한다(round10b/A1).
  return Array.from(document.body.querySelectorAll('.fixed.inset-0'))
}

describe('6. Modal + MaterialModal 실제 조합(OutputDetailPage가 쓰는 조합)', () => {
  function Host() {
    const [openMaterial, setOpenMaterial] = useState(null)
    return (
      <ToastProvider>
        <Modal open title="목록" onClose={() => {}}>
          <button onClick={() => setOpenMaterial(DUMMY_MATERIAL)}>유물 열기</button>
        </Modal>
        <MaterialModal material={openMaterial} onClose={() => setOpenMaterial(null)} />
      </ToastProvider>
    )
  }

  test('둘이 겹치면 아래(Modal)만 불투명, 위(MaterialModal)는 투명 배경', () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: '유물 열기' }))

    const [outer, inner] = overlayDims()
    expect(outer).toBeDefined()
    expect(inner).toBeDefined()
    expect(outer.className).toContain('bg-[rgba(20,26,46,.5)]')
    expect(inner.className).not.toContain('bg-[rgba(20,26,46,.5)]')
    expect(inner.className).toContain('bg-transparent')
  })

  test('아래(Modal)를 먼저 닫으면 남은 MaterialModal이 딤을 되찾는다', () => {
    function ToggleHost() {
      const [modalOpen, setModalOpen] = useState(true)
      const [openMaterial, setOpenMaterial] = useState(DUMMY_MATERIAL)
      return (
        <ToastProvider>
          <Modal open={modalOpen} title="목록" onClose={() => {}}>
            body
          </Modal>
          <MaterialModal material={openMaterial} onClose={() => setOpenMaterial(null)} />
          <button onClick={() => setModalOpen(false)}>목록 닫기</button>
        </ToastProvider>
      )
    }
    render(<ToggleHost />)

    const [, inner] = overlayDims()
    expect(inner.className).toContain('bg-transparent')

    fireEvent.click(screen.getByRole('button', { name: '목록 닫기' }))

    const remaining = overlayDims()
    expect(remaining.length).toBe(1)
    expect(remaining[0].className).toContain('bg-[rgba(20,26,46,.5)]')
  })

  // round10c 전브랜치 리뷰 I3 — 옛 5번을 실제 오버레이 위에서 다시 세운다.
  //
  // 투명하게 만드는 것과 지우는 것은 화면에서 똑같아 보이지만 다르다 — 지우면 배경 클릭으로
  // 닫는 경로가 함께 사라진다. 이 시험은 **투명해진 쪽 오버레이를 직접 눌러** 그 경로가
  // 살아 있는지 본다. 구현이 `bg-transparent` 대신 조건부 렌더로 바뀌면 빨개진다.
  test('투명해진 오버레이도 클릭하면 onClose가 불린다(요소가 살아 있다)', () => {
    const onCloseMaterial = vi.fn()
    render(
      <ToastProvider>
        <Modal open title="목록" onClose={() => {}}>body</Modal>
        <MaterialModal material={DUMMY_MATERIAL} onClose={onCloseMaterial} />
      </ToastProvider>,
    )

    const [, inner] = overlayDims()
    expect(inner.className, '위엣것이 투명해야 이 시험이 뜻을 갖는다').toContain('bg-transparent')

    fireEvent.click(inner)
    expect(onCloseMaterial).toHaveBeenCalledTimes(1)
  })
})
