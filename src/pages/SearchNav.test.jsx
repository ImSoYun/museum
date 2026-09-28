import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as ScenarioCtx from '../context/ScenarioContext.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import SearchNav from './SearchNav.jsx'

function renderNav() {
  render(<MemoryRouter><ScenarioProvider><SearchNav /></ScenarioProvider></MemoryRouter>)
}

test('search nav renders search input', () => {
  renderNav()
  // 기본 placeholder는 안내문이다(round06d 후속 #2 — Home과 IntroSearchCard를 공유하므로 함께 바뀐다).
  expect(screen.getByPlaceholderText('검색어 입력')).toBeInTheDocument()
})

test('search nav shows platform title', () => {
  renderNav()
  // 부제의 단일 출처는 IntroHero다. Testing Library 문자열 매처는 정규화된 전체 텍스트 일치이므로
  // 퍼블 원문 전체를 그대로 단언한다(부분 문자열로는 통과하지 않는다).
  expect(
    screen.getByText('학예 업무를 위한 근현대사 지능형 학예 지식 플랫폼')
  ).toBeInTheDocument()
})

test('최근 검색 기록 카드 클릭 시 setScenarioByQuery로 복원', () => {
  const setByQuery = vi.fn()
  vi.spyOn(ScenarioCtx, 'useScenario').mockReturnValue({
    activeScenario: {}, setScenarioByQuery: setByQuery, setScenarioById: vi.fn(),
  })
  render(<MemoryRouter><SearchNav /></MemoryRouter>)
  fireEvent.click(screen.getByText('민주화운동 관련 자료 정리'))
  expect(setByQuery).toHaveBeenCalledWith('민주화운동 관련 자료 정리')
  vi.restoreAllMocks()
})

test('메인 검색창 입력 후 검색 시 setScenarioByQuery(q) 호출', () => {
  const setByQuery = vi.fn()
  vi.spyOn(ScenarioCtx, 'useScenario').mockReturnValue({
    activeScenario: {}, setScenarioByQuery: setByQuery, setScenarioById: vi.fn(),
  })
  render(<MemoryRouter><SearchNav /></MemoryRouter>)
  const input = screen.getByPlaceholderText('검색어 입력')
  fireEvent.change(input, { target: { value: '경제개발 자료' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(setByQuery).toHaveBeenCalledWith('경제개발 자료')
  vi.restoreAllMocks()
})
