import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import History from './History.jsx'
import { ManageProvider } from '../../state/ManageProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'

function renderHistory() {
  return render(
    <ToastProvider>
      <ManageProvider>
        <MemoryRouter><History /></MemoryRouter>
      </ManageProvider>
    </ToastProvider>
  )
}

function submitFilter(container) {
  fireEvent.click(within(container.querySelector('.data_filter_bar')).getByRole('button', { name: '검색' }))
}

test('History: data_panel_head 문구는 퍼블 원문을 따른다', () => {
  const { container } = renderHistory()
  const head = container.querySelector('.data_panel_head')
  expect(within(head).getByText('학습 데이터 반영 이력')).toBeInTheDocument()
  expect(within(head).getByText('AI 모델에 반영된 자료 처리 이력')).toBeInTheDocument()
})

test('History: mng_page_tit + page_tabs가 렌더된다', () => {
  renderHistory()
  expect(screen.getByRole('heading', { name: '자료관리' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '학습 반영 이력' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '유물자료 OCR' })).toBeInTheDocument()
})

test('History: 개별 테두리 select 4개가 data_filter_bar 한 덩어리로 바뀐다', () => {
  const { container } = renderHistory()
  const bar = container.querySelector('form.data_filter_bar')
  expect(bar).not.toBeNull()
  expect(bar.querySelectorAll('.select_box > select')).toHaveLength(4)
  expect(bar.querySelectorAll('.data_filter_divider')).toHaveLength(4)
  expect(bar.querySelector('input[type=search]').placeholder).toBe('검색어를 입력해주세요.')
})

test('History: "기간"은 옵션이 정렬 방향이므로 첫 옵션 문구를 "정렬"로 교정한다', () => {
  const { container } = renderHistory()
  const period = container.querySelector('#history_filter_period')
  expect(Array.from(period.options).map((o) => [o.value, o.text]))
    .toEqual([['', '정렬'], ['latest', '최신순'], ['oldest', '과거순']])
})

test('History: 담당자 옵션은 퍼블 하드코딩이 아니라 mock MANAGERS에서 온다', () => {
  const { container } = renderHistory()
  const owner = container.querySelector('#history_filter_owner')
  const texts = Array.from(owner.options).map((o) => o.text)
  expect(texts).toEqual(['담당자', '김연구', '이학예', '박학예', '최큐레이터', '정아키비스트', '한사서'])
  expect(texts).not.toContain('김자료')
})

test('History: 상태·버전 옵션도 mock에서 파생된다', () => {
  const { container } = renderHistory()
  const status = Array.from(container.querySelector('#history_filter_status').options).map((o) => o.text)
  expect(status).toEqual(['상태', '반영 완료', '반영 중', '반영 실패', '검수중'])
  const version = Array.from(container.querySelector('#history_filter_version').options).map((o) => o.text)
  expect(version).toEqual(['버전', 'v1.5', 'v1.4', 'v1.3', 'v1.2', 'v1.1', 'v1.0'])
  expect(version).not.toContain('v2.3.1')
})

test('History: 검색 제출은 페이지 리로드 없이 표를 거른다', () => {
  const { container } = renderHistory()
  fireEvent.change(container.querySelector('input[type=search]'), { target: { value: '유물메타' } })
  submitFilter(container)
  expect(screen.getByText('유물메타.json')).toBeInTheDocument()
  expect(screen.queryByText('메타정보_표준.xlsx')).not.toBeInTheDocument()
  expect(container.querySelector('.data_total').textContent).toBe('총 1건')
})

test('History: 표는 7열이고 5번째 헤더는 "상태"가 아니라 "처리상태"', () => {
  const { container } = renderHistory()
  const table = container.querySelector('table.data_table')
  expect(table.querySelectorAll('colgroup col')).toHaveLength(7)
  const labels = Array.from(table.querySelectorAll('thead th')).slice(1).map((th) => th.textContent.trim())
  expect(labels).toEqual(['처리 일시', '자료명', '레코드', '처리상태', '담당자', '버전'])
  expect(table.querySelectorAll('tbody tr')).toHaveLength(10)
})

test('History: 처리상태는 알약이 아니라 data_status_text 텍스트형', () => {
  const { container } = renderHistory()
  const cells = container.querySelectorAll('tbody tr td')
  expect(cells[4].querySelector('span').className).toBe('data_status_text ty_done')
})

test('History: 버전 열의 font-mono가 제거됐다', () => {
  const { container } = renderHistory()
  const cells = container.querySelectorAll('tbody tr td')
  expect(cells[6].textContent).toBe('v1.5')
  expect(cells[6].className).not.toContain('font-mono')
  expect(cells[6].innerHTML).not.toContain('font-mono')
})

test('History: 행별 휴지통이 사라지고 툴바 선택삭제로 통합됐다 — 클릭 시 준비중 토스트만(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 ConfirmDialog 확인 후 removeItem으로 행이 빠졌지만,
  // D2a가 삭제를 mutation으로 분류해 showToast 스텁으로 막았다.
  const { container } = renderHistory()
  expect(screen.queryByRole('button', { name: /^삭제 l/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('선택 l2'))
  fireEvent.click(within(container.querySelector('.data_toolbar_actions')).getByRole('button', { name: /선택삭제/ }))
  expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('유물메타.json')).toBeInTheDocument()
})

test('History: "엑셀 다운로드" 버튼이 제거됐다', () => {
  renderHistory()
  expect(screen.queryByText('엑셀 다운로드')).not.toBeInTheDocument()
})

test('History: "다음 단계로 보내기"는 준비중 — 선택 상태와 무관하게 행이 그대로 남고 토스트만 뜬다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 "반영 완료" 행만 실제 promote()로 등재되고
  // "반영 중" 행은 자격 안내만 떴지만, D2a가 등재를 mutation으로 분류해
  // 선택 내용과 무관하게 항상 같은 준비중 토스트로 막았다.
  const { container } = renderHistory()
  const promote = within(container.querySelector('.data_toolbar_actions'))
    .getByRole('button', { name: '다음 단계로 보내기' })
  expect(promote).toBeDisabled()

  // l2는 '반영 중'
  fireEvent.click(screen.getByLabelText('선택 l2'))
  fireEvent.click(promote)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('유물메타.json')).toBeInTheDocument()

  // l1은 '반영 완료'—그래도 mock 상태는 바뀌지 않는다
  fireEvent.click(screen.getByLabelText('선택 l1'))
  fireEvent.click(promote)
  expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('메타정보_표준.xlsx')).toBeInTheDocument()
})

test('History: 행 클릭은 준비중 — HistoryViewModal이 열리지 않고 토스트만 뜬다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 HistoryViewModal(퍼블과 무관한 Tailwind 레거시
  // 조회 팝업)이 열렸지만, D2a가 그 모달을 페이지에서 완전히 걷어냈다.
  const { container } = renderHistory()
  const firstRow = container.querySelector('tbody tr')
  fireEvent.click(firstRow)
  expect(screen.queryByRole('heading', { name: '학습 반영 상세' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

// ── A8(round06b) — /manage의 env 게이트가 셸에서 페이지 레벨(EnvGate)로 옮겨왔다.
// Log.test.jsx의 "prod 환경" 테스트와 같은 계약이다. 이 테스트가 사보타주(EnvGate
// 제거)를 잡는다 — History.jsx에서 <EnvGate> 래퍼를 걷어내면 '준비 중입니다'가
// 사라지고 data_panel이 그대로 보여 아래 단언이 깨진다.
test('prod 환경: ManageTabs 5탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다(A8)', () => {
  const { container } = render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <ManageProvider>
          <MemoryRouter initialEntries={['/manage/history']}><History /></MemoryRouter>
        </ManageProvider>
      </ToastProvider>
    </AuthContext.Provider>
  )
  for (const name of ['유물자료 OCR', '메타 정보 등록', '데이터 임베딩 관리', '학습 반영 이력', '자료관리']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(container.querySelector('.data_panel')).toBeNull()
})
