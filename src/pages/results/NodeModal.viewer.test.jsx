// 이 파일의 책임: NodeModal 원문 뷰어(디스크립션 4·4-2·4-3·4-4·4-5).
//
// 자료당 이미지가 정확히 1장이고 PDF 는 0건이다(MinIO 실측 58,837건 전부 jpg).
// 그래서 페이지 개념에 딸린 것(↑↓·인쇄)은 자리만 두고 토스트이고, 이미지 하나에
// 적용되는 것(확대축소·화면맞춤·다운로드)은 실제로 동작한다.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const fetchArtifactDetail = vi.fn()
const downloadArtifactImage = vi.fn()
const triggerBrowserDownload = vi.fn()
vi.mock('../../lib/searchApi.js', () => ({
  isLive: () => true,
  fetchArtifactDetail: (...a) => fetchArtifactDetail(...a),
  downloadArtifactImage: (...a) => downloadArtifactImage(...a),
  toAbsolute: (u) => u,
}))
vi.mock('../../lib/downloadFile.js', () => ({
  triggerBrowserDownload: (...a) => triggerBrowserDownload(...a),
}))

const { default: NodeModal } = await import('./NodeModal.jsx')
const { ToastProvider } = await import('../../components/Toast.jsx')

const NODE = { id: 'n1', label: '민주화운동', count: 1, group: 'subject' }
const ITEMS = [{ id: 'a', title: '광주민주화운동 군인', type: '사진', image: '/images/a' }]

function renderModal() {
  return render(
    <ToastProvider>
      <NodeModal node={NODE} items={ITEMS} onClose={() => {}} onConfirm={() => {}} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchArtifactDetail.mockResolvedValue({
    ok: true,
    detail: { idnbr: 'a', name: '광주민주화운동 군인', image_url: '/images/a', is_public: true },
  })
})

describe('중앙 이미지 (4)', () => {
  it('조회한 이미지를 그린다', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByAltText(/광주민주화운동 군인/)).toHaveAttribute('src', '/images/a'))
  })
})

describe('페이지 표시 (4-5) — 자료당 1장', () => {
  it('1 / 1 로 나온다', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument())
  })
})

describe('확대/축소 (4-3) — 20% 단위', () => {
  it('+ 를 누르면 120% 가 된다', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    fireEvent.click(screen.getByRole('button', { name: '확대' }))
    expect(screen.getByText('120%')).toBeInTheDocument()
  })

  it('- 를 누르면 80% 가 된다', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    fireEvent.click(screen.getByRole('button', { name: '축소' }))
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('20% 아래로는 내려가지 않는다', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    for (let i = 0; i < 10; i += 1) fireEvent.click(screen.getByRole('button', { name: '축소' }))
    expect(screen.getByText('20%')).toBeInTheDocument()
  })
})

// 회귀 테스트 — 리뷰 Critical: 이식 CSS(component.css)의
// .node_detail_viewer_preview_img { max-width:100%; max-height:100% } 가 인라인
// width 를 100%로 계속 clamp 해, 100% 를 넘는 확대가 화면에 전혀 반영되지 않던
// 문제. jsdom 은 실제 레이아웃(렌더 픽셀)을 계산하지 않으므로 픽셀 폭 대신
// 인라인 style 객체 자체를 단언해 같은 실수가 다시 들어오는 것을 막는다.
//
// flexShrink:0 도 함께 단언한다 — 실브라우저 격리 하네스 실측에서, max-width만
// 풀면(1차 수정) 100%를 살짝만 넘어도 부모(.node_detail_viewer_preview, display:flex)
// 의 "플렉스 아이템 자동 최소 크기"가 원본 이미지 픽셀 크기로 다시 floor를 걸어
// 200%·400%가 전부 같은 크기로 멈추는 2차 문제가 있었다(jsdom은 레이아웃을 안 하니
// 이 floor도 못 잡는다 — 그래서 스타일 값 자체를 단언해 둔다).
describe('확대 시 클램프 해제 (회귀 — 100% 초과에서도 실제로 커져야 한다)', () => {
  it('100% 에서는 max-width/max-height 100% 클램프가 그대로 산다(퍼블 CSS에 위임)', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    const img = screen.getByAltText(/광주민주화운동 군인/)
    expect(img.style.width).toBe('100%')
    // 인라인으로 덮어쓰지 않는다 — 이식 CSS의 클래스 규칙이 그대로 적용되게 둔다.
    expect(img.style.maxWidth).not.toBe('none')
    expect(img.style.maxHeight).not.toBe('none')
    expect(img.style.flexShrink).toBe('0')
  })

  it('120% 로 확대하면 인라인 클램프 해제가 걸린다', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    fireEvent.click(screen.getByRole('button', { name: '확대' }))
    const img = screen.getByAltText(/광주민주화운동 군인/)
    expect(img.style.width).toBe('120%')
    expect(img.style.maxWidth).toBe('none')
    expect(img.style.maxHeight).toBe('none')
    expect(img.style.flexShrink).toBe('0')
  })

  it('상한 400% 에서도 요청한 배율 그대로 style.width 에 반영된다', async () => {
    // jsdom은 실제 레이아웃(플렉스 자동 최소 크기 등)을 계산하지 않으므로 이 테스트가
    // "화면에서 진짜 더 커지는지"까지 보증하진 못한다(그건 브라우저 실측으로 확인했다
    // — task-7-report.md 참고). 여기서 보증하는 건 React 쪽 배선: 최고 배율(400%)까지
    // 밀어붙여도 style.width 문자열 자체가 매 클릭 요청값 그대로 올라가고, 클램프 해제
    // 관련 인라인 속성(maxWidth/maxHeight/flexShrink)이 함께 살아있는지다.
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    for (let i = 0; i < 15; i += 1) fireEvent.click(screen.getByRole('button', { name: '확대' }))
    const img = screen.getByAltText(/광주민주화운동 군인/)
    expect(screen.getByText('400%')).toBeInTheDocument()
    expect(img.style.width).toBe('400%')
    expect(img.style.maxWidth).toBe('none')
    expect(img.style.maxHeight).toBe('none')
    expect(img.style.flexShrink).toBe('0')
  })

  it('80% 로 축소하면 클램프 해제를 걸지 않는다(넘칠 일이 없다)', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    fireEvent.click(screen.getByRole('button', { name: '축소' }))
    const img = screen.getByAltText(/광주민주화운동 군인/)
    expect(img.style.width).toBe('80%')
    expect(img.style.maxWidth).not.toBe('none')
    expect(img.style.flexShrink).toBe('0')
  })

  it('확대 후 원본 크기(1:1)로 되돌리면 클램프 해제도 함께 풀린다', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    fireEvent.click(screen.getByRole('button', { name: '확대' }))
    fireEvent.click(screen.getByRole('button', { name: '원본 크기' }))
    const img = screen.getByAltText(/광주민주화운동 군인/)
    expect(img.style.width).toBe('100%')
    expect(img.style.maxWidth).not.toBe('none')
    expect(img.style.maxHeight).not.toBe('none')
  })
})

describe('화면 맞춤 (4-2)', () => {
  it('1:1 을 누르면 100% 로 돌아온다', async () => {
    renderModal()
    await waitFor(() => screen.getByText('100%'))
    fireEvent.click(screen.getByRole('button', { name: '확대' }))
    fireEvent.click(screen.getByRole('button', { name: '원본 크기' }))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})

describe('다운로드 (4-4) — 실동작', () => {
  it('성공하면 브라우저 저장을 부른다', async () => {
    const blob = new Blob(['x'])
    downloadArtifactImage.mockResolvedValue({ ok: true, blob, filename: 'a.jpg' })
    renderModal()
    await waitFor(() => screen.getByRole('button', { name: '다운로드' }))
    fireEvent.click(screen.getByRole('button', { name: '다운로드' }))
    await waitFor(() => expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, 'a.jpg'))
  })

  it('실패는 사유를 토스트로 알린다 — 0바이트를 저장하지 않는다', async () => {
    downloadArtifactImage.mockResolvedValue({ ok: false, notice: '이미지가 없는 자료입니다' })
    renderModal()
    await waitFor(() => screen.getByRole('button', { name: '다운로드' }))
    fireEvent.click(screen.getByRole('button', { name: '다운로드' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('이미지가 없는 자료입니다'))
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })
})

describe('데이터 없는 기능 — 준비 중입니다', () => {
  it.each([['앞 페이지'], ['뒷 페이지'], ['인쇄'], ['번역']])('%s', async (name) => {
    renderModal()
    await waitFor(() => screen.getByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  })
})
