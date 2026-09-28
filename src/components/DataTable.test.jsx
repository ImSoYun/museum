import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import DataTable from './DataTable.jsx'

test('renders rows and custom cell', () => {
  const { container } = render(
    <DataTable
      caption="테스트 목록"
      colWidths={['w-[60%]', 'w-[40%]']}
      variant="ty_test"
      columns={[{ key: 'name', label: '이름' }, { key: 's', label: '상태', render: (r) => <b>{r.s}</b> }]}
      rows={[{ id: 1, name: '파일A', s: '완료' }]}
    />
  )
  expect(screen.getByText('파일A')).toBeInTheDocument()
  expect(screen.getByText('완료')).toBeInTheDocument()
  expect(screen.getByText('이름')).toBeInTheDocument()

  // 퍼블 table.data_table 마크업 — variant modifier · sr_only caption · colgroup
  expect(container.querySelector('table').className).toBe('data_table ty_test')
  expect(container.querySelector('caption').className).toBe('sr_only')
  expect(container.querySelector('caption')).toHaveTextContent('테스트 목록')
  expect(container.querySelectorAll('colgroup col')).toHaveLength(2)
  // 폭·정렬·행 높이는 퍼블 CSS가 잡으므로 tr에 Tailwind 클래스를 붙이지 않는다
  expect(container.querySelector('tbody tr').className).toBe('')
})

const cols = [{ key: 'name', label: '이름' }]
const data = [
  { id: 'a', name: '파일A' },
  { id: 'b', name: '파일B' },
]

test('selectedIds에 포함된 행은 체크되어 렌더된다', () => {
  render(<DataTable columns={cols} rows={data} selectable selectedIds={['a']} onToggle={() => {}} />)
  const cbA = screen.getByLabelText('선택 a')
  const cbB = screen.getByLabelText('선택 b')
  expect(cbA.checked).toBe(true)
  expect(cbB.checked).toBe(false)
  // 일부만 선택 → 전체선택 체크박스는 indeterminate.
  // 속성이 아니라 DOM 프로퍼티라 ref로 써야 한다(퍼블 common.js:132와 같은 처리)
  expect(screen.getByLabelText('전체선택').indeterminate).toBe(true)
})

test('행 체크박스 클릭 시 onToggle(id) 호출', () => {
  const onToggle = vi.fn()
  render(<DataTable columns={cols} rows={data} selectable selectedIds={[]} onToggle={onToggle} />)
  fireEvent.click(screen.getByLabelText('선택 b'))
  expect(onToggle).toHaveBeenCalledWith('b')
})

test('전체선택 체크박스 클릭 시 onToggleAll(true) 호출', () => {
  const onToggleAll = vi.fn()
  render(
    <DataTable columns={cols} rows={data} selectable selectedIds={[]} onToggle={() => {}} onToggleAll={onToggleAll} />
  )
  fireEvent.click(screen.getByLabelText('전체선택'))
  expect(onToggleAll).toHaveBeenCalledWith(true)
})

test('모든 행이 선택되면 전체선택 체크박스가 checked', () => {
  render(
    <DataTable columns={cols} rows={data} selectable selectedIds={['a', 'b']} onToggle={() => {}} onToggleAll={() => {}} />
  )
  expect(screen.getByLabelText('전체선택').checked).toBe(true)
  expect(screen.getByLabelText('전체선택').indeterminate).toBe(false)
})
