import { render, screen, fireEvent } from '@testing-library/react'
import { AdminProvider } from './AdminProvider.jsx'
import { useAdmin } from './useAdmin.js'

function Probe() {
  const { criteria, addCriterion, updateCriterion, removeCriteria, toggleActive } = useAdmin()
  const activeCount = criteria.filter((c) => c.active).length
  return (
    <div>
      <span data-testid="count">{criteria.length}</span>
      <span data-testid="active">{activeCount}</span>
      <span data-testid="first-title">{criteria[0]?.title}</span>
      <span data-testid="first-active">{String(criteria[0]?.active)}</span>
      <button onClick={() => addCriterion({ title: '신규 기준', prompt: 'p', active: true })}>추가</button>
      <button onClick={() => updateCriterion(criteria[0].id, { title: '수정됨' })}>수정</button>
      <button onClick={() => removeCriteria([criteria[0].id])}>삭제</button>
      <button onClick={() => toggleActive(criteria[0].id)}>토글</button>
    </div>
  )
}

test('초기값은 clusteringPrompts 10건, active 4건', () => {
  render(<AdminProvider><Probe /></AdminProvider>)
  expect(screen.getByTestId('count').textContent).toBe('10')
  expect(screen.getByTestId('active').textContent).toBe('4')
})

test('addCriterion은 맨 앞에 기준을 추가하고 자동 필드를 채운다', () => {
  render(<AdminProvider><Probe /></AdminProvider>)
  fireEvent.click(screen.getByText('추가'))
  expect(screen.getByTestId('count').textContent).toBe('11')
  expect(screen.getByTestId('first-title').textContent).toBe('신규 기준')
})

test('updateCriterion은 필드를 갱신한다', () => {
  render(<AdminProvider><Probe /></AdminProvider>)
  fireEvent.click(screen.getByText('수정'))
  expect(screen.getByTestId('first-title').textContent).toBe('수정됨')
})

test('removeCriteria는 id 목록을 제거한다', () => {
  render(<AdminProvider><Probe /></AdminProvider>)
  fireEvent.click(screen.getByText('삭제'))
  expect(screen.getByTestId('count').textContent).toBe('9')
})

test('toggleActive는 active를 반전한다', () => {
  render(<AdminProvider><Probe /></AdminProvider>)
  expect(screen.getByTestId('first-active').textContent).toBe('true')
  fireEvent.click(screen.getByText('토글'))
  expect(screen.getByTestId('first-active').textContent).toBe('false')
})

test('useAdmin은 Provider 밖에서 에러', () => {
  function Bare() { useAdmin(); return null }
  expect(() => render(<Bare />)).toThrow()
})
