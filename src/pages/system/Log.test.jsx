import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'
import Log from './Log.jsx'

// D1-2가 만든 잠정 placeholder를 제자리에서 v2 재퍼블한다(원장 주입 사항 #1 — 라우터
// /system/log 배선은 불변, 이 파일은 D2b가 그 자리에서 채운다).
function renderLog(path = '/system/log') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}><Log /></MemoryRouter>
    </ToastProvider>
  )
}

test('SystemTabs가 렌더되고 이용로그 탭이 4탭 중 활성이다', () => {
  renderLog()
  expect(screen.getByRole('link', { name: '모니터링' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '노드관리' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '이용로그' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '계정·권한' })).toBeInTheDocument()
})

test('이용로그 표는 mock 5건을 전부 보여준다', () => {
  renderLog()
  expect(screen.getByText(/support1 역할을 일반 관리자로 변경/)).toBeInTheDocument()
  expect(screen.getByText(/민주화운동 국제 연대/)).toBeInTheDocument()
  expect(screen.getByText(/대시보드 조회 세션 시작/)).toBeInTheDocument()
})

test('data_toolbar에 총 건수가 표시된다', () => {
  // F8(round06c 배치 리뷰): 퍼블 원문("총 5명")은 단위 오기다(로그는 건수지 인원이 아니다) —
  // Log.jsx가 "건"으로 교정했으므로 단언도 함께 갱신한다.
  const { container } = renderLog()
  expect(container.querySelector('.data_total').textContent).toBe('총 5건')
})

test('기간·유형·부서 select 3개와 사용자 활동 검색 input이 렌더된다(dropdown_box 스킵 — 네이티브 select 유지)', () => {
  const { container } = renderLog()
  const bar = container.querySelector('form.data_filter_bar')
  expect(bar.querySelectorAll('.select_box > select')).toHaveLength(3)
  expect(container.querySelector('#log_filter_period')).not.toBeNull()
  expect(container.querySelector('#log_filter_type')).not.toBeNull()
  expect(container.querySelector('#log_filter_dept')).not.toBeNull()
  expect(screen.getByPlaceholderText('사용자 활동 검색')).toBeInTheDocument()
})

test('필터 제출은 준비중 — 토스트만 뜨고 목록은 그대로다(D2b)', () => {
  const { container } = renderLog()
  fireEvent.click(within(container.querySelector('.data_filter_bar')).getByRole('button', { name: '검색' }))
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText(/support1 역할을 일반 관리자로 변경/)).toBeInTheDocument()
})

test('엑셀 다운로드는 준비중 — data_filter_export_btn 클래스가 붙는다', () => {
  const { container } = renderLog()
  const btn = screen.getByRole('button', { name: '엑셀 다운로드' })
  expect(btn.className).toContain('data_filter_export_btn')
  fireEvent.click(btn)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

// ── round06f 갈래 E(spec §10.3 · DoD 7): prod에서 탭줄은 남고 본문만 준비중 ──
// Monitoring/Nodes와 같은 계약이다. role 통합관리자 명시 이유는 spec §10.4.
test('prod 환경(통합관리자): SystemTabs 4탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다', () => {
  const { container } = render(
    <AuthContext.Provider value={{ user: { username: 'u', role: '통합관리자' }, appEnv: 'prod' }}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/system/log']}><Log /></MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>
  )
  for (const name of ['모니터링', '노드관리', '이용로그', '계정·권한']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(container.querySelector('.data_panel')).toBeNull()
  expect(container.querySelector('form.data_filter_bar')).toBeNull()
  expect(screen.queryByText(/support1 역할을 일반 관리자로 변경/)).toBeNull()
})
