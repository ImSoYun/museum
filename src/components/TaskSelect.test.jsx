/**
 * 이 파일의 책임: TaskSelect(채팅 입력 바의 「작업선택」 드롭다운)의 계약을 본다(round07g Task4).
 *
 * 왜 네이티브 <select> 를 그만뒀나 — 목록을 **위로** 펼쳐야 하는데 브라우저는
 * <select> 의 펼침 방향을 지정하게 해 주지 않는다. 채팅 입력 바는 화면 맨 아래에
 * 붙어 있어 아래로 열면 목록이 잘린다(피그마 695-100384 는 입력 바 **위**에 패널을
 * 그린다). 그래서 리스트박스를 손으로 만들되, 네이티브가 공짜로 주던 접근성
 * (↑↓·Enter·Esc·Tab 이탈 닫힘·바깥클릭 닫힘·포커스 복귀)을 여기서 전부 되사서 잠근다.
 *
 * 「위로 열림」은 jsdom 이 레이아웃을 계산하지 않아 화면 좌표로 볼 수 없다.
 * 이 파일이 잠그는 것은 **마크업 층** 하나다 — 패널이 트리거보다 DOM 에서 앞에 온다
 * (정상 흐름이면 그것만으로 위에 그려진다). **CSS 층**(.chat_task_select_panel 이
 * bottom 기준이고 top 오프셋이 없다)은 styles/css-contract.test.js 가 따로 잠그고,
 * **픽셀 층**은 e2e/smoke/smoke.spec.ts 「스모크 ④」가 실브라우저 좌표로 잰다(수정 R1).
 * 이 파일의 DOM 순서 단언은 픽셀 층으로 대체되지 않는다 — 그것이 지키는 것은
 * 「CSS 가 통째로 죽어도 위에 그려진다」이고, 픽셀 층은 CSS 가 살아 있을 때의 결과만 본다.
 */
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskSelect, { TASK_SELECT_LIST_LABEL, TASK_SELECT_OPTIONS } from './TaskSelect.jsx'

/** 제어 컴포넌트라 value 의 소유자가 밖에 있어야 라벨 전환을 관측할 수 있다
 *  (IntroSearchCard.test.jsx 의 Harness 와 같은 이유·같은 모양). */
function renderTaskSelect({ disabled = false, onChange } = {}) {
  function Harness() {
    const [value, setValue] = useState('')
    return (
      <TaskSelect
        value={value}
        disabled={disabled}
        onChange={(next) => { setValue(next); onChange?.(next) }}
      />
    )
  }
  return render(<Harness />)
}

const triggerByName = (name) => screen.getByRole('button', { name })
const openPanel = () => {
  fireEvent.click(triggerByName('작업선택'))
  return screen.getByRole('listbox')
}

it('닫힌 상태에서는 라벨이 「작업선택」이고 목록이 없다', () => {
  renderTaskSelect()
  expect(triggerByName('작업선택')).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('열면 「설명문 캡션 생성」·「학예 기획 자료 생성」·「작업선택」 세 항목이 이 순서로 나온다(피그마 원문 순서)', () => {
  renderTaskSelect()
  const list = openPanel()
  expect(screen.getAllByRole('option').map((o) => o.textContent))
    .toEqual(['설명문 캡션 생성', '학예 기획 자료 생성', '작업선택'])
  // 열면 포커스가 목록으로 간다 — 그래야 ↑↓·Enter·Esc 가 갈 곳이 생긴다.
  // (네이티브 <select> 가 공짜로 주던 것이라 빠뜨리면 키보드 사용자에게만 조용히 죽는다.)
  expect(list).toHaveFocus()
})

// spec 결정 9 — 피그마 안에서 문구가 갈린다. 목록은 「생성」, 고른 뒤 닫힌 라벨은
// 「작성」이다. 오타가 아니라 원문이며 사용자가 「둘 다 그대로」로 결정했다.
// 통일하려는 손을 막기 위해 **양방향으로** 단언한다 — 목록에 「작성」이 없고,
// 닫힌 라벨에 「생성」이 없다.
it('목록은 「설명문 캡션 생성」, 고른 뒤 닫힌 라벨은 「설명문 캡션 작성」 — 통일하지 않는다', () => {
  const onChange = vi.fn()
  renderTaskSelect({ onChange })
  openPanel()

  expect(screen.getByRole('option', { name: '설명문 캡션 생성' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: '설명문 캡션 작성' })).toBeNull()

  fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))

  expect(onChange).toHaveBeenCalledWith('caption')
  expect(screen.getByRole('button', { name: '설명문 캡션 작성' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '설명문 캡션 생성' })).toBeNull()
})

it('두 번째 항목 「작업선택」을 고르면 빈 값이 오고 라벨이 placeholder 로 되돌아온다', () => {
  const onChange = vi.fn()
  renderTaskSelect({ onChange })
  openPanel()
  fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))
  expect(triggerByName('설명문 캡션 작성')).toBeInTheDocument()

  fireEvent.click(triggerByName('설명문 캡션 작성'))
  fireEvent.click(screen.getByRole('option', { name: '작업선택' }))

  expect(onChange).toHaveBeenLastCalledWith('')
  expect(triggerByName('작업선택')).toBeInTheDocument()
})

// 「위로 열림」의 마크업 층 — 패널이 트리거보다 앞에 온다. CSS 가 통째로 죽어도
// 정상 흐름에서 위에 그려진다. (bottom 기준 절대배치는 css-contract.test.js 몫.)
it('패널은 같은 래퍼 안에서 트리거보다 DOM 앞에 온다 — 아래가 아니라 위로 펼친다', () => {
  const { container } = renderTaskSelect()
  const panel = openPanel()
  const trigger = triggerByName('작업선택')
  const root = container.querySelector('.chat_task_select')

  expect(root.contains(panel)).toBe(true)
  expect(root.contains(trigger)).toBe(true)
  // 패널 뒤에 트리거가 온다 = 패널이 먼저다.
  expect(panel.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // CSS 계약 테스트가 잠그는 클래스와 같은 이름이어야 두 층이 같은 것을 가리킨다.
  expect(panel).toHaveClass('chat_task_select_panel')
})

it('↑↓ 로 활성 항목이 움직이고 Enter 가 그것을 고른다', () => {
  const onChange = vi.fn()
  renderTaskSelect({ onChange })
  const list = openPanel()
  const options = screen.getAllByRole('option')

  expect(list).toHaveAttribute('aria-activedescendant', options[0].id)
  fireEvent.keyDown(list, { key: 'ArrowDown' })
  expect(list).toHaveAttribute('aria-activedescendant', options[1].id)
  fireEvent.keyDown(list, { key: 'ArrowDown' })
  expect(list).toHaveAttribute('aria-activedescendant', options[2].id)
  // 끝에서 더 내려가도 넘치지 않는다 — round07k 최종 리뷰 F9: 이 주석이 원래
  // 위 ArrowDown(1→2, 그냥 전진)에 붙어 있었다. 실제 경계 단언은 이 아래
  // (마지막 옵션에서 한 번 더 내려도 그대로 마지막에 머무는 것)다.
  fireEvent.keyDown(list, { key: 'ArrowDown' })
  expect(list).toHaveAttribute('aria-activedescendant', options[2].id)
  fireEvent.keyDown(list, { key: 'ArrowUp' })
  expect(list).toHaveAttribute('aria-activedescendant', options[1].id)

  fireEvent.keyDown(list, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith('exhibit')
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('트리거에서 ↓ 를 누르면 열린다(네이티브 select 와 같은 진입)', () => {
  renderTaskSelect()
  fireEvent.keyDown(triggerByName('작업선택'), { key: 'ArrowDown' })
  expect(screen.getByRole('listbox')).toBeInTheDocument()
})

it('Escape 로 닫히고 포커스가 트리거로 돌아온다', () => {
  renderTaskSelect()
  const list = openPanel()
  fireEvent.keyDown(list, { key: 'Escape' })

  expect(screen.queryByRole('listbox')).toBeNull()
  expect(triggerByName('작업선택')).toHaveFocus()
})

// [수정 R1 · M3] 네이티브 <select> 는 Tab 으로 빠져나가면 닫힌다. 손으로 만든 것은
// 그 처리를 안 해 두면 사용자가 이미 떠난 뒤에도 목록이 화면에 남고, 트리거의
// aria-expanded 가 true 로 굳어 스크린리더가 「펼쳐짐」이라 계속 말한다.
//
// 포커스를 트리거로 되돌리는 것까지가 이 계약이다 — 패널은 DOM 에서 트리거보다
// **앞**이라(위로 열기 위한 마크업 층) 되돌리지 않으면 브라우저의 다음 초점이 바로
// 그 트리거가 되어 포커스가 위젯 안에 갇힌다.
it('Tab 으로 목록을 빠져나가면 닫히고 aria-expanded 가 false 로 돌아온다', () => {
  renderTaskSelect()
  const list = openPanel()
  expect(triggerByName('작업선택')).toHaveAttribute('aria-expanded', 'true')

  fireEvent.keyDown(list, { key: 'Tab' })

  expect(screen.queryByRole('listbox')).toBeNull()
  expect(triggerByName('작업선택')).toHaveAttribute('aria-expanded', 'false')
  expect(triggerByName('작업선택')).toHaveFocus()
})

// [수정 R1 · M5] 리스트박스의 접근명이 placeholder 와 같은 「작업선택」이었는데,
// 두 번째 **항목**의 이름이 바로 그 「작업선택」이다. 그대로 두면 스크린리더가
// "작업선택 목록상자 … 작업선택"을 읽어, 방금 읽힌 것이 목록의 이름인지 항목의
// 이름인지가 사라진다. 문자열 하나만 단언하면 다음 사람이 항목 이름을 그 문자열로
// 바꿔도 초록이므로, **겹치지 않는다**는 의도 자체를 함께 잠근다.
it('리스트박스의 접근명은 어느 항목 이름과도 겹치지 않는다', () => {
  renderTaskSelect()
  const list = openPanel()

  expect(list).toHaveAccessibleName(TASK_SELECT_LIST_LABEL)
  expect(TASK_SELECT_OPTIONS.map((o) => o.label)).not.toContain(TASK_SELECT_LIST_LABEL)
})

it('바깥을 누르면(mousedown) 닫힌다', () => {
  renderTaskSelect()
  openPanel()
  fireEvent.mouseDown(document.body)
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('항목을 고른 뒤에도 포커스가 트리거로 돌아온다', () => {
  renderTaskSelect()
  openPanel()
  fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))
  expect(triggerByName('설명문 캡션 작성')).toHaveFocus()
})

it('disabled 면 눌러도 열리지 않는다 — AI 답변이 없으면 만들 근거가 없다', () => {
  renderTaskSelect({ disabled: true })
  const trigger = triggerByName('작업선택')
  expect(trigger).toBeDisabled()
  fireEvent.click(trigger)
  expect(screen.queryByRole('listbox')).toBeNull()
})

// 네이티브 <select> 는 value 를 늘 '' 로 되돌려 같은 옵션을 다시 고를 수 있게 했다.
// 커스텀은 값을 들고 있으므로(닫힌 라벨이 「작성」으로 바뀌어야 한다) **같은 값을
// 다시 골라도 onChange 가 다시 온다**는 것이 폼 턴 누적의 유일한 근거다.
it('같은 항목을 두 번 골라도 onChange 가 두 번 온다 — 폼 턴을 몇 번이고 다시 연다', () => {
  const onChange = vi.fn()
  renderTaskSelect({ onChange })
  openPanel()
  fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))
  fireEvent.click(triggerByName('설명문 캡션 작성'))
  fireEvent.click(screen.getByRole('option', { name: '설명문 캡션 생성' }))

  expect(onChange).toHaveBeenCalledTimes(2)
  expect(onChange).toHaveBeenNthCalledWith(1, 'caption')
  expect(onChange).toHaveBeenNthCalledWith(2, 'caption')
})

// 대화가 비워지면(새 검색) 트리거가 disabled 가 되는데, 그때 열려 있던 패널을 그대로
// 두면 이미 사라진 근거 위에서 고를 수 있는 목록이 화면에 남는다.
it('열려 있는 동안 disabled 가 되면 목록이 닫힌다', () => {
  function Harness() {
    const [disabled, setDisabled] = useState(false)
    return (
      <>
        <TaskSelect value="" disabled={disabled} onChange={() => {}} />
        <button type="button" onClick={() => setDisabled(true)}>대화비우기</button>
      </>
    )
  }
  render(<Harness />)

  fireEvent.click(triggerByName('작업선택'))
  expect(screen.getByRole('listbox')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '대화비우기' }))
  expect(screen.queryByRole('listbox')).toBeNull()
})

// round07k ④ — 작업선택에 특별전시를 더했었다. round10b B-4가 그것을 학예 기획
// 자료(exhibit)로 바꿨다(사용자 결정 — triage #11) — 설명문과 같은 규칙을
// 따르는지(열린 목록은 「생성」, 닫힌 트리거는 「작성」) 양방향으로 잠근다.
test('목록에 학예 기획 자료 생성이 있다', () => {
  render(<TaskSelect value="" onChange={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /작업선택/ }))
  expect(screen.getByRole('option', { name: '학예 기획 자료 생성' })).toBeInTheDocument()
})

test('학예 기획 자료를 고르면 트리거는 「작성」으로 바뀐다', () => {
  render(<TaskSelect value="exhibit" onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /학예 기획 자료 작성/ })).toBeInTheDocument()
})

test('placeholder 는 여전히 맨 뒤다', () => {
  const values = TASK_SELECT_OPTIONS.map((o) => o.value)
  expect(values).toEqual(['caption', 'exhibit', ''])
})
