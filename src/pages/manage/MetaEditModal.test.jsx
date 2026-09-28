import { render, screen, fireEvent } from '@testing-library/react'
import MetaEditModal from './MetaEditModal.jsx'

const row = { id: 'f1', name: '메타정보_표준.xlsx', uploadedAt: '2026-06-22 11:00', records: 320, mapping: '완료' }

test('MetaEditModal: 명칭·레코드 입력 필드를 초기값으로 보여준다', () => {
  render(<MetaEditModal row={row} onSave={() => {}} onClose={() => {}} />)
  expect(screen.getByLabelText('파일명')).toHaveValue('메타정보_표준.xlsx')
  expect(screen.getByLabelText('레코드 수')).toHaveValue(320)
})

test('MetaEditModal: 저장 시 변경된 패치로 onSave 호출', () => {
  const onSave = vi.fn()
  render(<MetaEditModal row={row} onSave={onSave} onClose={() => {}} />)
  fireEvent.change(screen.getByLabelText('레코드 수'), { target: { value: '999' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave).toHaveBeenCalledWith({ name: '메타정보_표준.xlsx', records: 999 })
})
