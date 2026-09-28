// 이 파일의 책임: 채팅의 설명문 생성 결정 모달(피그마 ③ — 화면 중앙 팝업).
// 폼 턴·완료 턴은 대화 안 인라인이고 이것만 모달이다.
//
// 문구는 피그마 원문 그대로다 — 요약·다듬기 금지.
//
// round07g — 이 모달은 이제 **가운데만** 소유한다. CaptionModal.test.jsx 와 같은
// 방식으로 두 가지를 나눠 잠근다:
//
//   ① **공용 조각에서 온다는 사실** — 부제·타임라인 보조문구·제목 라벨. 조각을
//      고치면 이 파일과 CaptionModal.test.jsx 가 **함께** 빨개져야 한다.
//      (round07f 는 이 부제를 「결정하세요.」로 따로 적어 두 화면이 갈렸다.)
//   ② **이 화면만의 가운데 순서** — 제목 설정 → 선택 자료. 산출물생성은 반대이고
//      그쪽에만 구분선이 있다. 여기 순서를 그쪽 순서로 바꾸면 **이 파일만** 빨개져야 한다.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatCaptionDecisionModal from './ChatCaptionDecisionModal.jsx'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

const renderModal = (over = {}) =>
  render(
    <ChatCaptionDecisionModal
      open
      count={20}
      onCancel={() => {}}
      onConfirm={() => {}}
      {...over}
    />,
  )

describe('설명문 생성 결정 모달', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    renderModal({ open: false })
    expect(screen.queryByText('설명문 생성')).toBeNull()
  })

  // ── ① 공용 조각에서 오는 것들 ─────────────────────────────────────────────
  it('뼈대 문구를 공용 조각에서 받아 그린다 — 부제·타임라인 보조문구', () => {
    renderModal()
    expect(screen.getByText('설명문 생성')).toBeInTheDocument()
    expect(
      screen.getByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.'),
    ).toBeInTheDocument()
    expect(screen.getByText('선택된 자료들로 타임라인이 생성됩니다.')).toBeInTheDocument()
  })

  it('제목 라벨·placeholder 를 공용 조각에서 받아 그린다', () => {
    renderModal()
    const input = screen.getByLabelText('제목 설정')
    expect(input).toHaveAttribute('placeholder', '설명문 타이틀')
  })

  it('나머지 피그마 문구도 그대로 말한다', () => {
    renderModal()
    expect(screen.getByText('선택 자료')).toBeInTheDocument()
    expect(
      screen.getByText('선택 자료는 대화창 상세보기를 통해 수정할 수 있습니다.'),
    ).toBeInTheDocument()
  })

  // ── ② 이 화면만의 가운데 순서 ─────────────────────────────────────────────
  it('가운데 순서는 제목 설정 → 선택 자료다(산출물생성과 반대)', () => {
    renderModal()
    const html = document.body.innerHTML
    expect(html.indexOf('제목 설정')).toBeGreaterThan(-1)
    expect(html.indexOf('제목 설정')).toBeLessThan(html.indexOf('선택 자료'))
  })

  // 산출물생성 프레임에는 선택 자료와 제목 사이에 구분선이 있고, 이 프레임에는 없다.
  it('구분선을 두지 않는다 — 그것은 산출물생성 프레임의 것이다', () => {
    renderModal()
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('섹션 라벨에 번호를 붙이지 않는다', () => {
    renderModal()
    expect(screen.getByText('선택 자료').textContent).toBe('선택 자료')
    expect(screen.queryByText(/^\d+\.\s/)).toBeNull()
  })

  // 산출물생성은 노드 뱃지로 자료를 보여주지만 여기는 텍스트 두 줄이다 —
  // 자료를 고른 곳도 고치는 곳도 대화(폼 턴의 「상세보기」)이기 때문이다.
  it('선택 자료를 뱃지가 아니라 텍스트 두 줄로 말한다', () => {
    renderModal()
    expect(
      screen.getByText('대화에서 나온 총 20건 자료를 바탕으로 생성하겠습니다.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /선택 해제/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /자료 상세보기/ })).toBeNull()
  })

  // 사용자가 명시적으로 요구한 지점 — 폼에서 ✕로 제외한 것을 **뺀** 건수다.
  // 이 모달은 스스로 세지 않고 폼이 올려 보낸 최종 목록의 길이를 그대로 받는다.
  it('건수는 받은 값을 그대로 말한다(폼에서 3건을 지웠으면 17이다)', () => {
    const { rerender } = renderModal({ count: 20 })
    expect(
      screen.getByText('대화에서 나온 총 20건 자료를 바탕으로 생성하겠습니다.'),
    ).toBeInTheDocument()

    rerender(
      <ChatCaptionDecisionModal open count={17} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(
      screen.getByText('대화에서 나온 총 17건 자료를 바탕으로 생성하겠습니다.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/총 20건/)).toBeNull()
  })

  // round07g — 피그마 프레임에 「제목 설정」 입력칸이 있는데 round07f 가 빠뜨렸다.
  // 형식만 여전히 묻지 않는다(어디서 만들든 DOCX — 사용자 결정 2026-09-03).
  it('제목은 받되 파일 형식은 묻지 않는다', () => {
    renderModal()
    expect(screen.getByLabelText('제목 설정')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    for (const t of ['DOCX', 'HWPX', 'PDF', '파일 형식'])
      expect(screen.queryByText(new RegExp(t))).toBeNull()
  })

  it('제목 기본값은 정본 헬퍼가 정한다 — 타임라인 켜짐 기준값이다', () => {
    renderModal()
    expect(screen.getByLabelText('제목 설정')).toHaveValue(
      defaultOutputTitle('caption', { timeline: true }),
    )
  })

  it('타임라인 체크박스는 기본으로 켜져 있고, 켠 채로 생성하면 timeline:true·제목을 함께 올린다', () => {
    const onConfirm = vi.fn()
    renderModal({ onConfirm })
    expect(screen.getByLabelText('타임라인 생성')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onConfirm).toHaveBeenCalledWith({
      timeline: true,
      title: defaultOutputTitle('caption', { timeline: true }),
    })
  })

  it('타임라인을 끄면 timeline:false 로 생성하고 제목도 꺼짐 기준값으로 따라간다', () => {
    const onConfirm = vi.fn()
    renderModal({ onConfirm })
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onConfirm).toHaveBeenCalledWith({
      timeline: false,
      title: defaultOutputTitle('caption', { timeline: false }),
    })
  })

  // round07f I10 — 산출물생성 모달과 **같은 규칙**이다(공용 훅 useCaptionTitleRule).
  // 학예사가 고쳐 놓은 제목을 체크박스 하나로 덮어쓰면 입력을 빼앗는 셈이다.
  it('학예사가 고친 제목은 타임라인을 토글해도 덮이지 않고, 그대로 올라간다', () => {
    const onConfirm = vi.fn()
    renderModal({ onConfirm })
    fireEvent.change(screen.getByLabelText('제목 설정'), { target: { value: '6월항쟁 캡션' } })
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    expect(screen.getByLabelText('제목 설정')).toHaveValue('6월항쟁 캡션')

    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onConfirm).toHaveBeenCalledWith({ timeline: false, title: '6월항쟁 캡션' })
  })

  it('제목을 비우면 생성할 수 없다', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('제목 설정'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('취소는 onCancel만 부른다 — 생성하지 않는다', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderModal({ onCancel, onConfirm })
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // 취소하고 다시 열었을 때 지난번 선택이 남아 있으면 「기본 켜짐」이 거짓이 된다.
  // 제목도 함께 되돌아와야 한다 — 안 그러면 지난번에 고친 제목이 새 산출물에 붙는다.
  it('다시 열면 타임라인과 제목이 기본값으로 되돌아온다', () => {
    const { rerender } = renderModal()
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    fireEvent.change(screen.getByLabelText('제목 설정'), { target: { value: '지난번 제목' } })
    expect(screen.getByLabelText('타임라인 생성')).not.toBeChecked()

    rerender(
      <ChatCaptionDecisionModal
        open={false} count={20} onCancel={() => {}} onConfirm={() => {}}
      />,
    )
    rerender(
      <ChatCaptionDecisionModal
        open count={20} onCancel={() => {}} onConfirm={() => {}}
      />,
    )
    expect(screen.getByLabelText('타임라인 생성')).toBeChecked()
    expect(screen.getByLabelText('제목 설정')).toHaveValue(
      defaultOutputTitle('caption', { timeline: true }),
    )
  })
})
