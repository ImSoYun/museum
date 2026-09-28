import { render, screen } from '@testing-library/react'
import IntroHero from './IntroHero.jsx'

// round07j — 워드마크 아트워크를 피그마에서 새로 받아 교체했다(ArchAI -> SA:I).
// 글자가 <path> 로 그려진 벡터라 alt 가 유일한 접근 경로다.
test('IntroHero: 워드마크 이미지를 alt="SA:I"로 렌더한다', () => {
  render(<IntroHero />)
  expect(screen.getByRole('img', { name: 'SA:I' })).toBeInTheDocument()
})

test('IntroHero: 부제는 퍼블 원문이며 / 와 /search 상단의 단일 출처다', () => {
  render(<IntroHero />)
  expect(
    screen.getByText('학예 업무를 위한 근현대사 지능형 학예 지식 플랫폼')
  ).toBeInTheDocument()
})
