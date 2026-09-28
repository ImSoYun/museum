/**
 * Accounts.test.jsx — 시스템관리 > 계정·권한 탭 화면(round06c-ext Task E4).
 *
 * adminApi(E1)의 listAccounts/approveUser/rejectUser/disableUser/unblockUser/
 * deleteUser/resetPassword를 vi.mock으로 갈아끼우고(subordinateRolesAll·
 * directSubordinateRole은 실제 구현을 그대로 쓴다 — importOriginal), 다티어
 * (관리자/사용자)·3상태(pending/approved/disabled) fixture로 화면을 검증한다.
 *
 * SystemTabs가 useAuth()·NavLink를 쓰므로 AuthContext.Provider(직접 주입, seed가
 * 아니라 AccountApprovals.test.jsx 관행)와 MemoryRouter로 감싼다.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../components/Toast.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'
import Accounts from './Accounts.jsx'

vi.mock('../../lib/adminApi.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    listAccounts: vi.fn(),
    approveUser: vi.fn(),
    rejectUser: vi.fn(),
    disableUser: vi.fn(),
    unblockUser: vi.fn(),
    deleteUser: vi.fn(),
    resetPassword: vi.fn(),
  }
})

import {
  listAccounts, approveUser, rejectUser, disableUser, unblockUser, deleteUser, resetPassword,
} from '../../lib/adminApi.js'

// 통합관리자(비root) — 직속 하위 티어는 '관리자'(§0 R2.2), 가시 티어는 ['관리자','사용자'].
const ME = { id: 1, username: 'me_admin', display_name: '나자신', role: '통합관리자', is_root: false }

// 다티어(관리자/사용자)·3상태(pending/approved/disabled) + 본인 행(id=1, role='관리자' —
// targetRole과 일치하지만 본인이라 액션이 없어야 한다, actionable() 이중 방어 검증).
//
// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": FIXTURE의 email
// 필드를 뺐다(실서버 응답 계약에 더 이상 그 키가 없다 — admin/routes.py:_summarize).
const FIXTURE = [
  { id: 1, username: 'me_admin', display_name: '나자신', role: '관리자', status: 'approved', dept: '기획팀', created_at: '2026-06-01T09:00:00Z', approved_at: '2026-06-02T10:00:00Z', blocked_at: null, unblocked_at: null, last_seen_at: '2026-07-24T09:00:00Z' },
  { id: 11, username: 'kim_do', display_name: '김도윤', role: '관리자', status: 'pending', dept: '전시기획팀', created_at: '2026-07-22T09:00:00Z', approved_at: null, blocked_at: null, unblocked_at: null, last_seen_at: null },
  { id: 12, username: 'lee_ha', display_name: '이하준', role: '관리자', status: 'approved', dept: '학예연구실', created_at: '2026-06-01T09:00:00Z', approved_at: '2026-06-02T10:00:00Z', blocked_at: null, unblocked_at: null, last_seen_at: '2026-07-23T18:40:00Z' },
  { id: 13, username: 'park_su', display_name: '박수영', role: '관리자', status: 'disabled', dept: '전시운영팀', created_at: '2026-05-10T09:00:00Z', approved_at: '2026-05-11T10:00:00Z', blocked_at: '2026-07-20T14:00:00Z', unblocked_at: null, last_seen_at: '2026-07-19T11:00:00Z' },
  { id: 14, username: 'choi_ji', display_name: '최지우', role: '사용자', status: 'approved', dept: '자료보존팀', created_at: '2026-06-05T09:00:00Z', approved_at: '2026-06-06T10:00:00Z', blocked_at: null, unblocked_at: null, last_seen_at: '2026-07-24T08:10:00Z' },
]

function rowOf(name) {
  return screen.getByText(name).closest('tr')
}

function renderPage(path = '/system/accounts') {
  return render(
    <AuthContext.Provider value={{ user: ME, status: 'authed', login: async () => {}, logout: async () => {} }}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Accounts />
        </MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  listAccounts.mockReset().mockResolvedValue({ users: FIXTURE.map((u) => ({ ...u })) })
  approveUser.mockReset()
  rejectUser.mockReset()
  disableUser.mockReset()
  unblockUser.mockReset()
  deleteUser.mockReset()
  resetPassword.mockReset()
})

describe('Accounts — 필터·행별 인접 액션·확인/임시비번 모달', () => {
  test('SystemTabs가 렌더되고 계정·권한 탭이 4탭 중 활성이다', async () => {
    renderPage()
    await screen.findByText('김도윤')
    expect(screen.getByRole('link', { name: '모니터링' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '계정·권한' })).toHaveAttribute('aria-current', 'page')
  })

  test('로딩 중에는 안내 문구를 보여주고, 로드 후 사라진다', async () => {
    renderPage()
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument())
  })

  // (a) 역할 필터 옵션이 가시 티어로 동적 구성된다.
  test('(a) 역할 필터 옵션이 가시 티어로 동적 구성된다(통합관리자 비root=전체/관리자/사용자)', async () => {
    renderPage()
    await screen.findByText('김도윤')
    const roleSelect = screen.getByLabelText('역할')
    const labels = within(roleSelect).getAllByRole('option').map((o) => o.textContent)
    expect(labels).toEqual(['전체', '관리자', '사용자'])
  })

  // (b) 상태별 버튼 노출.
  test('(b) pending=승인/거절, approved=차단/임시비번, disabled=차단해제/삭제/임시비번 버튼이 노출된다', async () => {
    renderPage()
    await screen.findByText('김도윤')

    const pendingRow = rowOf('김도윤')
    expect(within(pendingRow).getByRole('button', { name: '승인' })).toBeInTheDocument()
    expect(within(pendingRow).getByRole('button', { name: '거절' })).toBeInTheDocument()

    const approvedRow = rowOf('이하준')
    expect(within(approvedRow).getByRole('button', { name: '차단' })).toBeInTheDocument()
    expect(within(approvedRow).getByRole('button', { name: '임시비번' })).toBeInTheDocument()

    const disabledRow = rowOf('박수영')
    expect(within(disabledRow).getByRole('button', { name: '차단해제' })).toBeInTheDocument()
    expect(within(disabledRow).getByRole('button', { name: '삭제' })).toBeInTheDocument()
    expect(within(disabledRow).getByRole('button', { name: '임시비번' })).toBeInTheDocument()
  })

  // (c) 인접 대상만 액션 활성 — 사용자 행은 목록엔 보이되 액션 버튼이 없다.
  test('(c) 인접 대상만 액션 활성 — 관리자 행은 활성, 사용자 행은 노출되되 액션 버튼이 없다', async () => {
    renderPage()
    await screen.findByText('최지우')

    expect(within(rowOf('이하준')).getByRole('button', { name: '차단' })).toBeInTheDocument()

    const userRow = rowOf('최지우')
    expect(within(userRow).queryByRole('button')).toBeNull()
  })

  // (d) 본인 행(id=1)은 액션이 없다.
  test('(d) 본인 행(id=1)은 액션이 없고 "본인 계정" 안내만 보인다', async () => {
    renderPage()
    await screen.findByText('나자신')

    const meRow = rowOf('나자신')
    expect(within(meRow).queryByRole('button')).toBeNull()
    expect(within(meRow).getByText('본인 계정')).toBeInTheDocument()
  })

  // (e) 거절/삭제/차단 클릭 시 ConfirmDialog 오픈 후 확인해야 API 호출.
  test('(e) 거절 클릭: ConfirmDialog가 뜨고, 확인해야 rejectUser가 호출된다', async () => {
    rejectUser.mockResolvedValue({ status: 200 })
    renderPage()
    await screen.findByText('김도윤')

    fireEvent.click(within(rowOf('김도윤')).getByRole('button', { name: '거절' }))
    expect(await screen.findByRole('heading', { name: '가입 거절' })).toBeInTheDocument()
    expect(rejectUser).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '거절하기' }))
    await waitFor(() => expect(rejectUser).toHaveBeenCalledWith(11))
  })

  test('(e) 삭제 클릭: ConfirmDialog가 뜨고, 확인해야 deleteUser가 호출되고 목록이 재조회된다', async () => {
    deleteUser.mockResolvedValue({ status: 200 })
    renderPage()
    await screen.findByText('박수영')

    fireEvent.click(within(rowOf('박수영')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByRole('heading', { name: '계정 삭제' })).toBeInTheDocument()
    expect(deleteUser).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '삭제하기' }))
    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith(13))
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
  })

  test('(e) 차단 클릭: ConfirmDialog가 뜨고, 확인해야 disableUser가 호출된다', async () => {
    disableUser.mockResolvedValue({ status: 200 })
    renderPage()
    await screen.findByText('이하준')

    fireEvent.click(within(rowOf('이하준')).getByRole('button', { name: '차단' }))
    expect(await screen.findByRole('heading', { name: '계정 차단' })).toBeInTheDocument()
    expect(disableUser).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '차단하기' }))
    await waitFor(() => expect(disableUser).toHaveBeenCalledWith(12))
  })

  test('거절 클릭 후 취소: 다이얼로그가 닫히고 API는 호출되지 않는다', async () => {
    renderPage()
    await screen.findByText('김도윤')

    fireEvent.click(within(rowOf('김도윤')).getByRole('button', { name: '거절' }))
    expect(await screen.findByRole('heading', { name: '가입 거절' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('heading', { name: '가입 거절' })).toBeNull()
    expect(rejectUser).not.toHaveBeenCalled()
  })

  // (f) 임시비번은 resetPassword 응답의 temporary_password를 1회 노출 모달로 표시.
  test('(f) 임시비번 클릭: 확인 후 resetPassword 응답의 temporary_password를 1회 모달로 표시한다', async () => {
    resetPassword.mockResolvedValue({ status: 200, temporary_password: 'Temp-XyZ123' })
    renderPage()
    await screen.findByText('이하준')

    fireEvent.click(within(rowOf('이하준')).getByRole('button', { name: '임시비번' }))
    expect(await screen.findByRole('heading', { name: '비밀번호 초기화' })).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '초기화' }))

    expect(await screen.findByRole('heading', { name: '임시 비밀번호 발급' })).toBeInTheDocument()
    expect(screen.getByText('Temp-XyZ123')).toBeInTheDocument()
    expect(screen.getByText(/닫으면 다시 표시되지/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByRole('heading', { name: '임시 비밀번호 발급' })).toBeNull()
  })

  // 인접 티어 즉시 실행 액션(승인/차단해제) — Step6 "즉시 실행 후 load() 재조회+showToast".
  test('승인 클릭: 즉시 approveUser가 호출되고 목록이 재조회되며 토스트가 뜬다', async () => {
    approveUser.mockResolvedValue({ status: 200 })
    renderPage()
    await screen.findByText('김도윤')

    fireEvent.click(within(rowOf('김도윤')).getByRole('button', { name: '승인' }))
    await waitFor(() => expect(approveUser).toHaveBeenCalledWith(11))
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('김도윤님 계정을 승인했습니다')).toBeInTheDocument()
  })

  test('차단해제 클릭: 즉시 unblockUser가 호출되고 목록이 재조회되며 토스트가 뜬다', async () => {
    unblockUser.mockResolvedValue({ status: 200 })
    renderPage()
    await screen.findByText('박수영')

    fireEvent.click(within(rowOf('박수영')).getByRole('button', { name: '차단해제' }))
    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith(13))
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('박수영님 계정을 차단 해제했습니다')).toBeInTheDocument()
  })

  test('요청 실패(비200)면 토스트만 뜨고 목록은 그대로다(단언 약화 금지 — 실패 시 상태 불변 확인)', async () => {
    rejectUser.mockResolvedValue({ status: 403, detail: '해당 계정을 관리할 권한이 없습니다' })
    renderPage()
    await screen.findByText('김도윤')

    fireEvent.click(within(rowOf('김도윤')).getByRole('button', { name: '거절' }))
    fireEvent.click(screen.getByRole('button', { name: '거절하기' }))

    expect(await screen.findByText('해당 계정을 관리할 권한이 없습니다')).toBeInTheDocument()
    expect(screen.getByText('김도윤')).toBeInTheDocument()
    expect(within(rowOf('김도윤')).getByRole('button', { name: '거절' })).toBeInTheDocument()
  })
})

// ── round06c 최종 리뷰 must-fix I-3(활성화 시각 병기) + round10b Task C(이메일 제거) ──
// plan(2026-07-24-round06c-ext-publish-v2.md) §검토 정정: "[E4] 활성화 시각 병기
// (unblocked_at || approved_at 단일표시 금지)". 구현자가 plan 본문 Step3 코드(단일표시)를
// 따라간 것이 결함이었다 — 검토정정이 우선.
//
// "[E4] 이메일 노출"(이름 셀 title 툴팁)은 round10b 사용자 결정(2026-09-17)
// "이메일관련은 다 빼"로 걷어냈다 — listAccounts 응답 자체에 더 이상 email 키가 없다.
describe('Accounts — round10b 이메일 제거 + 활성화 시각 병기', () => {
  test('이메일이 없어져 이름 셀에 title 속성(툴팁)이 더 이상 붙지 않는다', async () => {
    renderPage()
    await screen.findByText('이하준')

    const nameCell = screen.getByText('이하준')
    expect(nameCell).not.toHaveAttribute('title')
  })

  test('활성화 상태에서 unblocked_at이 없으면 approved_at만 보인다(차단 이력 없음)', async () => {
    renderPage()
    await screen.findByText('이하준')

    // FIXTURE: 이하준 approved_at=2026-06-02T10:00:00Z, unblocked_at=null.
    expect(within(rowOf('이하준')).getByText('2026-06-02 10:00')).toBeInTheDocument()
  })

  test('활성화 상태에서 unblocked_at이 있으면 approved_at과 병기된다(단일표시 금지)', async () => {
    listAccounts.mockResolvedValue({
      users: [
        {
          id: 20, username: 'jung_min', display_name: '정민아', role: '사용자',
          status: 'approved', dept: '자료보존팀',
          created_at: '2026-05-01T09:00:00Z', approved_at: '2026-05-02T10:00:00Z',
          blocked_at: '2026-06-01T09:00:00Z', unblocked_at: '2026-07-15T13:00:00Z',
          last_seen_at: '2026-07-20T09:00:00Z',
        },
      ],
    })
    renderPage()
    await screen.findByText('정민아')

    const row = rowOf('정민아')
    // 병기 — approved_at과 unblocked_at 둘 다 같은 셀에 있어야 한다. unblocked_at만
    // 단독으로 보이는(구 whenOf: unblocked_at || approved_at) 회귀를 막는다.
    expect(within(row).getByText(/2026-05-02 10:00/)).toBeInTheDocument()
    expect(within(row).getByText(/2026-07-15 13:00/)).toBeInTheDocument()
  })
})
