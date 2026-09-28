// 이 파일의 책임: round07b — OutputTab이 **라이브 검색 결과**에 연결됐는지 검증한다.
//
// 기존 OutputTab.test.jsx는 데모 모드(시나리오 데이터)를 본다. 그 경로는 그대로
// 살아 있어야 하지만, 이 라운드의 핵심은 "좌측 클래스 목록이 질의마다 달라지는가"다
// — 그건 데모 데이터로는 절대 드러나지 않는다(시나리오는 고정 목록이니까).
//
// ScenarioContext 자체를 모킹한다. 컨텍스트가 그래프를 어떻게 **받아 오는가**는
// ScenarioContext.graph.test.jsx가 이미 잠갔고, 여기 관심사는 OutputTab이 그 값을
// 어떻게 **그리고 쓰는가**다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

const fetchGraph = vi.fn()
const createOutput = vi.fn()
const downloadOutputFile = vi.fn()
const triggerBrowserDownload = vi.fn()
// round07b-ext task-11 — OutputTab이 이제 항상 OutputList를 마운트하고, OutputList는
// listOutputs·deleteOutputs를 이 모듈(outputsApi.js)에서 가져온다. 여기 목이 그 둘을
// 빠뜨리면 real fetch가 나가 비동기 실패 토스트가 경합한다(자세한 이유는
// OutputTab.test.jsx 파일 상단 주석 참조). 기본 resolve 값은 beforeEach에서 매번
// 다시 심는다(아래 beforeEach 주석 참조) — 여기서 한 번만 주면 afterEach의
// restoreAllMocks가 둘째 테스트부터 그 구현을 걷어간다.
const listOutputs = vi.fn()
const deleteOutputs = vi.fn()
const bumpOutputsVersion = vi.fn()

const GRAPH = {
  classes: [
    { value: '정치행정', count: 12 },
    { value: '경제산업', count: 0 },
    { value: '사회환경', count: 5 },
    { value: '교육과학', count: 0 },
    { value: '문화예술', count: 0 },
    { value: '미분류', count: 3 },
  ],
  selected: '정치행정',
  nodes: [
    { id: 'n0', label: '정치행정', count: 12, group: 'root' },
    { id: 'n1', label: '민주화운동', count: 2, group: 'subject' },
    { id: 'n2', label: '정치', count: 1, group: 'subject' },
  ],
  edges: [{ from: 'n0', to: 'n1' }, { from: 'n0', to: 'n2' }],
  nodeItems: { n1: ['a', 'b'], n2: ['c'] },
  items: {
    a: { name: '4·19 혁명 사진', image_url: '/images/a', category: '사회생활-사진', has_image: true },
    b: { name: '선언문', image_url: null, category: '사회생활-도서', has_image: false },
    c: { name: '포스터', image_url: null, category: '사회생활-포스터', has_image: false },
  },
  total: 20,
  status: 'ok',
}

// round07i 방어 결함 수정 — 「경제산업」으로 전환했을 때의 그래프. node_graph.py가
// 노드 id를 **선택된 클래스 안에서만** n1부터 다시 매기므로(node_graph.py:188-205),
// GRAPH의 n1(민주화운동)과 이 그래프의 n1(산업)이 **같은 id, 다른 노드**다 — 클래스를
// 넘나드는 선택이 이 충돌을 실제로 견디는지 아래 describe가 검증한다.
const GRAPH2 = {
  classes: GRAPH.classes,
  selected: '경제산업',
  nodes: [
    { id: 'n0', label: '경제산업', count: 4, group: 'root' },
    { id: 'n1', label: '산업', count: 3, group: 'subject' },
    { id: 'n2', label: '경제', count: 1, group: 'subject' },
  ],
  edges: [{ from: 'n0', to: 'n1' }, { from: 'n0', to: 'n2' }],
  nodeItems: { n1: ['d', 'e', 'f'], n2: ['g'] },
  items: {
    d: { name: '공장 사진', image_url: null, category: '사회생활-사진', has_image: false },
    e: { name: '통계표', image_url: null, category: '사회생활-도서', has_image: false },
    f: { name: '설계도', image_url: null, category: '사회생활-도서', has_image: false },
    g: { name: '광고지', image_url: null, category: '사회생활-포스터', has_image: false },
  },
  total: 8,
  status: 'ok',
}

// round07i 감사 C — GRAPH2와 같은 클래스·같은 노드지만 n1의 첫 자료가 **정치행정
// n1에도 들어 있는 자료('a')** 다. 한 자료에 subject가 여럿이면 node_graph.py가 그
// 자료를 두 클래스 모두에 싣는다(ADR-002 F-02가 말하는 중복 노출이 클래스를 넘어
// 일어나는 정상 상태다). 감사가 실측한 오염 payload — 열려 있던 모달 밑으로 정치행정
// 그래프가 도착한 뒤 「선택완료」가 써 넣은 `{"node":"산업","idnbrs":["a"]}` — 는 정확히
// 이 겹침(옛 체크 ∩ 새 목록)에서 나온다. 겹침이 없으면 같은 결함이 "아무것도 고르지
// 않은 채 닫히는" 조용한 무동작으로 나타난다(아래 두 번째 it).
const GRAPH2_SHARED = {
  ...GRAPH2,
  nodeItems: { n1: ['a', 'e', 'f'], n2: ['g'] },
  items: { ...GRAPH2.items, a: GRAPH.items.a },
}

// round07i 리뷰 Finding 1 — 「정치행정」으로 돌아왔는데 그 사이 재분류돼(또는 자료가
// 바뀌어) '민주화운동' 노드 자체가 더 이상 없는 그래프. 크로스클래스 칩을
// 더블클릭해 그 클래스로 전환은 성공했지만(fetch 자체는 ok) 정작 그 칩이 가리키던
// 라벨을 찾을 수 없는 "낡은 칩" 시나리오를 재현한다 — GRAPH와 클래스는 같고
// n1 라벨만 다르다.
const GRAPH_RECLASSIFIED = {
  ...GRAPH,
  nodes: [
    { id: 'n0', label: '정치행정', count: 12, group: 'root' },
    { id: 'n1', label: '외교', count: 2, group: 'subject' },
    { id: 'n2', label: '정치', count: 1, group: 'subject' },
  ],
  nodeItems: { n1: ['h'], n2: ['c'] },
  items: { ...GRAPH.items, h: { name: '조약문', image_url: null, category: '사회생활-도서', has_image: false } },
}

let ctx

vi.mock('../../context/ScenarioContext.jsx', () => ({
  useScenario: () => ctx,
}))
vi.mock('../../lib/outputsApi.js', () => ({
  // isLive: 목 모듈이라 실제 env를 안 본다. true 로 둬야 OutputList·SearchFlowLayout의
  // 데모 모드 게이트를 통과해 기존 조회 경로가 그대로 검증된다.
  isLive: () => true,
  createOutput: (...a) => createOutput(...a),
  downloadOutputFile: (...a) => downloadOutputFile(...a),
  listOutputs: (...a) => listOutputs(...a),
  deleteOutputs: (...a) => deleteOutputs(...a),
  // round10a A조 최종 리뷰 I-2 — OutputTab.test.jsx와 같은 이유(그 파일 주석 참조).
  UNKNOWN_OUTCOME: new Set([0, 502, 503, 504]),
}))
vi.mock('../../lib/downloadFile.js', () => ({
  triggerBrowserDownload: (...a) => triggerBrowserDownload(...a),
}))

const { default: OutputTab, EXHIBIT_SUB_EXHIBITION } = await import('./OutputTab.jsx')
const { AdminProvider } = await import('../../state/AdminProvider.jsx')
const { ToastProvider } = await import('../../components/Toast.jsx')

function makeCtx(over = {}) {
  return {
    activeScenario: { nodes: [], nodeEdges: [], nodeItems: {}, output: { caption: {}, promo: {} } },
    isLive: true,
    graph: GRAPH,
    graphStatus: 'ok',
    graphNotice: null,
    fetchGraph,
    lastQuery: '민주화운동',
    searchMode: 'meta',
    // round07b-ext 리뷰 — 목록 갱신 신호는 이제 컨텍스트가 소유한다(탭 뱃지가 있는
    // SearchFlowLayout이 이 컴포넌트보다 위층이라 지역 상태로는 닿지 않는다).
    outputsVersion: 0,
    bumpOutputsVersion,
    ...over,
  }
}

// round10 Task5 리뷰 fix — LibraryProvider가 이제 useLocation()을 쓰는데, OutputTab이
// useLibrary()를 쓰지 않으므로(레포 전체 grep 확인) 이 wrap은 애초에 죽은 코드였다 —
// 걷어낸다(안 걷어내면 Router 컨텍스트 밖이라 useLocation()이 던진다). 아래 여러
// describe의 rerenderApp/renderAt도 같은 이유로 함께 걷어낸다.
function renderTab() {
  return render(
    <ToastProvider>
      <AdminProvider>
        <MemoryRouter>
          <OutputTab />
        </MemoryRouter>
      </AdminProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  ctx = makeCtx()
  // afterEach의 restoreAllMocks가 매 테스트 뒤 이 기본 구현까지 걷어가므로, 모듈
  // 스코프 초기화 한 번이 아니라 매 테스트 시작마다 다시 심어야 둘째 테스트부터
  // listOutputs()가 undefined를 반환해 OutputList의 .then 호출이 깨지는 사고를 막는다.
  listOutputs.mockResolvedValue({ ok: true, data: { outputs: [], has_more: false } })
})
afterEach(() => { vi.restoreAllMocks() })

describe('좌측 목록 — 주제 대분류', () => {
  it('고정 6개가 고정 순서로 나온다', () => {
    renderTab()
    // 라이브 모드의 주제 대분류 탭만 필터링한다 — 결과 탭(설명문/홍보자료)은 제외
    const classTablist = screen.getByRole('tablist', { name: /주제 대분류/ })
    const tabs = within(classTablist).getAllByRole('tab').map((t) => t.textContent.replace(/\d+/g, '').trim())
    expect(tabs).toEqual(['정치행정', '경제산업', '사회환경', '교육과학', '문화예술', '미분류'])
  })

  it('0건 클래스도 사라지지 않는다', () => {
    renderTab()
    expect(screen.getByRole('tab', { name: /경제산업/ })).toBeInTheDocument()
  })

  it('프로젝트로 저장 버튼은 없다 — 피그마에 없는 요소다', () => {
    renderTab()
    expect(screen.queryByRole('button', { name: /프로젝트로 저장/ })).toBeNull()
  })

  it('클래스별 건수를 함께 보여준다', () => {
    renderTab()
    expect(screen.getByRole('tab', { name: /정치행정/ }).textContent).toContain('12')
  })

  it('선택된 클래스에 is_active가 붙는다', () => {
    renderTab()
    expect(screen.getByRole('tab', { name: /정치행정/ }).className).toContain('is_active')
  })

  it('다른 클래스를 누르면 fetchGraph를 그 이름으로 부른다(재검색이 아니다)', () => {
    renderTab()
    fireEvent.click(screen.getByRole('tab', { name: /사회환경/ }))
    expect(fetchGraph).toHaveBeenCalledWith('민주화운동', 'meta', '사회환경')
  })

  it('같은 클래스를 다시 눌러도 요청하지 않는다', () => {
    renderTab()
    fireEvent.click(screen.getByRole('tab', { name: /정치행정/ }))
    expect(fetchGraph).not.toHaveBeenCalled()
  })

  it('데모용 「사용자 설정」 안내는 라이브에서 뜨지 않는다', () => {
    renderTab()
    expect(screen.queryByText(/사용자 설정 묶음기준은 준비 중입니다/)).toBeNull()
  })

  it('그래프 조회 실패는 사유를 화면에 남긴다', () => {
    ctx = makeCtx({ graphStatus: 'error', graphNotice: '노드 그래프를 불러오지 못했습니다' })
    renderTab()
    expect(screen.getByText(/노드 그래프를 불러오지 못했습니다/)).toBeInTheDocument()
  })
})

describe('노드 모달 — 200건 어디서든 이름을 그린다', () => {
  it('graph.items의 이름으로 자료를 그린다(현재 페이지 20건에 없어도)', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /민주화운동/ }))
    // 이름이 나온다 = 서버가 실어 준 items를 쓰고 있다. 검색 결과 페이지(20건)에
    // 없는 자료라도 그릴 수 있어야 하는 것이 이 계약의 요지다.
    expect(screen.getByText('4·19 혁명 사진')).toBeInTheDocument()
  })

  it('유형 탭의 「전체」 건수가 노드의 자료 수와 같다', () => {
    // 「선언문」은 도서라 기본 이미지 탭에서는 안 보인다 — 그래도 전체 집계에는 든다.
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /민주화운동/ }))
    expect(screen.getByRole('button', { name: /전체\s*2/ })).toBeInTheDocument()
  })
})

describe('선택 → 생성', () => {
  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
  // round07b-ext — 모달을 열면 **아무것도 선택돼 있지 않다**. 담을 것을 직접
  // 골라야 한다. 유형 행의 「전체 전체 선택」 체크박스가 그 유형의 자료를 한
  // 번에 켠다(기본으로 펼쳐지는 유형이 "전체"라 곧 전 자료다).
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  it('노드 선택이 칩과 건수로 올라온다', () => {
    renderTab()
    selectNode('민주화운동')
    expect(screen.getByText(/자료 2건을 골랐습니다/)).toBeInTheDocument()
  })

  it('여러 노드를 고르면 합집합으로 센다(중복 노출은 정상)', () => {
    renderTab()
    selectNode('민주화운동')
    selectNode('정치')
    expect(screen.getByText(/자료 3건을 골랐습니다/)).toBeInTheDocument()
  })

  it('생성 요청에 노드명과 자료 id가 실린다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: 't.xlsx', artifact_count: 2 },
    })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0]).toMatchObject({
      kind: 'exhibit',
      query: '민주화운동',
      selection: [{ node: '민주화운동', idnbrs: ['a', 'b'] }],
    })
  })

  it('생성에 성공하면 완료 모달이 뜬다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o1', file_name: 't.xlsx', artifact_count: 2 } })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByText('산출물 생성이 완료되었습니다')).toBeInTheDocument())
  })

  // 완료 모달을 어떻게 닫든 결과가 같아야 한다. "확인"에서만 신호를 올리던 시절엔
  // X·Esc로 닫으면 방금 "완료됐다"고 알려 준 그 산출물이 목록에 없었다.
  it.each([
    ['확인', () => fireEvent.click(screen.getByRole('button', { name: '확인' }))],
    ['닫기(X)', () => fireEvent.click(screen.getByRole('button', { name: '닫기' }))],
  ])('완료 모달을 %s로 닫아도 목록 갱신 신호가 올라간다', async (_label, close) => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o1', file_name: 't.xlsx', artifact_count: 2 } })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    await waitFor(() => expect(screen.getByText('산출물 생성이 완료되었습니다')).toBeInTheDocument())

    bumpOutputsVersion.mockClear()
    close()

    expect(bumpOutputsVersion).toHaveBeenCalled()
  })

  it('생성 직후 다운로드하지 않는다 — 받는 것은 목록에서다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o1', file_name: 't.xlsx', artifact_count: 2 } })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  it('생성 실패는 서버 사유를 토스트로 보여준다', async () => {
    createOutput.mockResolvedValue({ ok: false, notice: '알 수 없는 전시자료 컬럼: 크기' })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('알 수 없는 전시자료 컬럼'))
  })
})

// round07e — 설명문 생성이 준비중에서 풀린다. 「생성시작」[0]이 이제 CaptionModal을
// 연다(전시자료는 [1]) — submitCaption이 submitExhibit과 같은 흐름임을 여기서 잠근다.
describe('설명문 생성(round07e)', () => {
  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  it('생성 요청에 kind=caption·노드명·자료 id·기본 형식(docx)이 실리고 columns는 없다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o2', kind: 'caption', file_name: 't.docx', artifact_count: 2 },
    })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    const payload = createOutput.mock.calls[0][0]
    expect(payload).toMatchObject({
      kind: 'caption',
      query: '민주화운동',
      selection: [{ node: '민주화운동', idnbrs: ['a', 'b'] }],
      format: 'docx',
      timeline: false,
    })
    // exhibit 전용 필드다 — caption 요청에 섞이면 서버 계약을 흐린다(브리프).
    expect(payload).not.toHaveProperty('columns')
  })

  // round07g — 형식 라디오를 걷어냈다(사용자 결정 2026-09-03: 어디서 만들든 DOCX).
  // 예전 이 테스트는 hwpx 라디오를 눌러 그 값이 실리는지 보았다. 그 대상이 사라졌으니
  // 남은 계약을 대신 잠근다: **화면에 고를 자리가 없어도 요청의 format 은 여전히
  // 나간다**(서버 CreateOutputRequest.format 은 그대로다 — round11a 부터 그 값이
  // 가리키는 렌더러는 DOCX 하나뿐이다).
  // 화면이 보내는 값이 docx 하나로 고정됐을 뿐이다.
  it('타임라인 체크는 그대로 실리고, 형식은 화면과 무관하게 docx 로 나간다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o2', file_name: 't.docx', artifact_count: 2 } })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    // 고를 자리 자체가 없다.
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    fireEvent.click(screen.getByLabelText('타임라인 생성'))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0]).toMatchObject({ format: 'docx', timeline: true })
  })

  // round07g 디스크립션 1 「더블 클릭 시 상세모달 오픈, 수정 가능」.
  // 모달이 onOpenChip 을 올린다는 것은 CaptionModal.test.jsx 가 잠근다. 여기서
  // 잠그는 것은 그 위쪽 — **이 화면이 이미 쓰는 길에 꽂혔는가**다. 부모가 배선을
  // 빠뜨리면 뱃지는 눌려도 아무 일이 없고, 모달 단위 테스트만으로는 초록으로 남는다.
  // 새 길을 내지 않았다는 것도 같이 본다: 열리는 것은 NodeGraph 클릭과 **같은**
  // node_detail_modal 이다(round07f R1 Minor-3).
  it('모달의 노드 뱃지를 더블클릭하면 이 화면이 이미 쓰는 노드 상세가 열린다', () => {
    renderTab()
    selectNode('민주화운동')
    fireEvent.click(screen.getAllByText('생성시작')[0])
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))

    expect(screen.getByRole('dialog')).toHaveClass('node_detail_modal')
    // 설명문 모달은 열린 채다 — 자료를 고치고 그대로 이어서 만드는 흐름이다.
    expect(screen.getByLabelText('제목 설정')).toBeInTheDocument()
  })

  it('생성에 성공하면 완료 모달이 뜨고, 자동 다운로드하지 않는다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o2', file_name: 't.docx', artifact_count: 2 } })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByText('산출물 생성이 완료되었습니다')).toBeInTheDocument())
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  it('생성 실패는 서버 사유를 토스트로 보여준다', async () => {
    createOutput.mockResolvedValue({ ok: false, notice: 'LLM 호출에 실패했습니다' })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('LLM 호출에 실패했습니다'))
  })

  // round07e 최종 리뷰 F2(c) — timeline 체크를 켰는데 서버가 0건을 돌려주면(자료에
  // 연도 근거가 부족해 LLM이 항목을 비운 경우) 201이라 침묵히 성공으로만 보이면
  // 안 된다. 완료 모달에 사실 한 줄이 더 떠야 한다.
  it('타임라인을 켰는데 0건이면 완료 모달에 사유가 더 뜬다', async () => {
    createOutput.mockResolvedValue({
      ok: true,
      data: { id: 'o2', file_name: 't.docx', artifact_count: 2, timeline_count: 0 },
    })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    fireEvent.click(screen.getByLabelText(/타임라인 생성/))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByText('산출물 생성이 완료되었습니다')).toBeInTheDocument())
    expect(
      screen.getByText(/다만 자료에 연도 근거가 부족해 타임라인 항목이 만들어지지 않았습니다/),
    ).toBeInTheDocument()
  })

  it('타임라인을 켜지 않았으면(또는 항목이 있으면) 그 사유가 뜨지 않는다', async () => {
    createOutput.mockResolvedValue({
      ok: true,
      data: { id: 'o2', file_name: 't.docx', artifact_count: 2, timeline_count: 0 },
    })
    renderTab()
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    // 타임라인 체크는 켜지 않는다 — 기본값 false.
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByText('산출물 생성이 완료되었습니다')).toBeInTheDocument())
    expect(screen.queryByText(/타임라인 항목이 만들어지지 않았습니다/)).toBeNull()
  })
})

// round07i — 같은 "생성시작"[1] 버튼이 드롭다운 값에 따라 ExhibitModal 대신
// ExhibitionModal을 연다. submitExhibition이 submitExhibit·submitCaption과 같은
// 흐름(완료 모달로 끝나고 자동 다운로드하지 않는다)임을 여기서 잠근다 — 다만
// columns를 아예 싣지 않는다(T6 validator가 특별전시에 columns·format이 실리면
// 422로 거부한다).
describe('특별전시 생성(round07i)', () => {
  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  // round07i 감사 C — 값이 표시 문구가 아니라 kind다. 테스트도 문구 리터럴 대신
  // OutputTab이 export하는 상수를 쓴다 — 문구를 다듬어도 이 테스트가 따라 죽지
  // 않고, 값이 바뀌면(=진짜 계약이 바뀌면) 그때 깨진다.
  const openExhibitionModal = () => {
    fireEvent.change(screen.getByLabelText('전시자료 유형'), {
      target: { value: EXHIBIT_SUB_EXHIBITION },
    })
    fireEvent.click(screen.getAllByText('생성시작')[1])
  }

  it('생성 요청에 kind=exhibition·노드명·자료 id가 실리고 columns·format은 없다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o3', kind: 'exhibition', file_name: 't.docx', artifact_count: 2 },
    })
    renderTab()
    selectNode('민주화운동')
    openExhibitionModal()

    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    const payload = createOutput.mock.calls[0][0]
    expect(payload).toMatchObject({
      kind: 'exhibition',
      query: '민주화운동',
      selection: [{ node: '민주화운동', idnbrs: ['a', 'b'] }],
    })
    // exhibit·caption 전용 필드다 — 특별전시 요청에 섞이면 서버가 422로 거부한다.
    expect(payload).not.toHaveProperty('columns')
    expect(payload).not.toHaveProperty('format')
  })

  it('제목 초기값이 정본 기본값이고 엑셀 모달의 제목과 겹치지 않는다', () => {
    renderTab()
    selectNode('민주화운동')
    openExhibitionModal()
    expect(screen.getByLabelText('제목 설정')).toHaveValue(defaultOutputTitle('exhibition'))
  })

  it('생성에 성공하면 완료 모달이 뜨고, 자동 다운로드하지 않는다', async () => {
    createOutput.mockResolvedValue({ ok: true, data: { id: 'o3', file_name: 't.docx', artifact_count: 2 } })
    renderTab()
    selectNode('민주화운동')
    openExhibitionModal()

    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByText('산출물 생성이 완료되었습니다')).toBeInTheDocument())
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  it('생성 실패는 서버 사유를 토스트로 보여준다', async () => {
    createOutput.mockResolvedValue({ ok: false, notice: '특별전시 생성에 실패했습니다' })
    renderTab()
    selectNode('민주화운동')
    openExhibitionModal()

    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('특별전시 생성에 실패했습니다'))
  })
})

// round07f 리뷰(Important 2) — 두 모달의 defaultTitle이 실제로 defaultOutputTitle
// 산물을 쓰는지, 그리고 질의문(lastQuery)이 그 제목에 섞여 들지 않는지는 이전까지
// 아무 테스트도 확인하지 않았다. 리뷰어가 변이(defaultTitle 두 곳을 '설명문'/
// '전시자료' 리터럴로 되돌리기)로 실증했다 — src/pages/results/ 330테스트가 전부
// 통과했다. lastQuery가 '민주화운동'인 이 파일의 makeCtx가 대조표 §5 결함
// (질의문이 제목에 들어가는 것)의 재발을 함께 잡기에 가장 알맞은 자리다.
describe('제목 기본값 배선(round07f 리뷰 Important 2)', () => {
  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  it('설명문 모달 제목 초기값이 정본 기본값이다 — 리터럴이 아니다', () => {
    renderTab()
    selectNode('민주화운동')
    fireEvent.click(screen.getAllByText('생성시작')[0])
    // round07g — 설명문 모달의 제목 라벨은 공용 조각(CaptionTitleField)의
    // 「제목 설정」이다. 전시자료 모달도 Task 3에서 같은 라벨로 바뀌었다(아래 테스트).
    expect(screen.getByLabelText('제목 설정')).toHaveValue(defaultOutputTitle('caption'))
  })

  it('전시자료 모달 제목 초기값이 정본 기본값이다 — 리터럴이 아니다', () => {
    renderTab()
    selectNode('민주화운동')
    fireEvent.click(screen.getAllByText('생성시작')[1])
    // round07g Task 3 — 라벨을 피그마대로 「제목」→「제목 설정」으로 바꿨다.
    expect(screen.getByLabelText('제목 설정')).toHaveValue(defaultOutputTitle('exhibit'))
  })

  // 대조표 §5 결함 재발 방지 — 질의문(lastQuery: '민주화운동')이 제목에 섞여 들면
  // 안 된다. createOutput 요청의 query 필드(위 "생성 요청에 노드명과 자료 id가
  // 실린다" 테스트가 잠근다)와는 별개로, **화면에 보이는 제목** 자체에도 질의문이
  // 나타나지 않아야 한다.
  it('질의문(lastQuery)이 설명문 제목에 섞여 들지 않는다', () => {
    renderTab()
    selectNode('민주화운동')
    fireEvent.click(screen.getAllByText('생성시작')[0])
    expect(screen.getByLabelText('제목 설정').value).not.toContain('민주화운동')
  })

  it('질의문(lastQuery)이 전시자료 제목에 섞여 들지 않는다', () => {
    renderTab()
    selectNode('민주화운동')
    fireEvent.click(screen.getAllByText('생성시작')[1])
    expect(screen.getByLabelText('제목 설정').value).not.toContain('민주화운동')
  })
})

describe('새 검색은 선택을 물려주지 않는다', () => {
  it('질의가 바뀌면 칩이 사라진다 — 노드 id는 그래프마다 다시 매겨진다', () => {
    const { rerender } = renderTab()
    fireEvent.click(screen.getByRole('button', { name: /민주화운동/ }))
  // round07b-ext — 열면 아무것도 선택돼 있지 않다. 담을 것을 직접 고른다.
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
    expect(screen.getByText(/자료 2건을 골랐습니다/)).toBeInTheDocument()

    ctx = makeCtx({ lastQuery: '광복' })
    rerender(
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter>
            <OutputTab />
          </MemoryRouter>
        </AdminProvider>
      </ToastProvider>,
    )

    expect(screen.getByText(/노드를 클릭해 자료를 고르면/)).toBeInTheDocument()
  })
})

// round07i 방어 결함 수정 — 사용자 보고 재현: 정치행정에서 통일(안보)·식민통치를
// 고른 뒤 경제산업을 누르니 선택 자료 패널이 통째로 "노드를 클릭해 자료를 고르면
// 여기에 표시됩니다"로 되돌아갔다. 여러 주제를 엮는 것이 특별전시의 핵심 흐름이라
// 클래스 전환에도 선택이 살아남아야 한다(사용자가 그 의도를 확인했다).
//
// GRAPH2(위 선언부)는 GRAPH와 **같은 위치 id를 재사용한다** — node_graph.py가 노드
// id를 선택된 클래스 안에서만 n1부터 다시 매기기 때문이다(GRAPH.n1=민주화운동,
// GRAPH2.n1=산업). 이 충돌이 실제로 안전한지가 아래 describe의 핵심이다.
describe('클래스를 바꿔도 고른 자료가 남는다(round07i 방어 결함 수정)', () => {
  const rerenderApp = (rerender) =>
    rerender(
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter>
            <OutputTab />
          </MemoryRouter>
        </AdminProvider>
      </ToastProvider>,
    )

  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  it('클래스를 바꿔 더 고르면 두 클래스의 선택이 모두 남고 합계는 합집합이다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // GRAPH n1 — a, b (2건)
    expect(screen.getByText(/자료 2건을 골랐습니다/)).toBeInTheDocument()

    // 클래스만 바뀐다 — lastQuery는 그대로다(재검색이 아니다).
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)

    selectNode('산업') // GRAPH2 n1 — d, e, f (3건)

    // 두 클래스의 칩이 모두 살아 있다 — 하나가 다른 하나를 지우지 않는다.
    expect(
      screen.getByRole('button', { name: /민주화운동, 그래프에서 위치 확인/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /산업, 그래프에서 위치 확인/ }),
    ).toBeInTheDocument()
    // 합계는 2+3=5건 — 서로 다른 자료 id라 합쳐도 줄지 않는다(ADR-002 F-02와
    // 별개로 여기서는 애초에 겹치는 자료가 없다).
    expect(screen.getByText(/자료 5건을 골랐습니다/)).toBeInTheDocument()
  })

  it('같은 위치 id(n1)를 쓰는 두 클래스의 선택이 서로 덮어쓰지 않는다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // GRAPH n1 — id 'n1', 2건

    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)

    selectNode('산업') // GRAPH2 n1 — 같은 id 'n1', 3건

    // 라벨·건수가 서로 뒤섞이지 않았는지 각 칩을 직접 읽는다. selection이 여전히
    // 노드 id로 키가 잡혀 있다면(고침 전으로 되돌리면) 두 항목이 같은 키('n1')를
    // 두고 부딪혀 하나가 사라지거나 "산업 2"처럼 라벨과 건수가 뒤섞인 거짓 칩이 뜬다.
    const demoChip = screen.getByRole('button', { name: /민주화운동, 그래프에서 위치 확인/ })
    const econChip = screen.getByRole('button', { name: /산업, 그래프에서 위치 확인/ })
    expect(demoChip.textContent).toContain('민주화운동')
    expect(demoChip.textContent).toContain('2')
    expect(econChip.textContent).toContain('산업')
    expect(econChip.textContent).toContain('3')
  })

  it('두 클래스에서 고른 뒤에도 진짜 새 검색(질의 변경)은 선택을 전부 지운다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동')
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    selectNode('산업')
    expect(screen.getByText(/자료 5건을 골랐습니다/)).toBeInTheDocument()

    // 클래스 전환이 아니라 질의(lastQuery) 자체가 바뀐다 — 노드 집합이 통째로
    // 갈리므로 두 클래스에 걸쳐 쌓아 둔 선택도 전부 무의미해진다.
    ctx = makeCtx({ graph: GRAPH2, lastQuery: '광복' })
    rerenderApp(rerender)

    expect(screen.getByText(/노드를 클릭해 자료를 고르면/)).toBeInTheDocument()
  })

  it('생성 요청 payload에 두 클래스에서 고른 자료가 모두 실린다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o9', file_name: 't.xlsx', artifact_count: 5 },
    })
    const { rerender } = renderTab()
    selectNode('민주화운동')
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    selectNode('산업')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0].selection).toEqual([
      { node: '민주화운동', idnbrs: ['a', 'b'] },
      { node: '산업', idnbrs: ['d', 'e', 'f'] },
    ])
  })
})

// round07i 리뷰 Finding 1 — 다른 클래스의 칩을 더블클릭해도 조용히 아무 일도 하지
// 않아서는 안 된다(코딩표준 §6 · 피그마 「더블 클릭 시 상세모달 오픈, 수정 가능」은
// 칩마다 예외 없이 적용된다). 이 라운드 전에는 클래스를 바꾸면 선택 전체가
// 지워졌으니 크로스클래스 칩 자체가 있을 수 없었다 — 바로 위 describe가 잠근 방어
// 결함 수정이 그 칩을 처음으로 "존재할 수 있게" 만들면서 드러난 새 구멍이다.
//
// 고른 인터랙션 — 조용히 무시하는 대신 그 칩의 클래스로 **실제 전환을 요청**하고
// (chooseClass가 이미 쓰는 fetchGraph 경로 그대로), 그래프가 도착하면 그때 연다.
// 전환 요청과 그래프 도착을 이 목 컨텍스트에서는 ctx 교체 + rerender 두 단계로
// 나눠서 흉내낸다 — 그 사이(도착 전) 빈 모달이나 엉뚱한 모달이 뜨지 않는지도 함께 본다.
describe('다른 클래스의 칩도 더블클릭으로 열린다(round07i 리뷰 Finding 1)', () => {
  const rerenderApp = (rerender) =>
    rerender(
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter>
            <OutputTab />
          </MemoryRouter>
        </AdminProvider>
      </ToastProvider>,
    )

  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  const openCaptionModal = () => fireEvent.click(screen.getAllByText('생성시작')[0])

  it('활성 클래스의 칩을 더블클릭하면 곧바로 그 노드 상세가 열린다(같은 클래스 경로)', () => {
    renderTab()
    selectNode('민주화운동') // GRAPH, class 정치행정 — 지금 활성 클래스와 같다.
    openCaptionModal()

    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))

    expect(screen.getByRole('dialog')).toHaveClass('node_detail_modal')
    expect(within(screen.getByRole('dialog')).getByText('민주화운동')).toBeInTheDocument()
    // 이미 지금 그래프에 있는 노드다 — 클래스를 전환할 이유가 없다.
    expect(fetchGraph).not.toHaveBeenCalled()
  })

  it('다른 클래스의 칩을 더블클릭하면 그 클래스로 전환을 요청하고, 그래프가 도착하면 그때 연다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // GRAPH, class 정치행정

    // 클래스만 바뀐다 — 정치행정 칩은 이제 지금 활성 클래스(경제산업)와 다르다.
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    openCaptionModal()

    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))

    // chooseClass가 좌측 탭 클릭에 쓰는 것과 같은 경로다 — 새 fetch 경로를 만들지
    // 않고 칩의 클래스 이름으로 그대로 부른다.
    expect(fetchGraph).toHaveBeenCalledWith('민주화운동', 'meta', '정치행정')
    // 아직 그 클래스의 그래프가 도착하지 않았다 — 빈 모달도, 엉뚱한 모달도 없다
    // (지금 화면엔 경제산업뿐이라 정치행정의 노드를 그릴 재료가 없다).
    expect(screen.queryByRole('dialog')).toBeNull()

    // 정치행정의 그래프가 도착한다.
    ctx = makeCtx({ graph: GRAPH })
    rerenderApp(rerender)

    expect(screen.getByRole('dialog')).toHaveClass('node_detail_modal')
    expect(within(screen.getByRole('dialog')).getByText('민주화운동')).toBeInTheDocument()
  })

  it('전환 중 그래프 조회가 실패하면 토스트로 알리고, 모달은 열리지 않는다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동')
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    openCaptionModal()

    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))

    // fetchGraph가 실패로 돌아온다 — 좌측 목록 아래에 뜨는 것과 같은 사유다.
    ctx = makeCtx({
      graph: GRAPH2, graphStatus: 'error', graphNotice: '노드 그래프를 불러오지 못했습니다',
    })
    rerenderApp(rerender)

    expect(screen.getByRole('status')).toHaveTextContent('노드 그래프를 불러오지 못했습니다')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('전환은 성공했지만 그 라벨이 더 이상 없으면(낡은 칩) 찾을 수 없다고 알린다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // 정치행정 n1 — 아래에서 그 라벨이 사라진 그래프로 되돌아온다.
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    openCaptionModal()

    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))

    // 정치행정으로 전환 자체는 성공했지만(fetch ok), 그 사이 '민주화운동' 라벨이
    // 재분류돼 사라졌다(GRAPH_RECLASSIFIED — 같은 클래스, 다른 n1 라벨).
    ctx = makeCtx({ graph: GRAPH_RECLASSIFIED })
    rerenderApp(rerender)

    expect(screen.getByRole('status')).toHaveTextContent(
      '선택한 자료를 그래프에서 찾을 수 없습니다',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// round07i 재리뷰(round07b 절) — 위 Finding 1 수정이 새로 낸 구멍. 크로스클래스
// 칩을 더블클릭해 대기(pendingChipKey)가 걸린 사이, 사용자가 **다른 노드를 직접
// 연다**(그래프 클릭이든 같은 클래스 칩 더블클릭이든) — 그 새 행동은 옛 더블클릭의
// 의도를 대신해야 하는데, chooseClass·useEffect 두 곳만 pendingChipKey를 지우고
// 있어서 이 두 경로는 지우지 않았다. 그 결과 나중에 도착한 대기 요청이 사용자가
// 막 열어 둔(체크 중일 수도 있는) 모달을 아무 신호 없이 덮어썼다(코딩표준 §6).
//
// 재현 시퀀스(재리뷰가 준 그대로): 크로스클래스 칩 A를 더블클릭(대기 시작) →
// A의 그래프가 도착하기 전에 다른 노드 C를 연다 → A의 그래프가 도착한다 →
// ~~C가 그대로 떠 있어야 한다~~ → **A도 C도 떠 있지 않아야 한다.**
//
// 【round07i 감사 C — 이 두 테스트의 기대값을 고쳤다(느슨하게 한 것이 아니다)】
// 원래 기대는 「C(산업)가 그대로 떠 있다」였다. 그 기대 자체가 감사가 지적한
// 결함을 그대로 굳혀 둔 것이었다 — 이름만 C인 채 **목록은 A의 클래스 것으로
// 통째로 갈린 모달**이 떠 있는 상태를 "그대로 떠 있다"로 읽었기 때문이다(이
// 테스트는 dialog의 name만 봤고 그 안의 자료는 보지 않았다). 도착한 그래프
// 위에서 C를 계속 그릴 방법은 없다(C의 자료는 지금 그래프에 없다). 그래서
// 옳은 결과는 "C가 닫히고 사유를 말한다"이며, 이 describe가 원래 잠그려던 것
// — **A가 뒤늦게 열리지 않는다** — 은 그대로 남는다(아래 dialog 전무 단언).
// 자료 오염까지 포함한 전체 재현은 아래 「열린 모달 밑으로 그래프가 도착한다」
// describe가 잠근다.
describe('대기 중 다른 노드를 열면 그 대기가 취소된다(round07i 재리뷰)', () => {
  const rerenderApp = (rerender) =>
    rerender(
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter>
            <OutputTab />
          </MemoryRouter>
        </AdminProvider>
      </ToastProvider>,
    )

  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  const openCaptionModal = () => fireEvent.click(screen.getAllByText('생성시작')[0])

  it('대기 중 그래프를 직접 클릭해 다른 노드를 열면, 나중에 도착한 대기 요청이 그 모달을 덮어쓰지 않는다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // GRAPH, class 정치행정 — chip A(정치행정/민주화운동)

    // 활성 클래스를 경제산업으로 옮긴다 — 이제 chip A는 크로스클래스다.
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    openCaptionModal()

    // chip A(정치행정)를 더블클릭 — 지금 활성 클래스(경제산업)와 달라 대기 상태로
    // 들어간다. 아직 그 그래프는 도착하지 않았다.
    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    expect(fetchGraph).toHaveBeenCalledWith('민주화운동', 'meta', '정치행정')
    expect(screen.queryByRole('dialog')).toBeNull()

    // 대기 중, 사용자가 지금 화면(경제산업 그래프)의 다른 노드를 **직접** 클릭해 연다
    // — round07i 리뷰가 고친 openChipDetail 경로가 아니라 NodeGraph의
    // onNodeClick/onSelect다(재리뷰가 지목한 두 번째 구멍).
    fireEvent.click(screen.getByRole('button', { name: '산업' }))
    expect(screen.getByRole('dialog', { name: '산업' })).toBeInTheDocument()

    // 이제서야 대기하던 정치행정의 그래프가 도착한다.
    ctx = makeCtx({ graph: GRAPH })
    rerenderApp(rerender)

    // 뒤늦게 도착한 A(민주화운동)가 열리지 않는다 — 이 describe가 잠그는 것.
    // '산업'도 남지 않는다 — 그 모달의 자료 목록은 지금 그래프에 없으므로
    // 계속 그릴 수 없다(감사 C). 대신 왜 닫혔는지 말한다.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('그래프가 바뀌어')
  })

  it('대기 중 같은 클래스의 다른 칩을 더블클릭해 열어도, 나중에 도착한 대기 요청이 그 모달을 덮어쓰지 않는다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // GRAPH, class 정치행정 — chip A(정치행정/민주화운동)

    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    selectNode('산업') // GRAPH2, class 경제산업 — chip B(경제산업/산업), 지금 활성 클래스와 같다.
    openCaptionModal()

    // chip A(정치행정)를 더블클릭 — 지금 활성 클래스(경제산업)와 달라 대기 상태로 들어간다.
    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    expect(fetchGraph).toHaveBeenCalledWith('민주화운동', 'meta', '정치행정')
    expect(screen.queryByRole('dialog')).toBeNull()

    // 대기 중, 사용자가 같은 클래스(경제산업)의 다른 칩(B)을 더블클릭한다 —
    // openChipDetail의 즉시-오픈 분기(같은 클래스 경로, 재리뷰가 「openChipDetail:
    // 438-440, untouched」로 지목한 그 줄)를 탄다.
    fireEvent.doubleClick(screen.getByRole('button', { name: '산업 자료 상세보기' }))
    expect(screen.getByRole('dialog', { name: '산업' })).toBeInTheDocument()

    // 이제서야 대기하던 정치행정의 그래프가 도착한다.
    ctx = makeCtx({ graph: GRAPH })
    rerenderApp(rerender)

    // 위 테스트와 같은 이유로 A도 '산업'도 남지 않는다(감사 C 주석 참조).
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('그래프가 바뀌어')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// round07i 감사 C — **열린 모달 밑으로 새 그래프가 도착한다.**
//
// 위 두 describe(리뷰 Finding 1 · 재리뷰)는 "누가 모달을 여는가"만 다뤘다. 남은
// 구멍은 그 반대편이다: 모달이 **이미 열려 있는 채로** 클래스 전환이 착지하면,
// selectedNode는 옛 그래프의 노드 객체인데 그 안의 자료 목록(nodeMaterials)은
// **지금 그래프의 nodeItems[selectedNode.id]** 로 다시 계산된다. node_graph.py가
// 노드 id를 클래스마다 n1부터 다시 매기므로(위 GRAPH2 주석) 두 클래스의 n1은 같은
// id·다른 노드다 — 그래서 제목은 「산업」인 채 목록만 정치행정 n1의 자료로 통째로
// 갈린다. NodeModal의 체크 초기화는 node?.id에 걸려 있어(같은 'n1') 체크도 그대로
// 남는다. 그 상태로 「선택완료」를 누르면 selectionKey(**지금** 활성 클래스, 옛 라벨)
// = ('정치행정','산업') — 존재하지 않는 (클래스, 라벨) 쌍이 새 칩으로 생긴다.
//
// 고침의 방향(아래 OutputTab.jsx 주석 참조): 그래프가 갈리면 그 위에 떠 있던 노드
// 상세는 **닫고 사실을 말한다.** 라벨로 다시 찾아 여는 쪽은 택하지 않았다 — 라벨은
// 클래스 안에서만 유일하므로 클래스를 넘으면 같은 노드를 가리키지 않는다.
describe('열린 모달 밑으로 그래프가 도착한다(round07i 감사 C)', () => {
  const rerenderApp = (rerender) =>
    rerender(
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter>
            <OutputTab />
          </MemoryRouter>
        </AdminProvider>
      </ToastProvider>,
    )

  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  const openCaptionModal = () => fireEvent.click(screen.getAllByText('생성시작')[0])

  it('감사 재현 — 두 n1이 겹치는 자료를 가질 때, 학예사가 만든 적 없는 선택이 생기지 않는다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: 't.docx', artifact_count: 4, timeline_count: 0 },
    })
    const { rerender } = renderTab()

    // 칩 두 개를 만든다 — 정치행정/민주화운동(a,b)과 경제산업/산업(a,e,f).
    selectNode('민주화운동')
    ctx = makeCtx({ graph: GRAPH2_SHARED })
    rerenderApp(rerender)
    selectNode('산업')

    openCaptionModal()

    // ① 크로스클래스 칩을 더블클릭 — 정치행정 fetch가 뜬다(아직 도착 전).
    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    expect(fetchGraph).toHaveBeenCalledWith('민주화운동', 'meta', '정치행정')

    // ② 도착하기 전에 같은 클래스 칩을 더블클릭 — 경제산업 n1(산업)이 열린다.
    fireEvent.doubleClick(screen.getByRole('button', { name: '산업 자료 상세보기' }))
    const dialog = screen.getByRole('dialog', { name: '산업' })
    expect(within(dialog).getByText('통계표')).toBeInTheDocument()

    // ③ 학예사가 3건을 전부 고른다.
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '전체 전체 선택' }))
    expect(screen.getByText(/선택완료/).textContent).toContain('3')

    // ④ 이제서야 정치행정 그래프가 도착한다.
    ctx = makeCtx({ graph: GRAPH })
    rerenderApp(rerender)

    // 열려 있던 상세는 남지 않는다. 남으면 제목만 「산업」인 채 목록이 정치행정
    // n1(4·19 혁명 사진·선언문)으로 갈리고, 체크는 그대로다.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('그래프가 바뀌어')

    // ⑤ 모달이 아직 떠 있다면 학예사는 그대로 「선택완료」를 누른다 — 고쳐진
    //    뒤에는 누를 것이 없으므로 queryAll이 빈 배열이 되어 아무 일도 하지 않는다.
    screen.queryAllByText(/선택완료/).forEach((b) => fireEvent.click(b))

    // 칩 「산업」은 하나뿐이다 — 둘이면 학예사는 진짜와 유령을 구분할 수 없다.
    expect(screen.getAllByRole('button', { name: '산업 자료 상세보기' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    // 감사 실측(결함 상태)은 여기에 세 번째 그룹 {node:'산업', idnbrs:['a']}가 더
    // 붙었다 — 학예사가 열어 본 적 없는 (정치행정, 산업) 노드에 자료 'a'가 실린다.
    expect(createOutput.mock.calls[0][0].selection).toEqual([
      { node: '민주화운동', idnbrs: ['a', 'b'] },
      { node: '산업', idnbrs: ['a', 'e', 'f'] },
    ])
  })

  it('겹치는 자료가 없으면 조용한 무동작이 된다 — 그 경로에서도 상세는 남지 않는다', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동')
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    selectNode('산업') // 경제산업 n1 = d,e,f — 정치행정 n1(a,b)과 겹치지 않는다.
    openCaptionModal()

    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    fireEvent.doubleClick(screen.getByRole('button', { name: '산업 자료 상세보기' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '산업' })).getByRole('checkbox', { name: '전체 전체 선택' }),
    )

    ctx = makeCtx({ graph: GRAPH })
    rerenderApp(rerender)

    // 결함 상태에서는 「선택완료 3」 뱃지를 단 모달이 그대로 떠 있었고, 눌러도
    // 교집합이 비어 아무것도 고르지 않은 채 닫혔다(체크만 사라지는 무동작).
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('그래프가 바뀌어')
  })

  it('최소 변형 — 칩 하나로도 재현된다(대기를 취소한 뒤 연 모달도 덮인다)', () => {
    const { rerender } = renderTab()
    selectNode('민주화운동') // 정치행정 칩 하나뿐이다.
    ctx = makeCtx({ graph: GRAPH2 })
    rerenderApp(rerender)
    openCaptionModal()

    // 크로스클래스 칩 더블클릭 → 설명문 모달을 취소로 닫는다(대기는 살아 있다).
    fireEvent.doubleClick(screen.getByRole('button', { name: '민주화운동 자료 상세보기' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    // 그래프의 아무 노드나 직접 클릭해 연다 — showNode가 대기를 지운다.
    fireEvent.click(screen.getByRole('button', { name: '경제' }))
    expect(screen.getByRole('dialog', { name: '경제' })).toBeInTheDocument()

    // 앞서 걸린 fetch가 뒤늦게 착지한다.
    ctx = makeCtx({ graph: GRAPH })
    rerenderApp(rerender)

    // 결함 상태에서는 제목 「경제」인 채 목록만 정치행정 n2(포스터)로 갈렸다.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('그래프가 바뀌어')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// round07e D — 라이브인데 그래프가 없으면 **데모를 그리지 않는다.**
//
// 이전에는 `!live` 하나로 「데모 모드」와 「라이브인데 그래프 없음」을 함께
// 처리했다. 그래서 새로고침 뒤(graph=null) 하드코딩 데모(nodes.js)가 진짜처럼
// 그려졌다 — 「독립운동 0건」 같은 노드는 라이브 그래프가 낼 수 없는 값인데도
// 화면에 아무 표시가 없었다. 학예사가 가짜 숫자를 근거로 자료를 고르게 된다.
describe('라이브인데 그래프가 없을 때 — 데모 폴백 금지', () => {
  // 데모 시나리오에 눈에 띄는 노드를 심어 둔다. 이 이름이 화면에 나오면
  // 폴백이 되살아난 것이다.
  const DEMO = {
    nodes: [{ id: 'demo-1', label: '데모노드', count: 3, group: 'root' }],
    nodeEdges: [],
    nodeItems: { 'demo-1': ['x'] },
    output: { caption: {}, promo: {} },
  }

  it('데모 노드를 그리지 않는다', () => {
    ctx = makeCtx({ graph: null, graphStatus: 'idle', activeScenario: DEMO })
    renderTab()
    expect(screen.queryByText('데모노드')).toBeNull()
  })

  it('묶음기준 목록도 대신 보여주지 않는다', () => {
    // 좌측에 「주제별 분류」 같은 묶음기준이 뜨면 사용자는 그것을 실제
    // 클래스로 읽는다. 라이브에서는 빈 목록이 정직하다.
    ctx = makeCtx({ graph: null, graphStatus: 'idle', activeScenario: DEMO })
    renderTab()
    const list = screen.getByRole('tablist', { name: /클러스터링 기준|주제 대분류/ })
    expect(within(list).queryAllByRole('tab')).toHaveLength(0)
  })

  it('무엇이 없는지 말한다', () => {
    ctx = makeCtx({ graph: null, graphStatus: 'idle', activeScenario: DEMO })
    renderTab()
    expect(screen.getByText(/검색해 주세요/)).toBeInTheDocument()
  })

  it('불러오는 중이면 그렇게 말한다', () => {
    ctx = makeCtx({ graph: null, graphStatus: 'loading', activeScenario: DEMO })
    renderTab()
    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('error 일 때는 사유를 두 번 말하지 않는다', () => {
    // graphStatus==='error' 는 위쪽에서 이미 notice 를 그린다.
    ctx = makeCtx({
      graph: null, graphStatus: 'error',
      graphNotice: '노드 그래프를 불러오지 못했습니다', activeScenario: DEMO,
    })
    renderTab()
    expect(screen.getByText('노드 그래프를 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.queryByText(/검색해 주세요/)).toBeNull()
  })

  it('데모 모드(비라이브)에서는 시나리오를 그대로 그린다', () => {
    // 이 라운드가 바꾼 것은 **라이브인데 그래프가 없는 경우**뿐이다.
    // 서버가 없는 더미 모드에서 시나리오를 그리는 것은 원래 정상 동작이다.
    ctx = makeCtx({ isLive: false, graph: null, graphStatus: 'idle', activeScenario: DEMO })
    renderTab()
    expect(screen.getByText('데모노드')).toBeInTheDocument()
  })
})

// round07g — **산출물은 그 대화 안에서만 보인다.**
//
// 사용자 보고: 「산출물 생성 된것들은 그 세션에서만 산출된것들만 보여줘야해 —
// 지금 보면 다른 세션에서도 공유되거든?」 이 화면이 목록 조회와 생성 요청 양쪽에
// 대화 id 를 실어 보내는 것이 그 수정의 프론트 쪽 절반이다(나머지 절반은 서버 필터).
//
// 대화의 출처는 둘이고 **주소가 우선**이다: 셸의 탭 링크·「나의 기록」 재개가
// `?c=` 를 실어 주고 F5 를 눌러도 살아남는다. 컨텍스트 conversationId 는 새 검색
// 직후처럼 주소에 아직 없을 때를 받는다.
describe('대화 격리 (round07g)', () => {
  const renderAt = (entry) =>
    render(
      <ToastProvider>
        <AdminProvider>
          <MemoryRouter initialEntries={[entry]}>
            <OutputTab />
          </MemoryRouter>
        </AdminProvider>
      </ToastProvider>,
    )

  const selectNode = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
    fireEvent.click(screen.getByText(/선택완료/))
  }

  it('주소의 ?c= 를 목록 조회에 실어 보낸다', async () => {
    renderAt('/search/output?c=conv-URL')
    await waitFor(() =>
      expect(listOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-URL' })))
  })

  it('주소에 없으면 컨텍스트 conversationId 로 떨어진다(새 검색 직후)', async () => {
    ctx = makeCtx({ conversationId: 'conv-CTX' })
    renderAt('/search/output')
    await waitFor(() =>
      expect(listOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-CTX' })))
  })

  it('둘 다 있으면 주소가 이긴다 — 재개·딥링크가 가리킨 대화가 정본이다', async () => {
    ctx = makeCtx({ conversationId: 'conv-CTX' })
    renderAt('/search/output?c=conv-URL')
    await waitFor(() =>
      expect(listOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-URL' })))
  })

  it('전시자료 생성 요청에 conversation_id 가 실린다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o1', file_name: 't.xlsx', artifact_count: 2 },
    })
    renderAt('/search/output?c=conv-URL')
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[1])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0]).toMatchObject({ conversation_id: 'conv-URL' })
  })

  // round07g 수정 R1 (Important-1) — **이 화면 전체의 결말**을 잠근다.
  //
  // 리뷰가 잡은 실제 재현 경로: 라이브러리 「산출물 N건」이 대화를 못 실어 주면
  // `?c=` 없이 이 화면에 들어오고, 컨텍스트 conversationId 도 없으면 목록이
  // `conversation_id` 없이 조회해 **서버 기본값(내 전체)** 을 받는다 — 「다른 세션
  // 것까지 보인다」가 그대로 재현된다. OutputList 단위 테스트가 그 게이트를 잠그지만
  // 여기서 한 번 더 보는 이유는, 이 화면이 `<OutputList>` 를 `liveButNoGraph` 게이트
  // **밖**에서 무조건 렌더하기 때문이다 — 그래프가 없어 아무것도 안 그리는 화면에서도
  // 목록만은 살아 있었다. 그 조합이 정확히 사고 현장이다.
  it('대화가 없으면(라이브러리 딥링크 등) 목록을 조회하지 않는다', async () => {
    ctx = makeCtx({ conversationId: null })
    renderAt('/search/output')
    expect(await screen.findByText(/산출물은 그 대화에서 만든 것만 보여줍니다/)).toBeInTheDocument()
    expect(listOutputs).not.toHaveBeenCalled()
  })

  it('설명문 생성 요청에도 실린다 — 빠지면 만든 직후부터 목록에 안 뜬다', async () => {
    createOutput.mockResolvedValue({
      ok: true, data: { id: 'o2', kind: 'caption', file_name: 't.docx', artifact_count: 2 },
    })
    renderAt('/search/output?c=conv-URL')
    selectNode('민주화운동')

    fireEvent.click(screen.getAllByText('생성시작')[0])
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() => expect(createOutput).toHaveBeenCalled())
    expect(createOutput.mock.calls[0][0]).toMatchObject({ conversation_id: 'conv-URL' })
  })
})
