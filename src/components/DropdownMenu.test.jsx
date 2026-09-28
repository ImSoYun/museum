import { render, screen, fireEvent } from '@testing-library/react'
import DropdownMenu from './DropdownMenu.jsx'

const items = [
  { key: 'open', label: '열기', onSelect: vi.fn() },
  { key: 'del', label: '삭제', onSelect: vi.fn() },
]

test('초기에는 메뉴가 닫혀 있다', () => {
  render(<DropdownMenu trigger={<span>메뉴</span>} items={items} />)
  expect(screen.queryByText('열기')).toBeNull()
})

test('트리거 클릭 시 항목이 보인다', () => {
  render(<DropdownMenu trigger={<span>메뉴</span>} items={items} />)
  fireEvent.click(screen.getByText('메뉴'))
  expect(screen.getByText('열기')).toBeInTheDocument()
  expect(screen.getByText('삭제')).toBeInTheDocument()
})

test('항목 클릭 시 onSelect 호출·메뉴 닫힘', () => {
  const onSelect = vi.fn()
  render(<DropdownMenu trigger={<span>메뉴</span>} items={[{ key: 'a', label: '열기', onSelect }]} />)
  fireEvent.click(screen.getByText('메뉴'))
  fireEvent.click(screen.getByText('열기'))
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('열기')).toBeNull()
})

test('트리거 버튼은 aria-haspopup="menu"', () => {
  render(<DropdownMenu trigger={<span>메뉴</span>} items={items} />)
  expect(screen.getByRole('button', { name: /메뉴/ })).toHaveAttribute('aria-haspopup', 'menu')
})

test('Escape 키로 열린 메뉴가 닫힌다', () => {
  render(<DropdownMenu trigger={<span>메뉴</span>} items={items} />)
  fireEvent.click(screen.getByText('메뉴'))
  expect(screen.getByText('열기')).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  expect(screen.queryByText('열기')).toBeNull()
})
