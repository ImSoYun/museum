// 이 파일의 책임: 퍼블 dropdown_box ty_check(search_result.html L120-154)를 React로 옮긴
// 다중선택 드롭다운의 필수 동작 7종(spec §9.4.1). 하나라도 빠지면 "퍼블을 따랐다"고 말할 수 없다.
//
// 순수 제어 컴포넌트라 컨텍스트·라우터가 필요 없다 — props만 준다.
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import DropdownCheckBox from './DropdownCheckBox.jsx'

const OPTIONS = [
  { value: '사회생활', count: 87 },
  { value: '미디어', count: 12 },
  { value: '교통/통신', count: 5 },
]

function renderBox(overrides = {}) {
  const props = {
    label: '자료유형',
    options: OPTIONS,
    selected: [],
    onChange: vi.fn(),
    ...overrides,
  }
  const utils = render(<DropdownCheckBox {...props} />)
  return { ...utils, props }
}

const trigger = () => screen.getByTestId('dropdown-trigger')
const panel = () => screen.getByTestId('dropdown-panel')

// (a) 트리거 구조 — dropdown_box ty_labeled ty_filled
test('(a) 트리거는 라벨 + 요약값 + 화살표로 이루어진다', () => {
  const { container } = renderBox()
  const box = container.querySelector('.dropdown_box')
  expect(box.className).toContain('ty_labeled')
  expect(box.className).toContain('ty_filled')
  expect(trigger().querySelector('.dropdown_box_label').textContent).toBe('자료유형')
  expect(trigger().querySelector('.dropdown_box_value')).not.toBeNull()
  expect(trigger().querySelector('img.dropdown_box_arrow')).not.toBeNull()
})

// (b) 요약 라벨 형식 — <b>{값}</b> <em>{건수}</em> 를 ", "로 잇는다(퍼블 L123). 미선택은 '전체'
test('(b) 미선택이면 요약값이 "전체"다', () => {
  renderBox()
  expect(trigger().querySelector('.dropdown_box_value').textContent).toBe('전체')
})

test('(b) 1개 선택하면 값만 보여준다 (건수 없이)', () => {
  renderBox({ selected: ['사회생활'] })
  const value = trigger().querySelector('.dropdown_box_value')
  expect(value.textContent).toContain('사회생활')
  expect(value.textContent).not.toContain('87')
  expect([...value.querySelectorAll('b.dropdown_box_value_group')].map((b) => b.textContent))
    .toEqual(['사회생활'])
  expect([...value.querySelectorAll('em.dropdown_box_value_count')])
    .toEqual([])
})

// (c) 패널 토글 — 트리거 클릭으로 열고, 패널 머리(dropdown_box_panel_head) 클릭으로도 닫힌다
test('(c) 기본은 닫힘 — hidden 속성과 aria-expanded=false', () => {
  renderBox()
  expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  expect(panel()).toHaveAttribute('hidden')
})

test('(c) 트리거를 누르면 열리고 다시 누르면 닫힌다', () => {
  renderBox()
  fireEvent.click(trigger())
  expect(trigger()).toHaveAttribute('aria-expanded', 'true')
  expect(panel()).not.toHaveAttribute('hidden')
  fireEvent.click(trigger())
  expect(panel()).toHaveAttribute('hidden')
})

test('(c) 패널 머리를 눌러도 닫힌다(퍼블 L127-130)', () => {
  renderBox()
  fireEvent.click(trigger())
  fireEvent.click(screen.getByTestId('dropdown-panel-head'))
  expect(panel()).toHaveAttribute('hidden')
  expect(trigger()).toHaveAttribute('aria-expanded', 'false')
})

// (d) '전체' 체크박스 — 개별 선택을 전부 해제한다. 개별을 하나라도 고르면 '전체'는 해제된다
test('(d) 미선택 상태에서는 "전체"가 체크돼 있다', () => {
  renderBox()
  fireEvent.click(trigger())
  expect(screen.getByLabelText('전체')).toBeChecked()
})

test('(d) 개별을 고르면 "전체"는 해제된다', () => {
  renderBox({ selected: ['사회생활'] })
  fireEvent.click(trigger())
  expect(screen.getByLabelText('전체')).not.toBeChecked()
  expect(screen.getByLabelText('사회생활')).toBeChecked()
})

test('(d) "전체"를 누르면 onChange([])로 개별 선택을 전부 해제한다', () => {
  const { props } = renderBox({ selected: ['사회생활', '미디어'] })
  fireEvent.click(trigger())
  fireEvent.click(screen.getByLabelText('전체'))
  expect(props.onChange).toHaveBeenCalledWith([])
})

// (e) 다중 선택
test('(e) 개별 항목을 체크하면 기존 선택에 더해 onChange가 불린다', () => {
  const { props } = renderBox({ selected: ['사회생활'] })
  fireEvent.click(trigger())
  fireEvent.click(screen.getByLabelText('미디어'))
  expect(props.onChange).toHaveBeenCalledWith(['사회생활', '미디어'])
})

test('(e) 체크된 항목을 다시 누르면 그것만 빠진다', () => {
  const { props } = renderBox({ selected: ['사회생활', '미디어'] })
  fireEvent.click(trigger())
  fireEvent.click(screen.getByLabelText('사회생활'))
  expect(props.onChange).toHaveBeenCalledWith(['미디어'])
})

test('(e) 항목 라벨은 값과 건수를 함께 보여준다', () => {
  renderBox()
  fireEvent.click(trigger())
  expect(screen.getByLabelText('교통/통신').closest('.form_check').textContent).toContain('5')
})

// (f) 바깥 클릭 · Esc 로 닫기
test('(f) 바깥을 클릭하면 닫힌다', () => {
  renderBox()
  fireEvent.click(trigger())
  fireEvent.mouseDown(document.body)
  expect(panel()).toHaveAttribute('hidden')
})

test('(f) Esc를 누르면 닫히고 포커스가 트리거로 돌아온다', () => {
  renderBox()
  fireEvent.click(trigger())
  fireEvent.keyDown(panel(), { key: 'Escape' })
  expect(panel()).toHaveAttribute('hidden')
  expect(trigger()).toHaveFocus()
})

// (g) 접근성 속성 — 퍼블 그대로
test('(g) aria-haspopup·aria-controls·role=group·aria-label이 퍼블대로 붙는다', () => {
  renderBox()
  expect(trigger()).toHaveAttribute('aria-haspopup', 'true')
  expect(trigger().getAttribute('aria-controls')).toBe(panel().getAttribute('id'))
  const group = screen.getByRole('group', { hidden: true })
  expect(group).toHaveAttribute('aria-label', '자료유형(다중 선택 가능)')
  expect(group.className).toContain('ty_check')
})

// 예외 1건 — 항목 label 에만 form_check_label 을 붙인다(§9.4)
test('항목 label에 form_check_label 클래스가 붙는다(퍼블 CSS L391이 이 클래스를 요구한다)', () => {
  renderBox()
  fireEvent.click(trigger())
  expect(screen.getByLabelText('사회생활').closest('.form_check').querySelector('label').className)
    .toContain('form_check_label')
})

const OPTIONS_ROUND07K = [
  { value: '정치행정', count: 87 },
  { value: '경제산업', count: 31 },
  { value: '사회환경', count: 18 },
  { value: '교육과학', count: 32 },
]

// round07k ② — 고른 것이 늘수록 트리거가 옆으로 늘어나 같은 줄의 다른 컨트롤을
// 밀었다. 피그마는 「정치행정 외 3개」다. 규칙은 spec §2 표가 정본이다.
test('아무것도 안 고르면 전체', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={[]} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('전체')
})

test('1개면 건수 없이 값만 보여준다', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={['정치행정']} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('정치행정')
  expect(trigger()).not.toHaveTextContent('87')
  expect(trigger()).not.toHaveTextContent('외')
})

// ★ 2개가 경계다. 「3개 이상」으로 잘못 구현하면 여기서만 빨개진다.
test('2개면 「외 1개」로 접는다 — 여기가 경계다', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={['정치행정', '경제산업']} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('정치행정 외 1개')
  expect(trigger()).not.toHaveTextContent('경제산업')
})

test('4개면 「외 3개」이고 건수는 빠진다', () => {
  render(
    <DropdownCheckBox
      label="자료유형"
      options={OPTIONS_ROUND07K}
      selected={['정치행정', '경제산업', '사회환경', '교육과학']}
      onChange={() => {}}
    />,
  )
  expect(trigger()).toHaveTextContent('정치행정 외 3개')
  expect(trigger()).not.toHaveTextContent('87')
})

// 접는 것은 폭 문제이지 정보를 버리자는 것이 아니다 — 스크린리더는 전부 읽어야 한다.
test('접혀도 고른 값 전체가 접근명에 남는다', () => {
  render(
    <DropdownCheckBox
      label="자료유형"
      options={OPTIONS_ROUND07K}
      selected={['정치행정', '경제산업', '사회환경']}
      onChange={() => {}}
    />,
  )
  const name = trigger().getAttribute('aria-label') || ''
  expect(name).toContain('정치행정')
  expect(name).toContain('경제산업')
  expect(name).toContain('사회환경')
})

// round07k 최종 결정 — 피그마 일관성. 어떤 선택 크기에서든 건수는 화면과
// 접근명 어디에도 나타나지 않는다 — 값만 표시된다.
test('어떤 선택 크기에서도 건수가 화면과 접근명 어디에도 없다 (0개 선택)', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={[]} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('전체')
  expect(trigger().querySelector('.dropdown_box_value')).not.toHaveTextContent(/\d+/)
})

test('어떤 선택 크기에서도 건수가 화면과 접근명 어디에도 없다 (1개 선택)', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={['정치행정']} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('정치행정')
  expect(trigger()).not.toHaveTextContent('87')
  const ariaLabel1 = trigger().getAttribute('aria-label') || ''
  expect(ariaLabel1).toContain('정치행정')
  expect(ariaLabel1).not.toContain('87')
})

test('어떤 선택 크기에서도 건수가 화면과 접근명 어디에도 없다 (2개 선택)', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={['정치행정', '경제산업']} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('정치행정 외 1개')
  expect(trigger()).not.toHaveTextContent('87')
  expect(trigger()).not.toHaveTextContent('31')
})

test('어떤 선택 크기에서도 건수가 화면과 접근명 어디에도 없다 (4개 선택)', () => {
  render(<DropdownCheckBox label="자료유형" options={OPTIONS_ROUND07K} selected={['정치행정', '경제산업', '사회환경', '교육과학']} onChange={() => {}} />)
  expect(trigger()).toHaveTextContent('정치행정 외 3개')
  expect(trigger()).not.toHaveTextContent('87')
  expect(trigger()).not.toHaveTextContent('31')
  const ariaLabel4 = trigger().getAttribute('aria-label') || ''
  expect(ariaLabel4).toContain('정치행정')
  expect(ariaLabel4).not.toContain('87')
  expect(ariaLabel4).not.toContain('31')
})
