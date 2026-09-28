import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Ocr from './Ocr.jsx'
import { ManageProvider } from '../../state/ManageProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'

function renderOcr() {
  return render(
    <ToastProvider>
      <ManageProvider>
        <MemoryRouter><Ocr /></MemoryRouter>
      </ManageProvider>
    </ToastProvider>
  )
}

test('Ocr: 퍼블 골격(page_tabs + data_panel_body)과 페이지 제목', () => {
  const { container } = renderOcr()
  expect(screen.getByRole('heading', { name: '자료관리' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '유물자료 OCR' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '자료관리' })).toBeInTheDocument()
  expect(container.querySelector('.data_panel > .data_panel_body')).not.toBeNull()
  // ocr 화면은 퍼블에 data_panel_head가 없다
  expect(container.querySelector('.data_panel_head')).toBeNull()
})

test('Ocr: 드롭존은 label이고 "파일선택"은 aria-hidden span이다', () => {
  const { container } = renderOcr()
  const zone = container.querySelector('label.upload_dropzone#ocr_dropzone')
  expect(zone).not.toBeNull()
  const input = container.querySelector('#ocr_dropzone_input')
  expect(input.accept).toBe('.pdf,.jpg,.jpeg')
  expect(container.querySelector('.upload_dropzone_btn').tagName).toBe('SPAN')
  expect(screen.queryByRole('button', { name: /파일\s?선택/ })).not.toBeInTheDocument()
})

test('Ocr: 표는 7열이고 헤더 라벨이 퍼블과 같으며 PAGE_SIZE=10행', () => {
  const { container } = renderOcr()
  const table = container.querySelector('table.data_table')
  expect(table.querySelector('caption').className).toContain('sr_only')
  expect(table.querySelectorAll('colgroup col')).toHaveLength(7)
  const labels = Array.from(table.querySelectorAll('thead th')).slice(1).map((th) => th.textContent.trim())
  expect(labels).toEqual(['파일명', '업로드 일시', 'OCR 상태', '추출 텍스트 미리보기', '번역', '다운로드'])
  expect(table.querySelectorAll('tbody tr')).toHaveLength(10)
})

test('Ocr: OCR 상태는 알약형, 번역은 텍스트형으로 표기된다', () => {
  const { container } = renderOcr()
  const firstRow = container.querySelector('tbody tr')
  expect(within(firstRow).getAllByText('완료')[0].className).toBe('status_tag ty_done')
  const cells = firstRow.querySelectorAll('td')
  // 0=체크 1=파일명 2=일시 3=OCR상태 4=미리보기 5=번역 6=다운로드
  expect(cells[5].querySelector('span').className).toBe('data_status_text ty_done')
  expect(within(cells[6]).getByRole('button', { name: '다운로드' }).className).toContain('data_table_dl_btn')
})

test('Ocr: 다운로드 버튼은 준비중 — 클릭 시 토스트만 뜨고 아무 파일도 받지 않는다(D2a concern #4)', () => {
  const { container } = renderOcr()
  const firstRow = container.querySelector('tbody tr')
  fireEvent.click(within(firstRow).getByRole('button', { name: '다운로드' }))
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('Ocr: "OCR 재시도" 버튼은 제거됐다', () => {
  renderOcr()
  expect(screen.queryByRole('button', { name: 'OCR 재시도' })).not.toBeInTheDocument()
})

test('Ocr: 툴바에 총 건수 + 다음 단계로 보내기 + 선택삭제가 있고 선택 0건이면 둘 다 비활성', () => {
  const { container } = renderOcr()
  expect(container.querySelector('.data_total').textContent).toBe('총 23건')
  const actions = container.querySelector('.data_toolbar_actions')
  expect(within(actions).getByRole('button', { name: '다음 단계로 보내기' })).toBeDisabled()
  expect(within(actions).getByRole('button', { name: /선택삭제/ })).toBeDisabled()
})

test('Ocr: "다음 단계로 보내기"는 준비중 — 선택 행이 그대로 남고 토스트만 뜬다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 promote()가 실제로 행을 메타 단계로 옮겼지만
  // D2a가 승급을 mutation으로 분류해 showToast 스텁으로 막았다.
  renderOcr()
  fireEvent.click(screen.getByLabelText('선택 o1'))
  fireEvent.click(screen.getByRole('button', { name: '다음 단계로 보내기' }))
  expect(screen.getByText('유물대장_001.pdf')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('Ocr: 파일 선택은 준비중 — 표에 행이 추가되지 않고 토스트만 뜬다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 addUpload()가 "처리 대기" 행을 앞에 추가했지만
  // D2a가 업로드를 mutation으로 분류해 showToast 스텁으로 막았다. 드롭존 자체가
  // 고른 파일명을 표시하는 것은 FileDropzone 내부 표시 상태(has_file)일 뿐이라
  // 그대로 남는다 — 여기서 확인하는 것은 "표(mock 상태)에 행이 추가되지 않는다"이다.
  const { container } = renderOcr()
  const rowsBefore = container.querySelectorAll('tbody tr').length
  const input = container.querySelector('#ocr_dropzone_input')
  fireEvent.change(input, {
    target: { files: [new File(['x'], '신규스캔.pdf', { type: 'application/pdf' })] },
  })
  expect(container.querySelectorAll('tbody tr')).toHaveLength(rowsBefore)
  expect(screen.queryByText('처리 대기')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

// ── A8(round06b) — /manage의 env 게이트가 셸에서 페이지 레벨(EnvGate)로 옮겨왔다.
// Log.test.jsx의 "prod 환경" 테스트와 같은 계약이다: ManageTabs는 그대로 보이고
// data_panel 본문만 준비중으로 바뀐다. 이 테스트가 사보타주(EnvGate 제거)를 잡는다 —
// Ocr.jsx에서 <EnvGate> 래퍼를 걷어내면 '준비 중입니다'가 사라지고 data_panel이
// 그대로 보여 아래 단언이 깨진다.
test('prod 환경: ManageTabs 5탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다(A8)', () => {
  const { container } = render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <ManageProvider>
          <MemoryRouter initialEntries={['/manage/ocr']}><Ocr /></MemoryRouter>
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
