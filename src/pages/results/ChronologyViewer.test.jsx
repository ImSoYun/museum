// 이 파일의 책임: 「대한민국사 원문 뷰어」(round11a task-10) — 피그마 988:7897.
//
// 여기서 잠그는 것 여섯:
//   ① 툴바가 시안 그대로다(제목 · ↓↑ · 세로/1:1/가로 맞춤 · +/배율/− · N/M)
//      — 좌측에만 있는 `✏ 수정`·프린터·텍스트 복사는 **없다**
//   ② 쪽 넘기기는 **본문 쪽 목록 안에서만** 오간다(+1 씩 세지 않는다) · 양 끝 비활성
//   ③ 스캔 이미지가 없으면(204·로드 실패) 그 자리에 사유를 적는다 — 침묵 금지
//   ④ 사건 `bbox`(0.0~1.0 정규화)가 % 로 놓여 이미지와 같은 배율로 따라 움직인다
//   ⑤ **보기 모드**(onEventPick 없음)에서 사건 영역은 클릭 대상이 아니다
//   ⑥ `notice` 가 있으면 이미지 대신 그 안내만 그린다(빈 화면이 아니다)
import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../../lib/chronologyApi.js', () => ({
  getVolumePages: vi.fn(),
  getPageEvents: vi.fn(),
  pageImageUrl: (vol, page) => `/api/chronology/pages/${vol}/${page}/image`,
}))

const { getVolumePages, getPageEvents } = await import('../../lib/chronologyApi.js')
const { default: ChronologyViewer } = await import('./ChronologyViewer.jsx')

// 1권의 본문 쪽 목록 — **연속이 아니다.** 사진·표지 쪽이 빠져 있어(spec §1.6)
// 「지금 쪽 + 1」로 세면 41 다음이 42(표지)로 떨어진다. 이 픽스처의 구멍이
// 그 결함을 시험에서 실제로 드러나게 한다.
const PAGES = [12, 41, 57]

const EVENT = {
  id: 7, vol: 1, page: 41, seq: 0, year: 1952, month: 11, day: 27,
  text: '이승만 대통령, 타이완 방문', bbox: [0.1, 0.25, 0.6, 0.3],
}

beforeEach(() => {
  vi.clearAllMocks()
  getVolumePages.mockResolvedValue({ ok: true, data: { pages: PAGES } })
  getPageEvents.mockResolvedValue({ ok: true, data: { events: [EVENT] } })
})

/** 뷰어를 그리고 쪽 목록·사건이 도착할 때까지 기다린다. */
async function renderViewer(props = {}) {
  const view = render(<ChronologyViewer vol={1} page={41} {...props} />)
  await waitFor(() => expect(getVolumePages).toHaveBeenCalled())
  return view
}

/**
 * jsdom 에는 레이아웃이 없어 `clientWidth`·`naturalWidth` 가 **전부 0** 이다 —
 * 그래서 맞춤 버튼이 아무 일도 안 해도 「CSS 변수만 보는」 시험은 통과한다
 * (리뷰 HIGH-2 가 정확히 그 구멍을 지적했다). 맞춤이 **무엇을 재는가**를
 * 시험하려면 그 네 값을 직접 심어야 한다.
 *
 * 기본값은 실제 조건이다 — 패널 740px 에서 세로 스크롤바 자리를 뺀 725px
 * (`scrollbar-gutter: stable`, 브라우저 실측) · 높이 660px(시안) ·
 * 연표 스캔 원본 2194×3042(spec §3 「쪽마다 JPEG 한 장(2194×3042 · 2262×3144)」).
 */
function stubLayout(container, { panelW = 725, panelH = 660, imgW = 2194, imgH = 3042 } = {}) {
  const main = container.querySelector('.chronology_main')
  const img = container.querySelector('.chronology_page_img')
  Object.defineProperty(main, 'clientWidth', { value: panelW, configurable: true })
  Object.defineProperty(main, 'clientHeight', { value: panelH, configurable: true })
  Object.defineProperty(img, 'naturalWidth', { value: imgW, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: imgH, configurable: true })
  return { main, img }
}

const zoomOf = (container) =>
  container.querySelector('.chronology_page').style.getPropertyValue('--chrono-zoom')

test('제목은 「대한민국사 원문 뷰어」다', async () => {
  await renderViewer()
  expect(screen.getByText('대한민국사 원문 뷰어')).toBeInTheDocument()
})

test('좌측 전용 버튼(수정·인쇄·텍스트 복사)은 이 툴바에 없다', async () => {
  await renderViewer()
  expect(screen.queryByRole('button', { name: /수정/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /인쇄/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /복사/ })).toBeNull()
})

test('맞춤 3종(세로·1:1·가로)과 배율 +/− 가 있다', async () => {
  await renderViewer()
  expect(screen.getByRole('button', { name: '세로 맞춤' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '실제 크기' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '가로 맞춤' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '확대' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '축소' })).toBeInTheDocument()
})

test('N / M 은 「목록 안 몇 번째 / 전체 몇 쪽」이다', async () => {
  await renderViewer({ page: 41 })
  // 41 은 [12,41,57] 의 둘째다 — 쪽 번호(41)가 아니라 **차례**를 적는다.
  await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument())
})

test('쪽 넘기기는 본문 쪽 목록 안에서만 움직인다 — +1 이 아니다', async () => {
  const onPageChange = vi.fn()
  await renderViewer({ page: 41, onPageChange })
  await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
  expect(onPageChange).toHaveBeenCalledWith(57)

  fireEvent.click(screen.getByRole('button', { name: '이전 쪽' }))
  expect(onPageChange).toHaveBeenCalledWith(12)
})

test('목록의 첫 쪽에서는 「이전 쪽」이 비활성이다', async () => {
  await renderViewer({ page: 12 })
  await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: '이전 쪽' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '다음 쪽' })).not.toBeDisabled()
})

test('목록의 마지막 쪽에서는 「다음 쪽」이 비활성이다', async () => {
  await renderViewer({ page: 57 })
  await waitFor(() => expect(screen.getByText('3 / 3')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '이전 쪽' })).not.toBeDisabled()
})

test('스캔 이미지를 못 받으면(204·로드 실패) 그 자리에 사유를 적는다', async () => {
  const { container } = await renderViewer()
  const img = container.querySelector('.chronology_page_img')
  // 204 는 본문이 없어 브라우저가 디코드에 실패하고 error 이벤트를 낸다
  // (jsdom 은 이미지를 실제로 받지 않으므로 그 이벤트를 직접 낸다).
  fireEvent.error(img)
  expect(await screen.findByText('이 쪽의 스캔 이미지가 없습니다')).toBeInTheDocument()
})

test('사건 bbox 는 정규화 좌표 그대로 % 로 놓인다', async () => {
  const { container } = await renderViewer()
  const box = await waitFor(() => {
    const el = container.querySelector('[data-event-id="7"]')
    expect(el).not.toBeNull()
    return el
  })
  // [0.1, 0.25, 0.6, 0.3] → left 10% · top 25% · width 50% · height 5%
  expect(box.style.left).toBe('10%')
  expect(box.style.top).toBe('25%')
  expect(box.style.width).toBe('50%')
  expect(box.style.height).toBe('5%')
})

test('배율은 --chrono-zoom 변수로 나간다 — 오버레이가 이미지와 함께 커진다', async () => {
  const { container } = await renderViewer()
  const scaler = container.querySelector('.chronology_page')
  expect(scaler.style.getPropertyValue('--chrono-zoom')).toBe('1')
  // 오버레이가 이 래퍼 **안**에 있어야 배율이 같이 걸린다 — 형제로 두면
  // 확대했을 때 상자만 제자리에 남는다.
  expect(scaler.querySelector('[data-event-id="7"]')).not.toBeNull()

  fireEvent.click(screen.getByRole('button', { name: '확대' }))
  await waitFor(() =>
    expect(scaler.style.getPropertyValue('--chrono-zoom')).toBe('1.1'))
  // 단위가 붙으면 zoom 이 무효가 된다(좌측 뷰어의 --doc-zoom 과 같은 규율).
  expect(scaler.getAttribute('style')).not.toMatch(/--chrono-zoom:[^;]*px/)
})

// ─── 맞춤 3종이 **실제로 크기를 바꾸는가**(리뷰 HIGH-2) ─────────────────────
//
// 예전 구현은 맞춤을 CSS 폭(`width:100%` / `fit-content` + `height:100%`)으로
// 했는데, 래퍼에 `zoom` 이 걸려 있어 퍼센트 폭이 **줌 걸리기 전 부모 기준**으로
// 풀린 뒤 다시 줌이 걸렸다 — 렌더 폭이 늘 패널 폭 그대로였다(브라우저 실측:
// 50%·100%·200% 에서 전부 725.00px). 세로 맞춤의 `height:100%` 는 조상에 확정
// 높이가 없어 `auto` 로 풀려 **1:1 과 같은 결과**(2194×3042)를 냈다.
//
// 그래서 좌측 뷰어(`fitWidth`)와 **같은 결**로 바꿨다 — 래퍼는 늘 `max-content`
// (= 이미지 상자와 같은 크기, 오버레이 전제)이고 맞춤은 **배율을 재서** 정한다.
test('가로 맞춤은 패널 폭 ÷ 원본 폭을 배율로 삼는다 — 버튼이 실제로 크기를 바꾼다', async () => {
  const { container } = await renderViewer()
  const { img } = stubLayout(container)

  fireEvent.click(screen.getByRole('button', { name: '가로 맞춤' }))

  // 725 / 2194 = 0.3304… → 넘치지 않게 내림해 33%.
  await waitFor(() => expect(zoomOf(container)).toBe('0.33'))
  expect(img).toBeInTheDocument()
})

test('세로 맞춤은 패널 높이 ÷ 원본 높이다 — 1:1 과 같은 값이 아니다', async () => {
  const { container } = await renderViewer()
  stubLayout(container)

  fireEvent.click(screen.getByRole('button', { name: '세로 맞춤' }))
  // 660 / 3042 = 0.2169… → 21%.
  await waitFor(() => expect(zoomOf(container)).toBe('0.21'))

  fireEvent.click(screen.getByRole('button', { name: '실제 크기' }))
  await waitFor(() => expect(zoomOf(container)).toBe('1'))
})

test('맞춤 배율은 좌측 뷰어의 50% 바닥에 걸리지 않는다 — 걸리면 맞춤이 안 맞는다', async () => {
  // 실제 스캔 원본(2194×3042)은 가로 33%·세로 21% 가 있어야 들어온다. 바닥이
  // 50% 면 두 버튼 다 「눌러도 넘치는」 상태가 된다(브라우저 실측).
  const { container } = await renderViewer()
  stubLayout(container)

  fireEvent.click(screen.getByRole('button', { name: '세로 맞춤' }))
  await waitFor(() => expect(Number(zoomOf(container))).toBeLessThan(0.5))
})

test('이미지가 늦게 도착해도 기본 가로 맞춤이 그때 걸린다', async () => {
  // 원본 크기는 **로드된 뒤에야** 알 수 있다(naturalWidth 는 그 전까지 0).
  // 로드 때 다시 재지 않으면 첫 화면이 영영 100% 로 남는다.
  const { container } = await renderViewer()
  const { img } = stubLayout(container)
  expect(zoomOf(container)).toBe('1')

  fireEvent.load(img)

  await waitFor(() => expect(zoomOf(container)).toBe('0.33'))
})

test('원본 크기를 모르면(레이아웃 없음) 100% 로 떨어진다 — 0 으로 나누지 않는다', async () => {
  const { container } = await renderViewer()
  fireEvent.click(screen.getByRole('button', { name: '가로 맞춤' }))
  await waitFor(() => expect(zoomOf(container)).toBe('1'))
})

// ─── 지워도 안 빨개지던 갈래들(재리뷰 LOW-9·LOW-10) ────────────────────────
//
// 아래 넷은 구현을 지우거나 틀리게 바꿔도 시험이 초록이던 자리다.
//   · `setImageMissing(false)`  지우면 이미지 없는 쪽을 **한 번** 만난 뒤 모든
//     쪽이 「스캔 이미지가 없습니다」로 굳는다 — 가장 나쁜 갈래다
//   · 배율 +/− 의 상·하한  숫자만 바뀌고 실제로 안 줄거나 바닥을 뚫어도 몰랐다
//   · `!vol || !page` 안내  빈 화면과 구별되지 않았다
// 그리고 LOW-10 — **손으로 배율을 바꾸면 맞춤이 풀린다**(안 풀면 맞춤 버튼이
// 눌린 채 남고, 쪽을 넘길 때 `onImageLoad` 가 사용자의 배율을 조용히 덮는다).

const IMAGE_MISSING_TEXT = '이 쪽의 스캔 이미지가 없습니다'

test('쪽을 넘기면 「이미지 없음」이 풀린다 — 한 번 실패한 뒤 모든 쪽이 그 안내로 굳지 않는다', async () => {
  const { container, rerender } = await renderViewer()
  fireEvent.error(container.querySelector('.chronology_page_img'))
  expect(await screen.findByText(IMAGE_MISSING_TEXT)).toBeInTheDocument()

  rerender(<ChronologyViewer vol={1} page={57} />)

  await waitFor(() => expect(screen.queryByText(IMAGE_MISSING_TEXT)).toBeNull())
  // 안내가 사라진 자리에 다음 쪽 이미지가 실제로 돌아온다.
  expect(container.querySelector('.chronology_page_img')).not.toBeNull()
})

test('축소는 실제로 줄고 10% 아래로 내려가지 않는다', async () => {
  // 바닥이 10% 인 이유는 ZOOM_MIN 주석에 있다 — 2262×3144 스캔을 740px 패널에
  // 넣으려면 세로 맞춤이 21% 라, 좌측 뷰어의 50% 바닥을 쓰면 맞춤이 안 맞는다.
  const { container } = await renderViewer()
  const minus = screen.getByRole('button', { name: '축소' })

  fireEvent.click(minus)
  await waitFor(() => expect(zoomOf(container)).toBe('0.9'))

  for (let i = 0; i < 20; i += 1) fireEvent.click(minus)
  await waitFor(() => expect(zoomOf(container)).toBe('0.1'))
  expect(screen.getByText('10%')).toBeInTheDocument()
})

test('확대는 실제로 늘고 200% 를 넘지 않는다', async () => {
  const { container } = await renderViewer()
  const plus = screen.getByRole('button', { name: '확대' })

  fireEvent.click(plus)
  await waitFor(() => expect(zoomOf(container)).toBe('1.1'))

  for (let i = 0; i < 20; i += 1) fireEvent.click(plus)
  await waitFor(() => expect(zoomOf(container)).toBe('2'))
  expect(screen.getByText('200%')).toBeInTheDocument()
})

test('볼 쪽이 정해지지 않았으면 그 사유를 적는다 — 빈 화면이 아니다', async () => {
  render(<ChronologyViewer />)

  expect(screen.getByText('연표에서 볼 쪽이 정해지지 않았습니다')).toBeInTheDocument()
  // 부를 vol 이 없으므로 아무것도 조회하지 않는다.
  expect(getVolumePages).not.toHaveBeenCalled()
  expect(getPageEvents).not.toHaveBeenCalled()
})

test('손으로 배율을 바꾸면 맞춤이 풀린다 — 「가로 맞춤」이 눌린 채 남지 않는다', async () => {
  await renderViewer()
  const fitWidth = screen.getByRole('button', { name: '가로 맞춤' })
  expect(fitWidth).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByRole('button', { name: '축소' }))

  expect(fitWidth).toHaveAttribute('aria-pressed', 'false')
})

test('손으로 정한 배율은 쪽을 넘겨도 조용히 덮이지 않는다', async () => {
  // 쪽을 넘기면 새 이미지가 도착하고 `onImageLoad` 가 다시 잰다 — 맞춤이 안
  // 풀려 있으면 그 순간 사용자의 배율이 말없이 맞춤 값(여기선 33%)으로 돌아갔다.
  const { container } = await renderViewer()
  const { img } = stubLayout(container)
  fireEvent.click(screen.getByRole('button', { name: '축소' }))
  await waitFor(() => expect(zoomOf(container)).toBe('0.9'))

  fireEvent.load(img)

  expect(zoomOf(container)).toBe('0.9')
})

test('맞춤이 켜져 있으면 이미지가 도착할 때 다시 잰다 — 대조군', async () => {
  const { container } = await renderViewer()
  const { img } = stubLayout(container)
  fireEvent.click(screen.getByRole('button', { name: '축소' }))
  fireEvent.click(screen.getByRole('button', { name: '가로 맞춤' }))

  fireEvent.load(img)

  await waitFor(() => expect(zoomOf(container)).toBe('0.33'))
})

test('보기 모드(onEventPick 없음)에서 사건 영역은 클릭 대상이 아니다', async () => {
  const { container } = await renderViewer()
  const box = await waitFor(() => {
    const el = container.querySelector('[data-event-id="7"]')
    expect(el).not.toBeNull()
    return el
  })
  // 버튼도 아니고, 커서·포커스도 주지 않는다(브리프 ② — 붙이기는 task-11 몫).
  expect(box.tagName).not.toBe('BUTTON')
  expect(box).not.toHaveAttribute('tabindex')
  expect(screen.queryByRole('button', { name: /이승만 대통령/ })).toBeNull()
})

test('onEventPick 이 있으면 사건 영역이 버튼이 되어 그 사건을 넘긴다', async () => {
  const onEventPick = vi.fn()
  await renderViewer({ onEventPick })
  const btn = await screen.findByRole('button', { name: /이승만 대통령, 타이완 방문/ })
  fireEvent.click(btn)
  expect(onEventPick).toHaveBeenCalledWith(EVENT)
})

test('notice 가 있으면 이미지 대신 그 안내만 그린다', async () => {
  const { container } = render(
    <ChronologyViewer vol={null} page={null} notice="연표에 없는 시대입니다" />,
  )
  expect(screen.getByText('연표에 없는 시대입니다')).toBeInTheDocument()
  expect(container.querySelector('.chronology_page_img')).toBeNull()
  // 안내만 띄우는 동안에도 뷰어는 떠 있다(빈 화면이 아니다).
  expect(screen.getByText('대한민국사 원문 뷰어')).toBeInTheDocument()
  // 쪽이 없으므로 조회도 하지 않는다 — 부를 vol 이 없다.
  expect(getVolumePages).not.toHaveBeenCalled()
})

test('쪽 목록 조회가 실패하면 사유를 적는다 — 조용히 비우지 않는다', async () => {
  getVolumePages.mockResolvedValue({ ok: false, notice: '연표 쪽 목록을 불러오지 못했습니다' })
  await renderViewer()
  expect(await screen.findByText('연표 쪽 목록을 불러오지 못했습니다')).toBeInTheDocument()
})

test('사건 조회가 실패하면 사유를 적는다 — 오버레이만 조용히 사라지지 않는다', async () => {
  getPageEvents.mockResolvedValue({ ok: false, notice: '연표 사건을 불러오지 못했습니다' })
  await renderViewer()
  expect(await screen.findByText('연표 사건을 불러오지 못했습니다')).toBeInTheDocument()
})

test('쪽이 바뀌면 그 쪽의 사건을 다시 읽는다', async () => {
  const { rerender } = await renderViewer({ page: 41 })
  await waitFor(() => expect(getPageEvents).toHaveBeenCalledWith(1, 41))
  rerender(<ChronologyViewer vol={1} page={57} />)
  await waitFor(() => expect(getPageEvents).toHaveBeenCalledWith(1, 57))
})

test('권이 바뀌면 쪽 목록부터 비운다 — 1권 쪽 번호로 2권을 넘기지 않는다', async () => {
  const onPageChange = vi.fn()
  const { rerender } = await renderViewer({ vol: 1, page: 41, onPageChange })
  await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument())

  // 2권 목록이 아직 안 온 **전환 창**을 만든다. 여기서 옛 목록이 남아 있으면
  // 「다음 쪽」이 1권의 57 쪽을 2권 쪽 번호로 내보내고 `N / M` 도 틀린다
  // (사건 쪽 이펙트는 새 조회 전에 setEvents([]) 로 지우는데 쪽 목록만 안 지웠다).
  getVolumePages.mockImplementation(() => new Promise(() => {}))
  rerender(<ChronologyViewer vol={2} page={41} onPageChange={onPageChange} />)

  await waitFor(() => expect(screen.getByText('- / -')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '이전 쪽' })).toBeDisabled()
  expect(onPageChange).not.toHaveBeenCalled()
})
