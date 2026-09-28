// 이 파일의 책임: 산출물 상세의 **2단 레이아웃과 쪽 찾기**(round11a task-10 ④)
// — 피그마 `988:6277`(2단 전체) · spec §2.1·§2.4·§2.5.
//
// 기존 `OutputDetailPage.test.jsx` 는 1단 골격(돌아가기·타이틀·선택자료·다운로드)을
// 잠근다. 여기서 잠그는 것은 그 화면이 **둘로 갈리는 조건**이다:
//   ① 진입 시 우측 뷰어는 **없다**(디스크립션 ④ 「진입시 기본 펼침 x」)
//   ② 유물명을 누르면 펼쳐지고, 그 유물 `subject_era` 로 `locate` 한 쪽을 연다
//   ③ `found:false` 면 뷰어는 **뜨되** `reason` 안내만 그린다(빈 화면이 아니다)
//   ④ 다른 유물명을 누르면 대상이 그 유물로 바뀐다(spec §2.4)
//   ⑤ 접는 버튼은 **만들지 않는다**(피그마에 없다)
//   ⑥ 공유 열람(`?project=`)에서는 우측 뷰어를 아예 띄우지 않는다
import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../../components/Toast.jsx'

vi.mock('../../lib/outputsApi.js', () => ({
  isLive: () => true,
  getOutput: vi.fn(),
  getOutputDoc: vi.fn(),
  getOutputTimeline: vi.fn(),
  downloadOutputFile: vi.fn(),
  markOutputOpened: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('../../lib/projectsApi.js', () => ({
  getProjectOutput: vi.fn(),
  downloadProjectOutput: vi.fn(),
  getProjectOutputDoc: vi.fn(),
}))
vi.mock('../../lib/chronologyApi.js', () => ({
  locateEra: vi.fn(),
  getVolumePages: vi.fn(),
  getPageEvents: vi.fn(),
  pageImageUrl: (vol, page) => `/api/chronology/pages/${vol}/${page}/image`,
}))
vi.mock('../../lib/downloadFile.js', () => ({ triggerBrowserDownload: vi.fn() }))
vi.mock('../../lib/searchApi.js', () => ({
  isLive: () => false,
  fetchArtifactDetail: vi.fn().mockResolvedValue({ ok: false }),
}))
vi.mock('../../lib/artifactKeysApi.js', () => ({
  fetchDisplayKeys: vi.fn().mockResolvedValue({ ok: true, keys: {} }),
}))
vi.mock('../../context/ScenarioContext.jsx', () => ({
  useScenario: () => ({ bumpOutputsVersion: vi.fn() }),
}))

const { getOutput, getOutputDoc, getOutputTimeline } = await import('../../lib/outputsApi.js')
const { getProjectOutput, getProjectOutputDoc } = await import('../../lib/projectsApi.js')
const { locateEra, getVolumePages, getPageEvents } = await import('../../lib/chronologyApi.js')
const { default: OutputDetailPage } = await import('./OutputDetailPage.jsx')

const OUTPUT = {
  id: 'o1', kind: 'caption', title: '민주화운동 설명문',
  file_name: '민주화운동 설명문.docx', file_bytes: 25000,
  selection: [{ node: '민주화운동', idnbrs: ['PS-1', 'PS-2'] }],
  opened_at: null, created_at: '2026-09-02T10:00:00Z',
}

const DOC = { kind: 'caption', title: '민주화운동 설명문', subtitle: '', body: '본문', items: [] }

const item = (over) => ({
  index: 0, idnbr: 'PS-1', matched_by: 'exact', name: '삼선개헌 반대 자료',
  subject_era: '1969.12.27.', year_label: '1969년', headline: '삼선개헌 반대 자료',
  source: 's', background: '', event: '', attached: [], ...over,
})

const VIEW = {
  version: 1, edited: false,
  decades: [{
    decade: '1960', title: '1960년대',
    years: [{
      year_label: '1969년', subtitle: '',
      items: [item({}), item({ index: 1, idnbr: 'PS-2', name: '유신헌법 자료', subject_era: '1972.' })],
    }],
  }],
}

beforeEach(() => {
  vi.clearAllMocks()
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  getOutputDoc.mockResolvedValue({ ok: true, data: DOC })
  getOutputTimeline.mockResolvedValue({ ok: true, data: VIEW })
  getProjectOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: DOC })
  locateEra.mockResolvedValue({
    ok: true,
    data: { found: true, vol: 1, page: 41, year: 1969, month: 12, day: 27, matched: 'day' },
  })
  getVolumePages.mockResolvedValue({ ok: true, data: { pages: [12, 41, 57] } })
  getPageEvents.mockResolvedValue({ ok: true, data: { events: [] } })
})

function renderAt(search = '') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/search/output/o1${search}`]}>
        <Routes>
          <Route path="/search/output/:outputId" element={<OutputDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

test('진입 시 우측 뷰어는 없다 — 좌측이 자리를 다 쓴다', async () => {
  renderAt()
  await screen.findByText('삼선개헌 반대 자료')
  expect(screen.queryByText('대한민국사 원문 뷰어')).toBeNull()
  expect(locateEra).not.toHaveBeenCalled()
})

test('유물명을 누르면 우측 뷰어가 생기고 그 유물의 subject_era 로 쪽을 찾는다', async () => {
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))

  await waitFor(() => expect(locateEra).toHaveBeenCalledWith('1969.12.27.'))
  expect(await screen.findByText('대한민국사 원문 뷰어')).toBeInTheDocument()
  // found:true 면 그 쪽을 실제로 연다.
  await waitFor(() => expect(getPageEvents).toHaveBeenCalledWith(1, 41))
})

// ⚠️ 아래 세 시험의 `reason` 은 **서버가 실제로 내는 값**이다 — `out_of_range` ·
// `unparsable` **둘뿐**이고(domain/models.NotLocated 도크스트링 · chronology/rules.py),
// 사람이 읽을 한국어 문장이 아니다. 예전 픽스처는 「연표가 다루지 않는 시대입니다」
// 같은 한국어를 넣어 두어, 화면이 그 값을 **그대로 찍는 결함을 덮고 있었다**
// (실제 화면에는 `unparsable` 이라는 영어 코드가 떴다). 이런 픽스처를 다시 만들지 마라.
test('found:false(out_of_range) 면 뷰어는 뜨고 사람 문구가 보인다 — 코드를 그대로 찍지 않는다', async () => {
  locateEra.mockResolvedValue({ ok: true, data: { found: false, reason: 'out_of_range' } })
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))

  expect(await screen.findByText('대한민국사 원문 뷰어')).toBeInTheDocument()
  expect(await screen.findByText('연표(1948~2008)가 다루지 않는 시대입니다')).toBeInTheDocument()
  expect(screen.queryByText(/out_of_range/)).toBeNull()
  // 쪽을 그리지 않는다 — 안내만 띄운다(spec §2.5 표 마지막 두 행).
  expect(getPageEvents).not.toHaveBeenCalled()
})

test('found:false(unparsable) 도 사람 문구로 바뀐다', async () => {
  locateEra.mockResolvedValue({ ok: true, data: { found: false, reason: 'unparsable' } })
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))

  expect(await screen.findByText('시대 표기에서 연도를 읽지 못했습니다')).toBeInTheDocument()
  expect(screen.queryByText(/unparsable/)).toBeNull()
})

test('서버가 새 코드를 늘려도 기계 코드가 화면에 뜨지 않는다 — 기본 문구로 떨어진다', async () => {
  // 지금 서버에 없는 코드다. 맵에 없는 값이 오면 **코드를 그대로 찍지 말고**
  // 기본 문구로 떨어져야 한다 — 화면은 서버의 열거형을 사람 말로 옮기는 자리다.
  locateEra.mockResolvedValue({ ok: true, data: { found: false, reason: 'some_new_code' } })
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))

  expect(await screen.findByText('연표에서 쪽을 찾지 못했습니다')).toBeInTheDocument()
  expect(screen.queryByText(/some_new_code/)).toBeNull()
})

test('조회 자체가 실패해도 뷰어는 뜨고 사유가 보인다', async () => {
  locateEra.mockResolvedValue({ ok: false, notice: '서버에 연결하지 못했습니다' })
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))
  expect(await screen.findByText('서버에 연결하지 못했습니다')).toBeInTheDocument()
})

test('다른 유물명을 누르면 대상이 그 유물로 바뀐다', async () => {
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))
  await waitFor(() => expect(locateEra).toHaveBeenCalledWith('1969.12.27.'))
  expect(screen.getByRole('button', { name: '삼선개헌 반대 자료' }))
    .toHaveAttribute('aria-current', 'true')

  fireEvent.click(screen.getByRole('button', { name: '유신헌법 자료' }))

  await waitFor(() => expect(locateEra).toHaveBeenCalledWith('1972.'))
  expect(screen.getByRole('button', { name: '유신헌법 자료' }))
    .toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: '삼선개헌 반대 자료' }))
    .not.toHaveAttribute('aria-current')
})

test('접는 버튼은 만들지 않는다 — 한 번 펼쳐지면 그대로 둔다', async () => {
  renderAt()
  fireEvent.click(await screen.findByRole('button', { name: '삼선개헌 반대 자료' }))
  await screen.findByText('대한민국사 원문 뷰어')
  expect(screen.queryByRole('button', { name: /접기|닫기/ })).toBeNull()
})

test('공유 열람(?project=)에서는 우측 뷰어를 아예 띄우지 않는다', async () => {
  renderAt('?project=p1')
  await screen.findByText('민주화운동 2건')
  // 공유 열람에서도 타임라인은 **새 3층**으로 그려지지만(doc 으로 만든다 —
  // 재리뷰 MEDIUM-3), 유물명은 클릭 대상이 아니다: 이 페이지가 `onArtifactPick`
  // 에 null 을 준다. 서버에 프로젝트 경유 연표 짝이 없어 열 쪽을 정할 수 없다.
  // 그래서 소유자 전용 `/timeline` 도 부르지 않는다.
  expect(getOutputTimeline).not.toHaveBeenCalled()
  expect(screen.queryByText('대한민국사 원문 뷰어')).toBeNull()
})
