import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import DataFilterBar from './DataFilterBar.jsx'

const FIELDS = [
  { id: 'history_filter_period', name: 'period', placeholderLabel: '정렬', options: [
    { value: 'latest', label: '최신순' }, { value: 'oldest', label: '과거순' },
  ] },
  { id: 'history_filter_status', name: 'status', placeholderLabel: '상태', options: [
    { value: '반영 완료', label: '반영 완료' }, { value: '반영 중', label: '반영 중' },
  ] },
]

function renderBar(onSubmit = vi.fn()) {
  return { onSubmit, ...render(<DataFilterBar fields={FIELDS} onSubmit={onSubmit} />) }
}

test('DataFilterBar: form.data_filter_bar 안에 필드마다 select + divider가 놓인다', () => {
  const { container } = renderBar()
  const form = container.querySelector('form.data_filter_bar')
  expect(form).not.toBeNull()
  expect(form.querySelectorAll('.select_box > select')).toHaveLength(2)
  // divider는 필드 사이가 아니라 필드마다 뒤에 하나씩(퍼블 manage_history.html:103·113·123·133)
  expect(form.querySelectorAll('.data_filter_divider')).toHaveLength(2)
  expect(form.querySelector('.data_filter_divider').getAttribute('aria-hidden')).toBe('true')
  expect(container.querySelector('#history_filter_period').name).toBe('period')
})

test('DataFilterBar: 각 select의 첫 옵션이 라벨 역할을 하고 value는 빈 문자열', () => {
  const { container } = renderBar()
  const period = container.querySelector('#history_filter_period')
  expect(Array.from(period.options).map((o) => [o.value, o.text]))
    .toEqual([['', '정렬'], ['latest', '최신순'], ['oldest', '과거순']])
  expect(period.value).toBe('')
  expect(screen.getByLabelText('정렬')).toBe(period)
})

test('DataFilterBar: 검색 영역은 type=search + 아이콘 제출 버튼', () => {
  const { container } = renderBar()
  const search = container.querySelector('.data_filter_search')
  const input = search.querySelector('input')
  expect(input.type).toBe('search')
  expect(input.name).toBe('keyword')
  expect(input.placeholder).toBe('검색어를 입력해주세요.')
  expect(input.className).toBe('data_filter_search_input')
  const btn = screen.getByRole('button', { name: '검색' })
  expect(btn.type).toBe('submit')
  expect(btn.className).toBe('data_filter_search_btn icon_btn')
  expect(btn.querySelector('img').className).toBe('data_filter_search_btn_icon')
})

test('DataFilterBar: 제출 시 기본동작을 막고 onSubmit(values)를 호출한다', () => {
  const { container, onSubmit } = renderBar()
  const form = container.querySelector('form.data_filter_bar')
  fireEvent.change(container.querySelector('#history_filter_status'), { target: { value: '반영 완료' } })
  fireEvent.change(container.querySelector('input[type=search]'), { target: { value: '유물' } })

  // 퍼블은 <form action="#;" method="get">이라 preventDefault가 없으면 jsdom이
  // "Not implemented: HTMLFormElement.prototype.requestSubmit"를 던진다.
  const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
  form.dispatchEvent(submitEvent)
  expect(submitEvent.defaultPrevented).toBe(true)
  expect(onSubmit).toHaveBeenCalledWith({ period: '', status: '반영 완료', keyword: '유물' })
})
