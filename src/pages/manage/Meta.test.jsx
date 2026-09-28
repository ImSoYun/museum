import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Meta from './Meta.jsx'
import { ManageProvider } from '../../state/ManageProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'

function renderMeta() {
  return render(
    <ToastProvider>
      <ManageProvider>
        <MemoryRouter><Meta /></MemoryRouter>
      </ManageProvider>
    </ToastProvider>
  )
}

test('Meta: template_bar 오탈자 교정("데이터 템플릿")과 링크가 아닌 button 3개', () => {
  const { container } = renderMeta()
  const bar = container.querySelector('.template_bar')
  expect(within(bar).getByText('데이터 템플릿')).toBeInTheDocument()
  // D2a: 제목 클래스는 v2가 폐기한 template_bar_tit 대신 공용 section_tit다.
  expect(bar.querySelector('.section_tit').textContent).toBe('데이터 템플릿')
  expect(within(bar).getByText('표준 형식에 맞는 템플릿을 사용하세요')).toBeInTheDocument()
  // 실 템플릿 파일이 미납품이라 href 없는 a 대신 button으로 둔다(spec §8.3-4)
  expect(bar.querySelectorAll('a')).toHaveLength(0)
  const links = bar.querySelectorAll('button.template_bar_link')
  expect(Array.from(links).map((b) => b.textContent.trim())).toEqual(['엑셀 템플릿', 'JSON 템플릿', 'XML 템플릿'])
})

test('Meta: 템플릿 다운로드는 준비중 — 정확한 문구로 토스트가 뜬다(D2a)', () => {
  // 검증 대상이 바뀌었다 — 이전에는 "${fmt} 템플릿을 내려받았습니다"처럼 포맷별
  // 커스텀 문구였지만, D2a가 실 파일이 없는 다운로드를 canonical 문구로 통일한다.
  const { container } = renderMeta()
  const links = container.querySelectorAll('.template_bar button.template_bar_link')
  fireEvent.click(links[0])
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('Meta: 드롭존은 OCR과 같은 컴포넌트이고 accept는 메타 파일로 교정됐다', () => {
  const { container } = renderMeta()
  expect(container.querySelector('label.upload_dropzone#meta_dropzone')).not.toBeNull()
  const input = container.querySelector('#meta_dropzone_input')
  // 퍼블 manage_meta.html:114의 accept=".pdf,.jpg,.jpeg"는 OCR에서 복사해 온 오류다.
  expect(input.accept).toBe('.xlsx,.xls,.json,.xml')
  expect(container.querySelector('.upload_dropzone_desc').textContent)
    .toBe('xlsx, xls, json, xml 메타 파일 업로드')
  expect(container.querySelector('.upload_dropzone_btn').tagName).toBe('SPAN')
})

test('Meta: 표는 6열이고 매핑은 텍스트형, 다운로드 열 라벨이 교정됐다', () => {
  const { container } = renderMeta()
  const table = container.querySelector('table.data_table')
  expect(table.querySelectorAll('colgroup col')).toHaveLength(6)
  const labels = Array.from(table.querySelectorAll('thead th')).slice(1).map((th) => th.textContent.trim())
  expect(labels).toEqual(['파일명', '업로드 일시', '레코드', '매핑', '다운로드'])

  const cells = table.querySelectorAll('tbody tr td')
  expect(cells[3].textContent).toBe('320건')
  expect(cells[4].querySelector('span').className).toBe('data_status_text ty_done')
  expect(within(cells[5]).getByRole('button', { name: '다운로드' })).toBeInTheDocument()
  expect(table.querySelectorAll('tbody tr')).toHaveLength(10)
})

test('Meta: 다운로드 버튼은 준비중 토스트만 띄운다(D2a concern #4)', () => {
  const { container } = renderMeta()
  const table = container.querySelector('table.data_table')
  const dlBtn = within(table.querySelector('tbody tr')).getByRole('button', { name: '다운로드' })
  fireEvent.click(dlBtn)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('Meta: 행 클릭은 준비중 — 편집 모달이 열리지 않고 토스트만 뜬다(D2a)', () => {
  // 검증 대상이 사라졌다 — 이전에는 MetaEditModal(퍼블과 무관한 Tailwind 레거시 팝업)이
  // 열려 실제 updateMeta를 호출했지만, D2a가 그 모달을 완전히 걷어내고 토스트로 막았다.
  renderMeta()
  fireEvent.click(screen.getByText('메타정보_표준.xlsx'))
  expect(screen.queryByRole('heading', { name: '메타 정보 편집' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('Meta: 툴바 승급/선택삭제는 0건이면 비활성이고, 선택 후 클릭해도 준비중 토스트만 뜬다(D2a)', () => {
  const { container } = renderMeta()
  expect(container.querySelector('.data_total').textContent).toBe('총 18건')
  const actions = container.querySelector('.data_toolbar_actions')
  expect(within(actions).getByRole('button', { name: '다음 단계로 보내기' })).toBeDisabled()
  expect(within(actions).getByRole('button', { name: /선택삭제/ })).toBeDisabled()

  fireEvent.click(screen.getByLabelText('선택 f1'))
  fireEvent.click(within(actions).getByRole('button', { name: '다음 단계로 보내기' }))
  expect(screen.getByText('메타정보_표준.xlsx')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')

  fireEvent.click(within(actions).getByRole('button', { name: /선택삭제/ }))
  expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('준비 중입니다')
  expect(screen.getByText('메타정보_표준.xlsx')).toBeInTheDocument()
})

// ── A8(round06b) — /manage의 env 게이트가 셸에서 페이지 레벨(EnvGate)로 옮겨왔다.
// Log.test.jsx의 "prod 환경" 테스트와 같은 계약이다. 이 테스트가 사보타주(EnvGate
// 제거)를 잡는다 — Meta.jsx에서 <EnvGate> 래퍼를 걷어내면 '준비 중입니다'가 사라지고
// data_panel이 그대로 보여 아래 단언이 깨진다.
test('prod 환경: ManageTabs 5탭은 그대로 보이고 data_panel 본문만 준비중으로 바뀐다(A8)', () => {
  const { container } = render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <ManageProvider>
          <MemoryRouter initialEntries={['/manage/meta']}><Meta /></MemoryRouter>
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
