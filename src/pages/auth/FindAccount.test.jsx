// round06c-ext D2d(spec §9.3·§1.4③·R2.4·R2.8 — 메일 없음): 이메일 발송 인프라가 스택에
// 없고 셀프 복구도 명시적 비목표다(§0 R2.8). round06d가 이메일 입력/발송 폼을 만들고
// round06c 리뷰 fix3에서 문구만 "관리자 문의"로 바꿨던 것을, D2d에서 폼 자체를 걷어내고
// "상위 관리자 문의" 단일 안내 + 로그인 복귀 버튼으로 대체한다(퍼블 find.html에는 없는
// 화면 — round06c 확정 편차, spec 미참조사유 #3). 탭 골격(tab_seg)만 퍼블 그대로 유지한다.
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FindAccount from './FindAccount.jsx'

const renderFind = () => render(<MemoryRouter><FindAccount /></MemoryRouter>)

test('/find 초기 상태: 아이디 찾기 탭 선택, 비밀번호 패널은 hidden', () => {
  renderFind()
  expect(screen.getByRole('tab', { name: '아이디 찾기' }))
    .toHaveAttribute('aria-selected', 'true')

  const idPanel = document.getElementById('panel_findid')
  const pwPanel = document.getElementById('panel_findpw')
  expect(idPanel).not.toHaveAttribute('hidden')
  expect(pwPanel).toHaveAttribute('hidden')
})

test('/find 탭 전환: 비밀번호 찾기 클릭 시 패널 노출이 뒤바뀐다', () => {
  renderFind()
  fireEvent.click(screen.getByRole('tab', { name: '비밀번호 찾기' }))

  expect(screen.getByRole('tab', { name: '비밀번호 찾기' }))
    .toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: '아이디 찾기' }))
    .toHaveAttribute('aria-selected', 'false')

  expect(document.getElementById('panel_findid')).toHaveAttribute('hidden')
  expect(document.getElementById('panel_findpw')).not.toHaveAttribute('hidden')
})

test('/find 뒤로가기 링크는 /login으로 간다', () => {
  renderFind()
  expect(screen.getByRole('link', { name: '뒤로가기' })).toHaveAttribute('href', '/login')
})

// D2d 핵심 — 이메일 입력/발송 UI가 전면 제거됐다(§9.3 브리프 Step1).
describe('/find 이메일 입력·발송 UI 전면 제거(R2.4·R2.8)', () => {
  test('이메일 input이 문서 어디에도 없다(label 조회·querySelector 이중 확인)', () => {
    renderFind()
    expect(screen.queryByLabelText('이메일')).toBeNull()
    expect(document.querySelector('input[type="email"]')).toBeNull()
  })

  test('폼·입력요소가 전혀 없다(문의 안내만 남는다) — name 붙은 form 필드 0개', () => {
    renderFind()
    expect(document.querySelectorAll('input, select, textarea').length).toBe(0)
    expect(document.querySelectorAll('form').length).toBe(0)
  })

  test('두 패널 모두 "상위 관리자 문의" 안내 문구를 보여준다', () => {
    renderFind()
    const idPanel = document.getElementById('panel_findid')
    expect(within(idPanel).getByText(/관리자.*문의/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '비밀번호 찾기' }))
    const pwPanel = document.getElementById('panel_findpw')
    expect(within(pwPanel).getByText(/관리자.*문의/)).toBeInTheDocument()
  })

  test('두 패널 모두 로그인 화면으로 돌아가는 버튼(링크)을 제공한다', () => {
    renderFind()
    const idPanel = document.getElementById('panel_findid')
    expect(within(idPanel).getByRole('link', { name: '로그인 화면으로' }))
      .toHaveAttribute('href', '/login')

    fireEvent.click(screen.getByRole('tab', { name: '비밀번호 찾기' }))
    const pwPanel = document.getElementById('panel_findpw')
    expect(within(pwPanel).getByRole('link', { name: '로그인 화면으로' }))
      .toHaveAttribute('href', '/login')
  })

  test('렌더·탭 전환 어디에서도 네트워크(fetch) 호출이 없다', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    renderFind()
    fireEvent.click(screen.getByRole('tab', { name: '비밀번호 찾기' }))
    fireEvent.click(screen.getByRole('tab', { name: '아이디 찾기' }))
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
