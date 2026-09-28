import { render, screen, fireEvent } from '@testing-library/react'
import ToggleSwitch from './ToggleSwitch.jsx'

test('renders with role=switch and aria-checked', () => {
  render(<ToggleSwitch checked={false} onChange={() => {}} />)
  const btn = screen.getByRole('switch')
  expect(btn).toBeInTheDocument()
  expect(btn).toHaveAttribute('aria-checked', 'false')
})

test('aria-checked reflects checked prop', () => {
  render(<ToggleSwitch checked={true} onChange={() => {}} />)
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
})

test('click calls onChange with toggled value (false → true)', () => {
  const fn = vi.fn()
  render(<ToggleSwitch checked={false} onChange={fn} />)
  fireEvent.click(screen.getByRole('switch'))
  expect(fn).toHaveBeenCalledWith(true)
})

test('click calls onChange with toggled value (true → false)', () => {
  const fn = vi.fn()
  render(<ToggleSwitch checked={true} onChange={fn} />)
  fireEvent.click(screen.getByRole('switch'))
  expect(fn).toHaveBeenCalledWith(false)
})
