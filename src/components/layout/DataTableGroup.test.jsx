import { render, screen } from '@testing-library/react'
import DataTableGroup from './DataTableGroup.jsx'

test('toolbar/table/pagination 슬롯을 순서대로 렌더한다', () => {
  const { container } = render(
    <DataTableGroup toolbar={<div>툴바</div>} table={<table><tbody><tr><td>행</td></tr></tbody></table>} pagination={<nav>페이지</nav>} />
  )
  expect(container.querySelector('.data_table_group')).toBeTruthy()
  expect(screen.getByText('툴바')).toBeInTheDocument()
  expect(screen.getByText('행')).toBeInTheDocument()
  expect(screen.getByText('페이지')).toBeInTheDocument()
})

test('슬롯 미지정 시 해당 영역을 렌더하지 않는다', () => {
  const { container } = render(<DataTableGroup table={<table><tbody><tr><td>행</td></tr></tbody></table>} />)
  expect(screen.getByText('행')).toBeInTheDocument()
  // 미지정 슬롯은 흔적(빈 wrapper 등)도 남기지 않아야 한다.
  expect(container.querySelector('.data_table_group').children).toHaveLength(1)
})

// 슬롯 렌더 순서 계약 — toolbar → table → pagination. DOM 순서로 고정한다.
test('세 슬롯이 모두 있을 때 DOM 순서가 toolbar-table-pagination이다', () => {
  const { container } = render(
    <DataTableGroup
      toolbar={<div data-testid="toolbar">툴바</div>}
      table={<div data-testid="table">표</div>}
      pagination={<div data-testid="pagination">페이지</div>}
    />,
  )
  const ids = [...container.querySelector('.data_table_group').children].map((el) => el.dataset.testid)
  expect(ids).toEqual(['toolbar', 'table', 'pagination'])
})
