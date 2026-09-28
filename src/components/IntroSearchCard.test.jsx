import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import IntroSearchCard from './IntroSearchCard.jsx'

// 제어 컴포넌트라 입력값 변화를 관측하려면 state를 쥔 껍데기가 필요하다.
// ScenarioProvider로 감싸는 이유: round06e Task7부터 IntroSearchCard가 SearchModeToggle을
// 렌더하고, 그 컴포넌트가 useScenario()를 호출한다(Provider 밖이면 throw).
function Harness({ onSearch }) {
  const [v, setV] = useState('')
  return (
    <ScenarioProvider>
      <IntroSearchCard value={v} onChange={setV} onSearch={onSearch} />
    </ScenarioProvider>
  )
}

test('IntroSearchCard: 입력의 암묵 role은 searchbox다 (type="search"이므로 textbox가 아니다)', () => {
  render(<Harness onSearch={() => {}} />)
  expect(screen.getByRole('searchbox', { name: '검색어 입력' })).toBeInTheDocument()
  // 함정 고정: getByRole('textbox')로 찾으면 실패한다는 사실 자체를 테스트로 박아 둔다.
  expect(screen.queryByRole('textbox')).toBeNull()
  // 기본 placeholder는 안내문이다(round06d 후속 #2 — 예시 질의를 기본값으로 두지 않는다).
  expect(screen.getByPlaceholderText('검색어 입력')).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('민주화운동에 관련된 자료 찾아줘.')).toBeNull()
})

test('IntroSearchCard: Enter와 제출 버튼 양쪽에서 onSearch(value)를 부른다', () => {
  const onSearch = vi.fn()
  render(<Harness onSearch={onSearch} />)

  const input = screen.getByRole('searchbox')
  fireEvent.change(input, { target: { value: '독립운동 관련 자료' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSearch).toHaveBeenCalledWith('독립운동 관련 자료')

  fireEvent.click(screen.getByRole('button', { name: '검색' }))
  expect(onSearch).toHaveBeenCalledTimes(2)
  expect(onSearch).toHaveBeenLastCalledWith('독립운동 관련 자료')
})

// round10c Task B1 #20 — 기획 이슈: 검색어를 비운 채(input.value === '') 제출하면
// scenarios.js의 matchScenario가 빈 문자열에 걸리는 키워드가 없어
// hit || getScenario(MAIN_SCENARIO_ID) 폴백이 타 「민주화운동에 관련된 자료 찾아줘.」가
// 검색창에 자동으로 채워진다(원인 체인은 brief 참조). 사용자 지시(2026-09-18) 「저건
// 애초에 검색이 눌르면 안되는거 아니야 아무것도 누르지 않앗으니」에 따라 조용히 무시하는
// 대신 **버튼을 아예 못 누르게** 한다 — 제출 지점(IntroSearchCard) 한 곳만 막으면
// Home.jsx·SearchNav.jsx 두 화면이 함께 풀린다(이 컴포넌트를 둘이 공유한다).
describe('IntroSearchCard: 빈 검색어는 제출되지 않는다(round10c #20)', () => {
  test('빈 값일 때 검색 버튼이 disabled다', () => {
    render(<Harness onSearch={() => {}} />)
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled()
  })

  test('공백만(\'   \') 넣어도 disabled다 — trim 판정', () => {
    render(<Harness onSearch={() => {}} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled()
  })

  test('빈 값에서 Enter를 눌러도 onSearch가 호출되지 않는다 — 버튼과 다른 경로다', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSearch).not.toHaveBeenCalled()
  })

  test('글자를 넣으면 버튼이 살아나고, 눌렀을 때 onSearch가 호출된다(회귀 방지)', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: '독립운동' } })
    const button = screen.getByRole('button', { name: '검색' })
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(onSearch).toHaveBeenCalledWith('독립운동')
  })

  // ⚠️ 비활성 버튼을 회색으로 만들지 말라는 사용자 지시(round10a·round10b에서 두 번
  // 되돌린 지점) — 모양은 그대로 두고 눌리지만 않게 한다. className에 회색·흐림용
  // 클래스를 새로 붙이지 않았는지 여기서 고정한다.
  test('비활성 버튼에 회색·흐림 클래스가 붙지 않는다 — className이 intro_search_btn 그대로다', () => {
    render(<Harness onSearch={() => {}} />)
    expect(screen.getByRole('button', { name: '검색' }).className).toBe('intro_search_btn')
  })
})
