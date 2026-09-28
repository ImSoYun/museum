import { renderHook, act } from '@testing-library/react'
import { useSimulatedDelay } from './useSimulatedDelay.js'

test('run은 loading을 켜고 ms 후 끄며 onDone 호출', () => {
  vi.useFakeTimers()
  const onDone = vi.fn()
  const { result } = renderHook(() => useSimulatedDelay())
  expect(result.current.loading).toBe(false)
  act(() => { result.current.run(1000, onDone) })
  expect(result.current.loading).toBe(true)
  expect(onDone).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(result.current.loading).toBe(false)
  expect(onDone).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
