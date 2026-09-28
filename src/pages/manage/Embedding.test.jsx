import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Embedding from './Embedding.jsx'
import { ManageProvider } from '../../state/ManageProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'

function renderEmbedding() {
  return render(
    <ToastProvider>
      <ManageProvider>
        <MemoryRouter><Embedding /></MemoryRouter>
      </ManageProvider>
    </ToastProvider>
  )
}

test('Embedding: data_panel_head 문구는 퍼블을 따르고 통계 배너는 제거됐다', () => {
  const { container } = renderEmbedding()
  const head = container.querySelector('.data_panel_head')
  expect(within(head).getByText('데이터 임베딩 관리')).toBeInTheDocument()
  expect(within(head).getByText('미등록 자료를 업로드하고 AI 학습 데이터로 등록합니다.')).toBeInTheDocument()
  // 퍼블에 통계 배너가 없다 — 총계 자리는 툴바의 "총 N건"이 대신한다.
  expect(screen.queryByText('전체')).not.toBeInTheDocument()
  expect(container.querySelector('.data_total').textContent).toBe('총 25건')
})

test('Embedding: pill 필터가 select_box로 바뀌고 재시도 옵션이 빠졌으며 첫 옵션은 값이 빈 문자열', () => {
  const { container } = renderEmbedding()
  const select = container.querySelector('.data_toolbar .select_box select#embed_filter_status')
  const options = Array.from(select.options).map((o) => [o.value, o.text])
  expect(options).toEqual([['', '선택'], ['done', '임베딩 완료'], ['fail', '임베딩 실패']])
  expect(screen.queryByRole('button', { name: '임베딩 완료' })).not.toBeInTheDocument()

  // 실패만 남기고 걸러진다(mock 실패 4건: e2·e7·e11·e24)
  fireEvent.change(select, { target: { value: 'fail' } })
  const rows = container.querySelectorAll('tbody tr')
  expect(rows).toHaveLength(4)
  expect(within(rows[0]).getByText('실패').className).toBe('status_tag ty_fail')
})

test('Embedding: 체크박스 열이 추가된 6열이고 재시도·승급은 준비중 토스트만 띄운다(D2a)', () => {
  const { container } = renderEmbedding()
  const table = container.querySelector('table.data_table')
  expect(table.querySelectorAll('colgroup col')).toHaveLength(6)
  const labels = Array.from(table.querySelectorAll('thead th')).slice(1).map((th) => th.textContent.trim())
  expect(labels).toEqual(['파일명', '업로드 일시', '레코드', '임베딩', '작업'])

  // 완료 행의 작업 셀은 '—'가 아니라 빈 셀, 실패 행만 btn_sm btn_outline "재시도"
  const firstRow = table.querySelector('tbody tr')
  expect(firstRow.querySelectorAll('td')[5].textContent).toBe('')
  const retry = screen.getAllByRole('button', { name: '재시도' })[0]
  expect(retry.className).toBe('btn btn_sm btn_outline')

  // 이 화면에는 선택삭제가 없다(퍼블에 없고, 임베딩 단계의 조작은 재시도·승급이다)
  expect(screen.queryByRole('button', { name: /선택삭제/ })).not.toBeInTheDocument()

  // 재시도 — 검증 대상이 사라졌다(이전엔 '임베딩 재시도를 요청했습니다' 커스텀 문구).
  // D2a가 canonical 준비중 문구로 통일하고 mock 상태는 그대로 둔다.
  fireEvent.click(retry)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('유물메타.json')).toBeInTheDocument()

  // 승급 — 검증 대상이 사라졌다(이전엔 promote()가 실제로 행을 옮겼다).
  fireEvent.click(screen.getByLabelText('선택 e1'))
  fireEvent.click(screen.getByRole('button', { name: '다음 단계로 보내기' }))
  expect(screen.getByText('메타정보_표준.xlsx')).toBeInTheDocument()
  expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('준비 중입니다')
})

test('Embedding: 상태 필터는 준비중이 아니라 계속 실동작한다(주의: 실동작 보존)', () => {
  const { container } = renderEmbedding()
  const select = container.querySelector('.data_toolbar .select_box select#embed_filter_status')
  fireEvent.change(select, { target: { value: 'fail' } })
  // 필터는 mutation이 아닌 조회다 — 토스트 없이 그대로 거른다.
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
})

// ── A8(round06b) — /manage의 env 게이트가 셸에서 페이지 레벨(EnvGate)로 옮겨왔다.
// Log.test.jsx의 "prod 환경" 테스트와 같은 계약이다. 이 테스트가 사보타주(EnvGate
// 제거)를 잡는다 — Embedding.jsx에서 <EnvGate> 래퍼를 걷어내면 '준비 중입니다'가
// 사라지고 data_panel이 그대로 보여 아래 단언이 깨진다.
test('prod 환경: ManageTabs 5탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다(A8)', () => {
  const { container } = render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <ManageProvider>
          <MemoryRouter initialEntries={['/manage/embedding']}><Embedding /></MemoryRouter>
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
