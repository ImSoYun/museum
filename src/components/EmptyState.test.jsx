import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from './EmptyState.jsx'

test('title·description을 표시한다', () => {
  render(<EmptyState title="결과 없음" description="조건에 맞는 자료가 없습니다." />)
  expect(screen.getByText('결과 없음')).toBeInTheDocument()
  expect(screen.getByText('조건에 맞는 자료가 없습니다.')).toBeInTheDocument()
})

test('action을 주면 버튼이 렌더되고 클릭이 동작한다', () => {
  const onClick = vi.fn()
  render(<EmptyState title="비어 있음" action={{ label: '새로 만들기', onClick }} />)
  fireEvent.click(screen.getByText('새로 만들기'))
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('action이 없으면 버튼이 없다', () => {
  render(<EmptyState title="비어 있음" />)
  expect(screen.queryByRole('button')).toBeNull()
})
