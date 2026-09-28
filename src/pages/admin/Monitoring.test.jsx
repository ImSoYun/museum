import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Monitoring from './Monitoring.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'

// D2b — Monitoring은 이제 useToast를 쓰므로(모든 액션이 showToast('준비 중입니다')로
// 치환됐다) ToastProvider로 감싸야 한다(D2a Materials.test.jsx와 같은 관행).
function renderMonitoring() {
  return render(
    <ToastProvider>
      <MemoryRouter><Monitoring /></MemoryRouter>
    </ToastProvider>
  )
}

test('SystemTabs가 렌더되고 모니터링 탭이 4탭 중 활성이다', () => {
  renderMonitoring()
  expect(screen.getByRole('link', { name: '모니터링' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '노드관리' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '이용로그' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '계정·권한' })).toBeInTheDocument()
})

test('shows stat card value 9,142 (오늘 질의 수)', () => {
  renderMonitoring()
  expect(screen.getByText('9,142')).toBeInTheDocument()
})

test('shows stat card value 48 (인덱싱 완료)', () => {
  renderMonitoring()
  expect(screen.getByText('48')).toBeInTheDocument()
})

test('shows stat card value 92% (임베딩 완료)', () => {
  renderMonitoring()
  expect(screen.getByText('92%')).toBeInTheDocument()
})

test('shows stat card value 8 (오늘 검색 요청)', () => {
  renderMonitoring()
  expect(screen.getByText('8')).toBeInTheDocument()
})

test('KPI 카드는 v2 stat_card_list > li.stat_card 마크업이다(4장)', () => {
  const { container } = renderMonitoring()
  const list = container.querySelector('ul.stat_card_list')
  expect(list).not.toBeNull()
  expect(list.querySelectorAll('li.stat_card')).toHaveLength(4)
})

test('KPI 카드 클릭은 준비중 — 더 이상 다른 화면으로 이동하지 않는다(D2b)', () => {
  renderMonitoring()
  fireEvent.click(screen.getByTestId('kpi-indexed'))
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('시간대별 사용량 chart section is present', () => {
  renderMonitoring()
  expect(screen.getByText('시간대별 사용량')).toBeInTheDocument()
})

test('OCR·번역 학습 데이터 처리 현황 section is present', () => {
  renderMonitoring()
  expect(screen.getByText(/OCR·번역 학습 데이터 처리 현황/)).toBeInTheDocument()
})

test('실시간 질의 로그 section is present', () => {
  renderMonitoring()
  expect(screen.getByText('실시간 질의 로그')).toBeInTheDocument()
})

test('shows query log rows from queryLogs data', () => {
  renderMonitoring()
  expect(screen.getByTestId('view-log-q1')).toBeInTheDocument()
})

test('검색 결과 버튼은 준비중 — 모달 없이 토스트만 뜬다(D2b)', () => {
  renderMonitoring()
  fireEvent.click(screen.getByTestId('view-log-q1'))
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.queryByText('질의 결과 조회')).not.toBeInTheDocument()
})

test('코멘트 버튼은 준비중 — 모달 없이 토스트만 뜨고 평가·코멘트 수가 그대로다(D2b)', () => {
  renderMonitoring()
  const before = screen.getByTestId('open-comments-q1').textContent
  fireEvent.click(screen.getByTestId('open-comments-q1'))
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.queryByRole('heading', { name: '코멘트 · 평가' })).not.toBeInTheDocument()
  expect(screen.getByTestId('open-comments-q1').textContent).toBe(before)
})

test('기간 선택(flatpickr 대체)은 준비중 — 정적 표시고 위젯을 붙이지 않는다(D2b)', () => {
  renderMonitoring()
  fireEvent.click(screen.getByTestId('log-period-select'))
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  // flatpickr 라이브러리는 이 라운드 미사용 자산 — DOM에 flatpickr 관련 흔적이 없어야 한다.
  expect(document.querySelector('.flatpickr-calendar')).toBeNull()
})

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

// round06c-ext D1-2: 실제 앱 라우트가 /admin/monitoring → /system/monitoring 으로 이관됐다.
// 이 헬퍼는 실제 앱 라우터가 아니라 이 테스트 파일 전용의 격리된 라우트 정의라 동작에는
// 영향이 없지만, 이름을 맞춰 둔다(퇴역한 경로를 테스트에 남기지 않는다).
function renderMonitoringAtRoute() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/system/monitoring']}>
        <Routes>
          <Route path="/system/monitoring" element={<><Monitoring /><LocationProbe /></>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

// D2b 범위 밖 — 브리프는 KPI·모달·flatpickr만 준비중 대상으로 못박았고, 시간대별
// 사용량/OCR 학습 현황 패널은 이번 라운드 변경 대상이 아니다(§4 디자인 참조 — 미참조
// 사유: 대응 v2 CSS 그룹을 브리프가 지정하지 않았다). 그래서 이 두 실동작은 그대로 둔다.
test('처리현황 패널의 학습이력 링크 클릭 시 /manage/history 로 이동(변경 대상 밖 — 실동작 유지)', () => {
  renderMonitoringAtRoute()
  fireEvent.click(screen.getByTestId('processing-history-link'))
  expect(screen.getByTestId('loc')).toHaveTextContent('/manage/history')
})

// ── round06f 갈래 E(spec §10.3 · DoD 7): prod에서 탭줄은 남고 본문만 준비중 ──
// round06e는 이 화면을 AppShell에서 통째로 <ComingSoon/>으로 갈아치웠다 — 탭줄까지
// 함께 사라졌다. 이제 게이트가 <SystemTabs/> 바깥이 아니라 그 뒤 본문(data_panel)만
// 덮는다. role을 통합관리자로 **명시**하는 이유: "4탭 전부"는 통합관리자 기준이고
// (spec §10.4) 관리자 1탭·사용자 0탭은 env가 아니라 role 정책이라 이 변경과 무관하다.
// AuthProvider의 seed는 appEnv를 지원하지 않으므로 AuthContext.Provider로 직접 감싼다
// (SystemTabs.test.jsx·Lnb.test.jsx와 같은 관행).
test('prod 환경(통합관리자): SystemTabs 4탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다', () => {
  const { container } = render(
    <AuthContext.Provider value={{ user: { username: 'u', role: '통합관리자' }, appEnv: 'prod' }}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/system/monitoring']}><Monitoring /></MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>
  )
  for (const name of ['모니터링', '노드관리', '이용로그', '계정·권한']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(container.querySelector('.data_panel')).toBeNull()
  expect(screen.queryByText('9,142')).toBeNull()           // KPI(오늘 질의 수) 미렌더
  expect(screen.queryByText('실시간 질의 로그')).toBeNull() // 표 섹션 미렌더
})
