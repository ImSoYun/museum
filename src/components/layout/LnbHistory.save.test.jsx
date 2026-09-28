/**
 * 이 파일의 책임: LnbHistory 케밥 「라이브러리 저장」 실동작(round10 Task4) 검증.
 *
 * 기존 LnbHistory.test.jsx의 '(c)' 테스트는 스텁(showToast('준비 중입니다'))을
 * 검증했다 — 이 라운드에서 그 스텁이 실동작으로 바뀌므로 그 파일 쪽 단언도
 * "모달이 뜬다"로 고쳤다(같은 케밥 항목의 계약이 두 파일에 갈리지 않도록). 이
 * 파일은 그 실동작의 나머지(산출물 수집 → saveProject 배선 → 성공/실패 피드백)를
 * 새로 검증한다.
 *
 * ‼️ round10 수정 — 최초 작성본은 vi.doMock(테스트 본문에서 그 자리에 원하는 값을
 * 주고 바로 동적 import)을 시도했으나, 그 방식은 `afterEach(vi.resetModules)`와
 * 맞물려 두 번째 테스트부터 "useScenario must be used within ScenarioProvider"로
 * 깨졌다 — 이유: `vi.resetModules()`가 모듈 레지스트리를 비우면, 그 다음 테스트가
 * `await import('./LnbHistory.jsx')`로 LnbHistory를 다시 평가할 때 LnbHistory가 문
 * 안에서 import하는 ScenarioContext.jsx도 함께 새로 평가되어 **새 Context 객체**가
 * 생긴다. 반면 이 파일 최상단에서 정적으로 import해 둔 `ScenarioContext`는 그 리셋
 * 이전의 옛 인스턴스를 계속 가리키므로, `<ScenarioContext.Provider>`가 LnbHistory가
 * 실제로 구독하는 Context와 다른 객체가 되어 버린다(동일 원본 파일이라도 모듈
 * 레지스트리상 별개 인스턴스). LnbHistory.test.jsx(형제 파일)가 이미 쓰고 있는
 * 검증된 관행 — 파일 최상단 `vi.mock`(호이스트) + `beforeEach`로 목의 반환값만
 * 갈아끼우기 — 로 바꾸면 LnbHistory.jsx를 정적으로 한 번만 import하므로 이 문제
 * 자체가 생기지 않는다. listOutputs·saveProject의 성공/실패를 테스트마다 다르게
 * 주는 요구는 `mockResolvedValueOnce`로 충분히 만족한다.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ToastProvider } from '../Toast.jsx'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import LnbHistory from './LnbHistory.jsx'

vi.mock('../../lib/conversationsApi.js', () => ({
  listConversations: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
}))
vi.mock('../../lib/outputsApi.js', () => ({ listOutputs: vi.fn() }))
vi.mock('../../lib/projectsApi.js', () => ({ saveProject: vi.fn() }))

import { listConversations } from '../../lib/conversationsApi.js'
import { listOutputs } from '../../lib/outputsApi.js'
import { saveProject } from '../../lib/projectsApi.js'

const ITEMS = [{ id: 'c1', search_query: '민주화운동 관련 자료' }]

beforeEach(() => {
  vi.clearAllMocks()
  listConversations.mockResolvedValue({ conversations: ITEMS })
  // 그 대화의 산출물 2건 — listOutputs({conversationId, limit:100})로 모은다(브리프 Step6).
  listOutputs.mockResolvedValue({ ok: true, data: { outputs: [{ id: 'o1' }, { id: 'o2' }] } })
  saveProject.mockResolvedValue({ ok: true, id: 'p1' })
})

function renderLnbHistory() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ScenarioContext.Provider value={{ isLive: true, resumeConversation: vi.fn() }}>
          <LnbHistory />
        </ScenarioContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

// 매번 반복되는 "더보기 → 라이브러리 저장" 오프닝 시퀀스.
const openSaveModal = async () => {
  await screen.findByText(ITEMS[0].search_query)
  fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
  fireEvent.click(screen.getByRole('menuitem', { name: '라이브러리 저장' }))
}

describe('LnbHistory — 라이브러리 저장 실동작(round10 Task4)', () => {
  test('「라이브러리 저장」을 누르면 저장 모달이 열린다(준비중 토스트가 아니다)', async () => {
    renderLnbHistory()
    await openSaveModal()

    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.queryByText('준비 중입니다')).not.toBeInTheDocument()
    // 프로젝트명 기본값 = 그 대화의 표시 이름(title ?? search_query) — 아직 이름을
    // 바꾸지 않은 항목이라 곧 최초 검색어와 같다.
    expect(screen.getByLabelText('프로젝트명')).toHaveValue(ITEMS[0].search_query)
  })

  test('저장하면 projectsApi.saveProject 가 그 대화의 질의·대화 id·산출물 id 로 불린다', async () => {
    renderLnbHistory()
    await openSaveModal()

    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(listOutputs).toHaveBeenCalledWith({ conversationId: 'c1', limit: 100 }))
    await waitFor(() => expect(saveProject).toHaveBeenCalledWith({
      title: ITEMS[0].search_query,
      description: '',
      password: null,
      conversationId: 'c1',
      searchQuery: ITEMS[0].search_query,
      searchMode: 'meta',
      outputIds: ['o1', 'o2'],
    }))
  })

  test('저장에 성공하면 토스트로 알린다', async () => {
    renderLnbHistory()
    await openSaveModal()
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('라이브러리에 저장했습니다')
    // 모달이 닫힌다 — 저장 버튼이 더는 없다.
    await waitFor(() => expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument())
    // 「나의 기록」 자체는 바뀌지 않는다(spec §5-1) — 저장해도 대화는 그대로 남는다.
    expect(screen.getByText(ITEMS[0].search_query)).toBeInTheDocument()
  })

  test('저장에 실패하면 실패를 알리고 모달을 닫지 않는다', async () => {
    saveProject.mockResolvedValueOnce({ ok: false, status: 500 })
    renderLnbHistory()
    await openSaveModal()
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status'))
      .toHaveTextContent('저장하지 못했습니다 — 잠시 후 다시 시도하세요')
    // 재시도할 수 있도록 모달은 그대로 열려 있다.
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
  })

  // listOutputs 자체가 실패해도(산출물 id 없이 빈 프로젝트가 생기면 안 된다) 같은
  // 실패 안내를 주고 모달을 닫지 않는다 — saveProject는 아예 불리지 않는다.
  test('산출물 목록 조회가 실패하면 saveProject 를 부르지 않고 실패를 알린다', async () => {
    listOutputs.mockResolvedValueOnce({ ok: false, status: 500, notice: '산출물 목록을 불러오지 못했습니다' })
    renderLnbHistory()
    await openSaveModal()
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(listOutputs).toHaveBeenCalled())
    expect(await screen.findByRole('status'))
      .toHaveTextContent('저장하지 못했습니다 — 잠시 후 다시 시도하세요')
    expect(saveProject).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
  })

  test('취소하면 모달이 닫히고 saveProject 는 불리지 않는다', async () => {
    renderLnbHistory()
    await openSaveModal()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(saveProject).not.toHaveBeenCalled()
  })

  // round10c Task B2-2 — defaultTitle도 이름 바꾸기 초기값과 같은 문제를 가진다:
  // 표시명이 "제목 없음"(자리표시)인 항목을 저장 모달로 열면, 손대지 않고 저장할 경우
  // 프로젝트명이 문자 그대로 "제목 없음"으로 저장돼 버린다. 자리표시는 보여 주기용이지
  // 사용자가 지어 준 이름이 아니므로 초기값은 빈 문자열이어야 한다(이름 바꾸기와 동일 근거).
  test('빈 표시명 항목을 저장할 때 프로젝트명 초기값은 "제목 없음"이 아니라 빈 문자열이다', async () => {
    listConversations.mockResolvedValueOnce({
      conversations: [{ id: 'c1', search_query: '', title: null }],
    })
    renderLnbHistory()
    await screen.findByText('제목 없음')
    fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: '라이브러리 저장' }))

    expect(screen.getByLabelText('프로젝트명')).toHaveValue('')
  })
})
