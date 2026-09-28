/**
 * RequireAuth.test.jsx — 전면 게이트 단위 테스트(round06c F2, spec §9.2).
 *
 * AuthContext.Provider로 { user, status }를 직접 주입해 loading·anon·역할판정 세 갈래를
 * 각각 격리해서 본다. router.jsx에 실제로 꽂힌 뒤의 통합 동작(App.test.jsx)과는 다른
 * 레이어 — 여기서는 RequireAuth 자신의 순수 분기 로직만 검증한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from './AuthContext.jsx'
import RequireAuth from './RequireAuth.jsx'

function renderGate(authValue, path = '/') {
  return render(
    <AuthContext.Provider value={{ login: async () => {}, logout: async () => {}, ...authValue }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>로그인화면</div>} />
          <Route path="/" element={<RequireAuth><div>홈본문</div></RequireAuth>} />
          <Route path="/manage/ocr" element={<RequireAuth><div>OCR본문</div></RequireAuth>} />
          <Route path="/system/monitoring" element={<RequireAuth><div>모니터링본문</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

test('status=loading 이면 children 대신 스플래시(role=status)가 렌더된다', () => {
  renderGate({ user: null, status: 'loading' }, '/')
  expect(screen.queryByText('홈본문')).toBeNull()
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('status=anon 이면 /login 으로 리다이렉트된다(replace)', () => {
  renderGate({ user: null, status: 'anon' }, '/')
  expect(screen.queryByText('홈본문')).toBeNull()
  expect(screen.getByText('로그인화면')).toBeInTheDocument()
})

test('authed + 권한 있는 경로(system-ops, 통합관리자)는 children을 그대로 렌더한다', () => {
  renderGate({ user: { role: '통합관리자' }, status: 'authed' }, '/system/monitoring')
  expect(screen.getByText('모니터링본문')).toBeInTheDocument()
})

// round06c-ext D1-1: manage area는 세 역할 전부에 허용된다(자료관리 화면은 전부
// "준비중"이라 열람 자체를 막을 이유가 없다, §3.3) — 개명 전에는 사용자가 차단됐다.
test('authed + manage 경로(사용자 role)는 manage 권한이 있어 children을 그대로 렌더한다', () => {
  renderGate({ user: { role: '사용자' }, status: 'authed' }, '/manage/ocr')
  expect(screen.getByText('OCR본문')).toBeInTheDocument()
})

// F2(round06c 배치 리뷰): system-ops 차단은 더 이상 '/'로 즉시 리다이렉트하지 않는다
// (RequireAuth.jsx:46-51, D2b) — SystemAccessDenied가 그 자리에 렌더되고, 확인 버튼을
// 눌러야 홈으로 이동한다. App.test.jsx:163-201의 신규 단언 패턴(alertdialog 노출 + 확인
// 클릭 시 홈 렌더)과 정합하게 교체한다.
test('authed 라도 canAccess 가 false 인 system-ops 경로는 접근거부 화면이 뜨고, 확인 시 홈으로 이동한다(사용자 role)', () => {
  renderGate({ user: { role: '사용자' }, status: 'authed' }, '/system/monitoring')
  expect(screen.queryByText('모니터링본문')).toBeNull()
  const dialog = screen.getByRole('alertdialog')
  expect(dialog).toHaveTextContent('접근 권한 제한')
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByText('홈본문')).toBeInTheDocument()
})

test('authed + 전 역할 공통 영역(/)은 사용자 role 도 접근 가능하다', () => {
  renderGate({ user: { role: '사용자' }, status: 'authed' }, '/')
  expect(screen.getByText('홈본문')).toBeInTheDocument()
})

test('authed + manage 경로는 관리자 role 이면 통과한다', () => {
  renderGate({ user: { role: '관리자' }, status: 'authed' }, '/manage/ocr')
  expect(screen.getByText('OCR본문')).toBeInTheDocument()
})

// round06c-ext D1-1: system-ops(모니터링·노드관리·이용로그)는 통합관리자 전용이다 —
// 관리자는 system-accounts(계정·권한)만 갖는다.
// F2(round06c 배치 리뷰): 위 사용자 role 케이스와 같은 이유로 교체(관리자도 system-ops
// 권한이 없어 같은 접근거부 배선을 탄다).
test('authed 라도 canAccess 가 false 인 system-ops 경로는 접근거부 화면이 뜨고, 확인 시 홈으로 이동한다(관리자 role)', () => {
  renderGate({ user: { role: '관리자' }, status: 'authed' }, '/system/monitoring')
  expect(screen.queryByText('모니터링본문')).toBeNull()
  const dialog = screen.getByRole('alertdialog')
  expect(dialog).toHaveTextContent('접근 권한 제한')
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByText('홈본문')).toBeInTheDocument()
})
