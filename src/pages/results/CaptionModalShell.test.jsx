// 이 파일의 책임: 설명문 생성 모달의 **뼈대**(CaptionModalShell) — 두 모달이
// 공유해야 하는 위(헤딩·부제)와 아래(타임라인·버튼)를 여기 한 곳에서 잠근다.
//
// [왜 뼈대만 따로 잠그나]
// 설명문을 만드는 자리가 둘이다 — 산출물생성 페이지(CaptionModal)와 AI 학예
// 도우미 채팅(ChatCaptionDecisionModal). round07f가 채팅 폼을 만들 때 피그마 대신
// 옆 화면을 베꼈고, 그래서 부제 한 줄이 「결정하세요.」/「결정해주세요.」로 갈린 채
// 라이브에 나갔다. 두 벌로 두면 또 갈라진다.
//
// [뼈대가 소유하지 **않는** 것 — 가운데]
// 피그마 프레임 두 장의 가운데 순서가 서로 다르다(채팅=제목→선택자료 /
// 산출물생성=선택자료→구분선→제목). 그래서 뼈대는 가운데를 children 슬롯으로만
// 두고, 순서는 각 모달이 자기 테스트로 잠근다. 여기서 순서를 단언하면 두 모달을
// 억지로 같은 순서로 몰아붙이게 된다.
import { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CaptionModalShell, { useCaptionTitleRule, MAX_CAPTION_ARTIFACTS } from './CaptionModalShell.jsx'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

const noop = () => {}

function renderShell(over = {}) {
  const props = {
    open: true,
    timeline: false,
    onTimelineChange: noop,
    onClose: noop,
    onSubmit: noop,
    ...over,
  }
  return render(
    <CaptionModalShell {...props}>
      <div>가운데슬롯</div>
    </CaptionModalShell>,
  )
}

describe('설명문 생성 모달 뼈대', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    renderShell({ open: false })
    expect(screen.queryByText('설명문 생성')).toBeNull()
    expect(screen.queryByText('가운데슬롯')).toBeNull()
  })

  it('헤딩을 「설명문 생성」으로 그린다', () => {
    renderShell()
    expect(screen.getByText('설명문 생성')).toBeInTheDocument()
  })

  it('부제를 원문 그대로 그린다', () => {
    renderShell()
    expect(
      screen.getByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.'),
    ).toBeInTheDocument()
  })

  it('타임라인 보조문구를 원문대로 그린다', () => {
    renderShell()
    expect(screen.getByLabelText('타임라인 생성')).toBeInTheDocument()
    expect(screen.getByText('선택된 자료들로 타임라인이 생성됩니다.')).toBeInTheDocument()
  })

  it('children 은 부제 아래·타임라인 위에 온다', () => {
    renderShell()
    const html = document.body.innerHTML
    expect(html.indexOf('가운데슬롯')).toBeGreaterThan(-1)
    expect(html.indexOf('결정해주세요')).toBeLessThan(html.indexOf('가운데슬롯'))
    expect(html.indexOf('가운데슬롯')).toBeLessThan(html.indexOf('타임라인 생성'))
  })

  // 뼈대는 가운데를 **모른다**. 「선택 자료」도 「제목 설정」도 각 모달이 children
  // 으로 넣는다 — 순서가 서로 다르기 때문이다(파일 머리말 참조).
  it('가운데 내용을 스스로 그리지 않는다 — 선택 자료도 제목도 뼈대의 것이 아니다', () => {
    renderShell()
    expect(screen.queryByText('선택 자료')).toBeNull()
    expect(screen.queryByText('제목 설정')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  // 사용자 결정 2026-09-03 — 설명문은 어디서 만들든 DOCX 다. 화면에서 고르지 않는다.
  // (서버 CreateOutputRequest.format 은 그대로 남는다 — round11a 에서 렌더러는
  //  DOCX 하나만 남기고 hwpx·pdf 를 지웠다.)
  it('파일 형식을 묻지 않는다', () => {
    renderShell()
    for (const t of ['DOCX', 'HWPX', 'PDF', '파일 형식'])
      expect(screen.queryByText(new RegExp(t))).toBeNull()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('섹션 라벨에 번호를 붙이지 않는다', () => {
    renderShell()
    expect(screen.queryByText(/^\d+\.\s/)).toBeNull()
  })

  it('타임라인 체크는 부모에게 위임한다 — 뼈대는 상태를 갖지 않는다', () => {
    const onTimelineChange = vi.fn()
    renderShell({ onTimelineChange, timeline: false })
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    expect(onTimelineChange).toHaveBeenCalledWith(true)
    // 위임했을 뿐 스스로 바꾸지 않는다(부모가 다시 내려주기 전까지 값은 그대로다).
    expect(screen.getByLabelText('타임라인 생성')).not.toBeChecked()
  })

  it('timeline prop 이 체크 상태를 그대로 반영한다', () => {
    renderShell({ timeline: true })
    expect(screen.getByLabelText('타임라인 생성')).toBeChecked()
  })

  it('버튼은 취소·생성하기 둘이고 각각 onClose·onSubmit 을 부른다', () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    renderShell({ onClose, onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  // submitDisabled 는 「부모만 아는 사정」(제목이 비었다 / 산출물생성의 선택 자료
  // 0건)을 뼈대에 알리는 통로다. 뼈대가 제목을 갖지 않으므로 스스로는 판정할 수 없다.
  it('submitDisabled 면 생성할 수 없다', () => {
    const onSubmit = vi.fn()
    renderShell({ submitDisabled: true, onSubmit })
    const btn = screen.getByRole('button', { name: '생성하기' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('busy 면 「만드는 중…」이고 누를 수 없다', () => {
    renderShell({ busy: true })
    expect(screen.getByRole('button', { name: '만드는 중…' })).toBeDisabled()
  })
})

// ── round10a T2-B — 설명문 자료 상한(MAX_CAPTION_ARTIFACTS) ──────────────────────
// 175건(노드 「전체 선택」 한 번)이 73초 만에 502 로 끊겼다(라이브 실측). 40건은
// 15초에 성공했다. 거의 선형이라 60초 선이 약 150건 — 100건에서 미리 막는다.
// 누르고 나서가 아니라 **미리** 알리는 것이 요지다.
describe('설명문 자료 상한(round10a T2-B)', () => {
  it('자료가 상한을 넘으면 생성하기가 잠기고 몇 건을 덜어야 하는지 알려준다', () => {
    renderShell({ total: MAX_CAPTION_ARTIFACTS + 1 })
    expect(screen.getByText(/1건을 덜어/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('상한 이하면 생성하기가 열려 있다', () => {
    renderShell({ total: MAX_CAPTION_ARTIFACTS })
    expect(screen.queryByText(/건을 덜어/)).toBeNull()
    expect(screen.getByRole('button', { name: '생성하기' })).not.toBeDisabled()
  })
})

// ── 타임라인 ↔ 제목 연동(round07f I10)은 두 모달이 **똑같이** 지켜야 하는 규칙이라
// 뼈대 파일이 훅으로 소유한다. 여기서 규칙 자체를 잠그고, 두 모달의 테스트는 그
// 훅에 제대로 배선됐는지를 각자 잠근다.
describe('useCaptionTitleRule — 타임라인 ↔ 제목 연동(round07f I10)', () => {
  // 훅을 그대로 드러내는 최소 하네스. 모달을 거치지 않고 규칙만 본다.
  function Harness({ defaultTitle, defaultTimeline }) {
    const rule = useCaptionTitleRule({ defaultTitle, defaultTimeline })
    return (
      <div>
        <input aria-label="제목" value={rule.title} onChange={(e) => rule.setTitle(e.target.value)} />
        <input aria-label="타임라인" type="checkbox" checked={rule.timeline}
               onChange={(e) => rule.changeTimeline(e.target.checked)} />
        <button type="button" onClick={() => rule.reset()}>되돌리기</button>
      </div>
    )
  }
  const title = () => screen.getByLabelText('제목')
  const check = () => screen.getByLabelText('타임라인')

  it('제목이 기본값 그대로면 타임라인을 켤 때 「설명문 캡션 + 타임라인_YYMMDD」로 따라간다', () => {
    render(<Harness defaultTitle={defaultOutputTitle('caption')} />)
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: true }))
  })

  it('학예사가 고쳐 놓은 제목은 덮지 않는다', () => {
    render(<Harness defaultTitle={defaultOutputTitle('caption')} />)
    fireEvent.change(title(), { target: { value: '나만의 제목' } })
    fireEvent.click(check())
    expect(title()).toHaveValue('나만의 제목')
  })

  it('켰다 껐다 왕복하면 제목이 정확히 복원된다', () => {
    render(<Harness defaultTitle={defaultOutputTitle('caption')} />)
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: true }))
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption'))
  })

  // Minor 1 — 비교 기준은 재계산한 정본 기본값이 아니라 **넘겨받은 defaultTitle**이다.
  // 그래야 다른 기본값을 쓰는 호출부에서도 규칙이 조용히 죽지 않는다.
  it('defaultTitle 이 정본 기본값과 달라도 그 값을 기준으로 작동한다', () => {
    render(<Harness defaultTitle="민주화운동 설명문" />)
    expect(title()).toHaveValue('민주화운동 설명문')
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: true }))
  })

  // 채팅 모달은 타임라인 **켜짐**으로 시작한다 — 산출물생성과 기본값 규칙이 다르므로
  // 훅이 그 차이를 받아야 한다(그래서 상태가 뼈대가 아니라 부모에 있다).
  it('defaultTimeline=true 로 시작할 수 있고, 끄면 제목이 꺼짐 기준값으로 따라간다', () => {
    render(
      <Harness defaultTitle={defaultOutputTitle('caption', { timeline: true })} defaultTimeline />,
    )
    expect(check()).toBeChecked()
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: false }))
  })

  // ── 회귀 ── round07f 원본은 판정과 ref 갱신을 setTitle 의 updater **안**에서 했다.
  // updater 는 순수해야 하는데(React 가 한 번만 부른다고 보장하지 않는다) 거기서
  // ref 를 바꿨다. 부모가 「다시 열면 되돌린다」 같은 effect 를 하나 더 두면 곧바로
  // 드러난다 — updater 가 두 번 불리고, 두 번째가 이미 바뀐 ref 를 보고 「학예사가
  // 고쳤다」로 오판해 제목이 따라오지 않는다. 채팅 모달이 정확히 그 모양이라
  // 하네스도 같은 모양으로 둔다.
  it('부모가 reset effect 를 함께 두어도 연동이 죽지 않는다(updater 순수성)', () => {
    function ResettingHarness() {
      const rule = useCaptionTitleRule({
        defaultTitle: defaultOutputTitle('caption', { timeline: true }),
        defaultTimeline: true,
      })
      const { reset } = rule
      useEffect(() => {
        reset(defaultOutputTitle('caption', { timeline: true }), true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <div>
          <input aria-label="제목" value={rule.title} onChange={(e) => rule.setTitle(e.target.value)} />
          <input aria-label="타임라인" type="checkbox" checked={rule.timeline}
                 onChange={(e) => rule.changeTimeline(e.target.checked)} />
        </div>
      )
    }
    render(<ResettingHarness />)
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: true }))
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: false }))
  })

  // reset 은 값뿐 아니라 **자동값 기준(autoTitleRef)까지** 되돌려야 한다. 값만
  // 되돌리면, 되돌린 뒤의 제목이 "이미 고쳐진 것"으로 오판돼 연동이 죽는다.
  it('reset 은 제목·타임라인과 자동값 기준을 함께 되돌린다', () => {
    render(
      <Harness defaultTitle={defaultOutputTitle('caption', { timeline: true })} defaultTimeline />,
    )
    fireEvent.change(title(), { target: { value: '고친 제목' } })
    fireEvent.click(check()) // 고쳤으니 따라오지 않는다
    expect(title()).toHaveValue('고친 제목')

    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: true }))
    expect(check()).toBeChecked()

    // 되돌린 뒤에는 연동이 다시 살아 있어야 한다.
    fireEvent.click(check())
    expect(title()).toHaveValue(defaultOutputTitle('caption', { timeline: false }))
  })
})
