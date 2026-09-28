import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Materials from './Materials.jsx'
import { ManageProvider } from '../../state/ManageProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'

function renderMaterials() {
  return render(
    <ToastProvider>
      <ManageProvider>
        <MemoryRouter initialEntries={['/manage/materials']}>
          <Routes>
            <Route path="/manage/materials" element={<Materials />} />
          </Routes>
        </MemoryRouter>
      </ManageProvider>
    </ToastProvider>
  )
}

function search(container, keyword) {
  fireEvent.change(container.querySelector('input[type=search]'), { target: { value: keyword } })
  fireEvent.click(within(container.querySelector('.data_filter_bar')).getByRole('button', { name: '검색' }))
}

test('Materials: data_panel_head 문구는 퍼블 원문을 따른다', () => {
  const { container } = renderMaterials()
  const head = container.querySelector('.data_panel_head')
  expect(within(head).getByText('자료관리')).toBeInTheDocument()
  expect(within(head).getByText('전체 자료를 검색/수정/삭제 관리합니다.')).toBeInTheDocument()
  expect(container.querySelector('.data_total').textContent).toBe('총 30건')
})

test('Materials: 필터 select는 3개가 아니라 2개이고 "검색 항목"이 제거됐다', () => {
  const { container } = renderMaterials()
  const bar = container.querySelector('form.data_filter_bar')
  expect(bar.querySelectorAll('.select_box > select')).toHaveLength(2)
  expect(container.querySelector('#mng_filter_period')).not.toBeNull()
  expect(container.querySelector('#mng_filter_owner')).not.toBeNull()
  expect(screen.queryByText(/검색 항목/)).not.toBeInTheDocument()
  // '기간'은 옵션이 정렬 방향이므로 라벨을 '정렬'로 교정한다
  expect(Array.from(container.querySelector('#mng_filter_period').options).map((o) => [o.value, o.text]))
    .toEqual([['', '정렬'], ['latest', '최신순'], ['oldest', '과거순']])
})

test('Materials: 체크박스 열이 추가된 6열이고 레코드는 평문 표기', () => {
  const { container } = renderMaterials()
  const table = container.querySelector('table.data_table')
  expect(table.querySelectorAll('colgroup col')).toHaveLength(6)
  const labels = Array.from(table.querySelectorAll('thead th')).slice(1).map((th) => th.textContent.trim())
  expect(labels).toEqual(['처리 일시', '자료명', '레코드', '담당자', '작업'])
  expect(screen.getByLabelText('전체선택')).toBeInTheDocument()

  const cells = table.querySelectorAll('tbody tr td')
  expect(cells[3].textContent).toBe('24건')
  expect(cells[3].innerHTML).not.toContain('rounded-full')
  expect(table.querySelectorAll('tbody tr')).toHaveLength(10)
})

test('Materials: 작업 열은 상세보기 / 수정하기 텍스트 버튼 2개', () => {
  const { container } = renderMaterials()
  const actions = container.querySelector('tbody tr .data_col_actions')
  const buttons = actions.querySelectorAll('button')
  expect(Array.from(buttons).map((b) => b.textContent)).toEqual(['상세보기', '수정하기'])
  expect(buttons[0].className).toBe('btn btn_sm btn_outline')
  expect(buttons[1].className).toBe('btn btn_sm btn_outline_primary')
  // 아이콘 2개짜리 옛 '작업' 열은 사라졌다
  expect(screen.queryByLabelText('수정')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('삭제')).not.toBeInTheDocument()
})

test('Materials: 상세보기·수정하기는 모두 준비중 — mock 상태를 바꾸지 않고 토스트만 띄운다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 상세보기(읽기전용)·수정하기(편집모드)가
  // ManageDetailModal을 서로 다른 모드로 열었지만, D2a가 그 모달(퍼블과 무관한
  // Tailwind 레거시 팝업)을 완전히 걷어내고 두 버튼 모두 준비중 토스트로 막았다.
  renderMaterials()
  fireEvent.click(screen.getAllByRole('button', { name: '상세보기' })[0])
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.queryByText('데이터 정보')).not.toBeInTheDocument()

  fireEvent.click(screen.getAllByRole('button', { name: '수정하기' })[0])
  expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('준비 중입니다')
  expect(screen.queryByLabelText('명칭')).not.toBeInTheDocument()
})

test('Materials: 검색 제출 시 일치하는 행만 남는다', () => {
  const { container } = renderMaterials()
  search(container, '경제개발')
  expect(screen.getByText('경제개발 5개년 계획서')).toBeInTheDocument()
  expect(screen.queryByText('민주화운동 기록사진 #1')).not.toBeInTheDocument()
})

test('Materials: 검색 결과 0건이면 EmptyState를 유지한다', () => {
  const { container } = renderMaterials()
  search(container, '존재하지않는자료명')
  expect(screen.getByText('일치하는 자료가 없습니다')).toBeInTheDocument()
  expect(container.querySelector('table.data_table')).toBeNull()
})

test('Materials: 담당자 필터가 mock MANAGERS에서 파생된다', () => {
  const { container } = renderMaterials()
  const owner = container.querySelector('#mng_filter_owner')
  const texts = Array.from(owner.options).map((o) => o.text)
  expect(texts).toEqual(['담당자', '김연구', '이학예', '박학예', '최큐레이터', '정아키비스트', '한사서'])
  expect(texts).not.toContain('김자료')
})

test('Materials: 선택삭제는 준비중 — 확인창 없이 토스트만 뜨고 행은 그대로 남는다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 ConfirmDialog 확인 후 removeItem으로 행이
  // 빠졌지만, D2a가 삭제를 mutation으로 분류해 showToast 스텁으로 막았다.
  const { container } = renderMaterials()
  expect(screen.queryByText('엑셀 다운로드')).not.toBeInTheDocument()
  const del = within(container.querySelector('.data_toolbar_actions')).getByRole('button', { name: /선택삭제/ })
  expect(del).toBeDisabled()

  fireEvent.click(screen.getByLabelText('선택 d1'))
  expect(del).toBeEnabled()
  fireEvent.click(del)
  expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('민주화운동 기록사진 #1')).toBeInTheDocument()
})

test('Materials: 검색·담당자 필터는 준비중이 아니라 계속 실동작한다(주의: 실동작 보존)', () => {
  const { container } = renderMaterials()
  search(container, '경제개발')
  // 필터 제출은 mock 상태를 바꾸는 mutation이 아니라 조회다 — 토스트 없이 그대로 거른다.
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('경제개발 5개년 계획서')).toBeInTheDocument()
})

// ── A8(round06b) — /manage의 env 게이트가 셸에서 페이지 레벨(EnvGate)로 옮겨왔다.
// Log.test.jsx의 "prod 환경" 테스트와 같은 계약이다. 이 테스트가 사보타주(EnvGate
// 제거)를 잡는다 — Materials.jsx에서 <EnvGate> 래퍼를 걷어내면 '준비 중입니다'가
// 사라지고 data_panel이 그대로 보여 아래 단언이 깨진다.
test('prod 환경: ManageTabs 5탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다(A8)', () => {
  const { container } = render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <ManageProvider>
          <MemoryRouter initialEntries={['/manage/materials']}>
            <Routes>
              <Route path="/manage/materials" element={<Materials />} />
            </Routes>
          </MemoryRouter>
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
