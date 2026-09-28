import { render, screen, fireEvent } from '@testing-library/react'
import PasswordModal from './PasswordModal.jsx'

// round10 Task5 — 새 계약: onClose→onCancel, 취소/열람 라벨→"아니오"/"네", 제목
// "암호화된 프로젝트"→"프로젝트 암호 입력", placeholder "비밀번호 입력"→"암호를
// 입력하세요". error·busy 두 prop이 새로 생겼다(브리프 인터페이스
// {open, error, busy, onCancel, onSubmit(password)}).

test('open이면 제목과 입력칸이 뜬다', () => {
  render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByText('프로젝트 암호 입력')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('암호를 입력하세요')).toBeInTheDocument()
})

test('open이 false면 아무것도 렌더하지 않는다', () => {
  render(<PasswordModal open={false} onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.queryByText('프로젝트 암호 입력')).not.toBeInTheDocument()
})

test('입력칸은 4자를 넘길 수 없다(maxLength=4)', () => {
  render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByPlaceholderText('암호를 입력하세요')).toHaveAttribute('maxLength', '4')
})

test('"아니오" 클릭 시 onCancel을 부르고 모달은 스스로 닫지 않는다(닫는 판단은 부모 몫)', () => {
  const onCancel = vi.fn()
  render(<PasswordModal open onCancel={onCancel} onSubmit={() => {}} />)
  fireEvent.click(screen.getByText('아니오'))
  expect(onCancel).toHaveBeenCalledTimes(1)
  // 부모가 open을 그대로 true로 두고 있으므로(이 테스트는 안 바꾼다) 모달은 그대로 떠 있어야 한다.
  expect(screen.getByText('프로젝트 암호 입력')).toBeInTheDocument()
})

test('"네" 클릭 시 입력한 암호와 함께 onSubmit을 부른다', () => {
  const onSubmit = vi.fn()
  render(<PasswordModal open onCancel={() => {}} onSubmit={onSubmit} />)
  fireEvent.change(screen.getByPlaceholderText('암호를 입력하세요'), { target: { value: '1234' } })
  fireEvent.click(screen.getByText('네'))
  expect(onSubmit).toHaveBeenCalledWith('1234')
})

test('error가 있으면 입력칸 아래 오류 문구가 뜬다', () => {
  render(<PasswordModal open error="암호가 맞지 않습니다" onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByText('암호가 맞지 않습니다')).toBeInTheDocument()
})

test('error가 없으면 오류 문구가 없다', () => {
  render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.queryByText('암호가 맞지 않습니다')).not.toBeInTheDocument()
})

// 회색 비활성 관행(spec Global Constraints) — disabled 속성 + opacity-40 cursor-not-allowed.
test('busy=true면 "아니오"·"네" 버튼이 모두 비활성화된다', () => {
  render(<PasswordModal open busy onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByText('아니오').closest('button')).toBeDisabled()
  expect(screen.getByText('네').closest('button')).toBeDisabled()
})

// 세션에 통과 상태를 남기지 않는다(spec Global Constraints) — 다시 열 때마다 입력을 비운다.
// 이전 프로젝트에서 틀렸던 암호가 다음 프로젝트를 열 때 남아 있으면 안 된다.
test('닫혔다가 다시 열리면 입력값이 비워진다', () => {
  const { rerender } = render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText('암호를 입력하세요'), { target: { value: '9999' } })
  rerender(<PasswordModal open={false} onCancel={() => {}} onSubmit={() => {}} />)
  rerender(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByPlaceholderText('암호를 입력하세요')).toHaveValue('')
})

// 리뷰 fix — 입력칸을 비운 채 「네」를 누르면 서버가 401(password_required)을 준다.
// 403(틀림)과 구분해 쓰라는 신호인데, 이 컴포넌트는 그 요청 자체가 나가지 않게
// 막는 쪽을 택한다(SaveProjectModal이 빈 암호 저장을 막는 것과 같은 관행).
test('입력칸이 비어 있으면 "네" 버튼이 비활성화된다(빈 암호를 제출하면 서버가 401을 준다)', () => {
  render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByText('네').closest('button')).toBeDisabled()
})

test('입력하면 "네" 버튼이 다시 활성화된다', () => {
  render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText('암호를 입력하세요'), { target: { value: '1' } })
  expect(screen.getByText('네').closest('button')).not.toBeDisabled()
})

test('입력칸이 비어 있으면 "네" 클릭이 onSubmit을 부르지 않는다(비활성 버튼 방어)', () => {
  const onSubmit = vi.fn()
  render(<PasswordModal open onCancel={() => {}} onSubmit={onSubmit} />)
  fireEvent.click(screen.getByText('네'))
  expect(onSubmit).not.toHaveBeenCalled()
})

// 같은 모달 안에서 용어를 통일한다(리뷰 지적) — 제목·placeholder·오류 문구는 이미
// "암호"였는데 본문 설명 한 줄만 "비밀번호"로 남아 있었다.
test('본문 설명도 "암호"로 통일되어 있다("비밀번호"라는 말을 쓰지 않는다)', () => {
  render(<PasswordModal open onCancel={() => {}} onSubmit={() => {}} />)
  expect(screen.getByText(/이 프로젝트는 암호로 보호되어 있습니다/)).toBeInTheDocument()
  expect(screen.queryByText(/비밀번호/)).not.toBeInTheDocument()
})
