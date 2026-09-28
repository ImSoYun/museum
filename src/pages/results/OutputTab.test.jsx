// R6c-ext D1-7 재퍼블 — 이 화면의 배너(퍼블 v2에는 "학예 결과물 자동 생성"이었으나
// round07b-ext에서 "학예 산출물 생성"으로 변경)는 이제 상위 OutputView.jsx가
// 소유한다(OutputView.test.jsx가 검증). 여기서는 OutputTab 본체(node_view·
// node_select_panel)만 렌더해 검증한다 — 세 번째 패널(node_result_panel, 생성 결과
// 예시 초안)은 round07b-ext task-11이 제거했다(피그마 디스크립션에 없던 데모 패널이라
// 진짜 산출물 목록 OutputList.jsx로 대체됐다 — 그 목록 자체의 검증은
// OutputList.test.jsx 소관이다).
//
// 실동작 → 준비중 토스트로 교체한 테스트(브리프 크로스태스크 의존성):
//   생성시작 로딩→결과 노출, NodeModal 선택 완료 후 칩 갱신 — 전부 실제 상태 변화가
//   사라지고 showToast('준비 중입니다') 단언으로 바뀌었다. (전체 내보내기·복사·재생성하기·
//   타임라인 생성은 준비중 토스트가 아니라 task-11에서 버튼째 사라졌다 — 아래 참조.)
// 제거한 테스트(근거): T6-5(선택 0/1건에 따른 "주요 주제"/"선택 자료" 라벨 전환) — NodeModal의
// 선택 완료가 더 이상 부모 상태를 바꾸지 않으므로(브리프 §범위 5) 라벨은 항상 "선택 자료"로
// 고정된다. "설명문 세부유형 select → 결과 배지" 테스트도 제거 — 생성이 준비중이 된 이상
// select 값과 결과 콘텐츠 사이에 실제 연동이 없어, 배지를 남기면 없는 연동을 있는 것처럼
// 보여 오해를 부른다(그래서 OutputTab.jsx도 그 배지를 함께 제거했다).
// round07b-ext task-11 제거: 생성 결과 패널·예시 초안 고지(B1)·결과 탭 전환·재생성하기·
// 타임라인 생성·전체 내보내기·복사 — 패널 자체가 사라졌으므로 그 안의 모든 것이 함께 없어진다.
//
// task-11이 추가로 요구하는 것: OutputTab이 이제 항상 OutputList를 마운트하므로,
// outputsApi.js를 목(mock)한다 — 안 하면 real fetch가 나가 "서버에 연결하지 못했습니다"
// 토스트가 비동기로 뜰 수 있고, 그 타이밍이 `준비 중입니다` 단언과 경합해 role="status"
// 유일성이 깨질 수 있다. listOutputs는 항상 빈 목록으로 즉시 resolve시켜 그 여지를 없앤다.
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioProvider, useScenario } from '../../context/ScenarioContext.jsx'
import { ReadOnlyProvider } from '../../context/ReadOnlyContext.jsx'
import { AdminProvider } from '../../state/AdminProvider.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import { getScenario } from '../../data/scenarios.js'
import { materials } from '../../data/materials.js'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

const createOutput = vi.fn()
const listOutputs = vi.fn().mockResolvedValue({ ok: true, data: { outputs: [], has_more: false } })
const deleteOutputs = vi.fn()
const downloadOutputFile = vi.fn()
vi.mock('../../lib/outputsApi.js', () => ({
  // isLive: 목 모듈이라 실제 env를 안 본다. true 로 둬야 OutputList·SearchFlowLayout의
  // 데모 모드 게이트를 통과해 기존 조회 경로가 그대로 검증된다.
  isLive: () => true,
  createOutput: (...a) => createOutput(...a),
  listOutputs: (...a) => listOutputs(...a),
  deleteOutputs: (...a) => deleteOutputs(...a),
  downloadOutputFile: (...a) => downloadOutputFile(...a),
  // round10a A조 최종 리뷰 I-2 — 전체 교체 목이라 OutputTab.jsx가 쓰는 export를 전부
  // 실어야 한다. UNKNOWN_OUTCOME이 outputsApi.js로 옮겨간 뒤(위 파일 참조) 이 값도 여기
  // 함께 실어야 import가 죽지 않는다 — 실제 정의(lib/outputsApi.js)와 같은 값이다.
  UNKNOWN_OUTCOME: new Set([0, 502, 503, 504]),
}))

const { default: OutputTab, EXHIBIT_SUB_EXHIBITION, EXHIBIT_SUB_XLSX } = await import('./OutputTab.jsx')

// round10 Task5 리뷰 fix — LibraryProvider가 이제 useLocation()을 쓰는데, OutputTab이
// useLibrary()를 쓰지 않으므로(레포 전체 grep 확인) 이 wrap은 애초에 죽은 코드였다 —
// 걷어낸다(안 걷어내면 Router 컨텍스트 밖이라 useLocation()이 던진다).
function renderTab() {
  return render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <OutputTab />
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )
}

// Probe lets a test switch the active scenario via the context API.
function ScenarioProbe({ id }) {
  const { setScenarioById } = useScenario()
  return <button onClick={() => setScenarioById(id)}>__switch__</button>
}

function renderTabWithProbe(switchId) {
  return render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <ScenarioProbe id={switchId} />
            <OutputTab />
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )
}

// round07b — 노드를 열어 "선택 완료"까지 눌러 선택 상태를 만든다. 모달은 열릴 때
// 전 항목이 체크된 상태라(NodeModal의 기존 동작) 그대로 확정하면 그 노드 전체가 선택된다.
function selectFirstNode() {
  fireEvent.click(screen.getByRole('button', { name: '4·19 혁명' }))
  // round07b-ext — 모달을 열면 **아무것도 선택돼 있지 않다**. 담을 것을 직접
  // 골라야 한다. 유형 행의 「전체 전체 선택」 체크박스가 그 유형의 자료를 한
  // 번에 켠다(기본으로 펼쳐지는 유형이 "전체"라 곧 전 자료다).
  fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
  fireEvent.click(screen.getByText(/선택완료/))
}

test('묶음기준 탭이 활성 클러스터링 기준(criteria.active)에서 파생된다', () => {
  renderTab()
  expect(screen.getByRole('tab', { name: '주제별 분류' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '시대별 분류' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '매체별 분류' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '키워드 유사도 분류' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '사용자 설정' })).toBeInTheDocument()
  // 비활성 기준은 탭으로 노출되지 않는다
  expect(screen.queryByRole('tab', { name: '인물별 분류' })).not.toBeInTheDocument()
})

test('generation band renders 생성시작 buttons', () => {
  renderTab()
  const buttons = screen.getAllByText('생성시작')
  expect(buttons.length).toBeGreaterThanOrEqual(2)
})

test('node click opens NodeModal', () => {
  renderTab()
  // target the graph node button (aria-label), not the derived chip span
  fireEvent.click(screen.getByRole('button', { name: '4·19 혁명' }))
  expect(screen.getByText('번역')).toBeInTheDocument()
})

test('node click opens modal showing that node\'s scenario materials', () => {
  renderTab()

  // n1 = '4·19 혁명', nodeItems: ['m3', 'm23', 'm42']
  const democracy = getScenario('democracy')
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]))
  const nodeId = 'n1'
  const itemIds = democracy.nodeItems[nodeId] || []
  const firstMaterial = byId[itemIds[0]]

  fireEvent.click(screen.getByRole('button', { name: '4·19 혁명' }))

  const checkboxes = screen.getAllByRole('checkbox')
  expect(checkboxes.length).toBeGreaterThan(0)
  expect(screen.getByText(firstMaterial.title)).toBeInTheDocument()
})

test('선택 자료 chips are scenario-coherent (no leftover democracy literals)', () => {
  renderTabWithProbe('economy')

  fireEvent.click(screen.getByText('__switch__'))

  // 박종철은 민주화운동 시나리오의 칩 라벨이었다 — economy 시나리오엔 없으므로 완전히 사라져야 한다
  expect(screen.queryByText('박종철')).toBeNull()

  const economy = getScenario('economy')
  const expectedChip = economy.nodes.find((n) => n.group !== 'root').label
  expect(screen.getAllByText(expectedChip).length).toBeGreaterThan(0)
})

test('묶음기준 사용자 설정 선택 시 플레이스홀더 안내가 노출된다', () => {
  renderTab()
  expect(screen.queryByText(/사용자 설정 묶음기준은 준비 중입니다/)).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: '사용자 설정' }))
  expect(screen.getByText(/사용자 설정 묶음기준은 준비 중입니다/)).toBeInTheDocument()
})

// round07b — 선택이 실제 동작이 되면서 B2의 "준비중" 안내가 상태 안내로 바뀐다.
test('선택 전에는 고르라는 안내가 보인다', () => {
  renderTab()
  expect(screen.getByText(/노드를 클릭해 자료를 고르면 여기에 표시됩니다/)).toBeInTheDocument()
})

test('설명문은 퍼블 카피를 유지하고, 홍보자료 자리는 전시자료가 대신한다(round07b)', () => {
  renderTab()
  expect(screen.getByText('캡션·패널·도록 초안 자동 생성')).toBeInTheDocument()
  // "전시자료"는 이제 이 select 패널의 유형 제목과 산출물 목록(OutputList)의 탭
  // 두 곳에 나온다(task-11 이후) — getByText 단수 조회는 더 이상 유효하지 않다.
  expect(screen.getAllByText('전시자료').length).toBeGreaterThan(0)
  expect(screen.queryByText('채널별 홍보 초안 자동 생성')).toBeNull()
})

test('설명문 세부유형 select 높이가 같은 행 버튼(2.25rem)과 일치한다(B4)', () => {
  renderTab()
  expect(screen.getByLabelText('설명문 유형').className).toContain('h-[2.25rem]')
})

// round07f — round07e 최종 리뷰 F1이 「전시 해설」·「교육 자료」를 죽은 컨트롤로
// 오인해 준비중으로 잠갔었다. 대조표 §1-A(피그마 695:107618 실측)로 확인됐다 —
// 그 둘은 애초에 피그마에 없는 round07b-ext의 목업 값이었다. 걷어내고 피그마가
// 그리는 대로 「조건 및 대상 선택」 placeholder + 실제 항목 1개로 되돌린다.
test('설명문 select에 목업 옵션이 없다 — 캡션 하나뿐이다', () => {
  renderTab()
  const select = screen.getByLabelText('설명문 유형')
  const options = within(select).getAllByRole('option').map((o) => o.textContent)
  expect(options).toEqual(['조건 및 대상 선택', '캡션'])
})

// round07f — 대조표 §1-A: 전시자료 쪽 셀렉트가 통째로 없었다. 설명문과 같은
// 규격(placeholder + 실제 항목 1개)으로 신설한다.
// round07i — 그 자리가 실제로 늘었다. 「특별 전시 자료 생성」이 두 번째로 들어와
// 항목이 둘이 됐다(피그마 「전시자료 드롭다운」 3항목 중 앞의 둘). 순서까지 잠근다.
// round07i 감사 C — ~~「생성시작」의 분기가 이 문자열에 의존한다~~ 는 더 이상
// 사실이 아니다. 분기는 이제 option 의 value(=서버 kind)를 본다 — 그래서 문구와
// value 를 **따로** 잠근다: 문구는 피그마 정본이라 지켜야 하고, value 는 분기가
// 딛고 선 계약이라 지켜야 한다. 예전처럼 문구 하나에 둘을 겹쳐 두면, 문구를 다듬는
// 순간 분기가 조용히 반대로 넘어가 엉뚱한 산출물(.xlsx)이 생성됐다.
test('전시자료에도 조건 및 대상 선택 드롭다운이 있다 — 특별전시·엑셀 두 항목이다', () => {
  renderTab()
  const select = screen.getByLabelText('전시자료 유형')
  const options = within(select).getAllByRole('option')
  expect(options.map((o) => o.textContent)).toEqual([
    '조건 및 대상 선택', '특별 전시 자료 생성', '학예 기획 목록 엑셀 만들기',
  ])
  expect(options.map((o) => o.value)).toEqual(['', EXHIBIT_SUB_EXHIBITION, EXHIBIT_SUB_XLSX])
})

// round07i — 드롭다운 값이 바뀌면 같은 "생성시작" 버튼이 여는 모달도 바뀌어야
// 한다. 기본값(엑셀)일 때는 지금까지처럼 ExhibitModal이 열린다는 것은 위
// "전시자료 모달 제목 초기값…" 테스트가 이미 잠갔으므로, 여기서는 값을 바꾼
// 뒤의 반대쪽 경로를 본다.
test('전시자료 드롭다운에서 「특별 전시 자료 생성」을 고르면 다른 모달이 열린다', () => {
  renderTab()
  selectFirstNode()
  fireEvent.change(screen.getByLabelText('전시자료 유형'), {
    target: { value: EXHIBIT_SUB_EXHIBITION },
  })
  fireEvent.click(screen.getAllByText('생성시작')[1])
  expect(screen.getByText('특별전시 자료 생성')).toBeInTheDocument()
  expect(screen.queryByText('학예 기획 자료 목록')).toBeNull()
})

// ── round06c-ext D1-7: 모든 실행 버튼 → 정확히 "준비 중입니다" 토스트 ──────────────────
// round07e — 설명문 생성만 이 규칙에서 풀렸다(서버가 kind='caption'을 받게 됐다).
// 아래 두 테스트가 그 계약을 대신 잠근다 — "지우지 말고 다시 쓴다"(브리프).

test('생성시작(설명문) 클릭 시 설명문 생성 모달이 열린다(round07e) — 더는 준비중이 아니다', () => {
  renderTab()
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[0])
  expect(screen.getByText('설명문 생성')).toBeInTheDocument()
  expect(screen.queryByRole('status')).toBeNull()
})

// round07f 리뷰(Important 2) — 세 진입점(이 두 모달 + ChatCaptionPanel)이 실제로
// outputTitles.js의 defaultOutputTitle 산물을 쓰는지는 이전까지 아무 테스트도
// 확인하지 않았다. outputTitles.test.js는 순수 함수만 잠글 뿐 그 함수가 화면에
// 실제로 배선됐는지는 확인하지 못한다 — 리뷰어가 변이(OutputTab의 defaultTitle
// 두 곳을 '설명문'/'전시자료' 리터럴로, ChatCaptionPanel 초기값을 '대화 설명문'
// 리터럴로 되돌리기)로 이를 실증했다: src/pages/results/ 330테스트가 전부
// 통과했다. 아래가 그 구멍을 막는다(ChatCaptionPanel 쪽은 ChatCaptionPanel.test.jsx가 잠근다).
test('설명문 모달 제목 초기값이 정본 기본값(defaultOutputTitle)이다 — 리터럴이 아니다(round07f 리뷰)', () => {
  renderTab()
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[0])
  // round07g — 설명문 모달의 제목 라벨은 공용 조각(CaptionTitleField)의
  // 「제목 설정」이다. 전시자료 모달도 Task 3에서 같은 라벨로 바뀌었다(아래 테스트).
  expect(screen.getByLabelText('제목 설정')).toHaveValue(defaultOutputTitle('caption'))
})

test('전시자료 모달 제목 초기값이 정본 기본값(defaultOutputTitle)이다 — 리터럴이 아니다(round07f 리뷰)', () => {
  renderTab()
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[1])
  // round07g Task 3 — 라벨을 피그마대로 「제목」→「제목 설정」으로 바꿨다.
  expect(screen.getByLabelText('제목 설정')).toHaveValue(defaultOutputTitle('exhibit'))
})

test('설명문 생성시작도 고른 자료가 없으면 누를 수 없다(round07e, 전시자료와 같은 규칙)', () => {
  renderTab()
  expect(screen.getAllByText('생성시작')[0].closest('button')).toBeDisabled()
})

test('전시자료 생성시작은 고른 자료가 없으면 누를 수 없다', () => {
  renderTab()
  // 자료를 고르지 않은 채로 엑셀을 만들면 헤더만 있는 빈 표가 나온다.
  expect(screen.getAllByText('생성시작')[1].closest('button')).toBeDisabled()
})

test('프로젝트로 저장 버튼은 제거됐다(피그마 미존재)', () => {
  renderTab()
  expect(screen.queryByRole('button', { name: /프로젝트로 저장/ })).toBeNull()
})

test('선택 자료 칩 클릭(그래프에서 위치 확인)은 아직 준비 중이다', () => {
  renderTab()
  selectFirstNode()
  const chip = screen.getByRole('button', { name: /그래프에서 위치 확인/ })
  fireEvent.click(chip)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
})

test('칩 제거 버튼은 그 노드의 선택을 실제로 버린다(round07b)', () => {
  renderTab()
  selectFirstNode()
  expect(screen.getByRole('button', { name: /선택 해제/ })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /선택 해제/ }))

  expect(screen.queryByRole('button', { name: /선택 해제/ })).toBeNull()
  expect(screen.getByText(/노드를 클릭해 자료를 고르면/)).toBeInTheDocument()
})

test('NodeModal 선택 완료가 선택을 부모로 올리고 모달을 닫는다(round07b)', () => {
  renderTab()
  fireEvent.click(screen.getByRole('button', { name: '4·19 혁명' }))

  // round07b-ext — 열면 아무것도 선택돼 있지 않다. 담을 것을 직접 고른다.
  fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
  fireEvent.click(screen.getByText(/선택완료/))

  // 모달이 닫혔으므로 "메타정보"(모달 우측 패널) 라벨은 사라진다
  expect(screen.queryByText('메타정보')).toBeNull()
  // 고른 건수가 칩과 안내 문구에 반영된다 — D1-7의 "표시용 칩"과 다른 점이다.
  const items = getScenario('democracy').nodeItems.n1 || []
  expect(screen.getByText(new RegExp(`자료 ${items.length}건을 골랐습니다`))).toBeInTheDocument()
})

// ── round10 Task7 — 산출물생성 탭의 읽기 전용(프로젝트 상세) ─────────────────
// ProjectDetail이 <ReadOnlyProvider value={true}>로 감싸 이 화면을 재생한다(Task6).
// spec 결정 7 「노드·생성 버튼을 그대로 두되 비활성 — 숨기지 않는다」가 이 세
// 테스트의 근거다: 그래프는 그려지되(비활성 표현만 얹는다) 생성시작·자료선택은
// 실제로 막혀야 한다.
function renderTabReadOnly() {
  return render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <ReadOnlyProvider value={true}>
              <OutputTab />
            </ReadOnlyProvider>
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )
}

test('읽기 전용이면 생성시작 버튼이 비활성이다', () => {
  renderTabReadOnly()
  const buttons = screen.getAllByText('생성시작')
  expect(buttons.length).toBeGreaterThanOrEqual(2)
  buttons.forEach((b) => expect(b.closest('button')).toBeDisabled())
})

test('읽기 전용이면 노드·칩을 눌러도 모달이 열리지 않는다', () => {
  renderTabReadOnly()
  // 정상 모드라면 이 클릭이 NodeModal을 연다(위 "node click opens NodeModal" 테스트
  // 참조 — 그 모달의 우측 패널에만 있는 "번역" 버튼으로 열림 여부를 판정한다).
  fireEvent.click(screen.getByRole('button', { name: '4·19 혁명' }))
  expect(screen.queryByText('번역')).toBeNull()
})

// round10 최종리뷰 M-5 — 자료선택 대분류 탭(node_criteria_btn)이 readOnly를 보지 않아
// **회색인데 눌렸다**. 바깥 node_view의 opacity-40은 보이기만 회색으로 만들 뿐이라,
// 누르면 chooseClass가 실제로 돌아 저장된 기록을 보는 화면에서 새 조회(fetchGraph)가
// 나갔다 — spec §5-5 「자료선택 노드·칩: 보이되 disabled」 위반이다.
test('읽기 전용이면 자료선택 대분류 탭이 눌리지 않는다', () => {
  renderTabReadOnly()
  const tabs = screen.getAllByRole('tab')
  expect(tabs.length).toBeGreaterThan(0)
  tabs.forEach((t) => {
    expect(t).toBeDisabled()
    // 사용자 지시(2026-09-17) — 흐리게 만들지 않는다. 커서로만 알린다.
    expect(t.className).not.toContain('opacity-40')
    expect(t.className).toContain('cursor-not-allowed')
  })
})

// round10a T2 — 사용자 지시(2026-09-16): 「회색화면 말고 노드나 버튼들 비활성화로」.
// 컨테이너까지 흐리면 그 안의 컨트롤과 곱해져 유효 투명도가 0.16 이 된다(라이브 실측) —
// 노드 그래프와 건수가 안 읽힌다. 결정 7(「노드 그래프는 숨기지 않는다」)의 뜻은
// 「보이되 못 누른다」이므로, 흐려지는 것은 **조작 요소만**이다.
test('읽기 전용이어도 자료선택 컨테이너 자체는 흐려지지 않는다', () => {
  const { container } = renderTabReadOnly()
  const view = container.querySelector('.node_view')
  expect(view).toBeTruthy()
  expect(view.className).not.toContain('opacity-40')
})

test('정상 모드의 대분류 탭은 그대로 눌린다(회귀 대조군)', () => {
  renderTab()
  const tabs = screen.getAllByRole('tab')
  expect(tabs.length).toBeGreaterThan(0)
  tabs.forEach((t) => expect(t).toBeEnabled())
})

test('읽기 전용이어도 노드 그래프 자체는 보인다(숨기지 않는다, 결정 7)', () => {
  // NodeGraph.test.jsx의 관행(:6-12 "renders one button per outer node" ·
  // :92-102 "노드와 커넥터 SVG가 같은 설계 캔버스 래퍼 안에 있다")을 따른다 —
  // 노드 버튼 하나만 있는지가 아니라, 그래프가 **실제로 그려졌는지**(외곽 노드
  // 여럿 + 커넥터 SVG)에 더 가깝게 본다. 버튼 하나만 보면 "노드처럼 생긴 다른
  // 무언가"가 우연히 렌더돼도 초록일 수 있다.
  const { container } = renderTabReadOnly()
  const democracy = getScenario('democracy')
  const outerNodes = democracy.nodes.filter((n) => n.group !== 'root')
  outerNodes.forEach((n) => {
    expect(screen.getByRole('button', { name: n.label })).toBeInTheDocument()
  })
  const canvas = container.querySelector('.node_graph_canvas')
  expect(canvas).not.toBeNull()
  expect(canvas.querySelector('.node_graph_lines')).not.toBeNull()
})

// ── round10a A조 최종 리뷰 I-1 — 그래프 노드 자체가 "활성처럼" 보이던 병 ──────────
// round10 T2가 .node_view 컨테이너의 opacity-40을 걷어내며 그래프·건수를 또렷하게
// 만들었는데, 그 컨테이너 흐림이 노드 버튼의 유일한 비활성 신호였다는 것을 놓쳐
// 「원색 + 손가락 커서로 반응하는데 눌러도 아무 일도 없다」는 이 라운드의 주제 그
// 자체가 되살아났다. NodeGraph가 disabled prop을 받게 됐으니 OutputTab이 readOnly를
// 실어 주는지 여기서 잠근다(NodeGraph.test.jsx는 그 prop 자체의 동작만 본다).
test('읽기 전용이면 그래프 노드 버튼이 disabled + 비활성 표시를 받는다(round10a A조 I-1)', () => {
  renderTabReadOnly()
  const democracy = getScenario('democracy')
  const outerNodes = democracy.nodes.filter((n) => n.group !== 'root')
  outerNodes.forEach((n) => {
    const btn = screen.getByRole('button', { name: n.label })
    expect(btn).toBeDisabled()
    // 사용자 지시(2026-09-17) 「그냥 그대로인데 안눌러지도록」 — 흐리게 만들지 않는다.
    expect(btn.className).not.toContain('opacity-40')
    expect(btn.className).toContain('cursor-not-allowed')
  })
})

// I-1의 두 번째 지적 — "노드를 클릭해 자료를 고르세요"는 못 할 행동을 지시하는
// 명령문이라 읽기 전용에서는 거짓 안내다. ChatTab.jsx의 readOnly 안내 분기·
// ProjectDetail.jsx 상단 배너와 같은 어투("저장된 기록이라 ~할 수 없습니다")로 가른다.
test('읽기 전용이면 자료선택 안내 문구가 "고르세요" 대신 "고를 수 없습니다"로 바뀐다(round10a A조 I-1)', () => {
  renderTabReadOnly()
  expect(screen.queryByText('노드를 클릭해 자료를 고르세요')).toBeNull()
  expect(screen.getByText('저장된 기록이라 자료를 고를 수 없습니다')).toBeInTheDocument()
})

test('정상 모드에서는 그래프 노드가 그대로 활성이고 안내 문구도 그대로다(회귀 대조군)', () => {
  renderTab()
  const democracy = getScenario('democracy')
  const outerNodes = democracy.nodes.filter((n) => n.group !== 'root')
  outerNodes.forEach((n) => {
    expect(screen.getByRole('button', { name: n.label })).toBeEnabled()
  })
  expect(screen.getByText('노드를 클릭해 자료를 고르세요')).toBeInTheDocument()
})

// ── round10a A조 최종 리뷰 M-8 — 읽기 전용에서 두 select만 계속 활성이었다 ────────
test('읽기 전용이면 설명문·전시자료 유형 select도 비활성이다(round10a A조 M-8)', () => {
  renderTabReadOnly()
  expect(screen.getByLabelText('설명문 유형')).toBeDisabled()
  expect(screen.getByLabelText('전시자료 유형')).toBeDisabled()
})

// ── ⚠️ 반드시 짚고 갈 것(브리프) — 하단 OutputList는 **지금 로그인한 사람 자신의**
// 산출물을 대화 id로 걸러 서버에서 읽는다. 남의 프로젝트를 보는 화면에 그대로
// 두면 그 프로젝트와 무관한 내 산출물이 뜬다 — 그래서 읽기 전용이면 이 컴포넌트가
// 자기 OutputList를 그리지 않는다(그 자리는 상세(ProjectDetail)가 ProjectOutputList로
// 대신한다 — ProjectOutputList.test.jsx가 그 목록 자체를 검증한다). 정상 모드에서는
// 그대로 그려야 회귀가 아니므로 대조군도 함께 잠근다.
test('읽기 전용이면 자기 OutputList(소유자 전용 목록)를 그리지 않는다', () => {
  const { container } = renderTabReadOnly()
  expect(container.querySelector('.output_list')).toBeNull()
  expect(screen.queryByPlaceholderText('산출물 제목 검색')).toBeNull()
})

test('읽기 전용이 아니면(기존 화면) OutputList가 그대로 그려진다 — 대조군', () => {
  const { container } = renderTab()
  expect(container.querySelector('.output_list')).not.toBeNull()
})

// round10a T2-C — OutputList는 대화 id를 모르면 아예 조회하지 않는다(OutputList.jsx:136
// 게이트 — round07g "라이브인데 대화를 모르면 조회하지 않는다"). 기본 renderTab()은
// 주소에 `?c=`가 없어 이 게이트에 늘 걸리므로, listOutputs 재조회로 bumpOutputsVersion
// 호출을 확인하려는 아래 테스트만 대화 id를 실어 준다 — renderTab()과 같은 트리에
// MemoryRouter의 initialEntries만 더한 변형이다(새 렌더 방식을 짓지 않는다).
function renderTabWithConversation() {
  return render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter initialEntries={['/?c=test-conv']}>
            <OutputTab />
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )
}

// ── round10a T2-C — 응답을 못 받은 것을 「실패」로 단정하지 않는다 ─────────────────
// 라이브에서 502 를 받고 "산출물 생성에 실패했습니다"를 띄운 뒤 목록을 조회하니 그
// 산출물이 그대로 있었다(서버는 실제로 만들어 저장했다) — 사용자는 「실패」를 보고
// 목록에는 있으니, 다시 누르면 중복이 쌓인다. 정정 기록 — 프론트의 실패 배선
// 자체는 정상이다(POST /outputs 만 502로 가로채 다시 시험하니 문구가 정상적으로
// 떴다). 고치는 것은 문구의 사실성이지 배선이 아니다.
test('502면 만들어졌을 수 있다고 말하고 목록을 새로 고친다(round10a T2-C)', async () => {
  createOutput.mockResolvedValue({ ok: false, status: 502, notice: '산출물 생성에 실패했습니다' })
  renderTabWithConversation()
  const callsBefore = listOutputs.mock.calls.length
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[0])
  fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
  expect(await screen.findByText(/만들어졌을 수 있습니다/)).toBeInTheDocument()
  // bumpOutputsVersion이 실제로 불렸다는 것은, 그 값을 refreshKey로 받는
  // OutputList가 목록을 다시 읽었다는 사실로 확인한다(OutputList.jsx:164 의
  // refreshKey 의존 useEffect) — 이 파일의 기존 관행대로 ScenarioProvider의
  // 실제 컨텍스트를 그대로 쓰고, setter를 따로 모킹하지 않는다.
  expect(listOutputs.mock.calls.length).toBeGreaterThan(callsBefore)
})

test('4xx는 지금처럼 실패로 말한다(round10a T2-C)', async () => {
  createOutput.mockResolvedValue({ ok: false, status: 422, notice: '잘못된 요청입니다' })
  renderTab()
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[0])
  fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
  expect(await screen.findByText('잘못된 요청입니다')).toBeInTheDocument()
})

// ── round10a A조 최종 리뷰 M-7 — 응답 불명일 때 모달이 열린 채 남아 안내를 가린다 ──
// 이전에는 `!created.ok` 분기에서 notifyCreateFailure 후 곧바로 return해 모달을 닫는
// setCaptionOpen(false) 등에 닿지 못했다. finally가 busy만 풀어 「생성하기」가 다시
// 눌릴 수 있었다 — 이미 만들어졌을 자료를 중복 생성할 위험이 남는다. 응답 불명(502
// 등)에서는 목록이 이미 새로고침됐으니(위 테스트) 모달을 닫아 그 목록 앞에 세운다.
test('502면 생성 모달을 닫는다 — 목록을 보게 한다(round10a A조 M-7)', async () => {
  createOutput.mockResolvedValue({ ok: false, status: 502, notice: '산출물 생성에 실패했습니다' })
  renderTab()
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[0])
  expect(screen.getByLabelText('제목 설정')).toBeInTheDocument() // 모달이 열려 있다
  fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
  await screen.findByText(/만들어졌을 수 있습니다/)
  expect(screen.queryByLabelText('제목 설정')).toBeNull()
  expect(screen.queryByRole('button', { name: '생성하기' })).toBeNull()
})

// 진짜 실패(4xx 등)는 아무것도 만들어지지 않았으므로 모달을 열어 둔다 — 사용자가
// 값을 고쳐 다시 시도할 수 있고, 재시도가 중복을 만들지도 않는다.
test('4xx는 생성 모달을 열어 둔다 — 다시 시도할 수 있다(round10a A조 M-7)', async () => {
  createOutput.mockResolvedValue({ ok: false, status: 422, notice: '잘못된 요청입니다' })
  renderTab()
  selectFirstNode()
  fireEvent.click(screen.getAllByText('생성시작')[0])
  fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
  await screen.findByText('잘못된 요청입니다')
  expect(screen.getByLabelText('제목 설정')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()
})


// round10a — 사용자 지시(2026-09-17): 「회색으로 하지 말고 그대로 하는데 버튼만
// 안눌러지는 식으로」. 읽기 전용의 잠김은 **뜻이 다르다** — 자료 0건처럼 「조건을
// 채우면 눌린다」가 아니라 「저장된 기록이라 애초에 여기서 만들 수 없다」이고,
// 그 사실은 상단 배너와 패널 안내문이 이미 말한다. 그래서 겉모습은 활성과 같게 두고
// disabled 속성으로만 막는다(publish-ext.css 의 .btn.is_locked:disabled 가 색을 되돌린다).
describe('읽기 전용 잠김은 회색으로 덮지 않는다 — 사용자 지시 2026-09-17', () => {
  it('생성시작 버튼이 disabled 이면서 is_locked 를 함께 받는다', () => {
    renderTabReadOnly()
    const btns = screen.getAllByRole('button', { name: '생성시작' })
    expect(btns.length).toBe(2)
    btns.forEach((b) => {
      expect(b).toBeDisabled()
      expect(b.className).toContain('is_locked')
      expect(b.className).toContain('btn_primary')
      // 회색으로 바꾸는 변형(btn_gray)을 쓰지 않는다.
      expect(b.className).not.toContain('btn_gray')
    })
  })

  it('유형 셀렉트도 같은 방식으로 잠긴다', () => {
    renderTabReadOnly()
    const selects = [screen.getByLabelText('설명문 유형'), screen.getByLabelText('전시자료 유형')]
    selects.forEach((sel) => {
      expect(sel).toBeDisabled()
      expect(sel.className).toContain('is_locked')
    })
  })
})
