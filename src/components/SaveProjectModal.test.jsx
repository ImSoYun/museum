import { render, screen, fireEvent } from '@testing-library/react'
import SaveProjectModal from './SaveProjectModal.jsx'

// round10 Task4 — 새 계약: onClose→onCancel(취소·오버레이·X 공용), onSave는 문자열이
// 아니라 {title, description, password} 객체를 준다. 옛 계약의 "제목 입력값이
// defaultTitle로 채워진다"·"빈 제목이면 저장 불가"는 아래 Step3 시나리오들이 그대로
// 흡수한다(프로젝트명 필드 검증에 포함).

test('open이 false면 렌더 안 됨', () => {
  render(<SaveProjectModal open={false} defaultTitle="" onCancel={() => {}} onSave={() => {}} />)
  expect(screen.queryByText('프로젝트로 저장')).toBeNull()
})

test('작업 설명과 암호설정 칸이 있다', () => {
  render(<SaveProjectModal open defaultTitle="민주화운동" onCancel={() => {}} onSave={() => {}} />)
  expect(screen.getByLabelText('프로젝트명')).toHaveValue('민주화운동')
  expect(screen.getByLabelText('작업 설명')).toBeInTheDocument()
  expect(screen.getByLabelText('암호설정')).not.toBeChecked()
  expect(screen.queryByPlaceholderText('암호를 입력하세요')).toBeNull()
})

test('암호설정을 켜야 암호 입력칸이 열리고, 4자를 넘길 수 없다', () => {
  render(<SaveProjectModal open defaultTitle="x" onCancel={() => {}} onSave={() => {}} />)
  fireEvent.click(screen.getByLabelText('암호설정'))
  const pw = screen.getByPlaceholderText('암호를 입력하세요')
  expect(pw).toHaveAttribute('maxLength', '4')
})

test('저장은 제목·설명·암호를 함께 올린다', () => {
  const onSave = vi.fn()
  render(<SaveProjectModal open defaultTitle="민주화운동" onCancel={() => {}} onSave={onSave} />)
  fireEvent.change(screen.getByLabelText('작업 설명'), { target: { value: '포스터 모음' } })
  fireEvent.click(screen.getByLabelText('암호설정'))
  fireEvent.change(screen.getByPlaceholderText('암호를 입력하세요'), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave).toHaveBeenCalledWith({ title: '민주화운동', description: '포스터 모음', password: '1234' })
})

test('암호설정을 껐다면 암호는 올리지 않는다', () => {
  const onSave = vi.fn()
  render(<SaveProjectModal open defaultTitle="민주화운동" onCancel={() => {}} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave).toHaveBeenCalledWith({ title: '민주화운동', description: '', password: null })
})

test('제목이 비면 저장할 수 없다', () => {
  render(<SaveProjectModal open defaultTitle="" onCancel={() => {}} onSave={() => {}} />)
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
})

// round10 결정 — 암호설정 체크는 켰지만 아직 암호를 치지 않은 "중간 상태"를 저장으로
// 흘려보내지 않는다. 서버(ProjectCreateRequest.password, min_length=1)가 빈 문자열
// 암호를 422로 거부하므로, 여기서 조용히 "암호 없음"으로 되돌리는 대신(사용자가
// 분명히 암호를 걸겠다고 체크했는데 말없이 무시하면 더 놀랍다) 저장 버튼을 막아
// 사용자가 암호를 채우거나 체크를 꺼서 의도를 분명히 하게 한다.
test('암호설정은 켰지만 암호를 비워두면 저장할 수 없다', () => {
  render(<SaveProjectModal open defaultTitle="x" onCancel={() => {}} onSave={() => {}} />)
  fireEvent.click(screen.getByLabelText('암호설정'))
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
})

test('암호설정을 켰다가 다시 끄면 저장할 수 있다(암호 없음 의도로 복귀)', () => {
  const onSave = vi.fn()
  render(<SaveProjectModal open defaultTitle="x" onCancel={() => {}} onSave={onSave} />)
  const pwCheck = screen.getByLabelText('암호설정')
  fireEvent.click(pwCheck)
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  fireEvent.click(pwCheck)
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave).toHaveBeenCalledWith({ title: 'x', description: '', password: null })
})

test('취소 버튼을 누르면 onCancel이 불린다', () => {
  const onCancel = vi.fn()
  render(<SaveProjectModal open defaultTitle="x" onCancel={onCancel} onSave={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(onCancel).toHaveBeenCalled()
})

// busy(브리프 인터페이스: {open, defaultTitle, busy, onCancel, onSave}) — 저장 요청이
// 나가 있는 동안 중복 제출·중도 취소를 막는다. 취소까지 막는 이유는 Modal의 오버레이·
// X 버튼도 onCancel 하나로 묶여 있어(round10 LnbHistory 소비처), 여기서 버튼만
// 비활성화해도 배경 클릭으로는 여전히 닫혀 그 사이 응답이 돌아오면 언마운트된
// 모달에 setState하려는 경합이 생기기 때문이다 — 소비처(LnbHistory)가 onCancel
// 자체를 busy 동안 무시하지만, 모달도 버튼 자체를 비활성화해 눈에 보이는 신호를 준다.
test('busy=true 면 저장·취소 버튼이 비활성화되고 저장 버튼 라벨이 바뀐다', () => {
  render(<SaveProjectModal open defaultTitle="x" busy onCancel={() => {}} onSave={() => {}} />)
  expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
})
