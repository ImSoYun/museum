// 이 파일의 책임: 좌측 「산출물」 뷰어의 **타임라인 3층 렌더**(round11a task-10)
// — 피그마 `1043:6683`(좌측 타임라인 상세) · `988:7840`(좌측 패널 확대).
//
// 기존 `OutputViewer.test.jsx` 는 「연도 | 항목들」 2열 표를 잠근다. 이 라운드가
// 바꾸는 것은 그 **층**이라, 두 층이 한 파일에서 섞이지 않도록 새 파일에 둔다
// (`OutputViewer.captionContract.test.jsx` 를 따로 둔 것과 같은 판단).
//
// 여기서 잠그는 것:
//   ① `GET /outputs/{id}/timeline` 의 decades 로 3층을 그린다(본문은 doc 그대로)
//   ② 붙인 사건이 `12.27 사건명` 모양으로, **초록**으로 그려진다
//   ③ 유물명은 클릭 대상이고 `onArtifactPick(item)` 을 부른다
//   ④ `matched_by:'contains'` 는 **추정** 표시를, 빈 `idnbr` 은 **못 누르는 이유**를 남긴다
//   ⑤ `/timeline` 이 실패하거나 decades 가 비면 **옛 표 렌더로 떨어진다**(화면이 비지 않는다)
//   ⑥ 복사용 평문이 새 층과 어긋나지 않는다
//   ⑦ **공유 열람(`?project=`)도 새 층이다** — `/timeline` 을 안 부르고 doc 으로
//      만든다(재리뷰 MEDIUM-3). 유물명은 여전히 클릭 대상이 아니다
import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ToastProvider } from '../../components/Toast.jsx'

vi.mock('../../lib/outputsApi.js', () => ({
  isLive: () => true,
  getOutputDoc: vi.fn(),
  getOutputTimeline: vi.fn(),
}))
vi.mock('../../lib/projectsApi.js', () => ({
  getProjectOutputDoc: vi.fn(),
}))

const { getOutputDoc, getOutputTimeline } = await import('../../lib/outputsApi.js')
const { getProjectOutputDoc } = await import('../../lib/projectsApi.js')
const { default: OutputViewer } = await import('./OutputViewer.jsx')

/** 줄 나눔 문자. 소스에 이스케이프로 적는 대신 상수로 둔다. */
const NEWLINE = String.fromCharCode(10)

const DOC = {
  kind: 'caption',
  title: '1987년 6월 민주항쟁',
  subtitle: '시민의 힘으로 일궈낸 전환점',
  body: '1987년 1월 14일…',
  items: [
    { year_label: '1969년', headline: '삼선개헌 반대 자료',
      source: '삼선개헌 반대 자료 · 정치행정 · 1969.', background: '배경 문장.', event: '사건 문장.' },
  ],
  groups: [{ year_label: '1969년', items: [
    { year_label: '1969년', headline: '삼선개헌 반대 자료',
      source: '삼선개헌 반대 자료 · 정치행정 · 1969.', background: '배경 문장.', event: '사건 문장.' },
  ] }],
}

/** 공유 열람이 받는 doc — `doc_builder.caption_to_doc` 이 싣는 값 그대로다
 *  (`items[].attached`·`idnbr`·`decade_titles`·`year_subtitles`·`groups`).
 *  **서버 API 를 새로 만들지 않고도 새 층에 필요한 값이 다 있다**는 것이 요점이다. */
const SHARED_ITEM = {
  year_label: '1969년', headline: '삼선개헌 반대 자료',
  source: '삼선개헌 반대 자료 · 정치행정 · 1969.', idnbr: 'PS-1',
  background: '박정희 3선 연임을 위해 헌법 개정 시도.',
  event: '여당이 헌법 개정안을 기습 통과시킴.',
  attached: [{ event_id: 7, month: 12, day: 27, text: '연표참고하여 사건명' }],
}
const SHARED_UNKNOWN_ITEM = {
  year_label: '연도미상', headline: '미상 자료', source: '미상 자료 · 미디어',
  idnbr: '', background: '', event: '', attached: [],
}
const PROJECT_DOC = {
  ...DOC,
  decade_titles: { 1960: '1960년대 - 전환의 시작' },
  year_subtitles: { '1969년': '그 해의 기록' },
  items: [SHARED_ITEM, SHARED_UNKNOWN_ITEM],
  groups: [
    { year_label: '1969년', items: [SHARED_ITEM] },
    { year_label: '연도미상', items: [SHARED_UNKNOWN_ITEM] },
  ],
}

/** 이름에 **가운뎃점이 든 유물**의 doc. 출처 줄을 잇는 구분자(공백-점-공백)와
 *  글자가 겹쳐, 구분자를 `'·'` 로 적으면 「숟가락」에서 잘린다(재리뷰 MEDIUM-1). */
const MIDDOT_ITEM = {
  year_label: '1960년', headline: '표제',
  source: '숟가락·젓가락 · 식생활 · 1960.', idnbr: 'PS-9',
  background: '', event: '', attached: [],
}
const MIDDOT_DOC = {
  ...DOC,
  decade_titles: {}, year_subtitles: {},
  items: [MIDDOT_ITEM],
  groups: [{ year_label: '1960년', items: [MIDDOT_ITEM] }],
}

/** `build_view`(timeline_edit.py)가 내는 합친 모양 그대로다. */
const VIEW = {
  version: 1,
  edited: true,
  decades: [
    {
      decade: '1960',
      title: '1960년대 - 전환의 시작',
      years: [{
        year_label: '1969년',
        subtitle: '그 해의 기록',
        items: [{
          index: 0, idnbr: 'PS-1', matched_by: 'exact',
          name: '삼선개헌 반대 자료', subject_era: '1969.',
          year_label: '1969년', headline: '삼선개헌 반대 자료',
          source: '삼선개헌 반대 자료 · 정치행정 · 1969.',
          background: '박정희 3선 연임을 위해 헌법 개정 시도.',
          event: '여당이 헌법 개정안을 기습 통과시킴.',
          attached: [{ event_id: 7, month: 12, day: 27, text: '연표참고하여 사건명' }],
        }],
      }],
    },
    {
      // 연도미상 묶음 — 연대가 빈 문자열이라 **연대 제목이 없다**(맨 뒤).
      decade: '', title: '',
      years: [{
        year_label: '연도미상', subtitle: '',
        items: [{
          index: 1, idnbr: '', matched_by: 'none',
          name: '미상 자료', subject_era: '',
          year_label: '연도미상', headline: '미상 자료', source: '미상 자료 · 미디어',
          background: '', event: '', attached: [],
        }],
      }],
    },
  ],
}

/** VIEW 의 첫 연대를 「항목 하나 · 붙인 사건은 준 대로」로 바꾼 사본.
 *  붙인 사건 줄의 갈래(월 없음 · 일 없음 · 여러 건)를 픽스처로 만든다. */
const withAttached = (attached) => ({
  ...VIEW.decades[0],
  years: [{
    ...VIEW.decades[0].years[0],
    items: [{ ...VIEW.decades[0].years[0].items[0], attached }],
  }],
})

/** VIEW 의 첫 연대를 「항목 하나 · 유물 매칭은 준 대로」로 바꾼 사본.
 *  `pickBlockedReason` 세 갈래를 픽스처로 만든다. */
const withMatch = (over) => ({
  ...VIEW.decades[0],
  years: [{
    ...VIEW.decades[0].years[0],
    items: [{ ...VIEW.decades[0].years[0].items[0], ...over }],
  }],
})

beforeEach(() => {
  vi.clearAllMocks()
  getOutputDoc.mockResolvedValue({ ok: true, data: DOC })
  getOutputTimeline.mockResolvedValue({ ok: true, data: VIEW })
  getProjectOutputDoc.mockResolvedValue({ ok: false, notice: '미리보기 없음' })
})

function renderViewer(props = {}) {
  return render(
    <ToastProvider>
      <OutputViewer outputId="o1" kind="caption" {...props} />
    </ToastProvider>,
  )
}

test('설명문이면 /timeline 을 함께 부른다', async () => {
  renderViewer()
  await waitFor(() => expect(getOutputTimeline).toHaveBeenCalledWith('o1'))
})

test('본문(제목·부제·본문)은 doc 그대로다 — 갈아끼우지 않는다', async () => {
  renderViewer()
  expect(await screen.findByText('1987년 6월 민주항쟁')).toBeInTheDocument()
  expect(screen.getByText('시민의 힘으로 일궈낸 전환점')).toBeInTheDocument()
  expect(screen.getByText('1987년 1월 14일…')).toBeInTheDocument()
})

test('연대 제목 › 연도 + 소제목 › 항목 3층으로 그린다', async () => {
  renderViewer()
  expect(await screen.findByText('1960년대 - 전환의 시작')).toBeInTheDocument()
  expect(screen.getByText('1969년')).toBeInTheDocument()
  expect(screen.getByText('그 해의 기록')).toBeInTheDocument()
  // 2열 표(옛 층)가 아니다.
  expect(document.querySelector('.timeline_decades table')).toBeNull()
})

test('연대가 빈 묶음(연도미상)은 연대 제목 없이 맨 뒤에 온다', async () => {
  renderViewer()
  await screen.findByText('1960년대 - 전환의 시작')
  const decades = document.querySelectorAll('.timeline_decade')
  expect(decades).toHaveLength(2)
  // 마지막 묶음에는 연대 제목 요소 자체가 없다(빈 제목 줄을 그리지 않는다).
  expect(decades[1].querySelector('.timeline_decade_title')).toBeNull()
  expect(decades[1].textContent).toContain('연도미상')
})

test('붙인 사건은 `12.27 사건명` 모양이고 초록(#00B975)이다', async () => {
  renderViewer()
  const line = await screen.findByText('12.27 연표참고하여 사건명')
  // 월·일과 사건명이 **한 덩어리**여야 같은 초록이 걸린다(피그마 1043:6683).
  expect(line).toHaveClass('timeline_attached')
  // ⚠️ **색 값을 단언한다.** `timeline_attached` 는 CSS 규칙이 없는 표식 클래스라
  // (styles/ 전체 grep 0건) 그것만 보면 `text-[#1A7F37]` 로 되돌려도 초록이다.
  // DOCX 쪽은 값(`00B975`)으로 잠겨 있으므로, 여기도 값으로 잠가야 「한쪽만
  // 바꾸면 조용히 갈린다」는 방어가 양쪽에 선다.
  // (jsdom 에는 Tailwind 가 컴파일되지 않아 getComputedStyle 로는 색을 볼 수
  //  없다 — 값이 적힌 곳은 클래스 문자열 그 자체다.)
  expect(line).toHaveClass('text-[#00B975]')
})

test('붙인 사건이 여럿이면 줄이 늘고 라벨은 하나뿐이다', async () => {
  // 시안(1043:6683)은 「사건명」 라벨 하나가 여러 줄을 거느린다. 픽스처가 늘
  // 1건이라 둘째 줄부터의 경로가 시험에 닿지 않았다(리뷰 MEDIUM-5 ③).
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withAttached([
      { event_id: 7, month: 12, day: 27, text: '연표참고하여 사건명' },
      { event_id: 8, month: 11, day: 3, text: '둘째 사건명' },
    ])] },
  })
  renderViewer()

  expect(await screen.findByText('12.27 연표참고하여 사건명')).toBeInTheDocument()
  expect(screen.getByText('11.3 둘째 사건명')).toBeInTheDocument()
  // 라벨은 항목당 하나다 — 줄마다 반복하면 시안에 없는 글자가 생긴다.
  expect(screen.getAllByText('사건명')).toHaveLength(1)
})

test('월이 없는 붙인 사건은 사건명만 그린다 — 빈 점(`. 사건명`)이 앞서지 않는다', async () => {
  // 서버 `timeline_edit.attached_line` 과 **같은 규칙**이어야 하는 자리다.
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withAttached([
      { event_id: 9, month: null, day: null, text: '날짜 없는 사건명' },
    ])] },
  })
  renderViewer()

  expect(await screen.findByText('날짜 없는 사건명')).toBeInTheDocument()
  expect(screen.queryByText(/^\. /)).toBeNull()
})

test('일이 없는 붙인 사건은 `12. 사건명` 이다', async () => {
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withAttached([
      { event_id: 10, month: 12, day: null, text: '달만 아는 사건명' },
    ])] },
  })
  renderViewer()

  expect(await screen.findByText('12. 달만 아는 사건명')).toBeInTheDocument()
})

test('여러 줄 붙인 사건은 복사용 평문에서도 라벨 하나에 이어 붙는다', async () => {
  const writeText = vi.fn().mockResolvedValue()
  Object.assign(navigator, { clipboard: { writeText } })
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withAttached([
      { event_id: 7, month: 12, day: 27, text: '연표참고하여 사건명' },
      { event_id: 8, month: null, day: null, text: '날짜 없는 사건명' },
    ])] },
  })
  renderViewer()
  await screen.findByText('12.27 연표참고하여 사건명')

  fireEvent.click(screen.getByRole('button', { name: '내부 텍스트 복사' }))

  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const lines = writeText.mock.calls[0][0].split('\n')
  const at = lines.indexOf('● 사건명  12.27 연표참고하여 사건명')
  expect(at).toBeGreaterThan(-1)
  // 둘째 줄은 라벨 없이 그대로 떨어진다(화면의 모양과 같다).
  expect(lines[at + 1]).toBe('날짜 없는 사건명')
})

test('유물명이 비면 복사 평문에 꼬리 공백을 남기지 않는다', async () => {
  // 바로 위 「사건명」 줄과 같은 규율이다 — 파이썬 쪽은 꼬리 공백 금지를 시험으로
  // 잠갔는데(`test_event_label_stays_when_there_is_no_attached_event`) 유물명 줄만
  // `.trimEnd()` 가 없었다(재리뷰 LOW-5).
  const writeText = vi.fn().mockResolvedValue()
  Object.assign(navigator, { clipboard: { writeText } })
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withMatch({ name: '', idnbr: '', matched_by: 'none' })] },
  })
  renderViewer()
  await screen.findByText('1960년대 - 전환의 시작')

  fireEvent.click(screen.getByRole('button', { name: '내부 텍스트 복사' }))

  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const lines = writeText.mock.calls[0][0].split(NEWLINE)
  expect(lines).toContain('유물명')
  expect(lines).not.toContain('유물명  ')
})

test('붙인 사건이 없으면 「사건명」 줄은 라벨만 남는다', async () => {
  renderViewer()
  await screen.findByText('1960년대 - 전환의 시작')
  // 항목이 둘이고 붙인 사건은 첫째에만 있다 — 라벨은 둘 다 그린다.
  expect(screen.getAllByText('사건명')).toHaveLength(2)
  expect(screen.getAllByText('유물명')).toHaveLength(2)
})

test('배경·사건 줄은 라벨과 함께 그대로 그린다', async () => {
  renderViewer()
  expect(await screen.findByText('배경: 박정희 3선 연임을 위해 헌법 개정 시도.')).toBeInTheDocument()
  expect(screen.getByText('사건: 여당이 헌법 개정안을 기습 통과시킴.')).toBeInTheDocument()
})

test('유물명을 누르면 onArtifactPick(항목)을 부른다', async () => {
  const onArtifactPick = vi.fn()
  renderViewer({ onArtifactPick })
  const btn = await screen.findByRole('button', { name: '삼선개헌 반대 자료' })
  fireEvent.click(btn)
  expect(onArtifactPick).toHaveBeenCalledWith(
    expect.objectContaining({ idnbr: 'PS-1', subject_era: '1969.' }),
  )
})

test('onArtifactPick 이 없으면 유물명은 클릭 대상이 아니다', async () => {
  renderViewer()
  await screen.findByText('삼선개헌 반대 자료')
  expect(screen.queryByRole('button', { name: '삼선개헌 반대 자료' })).toBeNull()
})

test('지금 대상인 항목의 유물명은 화면에서 구별된다', async () => {
  renderViewer({ onArtifactPick: vi.fn(), activeIndex: 0 })
  const btn = await screen.findByRole('button', { name: '삼선개헌 반대 자료' })
  // 다른 유물을 누르면 대상이 바뀌므로(spec §2.4), 지금 대상이 무엇인지
  // 화면에서 알 수 있어야 한다.
  expect(btn).toHaveAttribute('aria-current', 'true')
})

test("matched_by:'none' 항목은 클릭 대상이 아니고 이유가 보인다", async () => {
  renderViewer({ onArtifactPick: vi.fn() })
  await screen.findByText('1960년대 - 전환의 시작')
  expect(screen.queryByRole('button', { name: '미상 자료' })).toBeNull()
  expect(screen.getByText(/맞는 유물을 찾지 못해 연표를 열 수 없습니다/)).toBeInTheDocument()
})

// `pickBlockedReason` 세 갈래 중 예전에 검증된 것은 `'none'` 하나뿐이었다
// (리뷰 MEDIUM-5 ②) — 사용자가 자료를 고쳐야 하는지(none) 이름이 겹친
// 것인지(ambiguous) 가리는 구분이라 셋 다 잠근다.
test("matched_by:'ambiguous' 는 이름이 겹쳤다는 사유를 적는다", async () => {
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withMatch({ idnbr: '', matched_by: 'ambiguous' })] },
  })
  renderViewer({ onArtifactPick: vi.fn() })
  await screen.findByText('1960년대 - 전환의 시작')

  expect(screen.queryByRole('button', { name: '삼선개헌 반대 자료' })).toBeNull()
  expect(screen.getByText('같은 이름의 유물이 여럿이라 연표를 열 수 없습니다')).toBeInTheDocument()
})

test('matched_by 가 그 밖이면 기본 사유를 적는다 — 조용히 못 누르게 두지 않는다', async () => {
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: { ...VIEW, decades: [withMatch({ idnbr: '', matched_by: 'exact' })] },
  })
  renderViewer({ onArtifactPick: vi.fn() })
  await screen.findByText('1960년대 - 전환의 시작')

  expect(screen.getByText('유물 정보가 없어 연표를 열 수 없습니다')).toBeInTheDocument()
})

test("matched_by:'contains' 는 추정임을 알 수 있게 한다", async () => {
  getOutputTimeline.mockResolvedValue({
    ok: true,
    data: {
      ...VIEW,
      decades: [{
        ...VIEW.decades[0],
        years: [{
          ...VIEW.decades[0].years[0],
          items: [{ ...VIEW.decades[0].years[0].items[0], matched_by: 'contains' }],
        }],
      }],
    },
  })
  renderViewer({ onArtifactPick: vi.fn() })
  const btn = await screen.findByRole('button', { name: /삼선개헌 반대 자료/ })
  expect(btn.getAttribute('title')).toMatch(/추정/)
})

test('/timeline 이 실패하면 옛 표 렌더로 떨어진다 — 화면이 비지 않는다', async () => {
  getOutputTimeline.mockResolvedValue({ ok: false, notice: '타임라인을 불러오지 못했습니다' })
  renderViewer()
  // 옛 렌더의 표식: `● 표제` 와 `출처  …` 줄.
  expect(await screen.findByText('● 삼선개헌 반대 자료')).toBeInTheDocument()
  // 두 칸(`출처␣␣…`)은 RTL 의 기본 정규화가 한 칸으로 접는다 — 그 규칙을 피하려
  // 매처를 바꾸는 대신 한 칸으로 적는다(평문 쪽 두 칸은 아래 복사 시험이 잠근다).
  expect(screen.getByText('출처 삼선개헌 반대 자료 · 정치행정 · 1969.')).toBeInTheDocument()
})

test('/timeline 이 실패하면 타임라인 머리 옆에 사유가 한 줄 남는다', async () => {
  // 같은 파일의 getOutputDoc 실패는 모두 setNotice 로 사유를 띄우고, 우측
  // 뷰어도 실패를 한 줄로 적는다 — 여기만 res.notice 를 받아 놓고 버렸다
  // (코딩표준 §6). 실제 증상은 「새 산출물이 말없이 옛 2열 표로 보이는 것」이다.
  getOutputTimeline.mockResolvedValue({ ok: false, notice: '타임라인을 불러오지 못했습니다' })
  renderViewer()

  expect(await screen.findByText(/타임라인을 불러오지 못했습니다/)).toBeInTheDocument()
  // 토스트가 아니라 **줄 안내**다 — 타임라인 머리 바로 아래에 붙는다.
  expect(document.querySelector('.timeline_notice')).not.toBeNull()
})

// ── 공유 열람(`?project=`)도 **새 층**이다(재리뷰 MEDIUM-3) ─────────────────
//
// 이 화면은 `/timeline` 을 부르지 않는다(소유자 전용 라우트이고 프로젝트 경유
// 짝이 서버에 없다). 그래서 예전에는 **새로 만든 설명문도** 미리보기만 옛 2열
// 표(`● 표제` · `출처 …`)로 그려졌는데, 같은 화면의 다운로드 버튼이 주는 DOCX 는
// 새 층이었다 — 미리보기와 파일이 다른 문서를 말했다. 아래 시험들이 예전에는
// 그 상태를 **잠그고** 있었다(「● 삼선개헌 반대 자료」를 기다렸다).
test('공유 열람도 새 층으로 그린다 — 미리보기와 DOCX 가 같은 문서를 말한다', async () => {
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: PROJECT_DOC })
  renderViewer({ projectId: 'p1' })

  expect(await screen.findByText('1960년대 - 전환의 시작')).toBeInTheDocument()
  expect(screen.getByText('그 해의 기록')).toBeInTheDocument()
  expect(screen.getByText('12.27 연표참고하여 사건명')).toBeInTheDocument()
  expect(screen.getAllByText('유물명')).toHaveLength(2)
  // 옛 2열 표의 표식(● 표제 · 출처 줄)은 더 이상 없다.
  expect(screen.queryByText('● 삼선개헌 반대 자료')).toBeNull()
  expect(screen.queryByText(/^출처/)).toBeNull()
})

test('공유 열람에는 안내를 붙이지 않는다 — 애초에 부르지 않는 정상 경로다', async () => {
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: PROJECT_DOC })
  renderViewer({ projectId: 'p1' })
  await screen.findByText('1960년대 - 전환의 시작')

  expect(getOutputTimeline).not.toHaveBeenCalled()
  expect(document.querySelector('.timeline_notice')).toBeNull()
})

test('공유 열람에서 유물명은 클릭 대상이 아니다 — 서버에 프로젝트 경유 연표 짝이 없다', async () => {
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: PROJECT_DOC })
  renderViewer({ projectId: 'p1' })
  await screen.findByText('1960년대 - 전환의 시작')

  expect(screen.queryByRole('button', { name: '삼선개헌 반대 자료' })).toBeNull()
  // `matched_by` 가 doc 에 없다 — 그래서 「추정」도 「못 누르는 사유」도 없다.
  // 무엇으로 맞췄는지는 유물 조회를 해야 알 수 있고 여기엔 그 조회가 없다.
  expect(screen.queryByText(/추정/)).toBeNull()
  expect(screen.queryByText(/연표를 열 수 없습니다/)).toBeNull()
})

test('공유 열람의 유물명은 출처 줄 첫 마디다 — 「·」 든 이름이 안 잘린다', async () => {
  // 서버 `timeline_edit.artifact_name` 과 **같은 규칙**이어야 하는 자리다.
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: MIDDOT_DOC })
  renderViewer({ projectId: 'p1' })

  expect(await screen.findByText('숟가락·젓가락')).toBeInTheDocument()
  expect(screen.queryByText('숟가락')).toBeNull()
})

test('공유 열람의 복사 평문도 새 층이다 — 화면과 갈리지 않는다', async () => {
  const writeText = vi.fn().mockResolvedValue()
  Object.assign(navigator, { clipboard: { writeText } })
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: MIDDOT_DOC })
  renderViewer({ projectId: 'p1' })
  await screen.findByText('숟가락·젓가락')

  fireEvent.click(screen.getByRole('button', { name: '내부 텍스트 복사' }))

  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const text = writeText.mock.calls[0][0]
  expect(text).toContain('유물명  숟가락·젓가락')
  // 새 층에는 「출처」 줄이 없다 — 옛 평문이 남아 있으면 화면과 다른 것을 말한다.
  expect(text).not.toContain('출처  ')
})

test('attached·제목 맵이 없는 옛 doc 도 공유 열람에서 새 층으로 그린다', async () => {
  // 소유자 경로의 `build_view` 가 옛 doc 을 가리지 않고 새 층으로 주므로, 여기만
  // 다른 기준을 두지 않는다. 없는 값은 빈 리스트·빈 문자열로 떨어진다.
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: DOC })
  renderViewer({ projectId: 'p1' })

  expect(await screen.findByText('삼선개헌 반대 자료')).toBeInTheDocument()
  expect(screen.getByText('사건명')).toBeInTheDocument()
  expect(screen.queryByText('● 삼선개헌 반대 자료')).toBeNull()
})

test('decades 가 비어도 옛 표 렌더로 떨어진다', async () => {
  getOutputTimeline.mockResolvedValue({ ok: true, data: { version: 1, edited: false, decades: [] } })
  renderViewer()
  expect(await screen.findByText('● 삼선개헌 반대 자료')).toBeInTheDocument()
})

test('공유 열람(projectId)에서는 /timeline 을 부르지 않는다 — 서버에 그 라우트가 없다', async () => {
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: PROJECT_DOC })
  renderViewer({ projectId: 'p1' })
  await screen.findByText('1960년대 - 전환의 시작')
  expect(getOutputTimeline).not.toHaveBeenCalled()
})

test('설명문이 아니면 /timeline 을 부르지 않는다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true, data: { kind: 'exhibit', columns: ['자료명'], rows: [['가']] },
  })
  render(
    <ToastProvider><OutputViewer outputId="o1" kind="exhibit" /></ToastProvider>,
  )
  await screen.findByText('가')
  expect(getOutputTimeline).not.toHaveBeenCalled()
})

test('복사용 평문이 새 층을 그대로 훑는다 — 화면과 갈리지 않는다', async () => {
  const writeText = vi.fn().mockResolvedValue()
  Object.assign(navigator, { clipboard: { writeText } })
  renderViewer()
  await screen.findByText('1960년대 - 전환의 시작')

  fireEvent.click(screen.getByRole('button', { name: '내부 텍스트 복사' }))

  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const text = writeText.mock.calls[0][0]
  expect(text).toContain('1960년대 - 전환의 시작')
  expect(text).toContain('1969년')
  expect(text).toContain('그 해의 기록')
  expect(text).toContain('12.27 연표참고하여 사건명')
  expect(text).toContain('유물명  삼선개헌 반대 자료')
  expect(text).toContain('배경: 박정희 3선 연임을 위해 헌법 개정 시도.')
  // 새 층에는 「출처」 줄이 없다(유물명이 그 자리를 대신한다) — 옛 평문이
  // 남아 있으면 복사한 글이 화면과 다른 것을 말한다.
  expect(text).not.toContain('출처  ')
})
