// 이 파일의 책임: /search/output 라우트 본문의 껍데기 — 퍼블 output_node.html L46-53의
// result_wrap(ty_chat 아님) 래퍼와 output_banner(chat_welcome 재사용)를 소유하는지, 그리고
// 그 안의 노드그래프(node_view)·선택자료(node_select_panel) 2패널 + 산출물 목록(OutputList)이
// 실제로 렌더되는지 검증한다. round06c-ext D1-7(task-D1-7-brief §절차 Step 1).
//
// round07b-ext task-11 — 세 번째 패널이었던 node_result_panel(생성 결과 예시 초안)은
// 피그마 디스크립션에 없던 데모 패널이라 제거되고 진짜 산출물 목록(OutputList.jsx)이
// 그 자리를 대신한다. 그 패널에 속했던 재생성하기·타임라인 생성·전체 내보내기·복사
// 4버튼도 함께 사라졌으므로 그 버튼들을 눌러 보던 테스트도 함께 걷어낸다.
//
// 왜 대표 액션 하나만 단언하는가 — round07b-ext 당시 이 화면의 남은 실행 버튼
// (생성시작 · 설명문)은 `showToast('준비 중입니다')`로 배선됐었다(브리프 §범위 3).
// 전량 반복 단언은 OutputTab.test.jsx가 맡고, 여기서는 "화면 진입 시 이 계약이
// 최소 성립한다"만 확인했다.
// (프로젝트로 저장 제거됨 — 피그마에 없어 round07b-ext에서 제거.)
//
// round07e — 설명문 생성이 준비중에서 풀린다(서버가 kind='caption'을 받는다). 이제
// 두 「생성시작」 버튼 모두 실제 모달을 연다 — 아래 테스트를 "실제로 CaptionModal이
// 열린다"로 다시 쓴다(지우지 않는다 — 브리프).
//
// OutputView가 마운트하는 OutputTab은 이제 항상 OutputList를 그린다 — outputsApi.js를
// 목(mock)해 real fetch가 나가지 않게 한다(이유는 OutputTab.test.jsx 파일 상단 주석과 같다).
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { AdminProvider } from '../state/AdminProvider.jsx'
import { ToastProvider } from '../components/Toast.jsx'

vi.mock('../lib/outputsApi.js', () => ({
  // isLive: 목 모듈이라 실제 env를 안 본다. true 로 둬야 OutputList·SearchFlowLayout의
  // 데모 모드 게이트를 통과해 기존 조회 경로가 그대로 검증된다.
  isLive: () => true,
  createOutput: vi.fn(),
  listOutputs: vi.fn().mockResolvedValue({ ok: true, data: { outputs: [], has_more: false } }),
  deleteOutputs: vi.fn(),
  downloadOutputFile: vi.fn(),
}))

const { default: OutputView } = await import('./OutputView.jsx')

// round10 Task5 리뷰 fix — LibraryProvider가 이제 useLocation()을 쓰는데, OutputView가
// useLibrary()를 쓰지 않으므로(레포 전체 grep 확인) 이 wrap은 애초에 죽은 코드였다 —
// 걷어낸다(안 걷어내면 Router 컨텍스트 밖이라 useLocation()이 던진다).
function renderView() {
  return render(
    <ToastProvider>
      <AdminProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <OutputView />
          </MemoryRouter>
        </ScenarioProvider>
      </AdminProvider>
    </ToastProvider>
  )
}

test('OutputView가 result_wrap(ty_chat 아님)을 소유한다', () => {
  const { container } = renderView()
  const wrap = container.querySelector('.result_wrap')
  expect(wrap).not.toBeNull()
  expect(wrap.classList.contains('ty_chat')).toBe(false)
})

test('output_banner는 chat_welcome 컴포넌트를 재사용한다(퍼블 주석 L48 근거)', () => {
  const { container } = renderView()
  expect(container.querySelector('.chat_welcome')).not.toBeNull()
  expect(screen.getByText('학예 산출물 생성')).toBeInTheDocument()
  expect(
    screen.getByText('검색 자료를 기반으로 학예 산출물을 작성합니다')
  ).toBeInTheDocument()
})

test('2패널(node_view·node_select_panel) + 산출물 목록(OutputList)이 렌더된다(round07b-ext task-11)', () => {
  const { container } = renderView()
  expect(container.querySelector('.node_view')).not.toBeNull()
  expect(container.querySelector('.node_select_panel')).not.toBeNull()
  expect(container.querySelector('.node_result_panel')).toBeNull()
  expect(container.querySelector('.output_list')).not.toBeNull()
})

test('노드그래프(NodeGraph)가 표시용으로 렌더된다', () => {
  renderView()
  // 기본(민주화운동) 시나리오의 루트 아닌 노드 하나가 버튼으로 렌더된다.
  expect(screen.getByRole('button', { name: '4·19 혁명' })).toBeInTheDocument()
})

test('생성시작(설명문) 클릭 시 설명문 생성 모달이 열린다(round07e) — 더는 준비중이 아니다', () => {
  renderView()
  // 자료를 먼저 골라야 버튼이 눌린다(전시자료와 같은 규칙 — 0건으로는 생성할 수 없다).
  fireEvent.click(screen.getByRole('button', { name: '4·19 혁명' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '전체 전체 선택' }))
  fireEvent.click(screen.getByText(/선택완료/))

  fireEvent.click(screen.getAllByText('생성시작')[0])

  expect(screen.getByText('설명문 생성')).toBeInTheDocument()
  expect(screen.queryByRole('status')).toBeNull()
})

// round07b-ext task-11 — 전체 내보내기·복사 버튼은 준비중 토스트가 아니라 버튼째
// 사라졌다(그 버튼들이 속했던 생성 결과 패널 자체가 없어졌다). 그래서 이 두 테스트는
// 더 이상 성립하지 않아 제거한다 — 남은 대표 액션(생성시작)은 위에서 이미 확인한다.
