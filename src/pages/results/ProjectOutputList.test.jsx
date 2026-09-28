// 이 파일의 책임: ProjectOutputList(round10 Task7) 검증 — 프로젝트 상세의 산출물생성
// 탭이 그리는 저장 당시 산출물 스냅샷 목록. OutputList.jsx와 달리 선택·삭제가 없고,
// 다운로드는 소유자 무관 경로(projectsApi.downloadProjectOutput)를 쓴다.
//
// round10b Task D — variant='chat'(대화 탭 전용 모양)을 더한다. 사용자 지적("산출물
// 생성 페이지랑 ai학예 페이지가 공유되면 안돼")의 본뜻은 데이터 분리가 아니라 모양이었다
// (2026-09-17 사용자 정정 — source 컬럼 신설은 폐기, 두 탭이 같은 산출물을 보는 것은
// 맞는 동작이다). `heading` prop(제목만 붙이고 모양은 그대로 큰 그리드)은 그 지적을
// 못 풀어 걷어냈다 — 아래 옛 헤딩 시험은 variant='chat' 시험으로 바뀌었다.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '../../components/Toast.jsx'

const listProjectOutputs = vi.fn()
const downloadProjectOutput = vi.fn()
vi.mock('../../lib/projectsApi.js', () => ({
  listProjectOutputs: (...a) => listProjectOutputs(...a),
  downloadProjectOutput: (...a) => downloadProjectOutput(...a),
}))

const triggerBrowserDownload = vi.fn()
vi.mock('../../lib/downloadFile.js', () => ({
  triggerBrowserDownload: (...a) => triggerBrowserDownload(...a),
}))

const { default: ProjectOutputList } = await import('./ProjectOutputList.jsx')

// projects/routes.py 의 `_snapshot_summary` 가 실어 주는 그대로.
// round10 재리뷰 — 이 픽스처는 두 번 고쳐졌다. ① 최종리뷰 I-3 이 `summary`(카드
// 본문)를 실어 주게 했고 ② 재리뷰가 `query`·`conversation_id` 를 다시 덜어 냈다
// (그 경로는 암호를 묻지 않으므로 — spec §7). `opened_at` 은 실려 오지만 이 목록은
// 언제나 readOnly 라 「신규」 판정이 꺼진다(아래 전용 테스트).
const OUT = (over = {}) => ({
  id: 'o1', kind: 'exhibit', title: '1987년 6월 민주항쟁',
  summary: '6월항쟁 자료 12건을 정리했습니다',
  file_name: '1987년 6월 민주항쟁.xlsx', file_bytes: 335872,
  opened_at: null, created_at: '2026-05-12T11:43:00Z', ...over,
})

function renderList(projectId = 'p1', props = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ProjectOutputList projectId={projectId} {...props} />
      </MemoryRouter>
    </ToastProvider>,
  )
}

// round10 Task7 사후조치 — 「상세보기」가 실제로 어디로 가는지 착지 URL을 잠근다
// (OutputList.test.jsx의 LandingProbe와 같은 근거 — MemoryRouter만 씌우면 useNavigate()가
// 던지지 않게 할 뿐, 목적지의 `?project=` 유실은 아무 테스트도 잡지 못한다).
function LandingProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="landing">{pathname + search}</div>
}

function renderRouted(projectId = 'p1') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/library/p1']}>
        <Routes>
          <Route path="/library/:id" element={<ProjectOutputList projectId={projectId} />} />
          <Route path="/search/output/:outputId" element={<LandingProbe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  listProjectOutputs.mockReset()
  downloadProjectOutput.mockReset()
  triggerBrowserDownload.mockReset()
})

test('스냅샷 산출물을 카드로 그린다(제목·형식·크기)', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  renderList()
  expect(await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)).toBeInTheDocument()
  expect(listProjectOutputs).toHaveBeenCalledWith('p1')
})

// round10 재리뷰 — 목록 응답에서 query·conversation_id 를 덜어 내면서 summary 까지
// 함께 날아가면 카드 본문이 다시 빈칸이 된다(최종리뷰 I-3 의 재발). 서버 테스트
// (test_스냅샷_목록에_저장_질의와_대화_id_가_없다)의 화면 쪽 짝이다.
test('카드 본문(summary)이 실제로 찬다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  const { container } = renderList()
  await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)
  expect(container.querySelector('.output_card_body'))
    .toHaveTextContent('6월항쟁 자료 12건을 정리했습니다')
})

test('다운로드를 누르면 projectsApi.downloadProjectOutput 이 불린다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  const blob = new Blob(['x'])
  downloadProjectOutput.mockResolvedValue({
    ok: true, blob, filename: '1987년 6월 민주항쟁.xlsx',
  })
  renderList('p1')
  await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)

  fireEvent.click(screen.getByRole('button', { name: '1987년 6월 민주항쟁 다운로드' }))

  await waitFor(() =>
    expect(downloadProjectOutput).toHaveBeenCalledWith('p1', 'o1', '1987년 6월 민주항쟁.xlsx'))
  await waitFor(() =>
    expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, '1987년 6월 민주항쟁.xlsx'))
})

test('다운로드 실패는 서버 사유를 토스트로 보여준다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  downloadProjectOutput.mockResolvedValue({ ok: false, notice: '다운로드에 실패했습니다' })
  renderList('p1')
  await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)

  fireEvent.click(screen.getByRole('button', { name: '1987년 6월 민주항쟁 다운로드' }))

  expect(await screen.findByText('다운로드에 실패했습니다')).toBeInTheDocument()
  expect(triggerBrowserDownload).not.toHaveBeenCalled()
})

test('선택 체크박스와 삭제 버튼이 없다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  renderList()
  await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByRole('button', { name: /삭제/ })).toBeNull()
})

test('산출물이 0건이면 안내를 보여준다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [] })
  renderList()
  expect(await screen.findByText('이 프로젝트에 저장된 산출물이 없습니다.')).toBeInTheDocument()
})

// round10 — 스냅샷 목록에는 opened_at이 없다(⚠️ 절). OutputCard의 isNew 판정
// (`output.opened_at == null`)을 그대로 쓰면 undefined도 null과 같아 항상 "신규"
// (보라 테두리, is_new)로 잘못 뜬다 — 이 목록은 readOnly라 그 판정을 아예 끈다.
test('신규(보라 테두리) 표시가 없다 — 스냅샷 목록에는 그 개념이 없다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  const { container } = renderList()
  await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)
  expect(container.querySelector('.output_card.is_new')).toBeNull()
})

// round10 Task7 사후조치(spec §5-5 위반 수정) — 「상세보기」가 `?project=`를 실어
// 보내야 OutputDetailPage가 프로젝트 경유(소유 무관) API로 바꾼다. 이게 없으면
// 남의 프로젝트에서 상세보기를 누른 사람이 소유자 전용 GET /outputs/{id}에서 403을
// 만난다(리뷰가 지적한 실제 버그) — 그 회귀를 여기서 잠근다.
test('상세보기를 누르면 ?project= 를 실어 상세 라우트로 이동한다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  renderRouted('p1')
  await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)

  fireEvent.click(screen.getByRole('button', { name: /상세보기/ }))

  expect(await screen.findByTestId('landing')).toHaveTextContent('/search/output/o1?project=p1')
})

// ── round10b Task D — variant='chat'(대화 탭) 완료 카드 모양 ──────────────────
// 피그마 완료 턴 구조(figma-695-100384.txt:175-195, ExcelDownloadCard가 정본):
//   반짝이+「요청하신 산출물 생성이 완료되었습니다.」
//     └ file-text 아이콘 + 설명(summary)
//        └ 파일명(확장자 제외) · 확장자 뱃지 · 다운로드 아이콘
// 제목(「이 프로젝트에 저장된 산출물」)은 없앤다 — 모양 자체가 맥락을 준다.
test('대화 탭 모양(variant=chat)은 완료 문구 · 설명 · 파일 카드를 그린다(피그마 695:100384)', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  renderList('p1', { variant: 'chat' })
  expect(await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')).toBeInTheDocument()
  expect(screen.getByText('6월항쟁 자료 12건을 정리했습니다')).toBeInTheDocument()
  expect(screen.getByText('1987년 6월 민주항쟁')).toBeInTheDocument()
  expect(screen.getByText('XLSX')).toBeInTheDocument()
  expect(screen.queryByText('이 프로젝트에 저장된 산출물')).toBeNull()
})

// 읽기 전용에서도 다운로드가 되어야 한다(spec) — 그리드 모양과 같은 프로젝트 경유
// 경로(downloadProjectOutput)를 쓴다. outputsApi.downloadOutputFile은 소유자 전용이라
// 남의 프로젝트 산출물을 403으로 못 받는다(이 파일 머리 브리프가 적어 둔 함정).
test('대화 탭 모양도 다운로드는 downloadProjectOutput(프로젝트 경유)을 쓴다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [OUT()] })
  const blob = new Blob(['x'])
  downloadProjectOutput.mockResolvedValue({ ok: true, blob, filename: '1987년 6월 민주항쟁.xlsx' })
  renderList('p1', { variant: 'chat' })
  await screen.findByText('요청하신 산출물 생성이 완료되었습니다.')

  fireEvent.click(screen.getByRole('button', { name: '1987년 6월 민주항쟁 다운로드' }))

  await waitFor(() =>
    expect(downloadProjectOutput).toHaveBeenCalledWith('p1', 'o1', '1987년 6월 민주항쟁.xlsx'))
  await waitFor(() =>
    expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, '1987년 6월 민주항쟁.xlsx'))
})

// 서버에 산출물↔턴 연결이 없어(ProjectDetail.jsx 주석) 여러 건을 한 묶음으로 그린다 —
// 완료 문구는 한 번만, 설명+파일 카드는 건수만큼 반복된다.
test('대화 탭 모양은 산출물이 여러 건이면 완료 문구는 한 번, 파일 카드는 건수만큼 그린다', async () => {
  listProjectOutputs.mockResolvedValue({
    ok: true,
    outputs: [
      OUT(),
      OUT({ id: 'o2', title: '4·13 호헌조치 발표문', file_name: '4·13 호헌조치 발표문.docx' }),
    ],
  })
  renderList('p1', { variant: 'chat' })
  await screen.findByText('4·13 호헌조치 발표문')
  expect(screen.getAllByText('요청하신 산출물 생성이 완료되었습니다.')).toHaveLength(1)
  expect(screen.getByRole('button', { name: '1987년 6월 민주항쟁 다운로드' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '4·13 호헌조치 발표문 다운로드' })).toBeInTheDocument()
})

// 완료 문구는 산출물이 실제로 있을 때만 뜬다 — 없는데 "완료되었습니다"라고 말하면
// 거짓말이 된다(로딩·조회실패·0건 세 구간 모두 확인).
test('대화 탭 모양도 불러오는 중에는 완료 문구 없이 안내만 보인다', async () => {
  listProjectOutputs.mockReturnValue(new Promise(() => {}))   // 영영 pending
  renderList('p1', { variant: 'chat' })
  expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
  expect(screen.queryByText('요청하신 산출물 생성이 완료되었습니다.')).toBeNull()
})

test('대화 탭 모양도 조회 실패를 침묵하지 않는다(화면과 토스트 양쪽)', async () => {
  listProjectOutputs.mockResolvedValue({ ok: false, notice: '산출물 목록을 불러오지 못했습니다' })
  const { container } = renderList('p1', { variant: 'chat' })
  // 같은 문구가 토스트에도 떠서 findByText 가 모호해진다 — 위 기존 시험과 같이
  // .output_list_empty 로 범위를 좁힌다.
  await waitFor(() =>
    expect(container.querySelector('.output_list_empty'))
      .toHaveTextContent('산출물 목록을 불러오지 못했습니다'))
  expect(await screen.findByRole('status')).toHaveTextContent('산출물 목록을 불러오지 못했습니다')
  expect(screen.queryByText('요청하신 산출물 생성이 완료되었습니다.')).toBeNull()
})

test('대화 탭 모양도 0건이면 안내만 보이고 완료 문구는 없다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [] })
  renderList('p1', { variant: 'chat' })
  expect(await screen.findByText('이 프로젝트에 저장된 산출물이 없습니다.')).toBeInTheDocument()
  expect(screen.queryByText('요청하신 산출물 생성이 완료되었습니다.')).toBeNull()
})

// 대조군 — 산출물생성 탭(variant 기본값 'grid')의 모양은 한 군데도 바뀌면 안 된다.
// 0건일 때 <p> 하나만 돌려주던 그대로여야 한다(section 으로 감싸지 않는다).
test('variant 기본값(grid)은 빈 상태를 section 으로 감싸지 않는다', async () => {
  listProjectOutputs.mockResolvedValue({ ok: true, outputs: [] })
  const { container } = renderList()
  await screen.findByText('이 프로젝트에 저장된 산출물이 없습니다.')
  expect(container.querySelector('.section_tit')).toBeNull()
  expect(container.querySelector('section.output_list')).toBeNull()
})

test('조회 실패는 화면과 토스트 양쪽에 사유를 알린다(침묵하지 않는다)', async () => {
  listProjectOutputs.mockResolvedValue({ ok: false, notice: '산출물 목록을 불러오지 못했습니다' })
  const { container } = renderList()
  // 화면(빈 상태 자리) — 토스트와 문구가 같아 getByText는 둘 다 잡아 모호해지므로
  // .output_list_empty로 범위를 좁힌다.
  await waitFor(() =>
    expect(container.querySelector('.output_list_empty')).toHaveTextContent('산출물 목록을 불러오지 못했습니다'))
  // 토스트(코딩표준 §6 — 침묵하지 않는다).
  expect(await screen.findByRole('status')).toHaveTextContent('산출물 목록을 불러오지 못했습니다')
})
