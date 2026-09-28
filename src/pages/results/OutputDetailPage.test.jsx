// 이 파일의 책임: 산출물 상세 화면(round07f) — 디스크립션 749:6351 항목 1~5.
// 뷰어 내부(Task 6)는 이 테스트 범위 밖이다 — 여기서는 골격(돌아가기·타이틀·
// 선택자료·다운로드)과 「없는 산출물」·「불러오는 중」 상태만 잠근다.
import { describe, expect, it, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../../components/Toast.jsx'
// round07i 재리뷰 — 서버 kind 전수 가드(아래 describe)가 routes.py를 직접
// 읽어 도출하는 헬퍼. 두 화면 테스트(OutputList·OutputDetailPage)가 같은
// 목록을 쓰므로 한 곳에서만 정의한다.
import { getServerOutputKinds } from './serverOutputKinds.test.js'

vi.mock('../../lib/outputsApi.js', () => ({
  isLive: () => true,
  getOutput: vi.fn(),
  getOutputDoc: vi.fn(),
  // round11a task-10 — 자식 OutputViewer 가 설명문일 때 함께 부른다.
  getOutputTimeline: vi.fn(),
  downloadOutputFile: vi.fn(),
  markOutputOpened: vi.fn().mockResolvedValue({ ok: true }),
}))

// round10 Task7 사후조치 — `?project=`가 있을 때 쓰는 프로젝트 경유(소유 무관) 경로.
vi.mock('../../lib/projectsApi.js', () => ({
  getProjectOutput: vi.fn(),
  downloadProjectOutput: vi.fn(),
  // round10 재리뷰 — 자식 OutputViewer가 프로젝트 문맥에서 이것을 부른다(네 번째
  // 소유자 전용 호출을 닫은 자리). 이 화면은 OutputViewer를 목하지 않고 실제로
  // 그리므로, 여기 없으면 「목에 없는 export」로 터진다 — 즉 이 목록 자체가
  // 「프로젝트 문맥에서 어떤 API가 실제로 불리는가」의 목록이다.
  getProjectOutputDoc: vi.fn().mockResolvedValue({ ok: false, notice: '미리보기 없음' }),
}))

vi.mock('../../lib/downloadFile.js', () => ({
  triggerBrowserDownload: vi.fn(),
}))

// MaterialModal이 searchApi.js를 부른다 — 그 모듈도 목한다
// (ChatTab.live.test.jsx가 같은 이유로 하는 것과 같다).
vi.mock('../../lib/searchApi.js', () => ({
  isLive: () => false,
  fetchArtifactDetail: vi.fn().mockResolvedValue({ ok: false }),
}))

// round07h Task 7 — 노드 목록이 이름을 받아 오는 통로. 이 화면은 노드당 idnbrs
// 전체를 한 번에 fetchDisplayKeys로 조회하므로(자료마다 부르지 않는다), 실제
// 응답 모양({ ok, keys })만 흉내 내면 된다.
vi.mock('../../lib/artifactKeysApi.js', () => ({
  fetchDisplayKeys: vi.fn(),
}))

// 이 화면은 useScenario()에서 bumpOutputsVersion만 쓴다(뱃지 갱신 신호, 리뷰 Important).
// ScenarioProvider 전체를 마운트하는 대신 컨텍스트 자체를 목한다 — 이 화면이 쓰지 않는
// 그래프·채팅 등 다른 훅까지 끌려오는 것을 피하고, "성공 시 신호를 올리는가"만 좁게 잠근다.
const bumpOutputsVersion = vi.fn()
vi.mock('../../context/ScenarioContext.jsx', () => ({
  useScenario: () => ({ bumpOutputsVersion }),
}))

const { getOutput, getOutputDoc, getOutputTimeline, markOutputOpened, downloadOutputFile } = await import('../../lib/outputsApi.js')
const { getProjectOutput, downloadProjectOutput, getProjectOutputDoc } = await import('../../lib/projectsApi.js')
const { triggerBrowserDownload } = await import('../../lib/downloadFile.js')
const { fetchDisplayKeys } = await import('../../lib/artifactKeysApi.js')
const { default: OutputDetailPage } = await import('./OutputDetailPage.jsx')

// vite.config.js·vitest.setup.js 어디에도 clearMocks가 없어, 목 호출 이력이 파일 안에서
// 누적된다(리뷰 Minor). 이게 없으면 앞선 테스트가 이미 같은 'o1'로 markOutputOpened를
// 불러 둔 채라, 이 테스트 자신의 마운트가 실패해도 단언이 우연히 통과할 수 있다.
// clearAllMocks는 호출 이력만 지우고 구현은 그대로 둔다 — 그런데 그 "구현"은 위
// vi.mock 팩토리가 최초 한 번 심은 { ok: true }만이 아니다. 실패 경로를 검증하는
// 테스트가 markOutputOpened.mockResolvedValue({ ok: false, ... })로 구현 자체를
// 새 값으로 **영구 교체**하면, clearAllMocks로는 되돌아가지 않고 뒤따르는 테스트까지
// 그 실패값을 물려받는다(다운로드 테스트에 열람 기록 실패 토스트까지 함께 떠 토스트가
// 2개가 되어 getByRole('status')가 깨졌다 — 실측). 그래서 매 테스트 시작마다 기본값을
// 명시적으로 다시 심는다 — 실패를 보고 싶은 테스트는 자기 본문에서 다시 덮어쓴다.
// getOutputDoc도 같은 이유로 매번 기본값을 심는다 — 위 vi.mock 팩토리는 이것을 목
// 목록에만 올려 두고 **반환값을 주지 않는다**. 이제 이 화면이 OutputViewer를 마운트
// 하고 뷰어가 마운트 즉시 getOutputDoc(...).then(...)을 부르므로, 값이 없으면
// undefined.then 으로 이 파일의 테스트가 전부 죽는다.
//
// 사유(ok:false)를 심는 이유: 이 파일의 관심사는 상세 화면의 골격이지 뷰어 내부가
// 아니다(뷰어 자체는 OutputViewer.test.jsx가 잠근다). 사유를 주면 뷰어는 안내 문구
// 한 줄만 그리고 끝나 골격 단언과 섞이지 않는다.
beforeEach(() => {
  vi.clearAllMocks()
  markOutputOpened.mockResolvedValue({ ok: true })
  // getOutputDoc 과 같은 이유로 매번 기본값을 심는다 — 값이 없으면
  // 뷰어의 undefined.then 으로 이 파일의 시험이 전부 죽는다.
  getOutputTimeline.mockResolvedValue({ ok: false, notice: '타임라인을 불러오지 못했습니다' })
  getOutputDoc.mockResolvedValue({
    ok: false,
    notice: '이 산출물은 미리보기를 만들기 전에 생성되었습니다 — 다운로드로 확인해 주세요',
  })
  // round07h Task 7 — 이름을 다루지 않는 기존 테스트(예: 아래 "선택자료 칩을 누르면…")가
  // 굳이 mockKeys를 부르지 않아도 자료번호 폴백으로 그려지도록, 「빈 결과」를 기본값으로
  // 심는다(실제 백엔드도 mock 프로파일·조회 실패 시 빈 keys로 200을 준다 — Task 4).
  fetchDisplayKeys.mockResolvedValue({ ok: true, keys: {} })
})

function renderAt(id, search = '') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/search/output/${id}${search}`]}>
        <Routes>
          <Route path="/search/output/:outputId" element={<OutputDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

/** round07f 최종 리뷰 M-1 — **리마운트 없이 outputId 만 갈아 끼우는** 트리.
 *
 * 라우트 패턴이 같으면 react-router 는 같은 엘리먼트를 그대로 두고 param 만
 * 바꾼다 — 컴포넌트가 리마운트되지 않아 상태(notice·output)가 이어진다.
 * 그 상황을 만들려면 initialEntries 로는 부족하고(마운트 시점에만 읽힌다)
 * 살아 있는 트리 안에서 이동해야 한다. 그래서 Link 를 Routes 밖에 둔다. */
function renderMovable(from) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/search/output/${from}`]}>
        <Link to="/search/output/good">다른 산출물로</Link>
        <Routes>
          <Route path="/search/output/:outputId" element={<OutputDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

// round10 재리뷰 — 이 픽스처는 프로젝트 경유(공유 열람) 응답의 **좁힌 계약**과 그대로
// 같다: `query`·`conversation_id` 가 없다(`projects/routes.py` 의 `_snapshot_summary`).
// 그래서 아래 `?project=` 테스트들이 「좁혀도 화면이 안 깨진다」의 증거가 된다 —
// 이 화면이 읽는 것은 id·kind·title·file_name·file_bytes·selection 뿐이다.
// round11a — 파일명이 `.hwpx` 였다. 서버가 hwpx·pdf 렌더러를 지워(사용자 확정
// 「docx만 사용할거야」) **이제 hwpx 산출물을 만들 수 없으므로** 나올 수 없는
// 픽스처가 됐다. 이 화면이 확장자로 하는 일(타이틀 옆 `[DOCX, 24.4KB]`)은 그대로다.
const OUTPUT = {
  id: 'o1', kind: 'caption', title: '민주화운동 설명문',
  file_name: '민주화운동 설명문.docx', file_bytes: 25000,
  selection: [{ node: '민주화운동', idnbrs: ['a1', 'a2'] }],
  opened_at: null, created_at: '2026-09-02T10:00:00Z',
}

test('돌아가기·타이틀·선택자료·다운로드가 있다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  renderAt('o1')
  await waitFor(() => expect(screen.getByText(/민주화운동 설명문/)).toBeInTheDocument())
  expect(screen.getByRole('link', { name: /이전 화면 돌아가기/ })).toHaveAttribute('href', '/search/output')
  expect(screen.getByText(/DOCX/)).toBeInTheDocument()
  // /민주화운동/ 으로 찾으면 타이틀 <b>(「민주화운동 설명문 …」)과 선택자료 칩이
  // **둘 다** 걸려 `Found multiple elements`로 던진다(I5). 칩을 문자열로 특정한다.
  expect(screen.getByText('민주화운동 2건')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /다운로드/ })).toBeInTheDocument()
})

test('진입 시 열람을 기록한다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  renderAt('o1')
  await waitFor(() => expect(markOutputOpened).toHaveBeenCalledWith('o1'))
})

// Important(리뷰) — 삭제된 OutputDetailModal은 성공 시 onOpened → bumpOutputsVersion()을
// 올렸다. 이 신호가 없으면 SearchFlowLayout의 탭 뱃지(outputsVersion 구독, deps가
// [outputsVersion]인 이유가 그 주석에 있다)가 상세 열람으로는 절대 줄지 않는다 —
// 레이아웃 라우트라 /search/* 이동으로는 리마운트되지 않기 때문이다.
test('열람 기록에 성공하면 뱃지 갱신 신호(bumpOutputsVersion)를 올린다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  renderAt('o1')
  await waitFor(() => expect(markOutputOpened).toHaveBeenCalledWith('o1'))
  await waitFor(() => expect(bumpOutputsVersion).toHaveBeenCalled())
})

test('열람 기록에 실패하면 사유를 토스트로 알리고, 뱃지 신호는 올리지 않는다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  markOutputOpened.mockResolvedValue({ ok: false, notice: '열람 표시에 실패했습니다' })
  renderAt('o1')
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('열람 표시에 실패했습니다'))
  // 실패했는데 신호를 올리면 "해제됐다"는 잘못된 뱃지 갱신이 된다.
  expect(bumpOutputsVersion).not.toHaveBeenCalled()
})

test('열람 기록이 실패해도 상세 내용은 그대로 남는다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  markOutputOpened.mockResolvedValue({ ok: false, notice: '열람 표시에 실패했습니다' })
  renderAt('o1')
  await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
  // 열람 기록 실패로 상세 열람 자체를 막지 않는다 — 본문은 그대로 보여야 한다.
  expect(screen.getByText(/민주화운동 설명문/)).toBeInTheDocument()
})

test('산출물을 찾을 수 없으면 사유를 말한다', async () => {
  getOutput.mockResolvedValue({ ok: false, notice: '산출물을 찾을 수 없습니다' })
  renderAt('no-such')
  await waitFor(() => expect(screen.getByText(/산출물을 찾을 수 없습니다/)).toBeInTheDocument())
})

test('선택자료 칩을 누르면 그 노드의 자료 목록이 열린다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  renderAt('o1')
  await waitFor(() => expect(screen.getByText('민주화운동 2건')).toBeInTheDocument())
  fireEvent.click(screen.getByText('민주화운동 2건'))
  // round07h Task 7 — 열자마자 fetchDisplayKeys(이름 조회)가 나간다(beforeEach
  // 기본값은 빈 keys라 a1/a2 그대로지만, 그 조회가 끝나는 시점까지 findByRole로
  // 기다려야 act 경고 없이 마이크로태스크가 정리된다).
  expect(await screen.findByRole('button', { name: 'a1' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'a2' })).toBeInTheDocument()
})

// 삭제된 OutputDetailModal.test.jsx가 잠그던 다운로드 경로 2건을 새 화면(OutputDetailPage)
// 기준으로 다시 잠근다(리뷰 Minor).
test('다운로드에 성공하면 브라우저 저장을 부른다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  const blob = new Blob(['x'])
  downloadOutputFile.mockResolvedValue({ ok: true, blob, filename: '민주화운동 설명문.docx' })
  renderAt('o1')
  fireEvent.click(await screen.findByRole('button', { name: /다운로드/ }))
  await waitFor(() =>
    expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, '민주화운동 설명문.docx'))
})

test('다운로드에 실패하면 사유만 알리고 저장하지 않는다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  downloadOutputFile.mockResolvedValue({ ok: false, notice: '산출물 파일이 없습니다' })
  renderAt('o1')
  fireEvent.click(await screen.findByRole('button', { name: /다운로드/ }))
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('산출물 파일이 없습니다'))
  expect(triggerBrowserDownload).not.toHaveBeenCalled()
})

// ── round07f 최종 리뷰 I-1 ─────────────────────────────────────────────────────
// 목록이 `?c=`(대화 id)를 실어 보내 줘도 돌아가는 링크가 떨어뜨리면 절반만 고친
// 것이 된다 — 상세에서 「이전 화면 돌아가기」를 누른 순간 검색 세션이 사라진다
// (검색바 빈칸 · 「표시할 검색 결과가 없습니다」 · 빈 대화). round07e D 가 세운
// 보호이고, 이 라운드가 상세를 독립 라우트로 승격하며 끊었던 자리다.
test('돌아가기 링크가 지금 주소의 ?c= 를 이어 나른다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  renderAt('o1', '?c=CONV-1')
  const back = await screen.findByRole('link', { name: /이전 화면 돌아가기/ })
  expect(back).toHaveAttribute('href', '/search/output?c=CONV-1')
})

test('대화 id 의 특수문자는 인코딩해 싣는다', async () => {
  getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
  renderAt('o1', '?c=a%20b%2Fc')
  const back = await screen.findByRole('link', { name: /이전 화면 돌아가기/ })
  expect(back).toHaveAttribute('href', '/search/output?c=a%20b%2Fc')
})

// ── round07f 최종 리뷰 M-1 ─────────────────────────────────────────────────────
// 옛 사유 문구가 새 산출물을 **영구히** 덮던 자리. 라우트 패턴이 같아 param 만
// 바뀌면 리마운트가 없으므로, 이펙트가 진입할 때 스스로 앞의 흔적을 지워야 한다.
test('id 만 바뀌면 옛 사유 문구가 새 산출물을 덮지 않는다', async () => {
  getOutput.mockImplementation((id) =>
    id === 'bad'
      ? Promise.resolve({ ok: false, notice: '산출물을 찾을 수 없습니다' })
      : Promise.resolve({ ok: true, data: OUTPUT }))
  renderMovable('bad')
  await waitFor(() => expect(screen.getByText(/산출물을 찾을 수 없습니다/)).toBeInTheDocument())

  fireEvent.click(screen.getByRole('link', { name: '다른 산출물로' }))

  await waitFor(() => expect(screen.getByText(/민주화운동 설명문/)).toBeInTheDocument())
  expect(screen.queryByText(/산출물을 찾을 수 없습니다/)).toBeNull()
})

// 반대 방향도 잠근다 — 정상 산출물을 보다가 없는 id 로 옮기면, 앞 산출물의 제목이
// 남은 채 사유 문구만 덧붙는 일이 없어야 한다(이 화면은 둘 중 하나만 그린다).
test('정상 → 없는 id 로 옮기면 앞 산출물이 남지 않는다', async () => {
  getOutput.mockImplementation((id) =>
    id === 'good'
      ? Promise.resolve({ ok: false, notice: '산출물을 찾을 수 없습니다' })
      : Promise.resolve({ ok: true, data: OUTPUT }))
  renderMovable('o1')
  await waitFor(() => expect(screen.getByText(/민주화운동 설명문/)).toBeInTheDocument())

  fireEvent.click(screen.getByRole('link', { name: '다른 산출물로' }))

  await waitFor(() => expect(screen.getByText(/산출물을 찾을 수 없습니다/)).toBeInTheDocument())
  expect(screen.queryByText(/민주화운동 설명문/)).toBeNull()
})

// ── round07h Task 7 ─────────────────────────────────────────────────────────
// 산출물 노드 목록이 자료번호 대신 유물 이름을 보여준다 — 이 라운드를 연 직접적인
// 이유다. selection.idnbrs만 보고 POST /artifacts/keys(Task 4)를 노드당 한 번
// 조회하므로 전시자료·설명문 양쪽에서 같게 동작하고(doc 모양에 기대지 않는다),
// 이름을 못 얻어도 자료번호로 목록이 그대로 열려야 한다.
//
// @testing-library/user-event는 이 저장소에 devDependency로 없다(round07h Task 5
// SortSelect.test.jsx의 같은 실측 주석 참조 — 다른 어떤 테스트 파일도 그 패키지를
// 쓰지 않는다). 새 의존성을 더하는 대신 이 파일이 이미 쓰는 fireEvent로 브리프
// 원안의 userEvent.click을 그대로 대체한다.

/** selection을 outputsApi(getOutput) 목의 반환값에 실어 이 화면에 주입한다
 * (renderAt은 그대로 두고, "무엇을 보여줄지"만 OUTPUT을 덮어써 바꾼다 — :98-103
 * OUTPUT·:105 이하 기존 테스트들과 같은 방식). */
function renderOutputDetail({ kind = 'exhibit', selection }) {
  getOutput.mockResolvedValue({ ok: true, data: { ...OUTPUT, kind, selection } })
  return renderAt('o1')
}

/** fetchDisplayKeys가 성공 응답으로 돌려주는 모양을 그대로 흉내 낸다
 * ({ ok:true, keys: { idnbr: { name, subject_year, is_public } } } — Task 4
 * 응답 그대로). 호출부(fetchDisplayKeys 자체)를 assert할 수 있도록 mock 함수를
 * 돌려준다. */
function mockKeys(byIdnbr) {
  const keys = {}
  for (const [idnbr, v] of Object.entries(byIdnbr)) {
    keys[idnbr] = { name: null, subject_year: null, is_public: null, ...v }
  }
  fetchDisplayKeys.mockResolvedValue({ ok: true, keys })
  return fetchDisplayKeys
}

/** 조회 실패 — 실제 백엔드도 예외를 던지지 않고 **빈 keys로 200**을 돌려준다
 * (Task 4, try/except가 흡수). throw가 아니라 빈 결과로 흉내 내는 이유가 그것이다. */
function mockKeysFailure() {
  fetchDisplayKeys.mockResolvedValue({ ok: false, keys: {} })
}

describe('노드 자료 목록 (round07h)', () => {
  it('자료번호가 아니라 유물 이름을 보여준다', async () => {
    mockKeys({ '2022005259': { name: '님을 위한 행진곡' } })
    renderOutputDetail({ selection: [{ node: '정치', idnbrs: ['2022005259'] }] })
    fireEvent.click(await screen.findByRole('button', { name: /정치 1건/ }))
    expect(await screen.findByText('님을 위한 행진곡')).toBeInTheDocument()
    expect(screen.queryByText('2022005259')).toBeNull()
  })

  it('★ 설명문 산출물에서도 이름이 나온다', async () => {
    // 이게 doc 파싱 대신 일괄 조회로 간 이유다. doc 에 기대면 전시자료에서만
    // 이름이 나오고 설명문에서는 자료번호가 나온다.
    mockKeys({ A1: { name: '6월 민주항쟁 사진' } })
    renderOutputDetail({ kind: 'caption', selection: [{ node: '정치', idnbrs: ['A1'] }] })
    fireEvent.click(await screen.findByRole('button', { name: /정치 1건/ }))
    expect(await screen.findByText('6월 민주항쟁 사진')).toBeInTheDocument()
  })

  it('★ 이름을 못 얻어도 목록이 열리고 자료번호를 그린다', async () => {
    mockKeysFailure()
    renderOutputDetail({ selection: [{ node: '정치', idnbrs: ['2022005259'] }] })
    fireEvent.click(await screen.findByRole('button', { name: /정치 1건/ }))
    // 목록이 안 열리거나 빈 칸이 뜨면 실패다.
    expect(await screen.findByText('2022005259')).toBeInTheDocument()
  })

  it('★ 조회는 노드당 한 번이다 — 자료마다 한 번이 아니다', async () => {
    const spy = mockKeys({ A1: { name: 'x' }, A2: { name: 'y' }, A3: { name: 'z' } })
    renderOutputDetail({ selection: [{ node: '정치', idnbrs: ['A1', 'A2', 'A3'] }] })
    fireEvent.click(await screen.findByRole('button', { name: /정치 3건/ }))
    await screen.findByText('x')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // round07i 감사 C — 칩의 React key가 s.node였다. 서버로 올라가는
  // SelectionGroup은 **클래스를 떼고 라벨만** 싣기 때문에(OutputTab의
  // buildSelectionPayload) 서로 다른 클래스의 같은 이름 노드가 한 산출물 안에
  // 나란히 들어올 수 있다 — 실제로 감사가 재현한 오염 payload에도 「산업」 그룹이
  // 둘이었다. 그때 두 <li>의 key가 겹쳐 React가 경고를 내고 한쪽 엘리먼트를
  // 재사용한다.
  it('같은 이름의 노드가 둘이어도 key가 겹치지 않는다', async () => {
    const errors = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(String(a[0])) })
    try {
      renderOutputDetail({
        selection: [
          { node: '산업', idnbrs: ['A1', 'A2'] },
          { node: '산업', idnbrs: ['B1'] },
        ],
      })
      // 둘 다 그려진다(하나로 합쳐지지 않는다).
      expect(await screen.findByRole('button', { name: /산업 2건/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /산업 1건/ })).toBeInTheDocument()
      expect(errors.join('\n')).not.toMatch(/same key/)
    } finally {
      spy.mockRestore()
    }
  })

  it('이름을 클릭하면 뷰어 제목이 처음부터 이름이다', async () => {
    mockKeys({ '2022005259': { name: '님을 위한 행진곡' } })
    renderOutputDetail({ selection: [{ node: '정치', idnbrs: ['2022005259'] }] })
    fireEvent.click(await screen.findByRole('button', { name: /정치 1건/ }))
    fireEvent.click(await screen.findByText('님을 위한 행진곡'))
    // 자료번호가 잠깐 떴다가 이름으로 바뀌는 깜빡임이 없어야 한다.
    expect(await screen.findByRole('heading', { name: '님을 위한 행진곡' })).toBeInTheDocument()
  })
})

// round10b B-3 — exhibit 라벨 개명(「전시자료」→「학예 기획 자료」)을 상세 화면에서도
// 정확한 문자열로 잠근다. 아래 it.each는 "한글이면 통과"라 오탈자(예: 「학예기획 자료」
// 붙여쓰기)까지는 못 잡는다 — 이 테스트가 그 틈을 메운다.
it('exhibit 산출물의 상세 뱃지는 정확히 「학예 기획 자료」다', async () => {
  renderOutputDetail({ kind: 'exhibit', selection: [] })
  const badge = await screen.findByText('학예 기획 자료')
  expect(badge).toHaveClass('output_card_kind')
})

// round07i 리뷰 — OutputCard.jsx와 이 파일이 각자 든 KIND_LABEL에 exhibition이
// 빠져 있어, 특별전시 산출물의 종류 뱃지가 폴백(KIND_LABEL[kind] || kind)으로
// 영문 "exhibition"을 그대로 찍었다(100% 재현 · round07i의 신규 기능을 쓴 직후
// 바로 보이는 화면). exhibition만 하드코딩해 잠그면 다음에 kind가 하나 더
// 생겼을 때 같은 사고가 반복돼도 이 테스트는 초록으로 남는다 — round07i
// 재리뷰: 그래서 하드코딩된 로컬 목록 대신 routes.py의 CreateOutputRequest.kind
// Literal을 직접 읽어 도출한다(serverOutputKinds.test.js). 서버가 kind를 하나 더
// 열면 다음 실행에서 곧바로 it.each가 그 kind도 돈다 — 손으로 이 상수를
// 갱신할 필요가 없다.
describe('종류 뱃지 — 서버가 낼 수 있는 kind 전부에 한글 라벨이 있다 (round07i 리뷰)', () => {
  const SERVER_KINDS = getServerOutputKinds()

  it.each(SERVER_KINDS)('kind=%s 는 뱃지에 영문 리터럴이 아니라 한글로 뜬다', async (kind) => {
    renderOutputDetail({ kind })
    await screen.findByText(/민주화운동 설명문/)
    const badge = document.querySelector('.output_card_kind')
    expect(badge).not.toBeNull()
    // KIND_LABEL에 항목이 빠지면 폴백이 kind 영문 리터럴을 그대로 찍는다 —
    // 그 사고를 "한글인가"로 잡는다(라벨 문구 자체를 하나하나 잠그지 않는다).
    // round10b — exhibit 라벨이 「학예 기획 자료」로 개명되며 공백이 섞였다 —
    // 정규식이 공백을 허용하지 않으면 이 통과해야 할 라벨까지 함께 떨어진다.
    expect(badge.textContent).toMatch(/^[가-힣\s]+$/)
    expect(badge.textContent).not.toBe(kind)
  })
})

// ── round10 Task7 사후조치(spec §5-5 위반 수정) ─────────────────────────────
// ProjectOutputList.openDetail이 `?project=`를 실어 보내면(round10 Task7 사후조치),
// 이 화면은 소유자 전용 세 API(getOutput·markOutputOpened·downloadOutputFile) 를
// **하나도** 부르지 않고 전부 프로젝트 경유(소유 무관, 스냅샷 소속 판정) API로
// 바꿔야 한다 — 하나라도 남으면 남의 프로젝트를 열어 본 사람이 그 자리에서 403을
// 만난다(리뷰가 지적한 실제 버그). 반대로 `?project=`가 없을 때는 기존 동작이
// 완전히 그대로여야 한다(이미 위 테스트들이 getOutput 을 그대로 부르는 것으로
// 잠가 두었다 — 여기서는 프로젝트 경유 API가 **불리지 않는다**는 것까지 명시적으로
// 잠근다).
describe('프로젝트 경유(?project=) — round10 Task7 사후조치', () => {
  test('?project= 가 있으면 소유자 전용 GET 대신 getProjectOutput 을 부른다', async () => {
    getProjectOutput.mockResolvedValue({ ok: true, data: OUTPUT })
    renderAt('o1', '?project=p1')
    await waitFor(() => expect(screen.getByText(/민주화운동 설명문/)).toBeInTheDocument())
    expect(getProjectOutput).toHaveBeenCalledWith('p1', 'o1')
    expect(getOutput).not.toHaveBeenCalled()
  })

  // round10 재리뷰 — 네 번째 소유자 전용 호출(자식 OutputViewer의 원문 조회)까지
  // 문맥이 내려가는지. 이것이 없으면 제목·선택자료·다운로드는 나오는데 **본문만**
  // 「권한 없음」이 된다(spec §5-5 「산출물 카드 — 활성 그대로」 미달).
  test('?project= 가 있으면 뷰어의 원문 조회도 프로젝트 경유로 간다', async () => {
    getProjectOutput.mockResolvedValue({ ok: true, data: OUTPUT })
    renderAt('o1', '?project=p1')
    await waitFor(() => expect(getProjectOutputDoc).toHaveBeenCalledWith('p1', 'o1'))
    expect(getOutputDoc).not.toHaveBeenCalled()
  })

  test('?project= 가 있으면 markOutputOpened(소유자 전용 PATCH) 를 부르지 않는다', async () => {
    getProjectOutput.mockResolvedValue({ ok: true, data: OUTPUT })
    renderAt('o1', '?project=p1')
    await waitFor(() => expect(screen.getByText(/민주화운동 설명문/)).toBeInTheDocument())
    // 스냅샷에는 「신규」 개념이 없다 — 남의 프로젝트에서 되살린 저장 시점의 묶음에
    // 「내가 아직 안 봤다」는 뜻이 성립하지 않으므로 해제할 것도 없다.
    // (round10 재리뷰 — 예전 주석은 "opened_at 필드 자체가 없다"고 적었으나 최종리뷰
    //  I-3 이후 서버가 그 값을 싣는다. 이유는 필드 부재가 아니라 개념 부재다.)
    expect(markOutputOpened).not.toHaveBeenCalled()
  })

  test('?project= 가 있으면 다운로드가 downloadProjectOutput 을 부른다(downloadOutputFile 아님)', async () => {
    getProjectOutput.mockResolvedValue({ ok: true, data: OUTPUT })
    const blob = new Blob(['x'])
    downloadProjectOutput.mockResolvedValue({ ok: true, blob, filename: '민주화운동 설명문.docx' })
    renderAt('o1', '?project=p1')
    fireEvent.click(await screen.findByRole('button', { name: /다운로드/ }))
    await waitFor(() =>
      expect(downloadProjectOutput).toHaveBeenCalledWith('p1', 'o1', '민주화운동 설명문.docx'))
    expect(downloadOutputFile).not.toHaveBeenCalled()
    expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, '민주화운동 설명문.docx')
  })

  test('?project= 가 있으면 돌아가기가 프로젝트 상세의 산출물생성 탭으로 간다', async () => {
    // round10(2026-09-16 라이브 검증, 사용자 지적) — `?tab=output` 이 없으면 상세의
    // 기본 탭(검색결과)이 열려, 산출물 목록에서 왔다는 맥락이 끊긴다. 탭은 라우트가
    // 아니라 지역 상태라 주소로만 복원된다.
    getProjectOutput.mockResolvedValue({ ok: true, data: OUTPUT })
    renderAt('o1', '?project=p1')
    const back = await screen.findByRole('link', { name: /이전 화면 돌아가기/ })
    expect(back).toHaveAttribute('href', '/library/p1?tab=output')
  })

  // 대조군 — `?project=`가 없으면 프로젝트 경유 API가 전혀 불리지 않는다(기존
  // 동작이 그대로다). 위쪽 기존 테스트들은 getOutput 을 부르는 쪽만 확인했으므로,
  // 여기서 반대쪽(신규 API가 섞여 불리지 않는다)까지 명시적으로 잠근다.
  test('?project= 가 없으면 프로젝트 경유 API를 전혀 부르지 않는다(기존 동작 그대로)', async () => {
    getOutput.mockResolvedValue({ ok: true, data: OUTPUT })
    const blob = new Blob(['x'])
    downloadOutputFile.mockResolvedValue({ ok: true, blob, filename: '민주화운동 설명문.docx' })
    renderAt('o1')
    fireEvent.click(await screen.findByRole('button', { name: /다운로드/ }))
    await waitFor(() => expect(triggerBrowserDownload).toHaveBeenCalled())
    expect(getProjectOutput).not.toHaveBeenCalled()
    expect(downloadProjectOutput).not.toHaveBeenCalled()
    expect(markOutputOpened).toHaveBeenCalledWith('o1')
  })
})
