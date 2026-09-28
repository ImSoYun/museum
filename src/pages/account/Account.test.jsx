import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext.jsx'
import Account from './Account.jsx'

vi.mock('../../lib/authApi.js', () => ({
  joinRequest: vi.fn(),
  changePasswordRequest: vi.fn(),
}))
import { changePasswordRequest } from '../../lib/authApi.js'

// round06c F2: CURRENT_USER 상수가 사라지고 Account가 useAuth()를 읽으므로,
// 구 CURRENT_USER와 같은 값을 AuthProvider seed로 시드한다(§9.1 재배선 — 단언 불변).
// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": email 키를 뺐다
// (세션 응답 계약 자체에 더 이상 그 필드가 없다).
const SEED_USER = { username: 'kim', display_name: '김연구', role: '사용자', dept: '학예연구실' }

function renderAccount(user = SEED_USER) {
  return render(
    <MemoryRouter>
      <AuthProvider seed={{ user, status: 'authed' }}>
        <Account />
      </AuthProvider>
    </MemoryRouter>,
  )
}

test('shows user name 김연구', () => {
  renderAccount()
  expect(screen.getByText(/김연구/)).toBeInTheDocument()
})

test('shows 사용자 badge (useAuth 시드 역할 단일화)', () => {
  renderAccount()
  expect(screen.getAllByText('사용자').length).toBeGreaterThan(0)
})

// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 계정 화면 어디에도
// 이메일이 보이지 않아야 한다(구 테스트 'shows email landsoft@gmail.com'을 대체한다).
test('이메일은 화면 어디에도 노출되지 않는다', () => {
  renderAccount()
  expect(screen.queryByText(/@/)).not.toBeInTheDocument()
})

// round10a — 부서는 **세션이 주는 값**이다. 전에는 '학예연구실' 리터럴이 박혀 있어
// 어느 계정으로 봐도 같은 부서가 떴다(라이브 실측: admin 은 /auth/me 가 dept:null 인데
// 화면은 학예연구실이라고 말했다). 세션 계약은 이미 dept 를 준다 —
// museum/auth/routes.py:77 `"dept": user.dept`.
test('부서를 세션(dept)에서 읽는다', () => {
  renderAccount({ ...SEED_USER, dept: '전시운영과' })
  expect(screen.getByText(/전시운영과/)).toBeInTheDocument()
  expect(screen.queryByText(/학예연구실/)).not.toBeInTheDocument()
})

// round10b Task C — 이메일이 없어지며 "이메일 · 부서" 구분점(·) 로직 자체가 사라졌다
// (구 테스트 '부서가 없으면 구분점까지 함께 사라진다'를 대체한다). 모르는 것을 지어내지
// 않는다 — 부서가 없으면 그 정보 줄은 그냥 빈 채로 남는다.
test('부서가 없으면 정보 줄이 빈 채로 남는다', () => {
  renderAccount({ ...SEED_USER, dept: null })
  expect(screen.getByTestId('account_contact_line').textContent.trim()).toBe('')
})

test('shows 정보 수정 button', () => {
  renderAccount()
  expect(screen.getByRole('button', { name: '정보 수정' })).toBeInTheDocument()
})

test('shows circular avatar with initial 김', () => {
  renderAccount()
  expect(screen.getByText('김')).toBeInTheDocument()
})

test("범위가 '내 계정'으로 축소되어 사용자 목록 UI 가 없다", () => {
  renderAccount()
  expect(screen.getAllByRole('heading', { name: '내 계정' }).length).toBeGreaterThan(0)
  expect(screen.queryByText('권한·계정 관리')).not.toBeInTheDocument()
})

test('정보 수정 클릭 시 모달이 열리고 이름 변경이 반영된다', () => {
  renderAccount()
  fireEvent.click(screen.getByRole('button', { name: '정보 수정' }))
  expect(screen.getByRole('heading', { name: '정보 수정' })).toBeInTheDocument()
  const nameInput = screen.getByLabelText('이름')
  fireEvent.change(nameInput, { target: { value: '김역사' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByText('김역사')).toBeInTheDocument()
})

beforeEach(() => {
  changePasswordRequest.mockReset()
})

test('비밀번호 변경 폼이 렌더된다', () => {
  renderAccount()
  expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument()
  expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument()
  expect(screen.getByLabelText('새 비밀번호 확인')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '비밀번호 변경' })).toBeInTheDocument()
})

test('새 비밀번호가 8자 미만이면 서버 호출 없이 에러를 보여준다', async () => {
  renderAccount()
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'oldpass1' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'short1' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'short1' } })
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('8자 이상')
  expect(changePasswordRequest).not.toHaveBeenCalled()
})

test('새 비밀번호와 확인이 다르면 서버 호출 없이 에러를 보여준다', async () => {
  renderAccount()
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'oldpass1' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass999' } })
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('일치하지 않습니다')
  expect(changePasswordRequest).not.toHaveBeenCalled()
})

test('정상 입력 시 changePasswordRequest를 current_password/new_password로 호출한다', async () => {
  changePasswordRequest.mockResolvedValue({ status: 200 })
  renderAccount()
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'oldpass1' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass123' } })
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

  await waitFor(() => expect(changePasswordRequest).toHaveBeenCalledWith({
    current_password: 'oldpass1', new_password: 'newpass123',
  }))
  expect(await screen.findByRole('status')).toHaveTextContent('변경되었습니다')
})

test('서버가 400과 사유를 반환하면 그 사유를 보여준다', async () => {
  changePasswordRequest.mockResolvedValue({ status: 400, detail: '현재 비밀번호가 올바르지 않습니다' })
  renderAccount()
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'wrongpass' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass123' } })
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('현재 비밀번호가 올바르지 않습니다')
})

// round06e-finishing Critical #1 회귀 가드 — status===200이라도 detail(에러 사유)이
// 함께 실려 있으면 성공으로 오판하지 않는다(단일 필드만 믿지 않는 이중 판정, Account.jsx).
test('status:200과 detail이 함께 오면 성공으로 오판하지 않고 그 사유를 보여준다', async () => {
  changePasswordRequest.mockResolvedValue({ status: 200, detail: '세션 무효화에 실패했습니다' })
  renderAccount()
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'oldpass1' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass123' } })
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('세션 무효화에 실패했습니다')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
