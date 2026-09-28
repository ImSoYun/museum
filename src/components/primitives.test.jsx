import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal.jsx'
import Tabs from './Tabs.jsx'

test('Modal hidden when closed, shown when open', () => {
  const { rerender } = render(<Modal open={false} title="t">x</Modal>)
  expect(screen.queryByText('t')).toBeNull()
  rerender(<Modal open title="t" onClose={() => {}}>x</Modal>)
  expect(screen.getByText('t')).toBeInTheDocument()
})
test('Tabs fires onChange', () => {
  const fn = vi.fn()
  render(<Tabs tabs={[{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]} active="a" onChange={fn} />)
  fireEvent.click(screen.getByText('B'))
  expect(fn).toHaveBeenCalledWith('b')
})
