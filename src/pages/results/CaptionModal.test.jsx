// 이 파일의 책임: 산출물생성 페이지의 설명문 생성 모달.
//
// round07g — 이 모달은 이제 **가운데만** 소유한다. 위(헤딩·부제)와 아래(타임라인·
// 버튼)는 CaptionModalShell 이, 제목 입력은 CaptionTitleField 가 그린다. 그래서 이
// 파일은 두 가지를 나눠 잠근다:
//
//   ① **공용 조각에서 온다는 사실** — 부제·타임라인 보조문구·제목 라벨. 조각을
//      고치면 이 파일과 ChatCaptionDecisionModal.test.jsx 가 **함께** 빨개져야 한다.
//   ② **이 화면만의 가운데 순서** — 선택 자료 → 구분선 → 제목 설정. 채팅은 순서가
//      반대이므로, 여기 순서를 채팅 순서로 바꾸면 **이 파일만** 빨개져야 한다.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CaptionModal from './CaptionModal.jsx'
import { MAX_CAPTION_ARTIFACTS } from './CaptionModalShell.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

const CHIPS = [{ nodeId: 'n1', label: '민주화운동', count: 12 }]

function renderModal(over = {}) {
  return render(
    <ToastProvider>
      <CaptionModal open chips={CHIPS} total={12} defaultTitle="민주화운동 설명문"
                    onClose={() => {}} onRemoveChip={() => {}}
                    onSubmit={() => {}} {...over} />
    </ToastProvider>,
  )
}

describe('설명문 생성 모달', () => {
  // ── ① 공용 조각에서 오는 것들 ─────────────────────────────────────────────
  // 채팅 모달의 짝 테스트가 같은 문구를 같은 방식으로 단언한다. 조각(뼈대·제목
  // 필드)을 고치면 두 파일이 함께 빨개진다 — 그것이 이 라운드가 사려는 성질이다.
  it('뼈대 문구를 공용 조각에서 받아 그린다 — 부제·타임라인 보조문구', () => {
    renderModal()
    expect(screen.getByText('설명문 생성')).toBeInTheDocument()
    expect(
      screen.getByText('설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.'),
    ).toBeInTheDocument()
    expect(screen.getByText('선택된 자료들로 타임라인이 생성됩니다.')).toBeInTheDocument()
  })

  it('제목 라벨·placeholder 를 공용 조각에서 받아 그린다', () => {
    renderModal()
    const input = screen.getByLabelText('제목 설정')
    expect(input).toHaveAttribute('placeholder', '설명문 타이틀')
  })

  // ── ② 이 화면만의 가운데 순서 ─────────────────────────────────────────────
  // 채팅은 제목이 먼저다. 두 프레임이 실제로 다르므로 각자 잠근다.
  it('가운데 순서는 선택 자료 → 제목 설정이다(채팅과 반대)', () => {
    renderModal()
    const html = document.body.innerHTML
    expect(html.indexOf('선택 자료')).toBeGreaterThan(-1)
    expect(html.indexOf('선택 자료')).toBeLessThan(html.indexOf('제목 설정'))
  })

  it('선택 자료와 제목 설정 사이에 구분선이 있다 — 채팅에는 없는 것이다', () => {
    renderModal()
    const divider = screen.getByRole('separator')
    const materials = screen.getByText('선택 자료')
    const titleLabel = screen.getByText('제목 설정')
    expect(materials.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
    expect(divider.compareDocumentPosition(titleLabel) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
  })

  // 「1. 선택 자료」식 번호는 피그마의 디스크립션 주석(빨간 원)이지 화면 글자가 아니다.
  it('섹션 라벨에 번호를 붙이지 않는다', () => {
    renderModal()
    expect(screen.getByText('선택 자료').textContent).toBe('선택 자료')
    expect(screen.queryByText(/^\d+\.\s/)).toBeNull()
  })

  // ── 사용자 결정 2026-09-03 — 설명문은 어디서 만들든 DOCX 다 ────────────────
  // 화면에서만 감춘 것이다. 서버 CreateOutputRequest.format 은 그대로이며,
  // 호출부(OutputTab)가 'docx' 를 보낸다. (round11a — 서버의 hwpx·pdf 렌더러는
  // 이제 없다. 이 시험이 보는 것은 「화면에 형식을 고를 자리가 없다」뿐이다.)
  it('파일 형식을 묻지 않는다', () => {
    renderModal()
    for (const t of ['DOCX', 'HWPX', 'PDF', '파일 형식'])
      expect(screen.queryByText(new RegExp(t))).toBeNull()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('onSubmit 은 제목과 타임라인만 올린다 — 형식은 화면이 정하지 않는다', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit).toHaveBeenCalledWith({ title: '민주화운동 설명문', timeline: false })
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('format')
  })

  it('타임라인 체크가 준비중 토스트를 띄우지 않는다 — round07e 가 해제한 것이다', () => {
    renderModal()
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    expect(screen.queryByText(/준비 중입니다/)).toBeNull()
  })

  it('타임라인 체크 상태가 요청에 실린다', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit.mock.calls[0][0].timeline).toBe(true)
  })

  it('자료가 0건이면 생성할 수 없다', () => {
    renderModal({ chips: [], total: 0 })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('제목이 비면 생성할 수 없다', () => {
    renderModal({ defaultTitle: '' })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('칩 ✕ 가 부모에 위임된다 — 병행 상태를 두지 않는다', () => {
    const onRemoveChip = vi.fn()
    renderModal({ onRemoveChip })
    fireEvent.click(screen.getByRole('button', { name: '민주화운동 선택 해제' }))
    expect(onRemoveChip).toHaveBeenCalledWith('n1')
  })
})

// ── ③ 실제로 담기는 건수(사용자 결정 2026-09-03) ────────────────────────────
// 이 라운드가 「선택한 자료 N건으로 만듭니다」 배너를 「피그마 프레임에 없다」는
// 이유로 뗐는데, 그 N 이 이 화면에서 **유일하게 정직한 숫자**였다. 뱃지 숫자는
// 노드별 건수라 합치면 두 노드에 걸친 자료가 두 번 세어진다(ADR-002 F-02) —
// 80 + 12 = 92 지만 실제로 담기는 것은 85건이다. 그 값은 부모(OutputTab)가
// `new Set(...).size` 로 세어 total 로 내려준다. 세는 곳이 둘이 되면 갈리므로
// 이 화면은 절대 chips[].count 를 더하지 않는다 — 아래가 그것을 잠근다.
describe('실제로 담기는 건수 — 뱃지 합이 아니다', () => {
  const DUP_CHIPS = [
    { nodeId: 'n1', label: '민주화운동', count: 80 },
    { nodeId: 'n2', label: '정치', count: 12 },
  ]
  // 7건이 두 노드에 동시에 걸려 있다 — 전시자료 모달 테스트와 같은 실측 예다.
  const DEDUPED_TOTAL = 85

  const renderDup = (over = {}) =>
    renderModal({ chips: DUP_CHIPS, total: DEDUPED_TOTAL, ...over })

  it('부모가 중복을 합쳐 센 건수를 말한다 — 뱃지 합(92)이 아니다', () => {
    renderDup()
    expect(screen.getByText('85건')).toBeInTheDocument()
    expect(screen.queryByText('92건')).toBeNull()
  })

  it('왜 뱃지 합과 다른지 화면에 드러난다 — 「80 + 12 인데 왜 85지?」', () => {
    renderDup()
    expect(screen.getByText(/중복 제외/)).toBeInTheDocument()
  })

  // 옛 배너는 구분선 아래 독립 블록이었다. 되살리되 프레임의 블록 순서(선택 자료 →
  // 구분선 → 제목 설정)는 건드리지 않는다 — 건수는 뱃지 줄 **끝**에 얹는다.
  it('건수는 뱃지 뒤·구분선 앞이다 — 독립 블록으로 되돌아가지 않는다', () => {
    renderDup()
    const count = screen.getByText('85건')
    const badge = screen.getByRole('button', { name: '민주화운동 자료 상세보기' })
    const divider = screen.getByRole('separator')
    expect(badge.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(count.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('자료가 없으면 건수를 말하지 않는다 — 그 자리는 「선택한 자료가 없습니다」다', () => {
    renderModal({ chips: [], total: 0 })
    expect(screen.queryByText(/0건/)).toBeNull()
    expect(screen.getByText(/선택한 자료가 없습니다/)).toBeInTheDocument()
  })
})

// ── 디스크립션 1 「더블 클릭 시 상세모달 오픈, 수정 가능」 ────────────────────
// 여는 길은 **이 화면이 이미 쓰는 것**이어야 한다 — 부모(OutputTab)가 selectedNode
// 를 세워 NodeModal 을 여는 그 길이다. 모달이 자기만의 상세 화면을 새로 내면 한
// 화면에서 자료를 여는 방법이 둘로 갈린다(round07f R1 Minor-3 가 같은 지적이었다).
// 그래서 이 모달은 스스로 무엇도 열지 않고 nodeId 를 부모에게 올린다.
describe('노드 뱃지 — 상세 열기(디스크립션 1)', () => {
  it('뱃지를 더블클릭하면 부모에게 그 노드 id 를 올린다', () => {
    const onOpenChip = vi.fn()
    renderModal({ onOpenChip })
    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    expect(onOpenChip).toHaveBeenCalledWith('n1')
  })

  // 더블클릭은 마우스 전용이다 — 키보드에도 같은 길을 낸다.
  it('뱃지에서 Enter·Space 도 같은 길로 연다', () => {
    const onOpenChip = vi.fn()
    renderModal({ onOpenChip })
    const badge = screen.getByRole('button', { name: '민주화운동 자료 상세보기' })
    fireEvent.keyDown(badge, { key: 'Enter' })
    fireEvent.keyDown(badge, { key: ' ' })
    expect(onOpenChip).toHaveBeenCalledTimes(2)
  })

  // ✕ 는 선택 해제이지 상세 열기가 아니다 — 뱃지 안에 있으므로 전파를 끊어야 한다.
  it('✕ 를 눌러도 상세가 열리지 않는다', () => {
    const onOpenChip = vi.fn()
    const onRemoveChip = vi.fn()
    renderModal({ onOpenChip, onRemoveChip })
    fireEvent.click(screen.getByRole('button', { name: '민주화운동 선택 해제' }))
    expect(onRemoveChip).toHaveBeenCalledWith('n1')
    expect(onOpenChip).not.toHaveBeenCalled()
  })

  it('모달이 스스로 상세를 그리지 않는다 — 여는 것은 부모의 몫이다', () => {
    renderModal({ onOpenChip: () => {} })
    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    // 이 모달 안에는 상세 화면이 없다. 부모가 NodeModal 을 여는 것으로 끝난다.
    expect(document.querySelector('.node_detail_modal')).toBeNull()
  })
})

// round07f 리뷰(Important 1) — 「타임라인 체크박스를 켜면 제목이 따라 바뀌되, 이미
// 고친 제목은 덮어쓰지 않는다」(spec §2 결정 4 · I10)는 이전 라운드에서 스크래치
// 테스트로만 검증하고 지웠다 — 저장소에는 아무도 이 규칙을 잠그지 않고 있었다.
// 리뷰어가 변이(제목 추종을 통째로 제거 / 항상 덮어쓰기)로 실증했다: 둘 다 기존
// 38테스트를 전부 통과시켰다. 아래가 그 구멍을 막는다.
//
// round07g — 규칙 자체는 이제 CaptionModalShell 의 useCaptionTitleRule 이 소유한다
// (채팅 모달과 **같은 규칙**이어야 하기 때문이다). 아래는 그 훅이 이 화면에 제대로
// 배선됐는지를 잠근다 — 동작은 한 줄도 바뀌지 않았다.
describe('타임라인 체크박스 — 제목 추종(round07f 결정 I10)', () => {
  it('제목이 기본값 상태에서 타임라인을 켜면 「설명문 캡션 + 타임라인_YYMMDD」로 바뀐다', () => {
    renderModal({ defaultTitle: defaultOutputTitle('caption') })
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    expect(screen.getByLabelText('제목 설정')).toHaveValue(
      defaultOutputTitle('caption', { timeline: true }),
    )
  })

  it('사용자가 제목을 고친 뒤 타임라인을 켜면 그 제목이 유지된다', () => {
    renderModal({ defaultTitle: defaultOutputTitle('caption') })
    fireEvent.change(screen.getByLabelText('제목 설정'), { target: { value: '나만의 제목' } })
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    expect(screen.getByLabelText('제목 설정')).toHaveValue('나만의 제목')
  })

  it('켰다 껐다 왕복해도 제목이 정확히 복원된다', () => {
    renderModal({ defaultTitle: defaultOutputTitle('caption') })
    const checkbox = screen.getByLabelText('타임라인 생성')
    fireEvent.click(checkbox) // on
    expect(screen.getByLabelText('제목 설정')).toHaveValue(
      defaultOutputTitle('caption', { timeline: true }),
    )
    fireEvent.click(checkbox) // off
    expect(screen.getByLabelText('제목 설정')).toHaveValue(defaultOutputTitle('caption'))
  })

  it('왕복 중간에 제목을 고치면 그 뒤로는 더는 따라오지 않는다', () => {
    renderModal({ defaultTitle: defaultOutputTitle('caption') })
    const checkbox = screen.getByLabelText('타임라인 생성')
    fireEvent.click(checkbox) // on → 기본값 + 타임라인으로 바뀐다
    fireEvent.change(screen.getByLabelText('제목 설정'), { target: { value: '학예사가 고친 제목' } })
    fireEvent.click(checkbox) // off — 이미 고쳤으니 건드리지 않아야 한다
    expect(screen.getByLabelText('제목 설정')).toHaveValue('학예사가 고친 제목')
  })

  // Minor 1 — 초기 제목은 defaultTitle **prop**에서 오는데, 예전 비교식은
  // defaultOutputTitle('caption')을 하드코딩으로 다시 계산해 두 진실 원천이 갈렸다.
  // 유일한 실제 호출자(OutputTab)가 정확히 그 값을 넘겨서 우연히 성립했을 뿐,
  // 다른 defaultTitle을 넘기면(바로 이 파일의 renderModal 기본값 "민주화운동 설명문"이
  // 그 예다) 규칙이 조용히 죽었다. 지금은 비교 기준이 defaultTitle 자체이므로,
  // 그 값이 정본 기본값과 다르더라도 추종 규칙이 여전히 작동해야 한다.
  it('전달받은 defaultTitle이 정본 기본값과 달라도(Minor 1) 추종 규칙이 그 값을 기준으로 작동한다', () => {
    renderModal({ defaultTitle: '민주화운동 설명문' })
    expect(screen.getByLabelText('제목 설정')).toHaveValue('민주화운동 설명문')
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    expect(screen.getByLabelText('제목 설정')).toHaveValue(
      defaultOutputTitle('caption', { timeline: true }),
    )
  })
})

// ── round10a T2-B 리뷰 Important — total이 CaptionModalShell까지 실제로 전달되는지 ──
// CaptionModalShell.test.jsx의 상한 시험은 total을 Shell에 **직접** 주입해 Shell
// 단독만 본다. OutputTab.test.jsx의 제출 흐름은 데모 노드 자료가 100건을 넘지
// 않아 이 경로를 태우지 못한다. 즉 CaptionModal.jsx의 `total={total}` 배선 한 줄이
// 지워져도 그 두 시험은 그대로 초록이었다 — 여기서 CaptionModal을 거쳐 실제로
// 잠기는지를 통합으로 확인해 그 회귀를 잡는다.
describe('설명문 자료 상한이 Shell까지 실제로 전달된다(round10a T2-B 리뷰 Important)', () => {
  it('total이 상한을 넘으면 CaptionModal을 거쳐도 생성하기가 잠긴다', () => {
    renderModal({ total: MAX_CAPTION_ARTIFACTS + 1 })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('total이 상한 이하면(대조군) 생성하기가 열려 있다', () => {
    renderModal({ total: MAX_CAPTION_ARTIFACTS })
    expect(screen.getByRole('button', { name: '생성하기' })).not.toBeDisabled()
  })
})
