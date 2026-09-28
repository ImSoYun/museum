import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from './Pagination.jsx'

test('renders page buttons', () => {
  const { container } = render(<Pagination page={1} totalPages={3} onChange={() => {}} />)
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
  // 퍼블 nav.data_pagination 5블록(manage_ocr.html:293-310)
  expect(container.querySelector('nav').className).toBe('data_pagination')
  expect(container.querySelector('.data_pagination_pages')).not.toBeNull()
})

test('next button calls onChange with page+1', () => {
  const fn = vi.fn()
  render(<Pagination page={1} totalPages={3} onChange={fn} />)
  fireEvent.click(screen.getByLabelText('다음 페이지'))
  expect(fn).toHaveBeenCalledWith(2)
  // 신설 — 마지막 페이지 버튼은 totalPages 로 보낸다
  fireEvent.click(screen.getByLabelText('마지막 페이지'))
  expect(fn).toHaveBeenCalledWith(3)
})

test('prev button calls onChange with page-1', () => {
  const fn = vi.fn()
  render(<Pagination page={2} totalPages={3} onChange={fn} />)
  fireEvent.click(screen.getByLabelText('이전 페이지'))
  expect(fn).toHaveBeenCalledWith(1)
  // 신설 — 첫 페이지 버튼은 1 로 보낸다
  fireEvent.click(screen.getByLabelText('첫 페이지'))
  expect(fn).toHaveBeenCalledTimes(2)
  expect(fn).toHaveBeenLastCalledWith(1)
})

test('active page has aria-current=page', () => {
  render(<Pagination page={2} totalPages={3} onChange={() => {}} />)
  expect(screen.getByText('2')).toHaveAttribute('aria-current', 'page')
})

test('D2a: 화살표·페이지 번호 버튼에 component.css v2 클래스가 붙는다', () => {
  const { container } = render(<Pagination page={2} totalPages={3} onChange={() => {}} />)
  const arrows = container.querySelectorAll('.data_pagination_arrow')
  expect(arrows).toHaveLength(4) // 첫/이전/다음/마지막
  for (const btn of arrows) {
    expect(btn.querySelector('img').className).toBe('data_pagination_arrow_icon')
  }
  const pageButtons = container.querySelectorAll('.data_pagination_page_btn')
  expect(pageButtons).toHaveLength(3)
})

test('returns null when totalPages <= 1', () => {
  // 퍼블의 "1~10 고정 번호 · 총 100건"은 정적 예시값이라 채택하지 않는다(§8.0.5).
  // 번호는 계속 실계산하고 한 페이지뿐이면 아무것도 그리지 않는 현행 동작을 유지한다.
  const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />)
  expect(container.firstChild).toBeNull()
})
