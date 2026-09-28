import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Join from './Join.jsx'

const renderJoin = () => render(<MemoryRouter><Join /></MemoryRouter>)

// 유효한 값 전부를 채운 뒤 필요한 필드만 덮어써서 검증 케이스를 만든다.
// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": join_email을 뺐다.
const VALID = {
  join_name: '박연구',
  join_dept: '자료관리과',
  join_id: 'kim01',
  join_pw: 'password1',
  join_pw_confirm: 'password1',
  join_role: '사용자',
}

function fillForm(overrides = {}) {
  const values = { ...VALID, ...overrides }
  for (const [name, value] of Object.entries(values)) {
    const el = document.querySelector(`[name="${name}"]`)
    fireEvent.change(el, { target: { value } })
  }
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: '가입신청' }))

test('join: 신청권한 옵션은 스키마 어휘 3개(사용자/관리자/통합관리자)다(§0 R2.3)', () => {
  renderJoin()
  const select = screen.getByLabelText('신청권한')
  const values = Array.from(select.options).map((o) => o.value)
  expect(values).toEqual(['', '사용자', '관리자', '통합관리자'])

  // 퍼블 원문의 저장값은 schema.sql의 role CHECK를 통과하지 못한다
  expect(values).not.toContain('자료 관리자')
  expect(values).not.toContain('실무자')

  // 표시 텍스트와 저장값이 같은 한 계열이어야 매핑표가 생기지 않는다
  expect(Array.from(select.options).map((o) => o.textContent))
    .toEqual(['선택', '사용자', '관리자', '통합관리자'])
})

test('join: 신청권한 초기값은 빈 문자열("선택")이다', () => {
  renderJoin()
  expect(screen.getByLabelText('신청권한')).toHaveValue('')
})

test('join: 뒤로가기 링크는 /login으로 간다', () => {
  renderJoin()
  expect(screen.getByRole('link', { name: '뒤로가기' })).toHaveAttribute('href', '/login')
})

describe('join: 클라 검증(round06d가 미룬 5가지 중 형태 검증 4가지)', () => {
  test('필수 필드가 비어 있으면 인라인 에러를 보여주고 네트워크 호출을 하지 않는다', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    renderJoin()
    submit()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  test('비밀번호가 8자 미만이면 에러를 보여준다', () => {
    renderJoin()
    fillForm({ join_pw: 'short1', join_pw_confirm: 'short1' })
    submit()
    expect(screen.getByText('비밀번호는 8자 이상이어야 합니다')).toBeInTheDocument()
  })

  test('비밀번호와 확인이 다르면 에러를 보여준다', () => {
    renderJoin()
    fillForm({ join_pw_confirm: 'different1' })
    submit()
    expect(screen.getByText('비밀번호가 일치하지 않습니다')).toBeInTheDocument()
  })
})

// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 이메일 입력·형식
// 검증(join_email·EMAIL_RE)을 항목과 함께 걷어냈다(구 '이메일 형식이 아니면 에러를
// 보여준다' 테스트를 대체한다).
test('join: 이메일 입력이 화면 어디에도 없다', () => {
  renderJoin()
  expect(screen.queryByLabelText('이메일')).toBeNull()
  expect(document.querySelector('input[type="email"]')).toBeNull()
})

describe('join: 제출 배선(POST /auth/join)', () => {
  test('검증 통과 시 서버 계약 그대로 전송하고 200이면 승인 대기 안내로 전환한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    renderJoin()
    fillForm()
    submit()

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/join'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          username: 'kim01',
          password: 'password1',
          display_name: '박연구',
          dept: '자료관리과',
          role: '사용자',
        }),
      }),
    )
    expect(await screen.findByText('신청이 접수되었습니다. 관리자 승인 후 이용 가능합니다.')).toBeInTheDocument()
  })

  // F6(round06c 배치 리뷰): 위 테스트는 role:'사용자' 제출만 검증했다 — 수용기준(§0 R2.3)은
  // 3옵션 전부가 신청 가능해야 한다는 것이므로 '통합관리자' 선택 제출도 별도로 검증한다.
  test('통합관리자를 선택해 제출하면 서버 계약 body에 role:"통합관리자"가 그대로 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    renderJoin()
    fillForm({ join_role: '통합관리자' })
    submit()

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/join'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          username: 'kim01',
          password: 'password1',
          display_name: '박연구',
          dept: '자료관리과',
          role: '통합관리자',
        }),
      }),
    )
  })

  test('409(중복)이면 중복 안내를 보여주고 승인 대기 화면으로 넘어가지 않는다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 409, json: () => Promise.resolve({ detail: '이미 사용 중입니다' }) })
    renderJoin()
    fillForm()
    submit()

    // round10b Task C — 이메일 항목 자체가 없어져 중복 사유는 아이디 하나뿐이다.
    expect(await screen.findByText('이미 사용 중인 아이디입니다')).toBeInTheDocument()
    expect(screen.queryByText('신청이 접수되었습니다. 관리자 승인 후 이용 가능합니다.')).toBeNull()
    // 재시도할 수 있도록 폼이 그대로 남아 있다
    expect(screen.getByLabelText('신청권한')).toBeInTheDocument()
  })
})
