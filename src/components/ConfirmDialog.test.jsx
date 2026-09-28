import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog.jsx'

test('open=false면 렌더되지 않는다', () => {
  render(<ConfirmDialog open={false} title="삭제" message="지울까요?" onConfirm={() => {}} onClose={() => {}} />)
  expect(screen.queryByText('삭제')).toBeNull()
})

test('확인 클릭 시 onConfirm 호출', () => {
  const onConfirm = vi.fn()
  render(<ConfirmDialog open title="삭제" message="지울까요?" onConfirm={onConfirm} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

test('취소 클릭 시 onClose 호출·onConfirm 미호출', () => {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(<ConfirmDialog open title="삭제" message="지울까요?" onConfirm={onConfirm} onClose={onClose} />)
  fireEvent.click(screen.getByText('취소'))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

test('message가 본문에 표시된다', () => {
  render(<ConfirmDialog open title="삭제" message="지울까요?" onConfirm={() => {}} onClose={() => {}} />)
  expect(screen.getByText('지울까요?')).toBeInTheDocument()
})
