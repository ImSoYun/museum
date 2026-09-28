import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Library from './Library.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { LibraryProvider } from '../state/LibraryProvider.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { AuthContext } from '../context/AuthContext.jsx'

// round10 Task5 — 라이브러리 목록을 mock(searchHistory)에서 실데이터(lib/projectsApi.js)로
// 갈아끼운다. 이 파일이 round06c-ext D2c에서 잠갔던 "준비중 토스트" 단언들(카드 잠금·
// 공유 카운트·댓글 카운트·검색바 제출이 전부 showToast('준비 중입니다')만 부르는 순수
// 스텁이었다는 계약)은 이제 실동작으로 뒤집힌다 — 그 스텁들이 지목했던 UI 자체가 이번
// 라운드부터 실제 서버 데이터로 움직인다.
//
// 함께 사라진 것과 이유:
//  - "active project card is highlighted"(옛 시나리오 복원 하이라이트) — Library.jsx가
//    더 이상 useScenario/activeScenario를 쓰지 않는다(카드 클릭은 이제 시나리오 복원이
//    아니라 실제 프로젝트 열람 API를 부른다). 대응하는 실데이터 개념 자체가 없어 이관할
//    단언이 없다.
//  - 공유 카운트(AvatarStack) — 서버 프로젝트 응답(projects/routes.py:59-71)에 shared
//    필드가 아예 없다. 없는 값을 꾸며 보여주지 않는다.
//  - '산출물 N건' 버튼(딥링크) — Library.deeplink.test.jsx·Library.output-deeplink.test.jsx로
//    이관(그 두 파일 머리주석 참조). 이 파일은 "산출물 수가 카드에 표시되는가"만 본다.
//  - 댓글 카운트 — spec Global Constraints: 댓글은 만들지 않는다. 아래 "댓글 아이콘이
//    없다" 테스트가 그 부재를 잠근다(브리프 결정 13).
vi.mock('../lib/projectsApi.js', () => ({
  listProjects: vi.fn(),
  openProject: vi.fn(),
}))
import { listProjects, openProject } from '../lib/projectsApi.js'

// ⚠️ round10 최종리뷰 M-7 — 목록 응답에는 search_query·search_mode·conversation_id 가
// **없다**(projects/routes.py `_serialize(with_restore=False)`). 암호가 걸린 프로젝트의
// 저장 질의가 암호 없이 목록 본문으로 나가던 것을 서버에서 막았기 때문이다. 이 픽스처가
// 서버 계약을 흉내내는 자리이므로 그 셋을 여기서도 지운다 — 이 파일 전체가 초록이면
// 「목록 화면은 그 셋 없이도 돈다」가 증명된다(상세는 POST /open 응답에서 받는다).
const FIXTURE = [
  {
    id: 'p1',
    title: '민주화운동 관련 자료 정리',
    description: '4·19 혁명부터 6월 항쟁까지 민주화운동 자료 검색',
    author: '김연구',
    has_password: true,
    output_count: 5,
    created_at: '2026-06-24T14:21:00Z',
  },
  {
    id: 'p2',
    title: '경제개발 계획 자료 정리',
    description: '1~5차 경제개발 5개년 계획 관련 자료 검색',
    author: '한실무',
    has_password: false,
    output_count: 2,
    created_at: '2026-06-18T17:40:00Z',
  },
]

// round10 Task5 리뷰 fix — LibraryProvider가 useLocation()으로 현재 경로를 보고 정확히
// '/library'일 때만 조회한다(AppShell.jsx가 모든 라우트를 이 Provider로 감싸므로, 게이트가
// 없으면 무관한 화면에서도 매번 버려질 /projects 요청이 나간다). useLocation()은 Router
// 컨텍스트 안에서만 동작하므로 MemoryRouter가 LibraryProvider의 조상이어야 하고(운영
// 코드의 AppShell.jsx와 같은 중첩 순서), 경로도 명시적으로 '/library'여야 한다.
function renderLibrary() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/library']}>
        <LibraryProvider>
          <ScenarioProvider>
            <Library />
          </ScenarioProvider>
        </LibraryProvider>
      </MemoryRouter>
    </ToastProvider>
  )
}

beforeEach(() => {
  listProjects.mockReset()
  openProject.mockReset()
  listProjects.mockResolvedValue({ ok: true, projects: FIXTURE, hasMore: false })
})

test('마운트 시 listProjects 를 불러 카드에 작성자·제목·설명·날짜·산출물 수를 표시한다', async () => {
  renderLibrary()
  const card = (await screen.findByText('민주화운동 관련 자료 정리')).closest('.library_card')
  expect(within(card).getByText('김연구')).toBeInTheDocument()
  expect(within(card).getByText('4·19 혁명부터 6월 항쟁까지 민주화운동 자료 검색')).toBeInTheDocument()
  // created_at은 ISO 문자열을 사람이 읽게 포맷한다(OutputCard.jsx와 같은 관행) — 정확한
  // 시:분은 실행 환경의 타임존에 따라 갈리므로 연도만 안정적으로 단언한다.
  expect(within(card).getByText(/2026/)).toBeInTheDocument()
  expect(within(card).getByText(/산출물\s*5건/)).toBeInTheDocument()
})

test('자물쇠 배지는 has_password 를 그대로 따른다', async () => {
  renderLibrary()
  const locked = (await screen.findByText('민주화운동 관련 자료 정리')).closest('.library_card')
  const plain = screen.getByText('경제개발 계획 자료 정리').closest('.library_card')
  expect(within(locked).getByText('비밀번호')).toBeInTheDocument()
  expect(within(plain).queryByText('비밀번호')).not.toBeInTheDocument()
})

test('댓글 수 아이콘·버튼이 없다(spec Global Constraints — 댓글은 만들지 않는다)', async () => {
  renderLibrary()
  await screen.findByText('민주화운동 관련 자료 정리')
  expect(screen.queryByRole('button', { name: /댓글 \d+개/ })).not.toBeInTheDocument()
  expect(screen.queryByText('코멘트')).not.toBeInTheDocument()
})

test('검색창 제출은 listProjects({q}) 를 다시 부른다', async () => {
  renderLibrary()
  await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByPlaceholderText('검색어를 입력해주세요'), { target: { value: '민주화' } })
  fireEvent.submit(document.querySelector('form.result_query_bar'))
  await waitFor(() =>
    expect(listProjects).toHaveBeenCalledWith(expect.objectContaining({ q: '민주화' }))
  )
})

test('listProjects 가 실패하면 조용히 빈 목록으로 넘어가지 않고 사유를 보여준다(코딩표준 §6)', async () => {
  listProjects.mockResolvedValue({ ok: false, status: 0, notice: '서버에 연결하지 못했습니다' })
  renderLibrary()
  expect(await screen.findByText('서버에 연결하지 못했습니다')).toBeInTheDocument()
})

// round10c — 뷰 토글과 목록형 표를 걷었다(사용자 결정 2026-09-18: 「나는 카드형만 필요한건데」).
//
// 퍼블 library.html:557-578 에는 7열 표와 뷰 토글이 있지만 **피그마에는 없다.** 그 표의
// 존재 이유인 공유(아바타 스택)·코멘트 두 열이 우리 화면엔 없었고(공유는 서버 응답에
// shared 필드가 없어서, 댓글은 spec Global Constraints 가 만들지 않기로 해서), 남은 5열은
// 한 열도 빠짐없이 카드형에 이미 있는 것이라 목록형은 같은 정보를 세로로 늘어놓기만 했다.
//
// 아래 시험은 **없어진 상태를 잠근다** — 다음 사람이 퍼블 마크업을 보고 「빠졌네」 하며
// 되살리는 것을 막는다. 되살려야 할 때는 피그마에 그 화면이 생긴 뒤다.
describe('카드형만 그린다 — 뷰 토글·목록형 표는 없다(round10c)', () => {
  test('뷰 토글 버튼이 둘 다 없다', async () => {
    renderLibrary()
    await screen.findByText('민주화운동 관련 자료 정리')
    expect(screen.queryByRole('button', { name: '썸네일형으로 보기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '목록형으로 보기' })).toBeNull()
  })

  test('목록형 표를 그리지 않고 카드만 그린다', async () => {
    renderLibrary()
    await screen.findByText('민주화운동 관련 자료 정리')
    expect(document.querySelector('table.library_table')).toBeNull()
    expect(document.querySelector('.data_table_wrap')).toBeNull()
    expect(document.querySelector('.library_card_list')).not.toBeNull()
  })

  test('프로젝트 전체가 카드로 렌더된다', async () => {
    renderLibrary()
    await screen.findByText('민주화운동 관련 자료 정리')
    const list = document.querySelector('.library_card_list')
    for (const item of FIXTURE) {
      expect(within(list).getByText(item.title)).toBeInTheDocument()
    }
  })
})

// A8(round06b) — /library의 env 게이트가 셸에서 페이지 레벨(EnvGate)로 옮겨왔다. 이
// 테스트가 사보타주(EnvGate 제거)를 잡는다 — Library.jsx에서 <EnvGate> 래퍼를 걷어내면
// '준비 중입니다'가 사라지고 검색바·카드 목록이 그대로 보여 아래 단언이 깨진다.
test('prod 환경: 본문(검색바·library_panel)이 준비중으로 바뀐다(A8 — 페이지 레벨 EnvGate)', async () => {
  const { container } = render(
    <AuthContext.Provider value={{ appEnv: 'prod' }}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/library']}>
          <LibraryProvider>
            <ScenarioProvider>
              <Library />
            </ScenarioProvider>
          </LibraryProvider>
        </MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>
  )
  // EnvGate가 본문을 <ComingSoon/>으로 갈아치워도 LibraryProvider는 여전히 마운트돼
  // listProjects를 부른다(셸 레벨 상태와 페이지 렌더는 서로 다른 층이다) — 그 응답이
  // act() 밖에서 정착하지 않도록 findByText로 기다린다(경고 없는 깨끗한 출력).
  expect(await screen.findByText('준비 중입니다')).toBeInTheDocument()
  expect(container.querySelector('form.result_query_bar')).toBeNull()
  expect(container.querySelector('.library_panel')).toBeNull()
})
