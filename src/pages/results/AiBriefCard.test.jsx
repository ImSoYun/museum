// 이 파일의 책임: AI 브리핑 카드의 상태 4종 렌더 규칙(spec §7.5.3)과 퍼블 마크업 계약.
//
// 상태는 ScenarioProvider가 아니라 <ScenarioContext.Provider value={...}> 로 직접 주입한다
// (ResultsTab.live.test.jsx·SearchResults.v2.test.jsx와 같은 관행). MemoryRouter가 필요한
// 이유는 ai_brief_more가 앱 라우트 /search/chat 으로 가는 <Link>이기 때문이다.
//
// round10b B-2 — 제목·태그·설명 문구가 피그마 `695:92114` 원문으로 바뀌었다. 예전엔
// 설명 자리가 검색어를 인용하는 동적 문구(lastQuery·subjects에 의존)였는데, 이제는
// 고지문 하나로 고정된 정적 문구다 — 그래서 이 파일도 더 이상 lastQuery·subjects를
// 검증하지 않는다(그 값을 읽지 않는 컴포넌트를 테스트가 여전히 읽는 척하면 그것도
// 낡은 시험이 된다).
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import AiBriefCard from './AiBriefCard.jsx'

const NOTICE_TEXT = '본 요약은 AI로 생성되었으며, 오류가 있을 수 있습니다.'

function renderCard(overrides = {}) {
  const value = {
    lastQuery: '민주화운동',
    brief: null,
    briefStatus: 'idle',
    briefNotice: null,
    subjects: [],
    ...overrides,
  }
  return render(
    <ScenarioContext.Provider value={value}>
      <MemoryRouter>
        <AiBriefCard />
      </MemoryRouter>
    </ScenarioContext.Provider>,
  )
}

test('idle: 카드를 아예 렌더하지 않는다(검색 전 직접 진입·결과 0건)', () => {
  const { container } = renderCard({ briefStatus: 'idle' })
  expect(container.querySelector('.ai_brief_card')).toBeNull()
})

test('error: 카드를 아예 렌더하지 않는다 — 브리핑 실패가 검색 결과 화면을 방해하지 않는다', () => {
  const { container } = renderCard({ briefStatus: 'error', briefNotice: '브리핑이 비활성화되어 있습니다' })
  expect(container.querySelector('.ai_brief_card')).toBeNull()
  expect(screen.queryByText('브리핑이 비활성화되어 있습니다')).toBeNull()
})

// round10b — 고지문이 하단(본문 뒤)에서 설명 자리(머리글)로 옮겨 왔다. 머리글은
// 로딩 여부와 무관하게 항상 그려지므로, 로딩 중에도 고지문은 보인다 — 예전엔 이
// 자리가 검색어 인용문이라 로딩 중에도 보였고, 하단 고지문만 로딩 중 숨었었다.
// 자리가 바뀌었으니 "로딩 중에도 보인다"는 성질은 고지문 쪽으로 그대로 옮겨간다.
test('loading: 카드 골격 + 스켈레톤 3줄을 그리고, 머리글(제목·고지문)은 이미 보인다', () => {
  const { container } = renderCard({ briefStatus: 'loading' })
  expect(container.querySelector('.ai_brief_card')).not.toBeNull()
  expect(container.querySelector('.ai_brief_tit').textContent).toContain('SA:I 브리핑')
  expect(screen.getByTestId('ai-brief-skeleton').children).toHaveLength(3)
  expect(container.querySelector('.ai_brief_body')).toBeNull()
  expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
})

test('ok: 본문을 렌더하고 스켈레톤은 사라지며, 태그·고지문은 피그마 문구다', () => {
  const { container } = renderCard({ briefStatus: 'ok', brief: '이 검색 결과는 대체로 1980년대 자료입니다.' })
  expect(screen.getByText('이 검색 결과는 대체로 1980년대 자료입니다.')).toBeInTheDocument()
  expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
  expect(screen.queryByTestId('ai-brief-skeleton')).toBeNull()
  expect(container.querySelector('.ai_brief_tag').textContent).toBe('검색결과 AI 요약')
})

test('ai_brief_more는 퍼블의 ai_chat.html이 아니라 앱 라우트 /search/chat으로 간다', () => {
  renderCard({ briefStatus: 'ok', brief: 'x' })
  const more = screen.getByRole('link', { name: /SA:I가 더 도와드릴까요\?/ })
  expect(more).toHaveAttribute('href', '/search/chat')
  // 글로우 테두리는 손으로 옮기지 않고 기존 GlowBorder 컴포넌트를 재사용한다(rect 12개)
  expect(more.querySelectorAll('svg.glow_border rect')).toHaveLength(12)
})

// ── 접기 토글(퍼블 ai_brief_toggle, aria-expanded) ──────────────────────────
test('토글: 기본은 펼침(aria-expanded=true)이고, 누르면 본문만 접힌다(고지문은 머리글이라 남는다)', () => {
  renderCard({ briefStatus: 'ok', brief: '요약 본문' })
  const toggle = screen.getByRole('button', { name: 'SA:I 브리핑 접기/펼치기' })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('요약 본문')).toBeInTheDocument()

  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('요약 본문')).toBeNull()
  // round10b — 고지문이 설명 자리(머리글)로 옮겨 왔다. 머리글은 접어도 남으므로
  // 예전(본문 뒤 하단)과 달리 접어도 고지문은 사라지지 않는다.
  expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
})

test('토글: 접었다 다시 펴면 본문이 돌아온다', () => {
  renderCard({ briefStatus: 'ok', brief: '요약 본문' })
  const toggle = screen.getByRole('button', { name: 'SA:I 브리핑 접기/펼치기' })
  fireEvent.click(toggle)
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('요약 본문')).toBeInTheDocument()
})

// ── round10b — 필터 부기 제거(사용자 결정, 피그마 그대로) ───────────────────
// 예전엔 subjects(필터)가 있으면 설명 자리에 「· 필터 적용 전 전체 기준」이 붙었다.
// 그 설명 자리를 이제 고지문이 고정으로 차지하므로, subjects가 있든 없든 카드
// 문구는 완전히 같아야 한다 — 다르면 옛 분기가 죽지 않고 남아 있다는 뜻이다.
test('subjects(필터) 유무와 무관하게 고지문은 같다 — 필터 부기는 없앴다(사용자 결정)', () => {
  const withFilter = renderCard({ briefStatus: 'ok', brief: 'x', subjects: ['정치행정'] })
  expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
  expect(screen.queryByText(/필터 적용 전 전체 기준/)).toBeNull()
  withFilter.unmount()

  renderCard({ briefStatus: 'ok', brief: 'x', subjects: [] })
  expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
})

test('필터가 걸려도 본문(ai_brief_body)은 손대지 않는다', () => {
  const { container } = renderCard({ briefStatus: 'ok', brief: '요약 본문', subjects: ['경제산업', '문화예술'] })
  expect(container.querySelector('.ai_brief_body').textContent).toBe('요약 본문')
})

// round10b — 설명 자리가 더 이상 검색어를 인용하지 않는다. lastQuery를 화면
// 어디서도 그대로 노출하지 않는지 직접 확인한다(예전 자리가 남아 있으면 그
// 검색어 문자열이 카드 어딘가에 여전히 찍힌다).
test("설명 자리는 더 이상 검색어를 인용하지 않는다 — lastQuery 문자열이 카드에 없다", () => {
  renderCard({ briefStatus: 'ok', brief: 'x', lastQuery: '5·18 포스터' })
  expect(screen.queryByText(/5·18 포스터/)).toBeNull()
})

test('제목·태그·고지문 세 문구가 모두 피그마 695:92114 원문이다', () => {
  const { container } = renderCard({ briefStatus: 'ok', brief: 'x' })
  expect(container.querySelector('.ai_brief_tit').textContent).toContain('SA:I 브리핑')
  expect(container.querySelector('.ai_brief_tag').textContent).toBe('검색결과 AI 요약')
  expect(container.querySelector('.ai_brief_desc').textContent).toBe(
    '본 요약은 AI로 생성되었으며, 오류가 있을 수 있습니다.',
  )
})
