// 이 파일의 책임: NodeModal(round07b-ext) — 퍼블 node_detail 레이아웃 + 실데이터.
//
// round07b 까지 이 모달의 우측은 DUMMY_META·DUMMY_BODY 상수였다. 왼쪽엔 진짜
// 자료, 오른쪽엔 「식별번호 2024-00000」이 나란히 있어 오해를 부르는 상태였다.
// 이 파일이 잠그는 것은 「보이는 값이 전부 조회된 값인가」다.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const fetchArtifactDetail = vi.fn()
vi.mock('../../lib/searchApi.js', () => ({
  isLive: () => true,
  fetchArtifactDetail: (...a) => fetchArtifactDetail(...a),
  toAbsolute: (u) => u,
}))

const { default: NodeModal } = await import('./NodeModal.jsx')
const { ToastProvider } = await import('../../components/Toast.jsx')
// C1 시험용 — 닫힌 NodeModal 이 다른 오버레이의 딤을 빼앗지 않는지 보려면 실제 소비처가 하나 필요하다.
const { default: Modal } = await import('../../components/Modal.jsx')

const NODE = { id: 'n1', label: '민주화운동', count: 2, group: 'subject' }
const ITEMS = [
  { id: 'a', title: '광주민주화운동 군인', type: '사진', image: '/images/a' },
  { id: 'b', title: '민중신문 제40호', type: '도서', image: null },
]

const DETAIL = {
  ok: true,
  detail: {
    idnbr: 'a', name: '광주민주화운동 군인', altrvnm: '광주 80년 5월',
    era: '1980.05', year_info: '1980년대', category: '정치행정-민주화운동',
    datadc: '5·18 당시 시민군 사진이다.', ocr_text: '光州80年5月',
    image_url: '/images/a', page_url: 'https://archives.example/a',
    is_public: true, subject: ['정치행정 > 민주화운동'],
  },
}

function renderModal(props = {}) {
  return render(
    <ToastProvider>
      <NodeModal node={NODE} items={ITEMS} onClose={() => {}} onConfirm={() => {}} {...props} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchArtifactDetail.mockResolvedValue(DETAIL)
})

describe('좌측 트리 (디스크립션 2·2-1·2-2)', () => {
  it('노드명이 제목이다', () => {
    renderModal()
    expect(screen.getByText('민주화운동')).toBeInTheDocument()
  })

  it('자료명이 원본 그대로 나온다', () => {
    renderModal()
    expect(screen.getByText('광주민주화운동 군인')).toBeInTheDocument()
    expect(screen.getByText('민중신문 제40호')).toBeInTheDocument()
  })

  it('전체 건수 라벨이 자료 수와 같다', () => {
    renderModal()
    expect(screen.getByText('전체').closest('*').textContent).toContain('2')
  })

  it('자료를 클릭하면 그 자료의 상세를 조회한다(2-2 선택시 우측 반영)', async () => {
    renderModal()
    fireEvent.click(screen.getByText('민중신문 제40호'))
    await waitFor(() => expect(fetchArtifactDetail).toHaveBeenCalledWith('b'))
  })
})

describe('우측 데이터 정보 — 전부 조회된 값이다', () => {
  it('메타정보가 더미가 아니라 조회 결과다', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText(/광주 80년 5월/)).toBeInTheDocument())
    expect(screen.queryByText(/2024-00000/)).toBeNull()
    expect(screen.queryByText(/sample_archive_document/)).toBeNull()
  })

  it('OCR 텍스트를 보여준다(5-2)', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText('光州80年5月')).toBeInTheDocument())
  })

  it('우리 필드를 함께 싣는다(시기·연도·분류·상세설명)', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText(/1980.05/)).toBeInTheDocument())
    expect(screen.getByText(/1980년대/)).toBeInTheDocument()
    expect(screen.getByText(/정치행정-민주화운동/)).toBeInTheDocument()
  })

  it('없는 필드는 행 자체가 없다(정렬순서·생산기관)', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText(/광주 80년 5월/)).toBeInTheDocument())
    expect(screen.queryByText('정렬순서')).toBeNull()
    expect(screen.queryByText('생산기관')).toBeNull()
  })
})

// 자료를 바꾸는 순간 우측이 **비워져야** 한다. 이전에는 이펙트가 detail 을 지우지
// 않고 .catch 도 없어서, 다음 자료를 부르는 동안(그리고 그 요청이 거절되면 영영)
// 방금 누른 행 아래에 직전 자료의 이름·뱃지·OCR·메타가 그대로 남았다 — 큐레이터가
// A 를 보면서 B 의 메타를 읽는 조용한 오독 사고다.
describe('자료 전환 시 이전 상세가 남지 않는다', () => {
  it('조회가 거절되면 직전 자료의 메타가 화면에서 사라진다', async () => {
    renderModal()
    // 첫 자료(a)의 상세가 실제로 그려진 것을 확인한 뒤에 전환한다 —
    // 그래야 "남아 있었는가"를 물을 수 있다.
    await waitFor(() => expect(screen.getByText(/광주 80년 5월/)).toBeInTheDocument())

    fetchArtifactDetail.mockRejectedValueOnce(new Error('network down'))
    fireEvent.click(screen.getByText('민중신문 제40호'))

    await waitFor(() => expect(screen.queryByText(/광주 80년 5월/)).toBeNull())
    expect(screen.queryByText('光州80年5月')).toBeNull()
    expect(screen.queryByText('공개')).toBeNull()
  })

  it('다음 자료를 기다리는 동안에도 직전 메타를 보여주지 않는다', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText(/광주 80년 5월/)).toBeInTheDocument())

    // 영영 resolve 되지 않는 조회 — "로딩 중" 창에서 화면이 무엇을 말하는지 본다.
    fetchArtifactDetail.mockReturnValueOnce(new Promise(() => {}))
    fireEvent.click(screen.getByText('민중신문 제40호'))

    await waitFor(() => expect(screen.queryByText(/광주 80년 5월/)).toBeNull())
  })
})

describe('공개/미공개 뱃지 (디스크립션 3)', () => {
  it('공개 자료는 공개로 표시된다', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByText('공개')).toBeInTheDocument())
  })

  it('비공개 자료는 미공개로 표시된다', async () => {
    fetchArtifactDetail.mockResolvedValue({
      ok: true, detail: { ...DETAIL.detail, is_public: false },
    })
    renderModal()
    await waitFor(() => expect(screen.getByText('미공개')).toBeInTheDocument())
  })

  it('값이 없으면 뱃지를 그리지 않는다', async () => {
    fetchArtifactDetail.mockResolvedValue({
      ok: true, detail: { ...DETAIL.detail, is_public: null },
    })
    renderModal()
    await waitFor(() => expect(screen.getByText(/광주 80년 5월/)).toBeInTheDocument())
    expect(screen.queryByText('공개')).toBeNull()
    expect(screen.queryByText('미공개')).toBeNull()
  })
})

describe('외부기관 링크 (디스크립션 3-1)', () => {
  it('page_url 로 새 창을 연다', async () => {
    renderModal()
    const link = await screen.findByRole('link')
    expect(link).toHaveAttribute('href', 'https://archives.example/a')
    expect(link).toHaveAttribute('target', '_blank')
  })
})

// round07b-ext — 「담기(체크)」와 「보기(이름 클릭)」를 갈랐다. 예전에는 자료명이
// form_check_label 안에 있어 label-for 전달로 이름 클릭이 체크를 토글했고, 그래서
// 자료를 훑어볼 때마다 선택이 하나씩 풀렸다. 아래 넷이 그 분리를 잠근다.
const checkboxFor = (title) => screen.getByRole('checkbox', { name: `${title} 선택` })

describe('선택완료 (디스크립션 6)', () => {
  it('열었을 때는 아무것도 선택돼 있지 않다', () => {
    // 기본이 "전부"면 학예사가 고르지 않은 자료가 산출물에 담긴다.
    renderModal()
    expect(screen.getByText(/선택완료/).textContent).toContain('0')
  })

  it('체크한 자료만 목록 순서로 올린다', () => {
    const onConfirm = vi.fn()
    renderModal({ onConfirm })
    fireEvent.click(checkboxFor('민중신문 제40호'))
    fireEvent.click(checkboxFor('광주민주화운동 군인'))
    fireEvent.click(screen.getByText(/선택완료/))
    // 체크한 **순서**가 아니라 **목록 순서**(=검색 랭킹 순)로 나간다.
    expect(onConfirm).toHaveBeenCalledWith(['a', 'b'])
  })

  it('체크를 해제하면 건수가 줄어든다', () => {
    renderModal()
    fireEvent.click(checkboxFor('광주민주화운동 군인'))
    expect(screen.getByText(/선택완료/).textContent).toContain('1')
    fireEvent.click(checkboxFor('광주민주화운동 군인'))
    expect(screen.getByText(/선택완료/).textContent).toContain('0')
  })
})

describe('보기와 담기는 서로 간섭하지 않는다 (round07b-ext)', () => {
  it('자료명을 눌러도 체크는 변하지 않는다', () => {
    renderModal()
    fireEvent.click(checkboxFor('광주민주화운동 군인'))
    expect(screen.getByText(/선택완료/).textContent).toContain('1')

    // 이름을 여러 번 눌러 살펴봐도 담은 목록은 그대로여야 한다.
    fireEvent.click(screen.getByRole('button', { name: '민중신문 제40호' }))
    fireEvent.click(screen.getByRole('button', { name: '광주민주화운동 군인' }))

    expect(screen.getByText(/선택완료/).textContent).toContain('1')
  })

  it('자료명을 누르면 그 자료를 조회한다', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: '민중신문 제40호' }))
    await waitFor(() => expect(fetchArtifactDetail).toHaveBeenCalledWith('b'))
  })

  it('체크만 해서는 보고 있는 자료가 바뀌지 않는다', () => {
    renderModal()
    fetchArtifactDetail.mockClear()
    fireEvent.click(checkboxFor('민중신문 제40호'))
    expect(fetchArtifactDetail).not.toHaveBeenCalled()
  })
})

describe('미공개 표시 (좌측 목록)', () => {
  it('is_public 이 false 인 자료에만 점을 찍는다', () => {
    renderModal({
      items: [
        { ...ITEMS[0], isPublic: false },
        { ...ITEMS[1], isPublic: true },
      ],
    })
    expect(screen.getAllByLabelText('미공개')).toHaveLength(1)
  })

  it('모르는 값(null)에는 아무 표시도 하지 않는다', () => {
    // 추측해 점을 찍으면 공개 자료를 비공개로 오인한다.
    renderModal({ items: ITEMS.map((it) => ({ ...it, isPublic: null })) })
    expect(screen.queryByLabelText('미공개')).toBeNull()
  })

  it('미공개가 하나도 없으면 범례를 그리지 않는다', () => {
    renderModal({ items: ITEMS.map((it) => ({ ...it, isPublic: true })) })
    expect(screen.queryByText('미공개')).toBeNull()
  })
})

// 전역 제약 — onConfirm 을 주지 않는 다른 호출부를 이 컴포넌트가 깨면 안 된다.
// renderModal 기본값(onConfirm={() => {}})을 명시적으로 undefined 로 덮어써
// "정말 안 준" 상태를 재현한다(JSX 스프레드는 나중 키가 undefined 여도 덮어쓴다).
describe('onConfirm 미전달 폴백 (전역 제약)', () => {
  it('onConfirm 이 없으면 토스트를 띄우고 닫기를 호출한다', () => {
    const onClose = vi.fn()
    renderModal({ onConfirm: undefined, onClose })
    fireEvent.click(screen.getByText(/선택완료/))
    expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// 2-1 — 노드가 바뀌면 이전 노드에서 고른 체크가 새 노드로 이어지지 않는다
// (useEffect([node?.id])의 존재 이유). 노드 id 는 그래프마다 다시 매겨지므로
// 남겨 두면 엉뚱한 자료가 담긴 채로 시작한다.
describe('노드 전환 재동기화', () => {
  it('다른 노드로 바뀌면 선택이 비워진 채로 시작한다', () => {
    const { rerender } = renderModal()
    // 첫 노드에서 하나를 골라 둔다 — 새 노드로 넘어가면 사라져야 한다.
    fireEvent.click(screen.getByRole('checkbox', { name: '광주민주화운동 군인 선택' }))
    expect(screen.getByText(/선택완료/).textContent).toContain('1')

    const NODE2 = { id: 'n2', label: '정치', count: 2, group: 'subject' }
    const ITEMS2 = [
      { id: 'c', title: '포스터 1', type: '포스터', image: null },
      { id: 'd', title: '포스터 2', type: '포스터', image: null },
    ]
    rerender(
      <ToastProvider>
        <NodeModal node={NODE2} items={ITEMS2} onClose={() => {}} onConfirm={() => {}} />
      </ToastProvider>,
    )
    // 옛 체크 맵(a:true)이 남아 있었다면 1 이 됐을 것이다.
    expect(screen.getByText(/선택완료/).textContent).toContain('0')
  })

  // round07i 감사 C — **id가 같아도 다른 노드면 초기화된다.**
  // node_graph.py는 노드 id를 선택된 클래스 안에서만 n1부터 다시 매긴다 —
  // 정치행정 n1(민주화운동)과 경제산업 n1(산업)은 같은 id·다른 노드다. 기준이
  // node?.id면 이 이펙트가 아예 돌지 않아 앞 노드의 체크가 새 노드의 자료에
  // 그대로 얹히고, 그 상태의 「선택완료」는 학예사가 고른 적 없는 자료를 담는다.
  it('id가 같아도 다른 노드면 선택이 이어지지 않는다', () => {
    const { rerender } = renderModal()
    fireEvent.click(screen.getByRole('checkbox', { name: '광주민주화운동 군인 선택' }))
    expect(screen.getByText(/선택완료/).textContent).toContain('1')

    // 같은 'n1'이지만 다른 클래스의 다른 노드다.
    const SAME_ID_OTHER_NODE = { id: 'n1', label: '산업', count: 2, group: 'subject' }
    const ITEMS2 = [
      { id: 'a', title: '광주민주화운동 군인', type: '사진', image: '/images/a' },
      { id: 'e', title: '통계표', type: '도서', image: null },
    ]
    rerender(
      <ToastProvider>
        <NodeModal node={SAME_ID_OTHER_NODE} items={ITEMS2} onClose={() => {}} onConfirm={() => {}} />
      </ToastProvider>,
    )
    expect(screen.getByText(/선택완료/).textContent).toContain('0')
  })
})

// ── 2026-09-01 — 메타정보에 재질·크기·국적을 더했다 ────────────────────────
// 셋 다 상세 조회가 이미 실어 오던 값인데(reader.DETAIL_COLS) 화면이 버리고
// 있었다. 현장에서 「크기」를 물어 온 것이 계기다(같은 결정으로 엑셀 칩도 15개로
// 열었다 — spec §4.4).
describe('메타정보 — 재질·크기·국적', () => {
  it('상세 응답의 값을 그대로 그린다', async () => {
    fetchArtifactDetail.mockResolvedValue({
      ok: true,
      detail: { ...DETAIL.detail, material: '종이', size_info: '가로 5.5 세로 8.5', nation: '대한민국' },
    })
    renderModal()

    const meta = await screen.findByText(/재질: 종이/)
    expect(meta).toHaveTextContent('크기: 가로 5.5 세로 8.5')
    expect(meta).toHaveTextContent('국적: 대한민국')
  })

  it('원천에 없으면 —로 둔다', async () => {
    // 아카이브 자료는 셋 다 비어 있다. 행을 지우면 「그런 항목이 없다」로 읽히지만
    // 실제로는 「그 원천에 값이 없다」다 — 자리를 지키고 —를 찍는다.
    fetchArtifactDetail.mockResolvedValue({
      ok: true,
      detail: { ...DETAIL.detail, material: null, size_info: null, nation: null },
    })
    renderModal()

    expect(await screen.findByText(/크기: —/)).toBeInTheDocument()
  })
})

// ── round10c Task A1 — body 로 포털하고 스크롤을 잠근다 ─────────────────────────
//
// 라이브 실측(2026-09-18, /search/output): 노드를 열고 모달 **바깥** 좌표에서 휠을
// 내리면 .dim.is_active·.node_detail_modal.is_active 는 열려 있는데
// document.body.style.overflow === ''(잠금이 아예 없다)이라 배경 문서가 그대로
// 끝까지 스크롤됐다(documentElement.scrollTop 0 → 540). 관용구는
// components/Modal.test.jsx 의 'L1 — 오버레이는 body 로 포털된다'를 그대로 따른다.
describe('L1 — NodeModal 은 body 로 포털되고 스크롤을 잠근다', () => {
  it('.dim.is_active 와 .node_detail_modal 이 둘 다 document.body 의 자식이다', () => {
    const { container } = render(
      <div id="host" style={{ position: 'relative', zIndex: 1 }}>
        <ToastProvider>
          <NodeModal node={NODE} items={ITEMS} onClose={() => {}} onConfirm={() => {}} />
        </ToastProvider>
      </div>,
    )
    // 렌더한 자리(container)에는 없다
    expect(container.querySelector('.dim.is_active')).toBeNull()
    expect(container.querySelector('.node_detail_modal')).toBeNull()

    // body 아래에서는 찾아진다
    const dim = document.body.querySelector('.dim.is_active')
    const modal = document.body.querySelector('.node_detail_modal')
    expect(dim).not.toBeNull()
    expect(modal).not.toBeNull()
    expect(dim.parentElement).toBe(document.body)
    expect(modal.parentElement).toBe(document.body)
  })

  // 퍼블 정본: dim 은 모달의 부모가 아니라 형제다(AlertPopup.jsx 와 같은 관행) —
  // 그래서 모달 카드에 stopPropagation 없이도 dim 클릭이 모달로 전파되지 않는다.
  // 포털은 <>...</> 조각 전체를 통째로 옮기므로 이 형제 관계는 포털 후에도 유지돼야 한다.
  it('dim 은 모달의 부모가 아니라 형제다(포털 후에도 퍼블 형제 구조가 유지된다)', () => {
    renderModal()
    const dim = document.body.querySelector('.dim.is_active')
    const modal = document.body.querySelector('.node_detail_modal')
    expect(dim.parentElement).toBe(modal.parentElement)
  })

  it('열리면 document.body.style.overflow 가 hidden 이고, 언마운트하면 되돌아온다', () => {
    document.body.style.overflow = ''
    const { unmount } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})

// ── round10c #26 — 메타정보의 「수정」(연필)을 걷는다 ──────────────────────────
//
// 기획 이슈 시트 #26: "노드 상세 메타정보의 수정 아이콘 삭제".
// 바로 위 번역정보 블록에도 같은 수정/복사 쌍이 있는데 **메타정보 쪽만** 지목됐다.
// 그래서 「수정 버튼이 0개」로 잠그면 안 된다 — 번역정보 쪽까지 못 살게 막는다.
// 두 블록을 갈라서 각각 확인한다.
describe('#26 — 수정 아이콘은 메타정보에서만 사라지고 번역정보에는 남는다', () => {
  /** 소제목(번역정보·메타정보)이 속한 sub_head 안의 액션 버튼 라벨을 모은다. */
  function actionLabelsOf(title) {
    const head = [...document.body.querySelectorAll('.node_detail_trans_sub_head')]
      .find((h) => h.querySelector('.node_detail_trans_sub_tit')?.textContent?.trim() === title)
    expect(head, `${title} 블록을 못 찾았다`).toBeTruthy()
    return [...head.querySelectorAll('.node_detail_trans_action')].map((b) => b.getAttribute('aria-label'))
  }

  beforeEach(() => {
    render(
      <ToastProvider>
        <NodeModal node={NODE} items={ITEMS} onClose={() => {}} onConfirm={() => {}} />
      </ToastProvider>,
    )
  })

  it('메타정보에는 「복사」만 남는다', () => {
    expect(actionLabelsOf('메타정보')).toEqual(['복사'])
  })

  it('번역정보의 「수정」은 그대로 남는다', () => {
    expect(actionLabelsOf('번역정보')).toEqual(['수정', '복사'])
  })
})

// ── round10c 전브랜치 리뷰 C1 — 닫혀 있을 때는 아무것도 점유하지 않는다 ──────────
//
// 유일한 소비처 OutputTab.jsx:1083 은 이 컴포넌트를 **무조건** 마운트하고 `node` 로
// 열고 닫는다(초기값 null). 처음 구현은 「마운트 = 열림」이라는 틀린 전제로
// useBodyScrollLock(true) 를 걸어, /search/output 에 진입만 해도 배경이 잠기고
// 그 화면의 다른 모달들이 딤을 잃었다. 아래 두 시험이 그 전제를 되살리는 것을 막는다.
describe('C1 — node 가 없으면 잠금도 스택도 건드리지 않는다', () => {
  it('node={null} 이면 body 스크롤을 잠그지 않는다', () => {
    document.body.style.overflow = ''
    render(
      <ToastProvider>
        <NodeModal node={null} items={[]} onClose={() => {}} onConfirm={() => {}} />
      </ToastProvider>,
    )
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  // 스택을 점유하지 않는다는 것은 「다른 오버레이가 맨 아래가 된다」로만 밖에서 확인된다.
  // 닫힌 NodeModal 과 공용 Modal 을 같이 두고, Modal 이 딤을 그리는지 본다 —
  // NodeModal 이 스택을 차지하면 Modal 이 bg-transparent 가 되어 빨개진다.
  it('닫힌 NodeModal 은 다른 모달의 딤을 빼앗지 않는다', () => {
    render(
      <ToastProvider>
        <NodeModal node={null} items={[]} onClose={() => {}} onConfirm={() => {}} />
        <Modal open title="생성" onClose={() => {}}>본문</Modal>
      </ToastProvider>,
    )
    const overlay = document.body.querySelector('.fixed.inset-0.z-50')
    expect(overlay, '공용 Modal 의 오버레이를 못 찾았다').not.toBeNull()
    expect(overlay.className).not.toMatch(/bg-transparent/)
  })
})
