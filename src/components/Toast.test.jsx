import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from './Toast.jsx'
import { useToast } from './useToast.js'

function Probe() {
  const { showToast } = useToast()
  return <button onClick={() => showToast('저장되었습니다')}>알림</button>
}

test('showToast 호출 시 메시지가 화면에 나타난다', () => {
  render(<ToastProvider><Probe /></ToastProvider>)
  expect(screen.queryByText('저장되었습니다')).toBeNull()
  fireEvent.click(screen.getByText('알림'))
  expect(screen.getByText('저장되었습니다')).toBeInTheDocument()
})

test('토스트는 role="status"로 노출된다', () => {
  render(<ToastProvider><Probe /></ToastProvider>)
  fireEvent.click(screen.getByText('알림'))
  expect(screen.getByRole('status').textContent).toContain('저장되었습니다')
})

// round07e 최종 재리뷰 잔여 — 호출별 표시 시간. 기본 2500ms 는 짧은 확인 문구를
// 전제한 값이라, 사실을 담은 긴 안내(설명문의 「타임라인이 만들어지지 않았습니다」)는
// 다 읽히기 전에 사라진다. 기본값이 그대로인 것과 override 가 실제로 먹는 것을
// 둘 다 잠근다 — 한쪽만 잠그면 다른 쪽이 조용히 회귀한다.
function DurationProbe() {
  const { showToast } = useToast()
  // 버튼 라벨과 토스트 문구를 일부러 다르게 둔다 — 같으면 getByText가 버튼과
  // 토스트 둘 다 잡아 테스트가 무엇을 보고 있는지 흐려진다.
  return (
    <>
      <button onClick={() => showToast('짧은 문구')}>짧게 띄우기</button>
      <button onClick={() => showToast('긴 문구', { duration: 8000 })}>길게 띄우기</button>
    </>
  )
}

test('표시 시간은 기본 2500ms이고, 호출별로 늘릴 수 있다', () => {
  vi.useFakeTimers()
  try {
    render(<ToastProvider><DurationProbe /></ToastProvider>)

    fireEvent.click(screen.getByText('짧게 띄우기'))
    fireEvent.click(screen.getByText('길게 띄우기'))
    expect(screen.getAllByRole('status')).toHaveLength(2)

    // 2500ms — 기본값 쪽만 사라진다.
    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('긴 문구')

    // 8000ms — override 한 쪽도 사라진다.
    act(() => { vi.advanceTimersByTime(5500) })
    expect(screen.queryByRole('status')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('useToast는 Provider 밖에서 에러', () => {
  function Bare() { useToast(); return null }
  expect(() => render(<Bare />)).toThrow()
})
