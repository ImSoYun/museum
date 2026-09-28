import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import SystemAccessDenied from './SystemAccessDenied.jsx'

/**
 * SystemAccessDenied — v2 admin_access_denied.html(본문 없이 main.mng_main + 접근거부
 * 알림만)의 재현. RequireAuth가 canAccess=false·system-ops/system-accounts 영역일 때
 * Navigate('/') 대신 이 화면을 렌더한다(원장 주입 사항 #2) — 이 테스트는 그 배선의
 * 전제가 되는 컴포넌트 자체의 계약만 본다(배선 자체는 App.test.jsx가 검증).
 */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

function renderDenied(path = '/system/monitoring') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<><SystemAccessDenied /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  )
}

test('main.mng_main 안에 sr_only 제목 "시스템관리"를 렌더한다(v2 admin_access_denied.html 계승)', () => {
  const { container } = renderDenied()
  const main = container.querySelector('main.mng_main')
  expect(main).not.toBeNull()
  expect(screen.getByRole('heading', { level: 2, name: '시스템관리' })).toHaveClass('sr_only')
})

test('접근거부 알림(system_access)이 즉시 노출된다', () => {
  renderDenied()
  const dialog = screen.getByRole('alertdialog')
  expect(dialog).toHaveTextContent('접근 권한 제한')
  expect(dialog).toHaveTextContent('통합관리자에게 있습니다.')
})

test('확인 버튼을 누르면 홈으로 이동한다', () => {
  renderDenied('/system/accounts')
  expect(screen.getByTestId('loc')).toHaveTextContent('/system/accounts')
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/')
})

test('Escape로도 홈 이동(AlertPopup의 닫기 경로 재사용)', () => {
  renderDenied('/system/nodes')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.getByTestId('loc')).toHaveTextContent('/')
})
