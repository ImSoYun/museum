import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import Home from './Home.jsx'

// 현재 라우터 경로를 노출해 이동 단언에 쓰는 프로브
function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="pathname">{pathname}</div>
}

const renderHome = () =>
  render(
    <ScenarioProvider>
      <MemoryRouter initialEntries={['/']}>
        <Home />
        <LocationProbe />
      </MemoryRouter>
    </ScenarioProvider>
  )

test('홈: 히어로가 워드마크 이미지(alt="SA:I")로 바뀐다', () => {
  renderHome()
  expect(screen.getByRole('img', { name: 'SA:I' })).toBeInTheDocument()
  // 구 히어로(h1 텍스트 + CI 심볼)는 사라진다
  expect(screen.queryByText('대한민국역사박물관')).toBeNull()
})

const PUBLISH_V2_QUESTIONS = [
  '1970년대 국가 관광 정책에 대해 알려줘',
  '이오시프 스탈린 소비에트 연방 총리 기념 케이스의 자료열람과 신청하는 방법을 알려줘.',
  '민주화운동에 관련된 자료 찾아줘.',
]

test('홈: 추천 카드 3개는 publish-v2 정본 문구를 그대로 쓴다(round06e — scenarios 바인딩 결정 번복)', () => {
  renderHome()
  for (const text of PUBLISH_V2_QUESTIONS) {
    const card = screen.getByText(text)
    expect(card.tagName).toBe('BUTTON')
    expect(card.className).toContain('intro_question_card')
  }
  // 퍼블 원문 Q3는 이 문장이 2회 반복된 결함이다(§1.4 #4) — 1회로 교정했으므로 정확히 1건.
  expect(screen.getAllByText('민주화운동에 관련된 자료 찾아줘.')).toHaveLength(1)
  expect(document.querySelector('.intro_questions')).not.toBeNull()
})

test('홈: 추천 카드 클릭("1970년대 국가 관광 정책...") → /search/results 이동', () => {
  renderHome()
  expect(screen.getByTestId('pathname').textContent).toBe('/')
  fireEvent.click(screen.getByText('1970년대 국가 관광 정책에 대해 알려줘'))
  expect(screen.getByTestId('pathname').textContent).toBe('/search/results')
})

test('홈: 검색 제출 → /search/results 이동 (입력은 searchbox)', () => {
  renderHome()
  expect(screen.getByTestId('pathname').textContent).toBe('/')
  const input = screen.getByRole('searchbox')
  fireEvent.change(input, { target: { value: '독립운동 관련 자료' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByTestId('pathname').textContent).toBe('/search/results')
  // 퍼블 클래스 실사용(D14)
  expect(document.querySelector('.intro_search_card')).not.toBeNull()
})

test('홈: AI 고지 문구는 퍼블 원문이다', () => {
  renderHome()
  expect(
    screen.getByText('AI가 제시하는 정보를 다시 한 번 검증하세요.')
  ).toBeInTheDocument()
})

test('홈: publish-v2 자식 클래스(아이콘·텍스트)가 마크업에 실사용된다(D1-4·D14)', () => {
  renderHome()
  // v2는 이 자식들을 자손 선택자가 아닌 전용 클래스로 스타일한다(css-contract: 각 1선택자) —
  // 1차 이식본에는 없어 컨테이너 클래스만 맞고 자식 스타일이 누락됐다. 마크업 실사용을 잠근다.
  for (const cls of [
    'intro_search_notice_icon', 'intro_search_notice_txt', 'intro_search_btn_icon',
    'intro_questions_tit_icon', 'intro_questions_tit_txt', 'intro_disclaimer_icon',
  ]) {
    expect(document.querySelector(`.${cls}`), cls).not.toBeNull()
  }
})
