import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound.jsx'

test('404 문구와 홈 링크를 표시한다 (새 토큰·스케일 기준)', () => {
  const { container } = render(<MemoryRouter><NotFound /></MemoryRouter>)
  expect(screen.getByText('404')).toBeInTheDocument()
  expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeInTheDocument()
  expect(screen.getByText('홈으로').closest('a')).toHaveAttribute('href', '/')

  // 토큰: 브랜드색은 구 팔레트 primary-600 이 아니라 var(--primary) 를 참조하는 text-primary 다
  const numeral = screen.getByText('404')
  expect(numeral.className).toMatch(/text-primary(?![-\w])/)
  expect(numeral.className).not.toMatch(/text-primary-600/)

  // 스케일: spacing 키 1 = 1px(@루트 20px) 이므로 구 py-24(=96px)의 등가는 py-96 이다.
  // 키를 그대로 두면 세로 여백이 96px → 24px 로 줄어 화면이 무너진다(§5.4.3).
  expect(container.firstChild.className).toMatch(/\bpy-96\b/)
  expect(container.firstChild.className).not.toMatch(/\bpy-24\b/)
  expect(container.firstChild.className).toMatch(/\bpx-24\b/)
})
