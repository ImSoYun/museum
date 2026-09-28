/**
 * 이 파일의 책임: Lnb가 퍼블 publish-v2의 좌측 내비게이션(nav.lnb) 계약을 지키는지 본다
 * (round06c-ext A2 — v2화: 자료검색 제거·나의 기록 케밥·시스템관리 접근거부).
 *
 * v1(publish-v1) 대비 이번 재작성의 요지:
 *   - NAV가 5항목 → 4항목(홈/라이브러리/자료관리/시스템관리)으로 준다. '자료검색'과
 *     '계정 승인'(구 /approvals) 항목이 사라진다(브리프 §3 확정 — YAGNI, D1이 후자를 이관).
 *   - 시스템관리 목적지가 /admin/monitoring → /system/monitoring, requires가
 *     'admin'(통합관리자 전용) → 'system'(관리자·통합관리자 공통, A2 최소 seam)으로 바뀐다.
 *     round06c-ext D1-1이 이를 다시 'system-ops'로 정밀화했다 — /system/monitoring은
 *     통합관리자 전용이라(계정·권한 탭 /system/accounts=system-accounts만 관리자도 접근),
 *     관리자 role은 시스템관리 클릭 시 차단된다(permissions.js 참고).
 *   - 나의 기록 항목마다 케밥(더보기) 드롭다운이 새로 열린다 — round06c Task E5부터 실데이터·
 *     재개·삭제까지 전부 `LnbHistory.jsx`(자식 컴포넌트)가 소유한다. 그 계약(listConversations·
 *     resumeConversation·deleteConversation·토스트 문구)의 단언은 `LnbHistory.test.jsx`로
 *     이관했다 — 이 파일에는 Lnb 자체의 계약(메뉴·토글·차단·로그아웃 등)만 남는다. 다만 Lnb가
 *     LnbHistory를 항상 마운트하므로(useToast 의존) 아래 헬퍼들은 ToastProvider로 감싼다.
 *   - "새로운 검색" 버튼 목적지가 /search → /(홈).
 *
 * 유지: 로그아웃 세션 종료 배선(round06c 리뷰 fix1), 프로필→/account 링크(§12.1 #8),
 * 로고→홈 링크(round06d 후속 #1), 토글 aria-expanded/aria-label 왕복, 접힘 시 조건부 렌더
 * 구현 제약(jsdom이 CSS를 로드하지 않는다). 자료관리(requires:manage)는 round06c-ext D1-1이
 * manage area를 세 역할 전부에 허용해 더 이상 차단되지 않는다(아래 테스트 갱신).
 *
 * 구현 제약: jsdom은 CSS를 로드하지 않는다. 그래서 접힘 시 라벨 비노출과 케밥 드롭다운
 * 열림/닫힘은 .lnb.is_collapsed .lnb_menu_label{display:none} / .history_menu.is_active
 * 가 아니라 **조건부 렌더**로 구현한다(v1과 동일 제약).
 */
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ScenarioProvider } from '../../context/ScenarioContext.jsx'
import { AuthContext } from '../../context/AuthContext.jsx'
import { ToastProvider } from '../Toast.jsx'
import Lnb from './Lnb.jsx'

// 펼침/접힘이 고정된 단순 렌더. AuthContext.Provider로 감싸지 않으면 useAuth()가
// DEFAULT_VALUE(DEMO_MOCK_USER=통합관리자)로 폴백한다 — 아래 role 미지정 테스트는 전부
// 통합관리자 권한(시스템관리 포함 전 항목 통과)으로 렌더된다.
// ToastProvider가 필요한 이유: Lnb가 항상 LnbHistory를 마운트하고, LnbHistory가
// useToast()를 쓴다(케밥 '라이브러리 저장' 토스트, round06c Task E5).
function at(path = '/', collapsed = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <ScenarioProvider>
          <Lnb collapsed={collapsed} onToggle={() => {}} />
        </ScenarioProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

// 토글 동작 검증용 하네스 — collapsed는 부모(AppShell)가 보유하므로 부모를 흉내낸다.
function Harness() {
  const [collapsed, setCollapsed] = useState(false)
  return <Lnb collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
}

function atHarness(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <ScenarioProvider><Harness /></ScenarioProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

// v2 메뉴 4항목(브리프 §3 확정 — 자료검색·계정 승인 제거)
const MENU = ['홈', '라이브러리', '자료관리', '시스템관리']

// ── v2 메뉴 렌더 ─────────────────────────────────────────────────────────
test('LNB: v2 메뉴 4항목과 "새로운 검색" 버튼을 렌더한다', () => {
  at('/')
  MENU.forEach((label) => {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  })
  expect(screen.queryByRole('link', { name: '자료검색' })).toBeNull()
  expect(screen.queryByRole('link', { name: '계정 승인' })).toBeNull()
  expect(screen.getByRole('button', { name: '새로운 검색' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: '주요메뉴' })).toBeInTheDocument()
})

test('LNB: 임의 경로에서도 같은 4항목이며 모드 전용 메뉴가 없다', () => {
  at('/admin/monitoring')
  MENU.forEach((label) => {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  })
  // 구 ModeSidebar 잔재 회귀 가드 — 모드 전용 메뉴 세트라는 개념이 없다
  expect(screen.queryByRole('link', { name: '모니터링' })).toBeNull()
  expect(screen.queryByRole('link', { name: '계정관리' })).toBeNull()
  expect(screen.queryByRole('link', { name: '노드관리' })).toBeNull()
  // "새로운 검색"은 경로와 무관하게 항상 있다
  expect(screen.getByRole('button', { name: '새로운 검색' })).toBeInTheDocument()
})

// ── 시스템관리 활성 판정 ─────────────────────────────────────────────────
test('LNB: /system/monitoring 에서 시스템관리 항목이 활성이다', () => {
  at('/system/monitoring')
  expect(screen.getByRole('link', { name: '시스템관리' })).toHaveClass('active')
})

test('LNB: /account 에서는 시스템관리 항목이 비활성이다(match 배열에서 /account 제거, D1-2)', () => {
  at('/account')
  expect(screen.getByRole('link', { name: '시스템관리' })).not.toHaveClass('active')
  expect(screen.getByRole('link', { name: '홈' })).not.toHaveClass('active')
})

// ── 세그먼트 토글 부재 + 접기 버튼 ───────────────────────────────────────
test('LNB: 사용자/관리자 세그먼트 토글이 없고 접기 버튼이 그 자리를 대신한다', () => {
  at('/')
  expect(screen.queryByRole('button', { name: '사용자' })).toBeNull()
  expect(screen.queryByRole('button', { name: '관리자' })).toBeNull()
  expect(screen.getByRole('button', { name: '메뉴 접기' })).toBeInTheDocument()
})

// ── 나의 기록 ────────────────────────────────────────────────────────────
// round06c Task E5: 나의 기록의 실데이터 렌더·재개·케밥(저장/삭제) 단언은 전부
// LnbHistory.test.jsx로 이관했다(구 onSaveHistory/onDeleteHistory 콜백 props 자체가
// 폐기되고 LnbHistory가 toast·ConfirmDialog·deleteConversation을 직접 다루므로, 옛
// 단언을 그대로 옮길 수 없어 새 계약에 맞춰 다시 썼다 — 커버리지는 그대로 유지된다).
// 접힘 시 "나의 기록" 블록 자체가 숨는지는 아래 "LNB: 접힘 상태..." 테스트가 계속 본다
// (Lnb가 LnbHistory에 collapsed를 그대로 전달하는지의 Lnb 자체 계약이므로 여기 남는다).

// ── 토글(접기/펼치기) ────────────────────────────────────────────────────
test('LNB: 토글 클릭 시 aria-expanded가 true ↔ false로 뒤집힌다', () => {
  atHarness('/')
  const btn = screen.getByRole('button', { name: '메뉴 접기' })
  expect(btn).toHaveAttribute('aria-expanded', 'true')
  expect(btn).toHaveAttribute('aria-controls', 'lnb')
  fireEvent.click(btn)
  expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toHaveAttribute('aria-expanded', 'false')
})

test('LNB: 토글 aria-label이 메뉴 접기 ↔ 메뉴 펼치기로 바뀐다', () => {
  atHarness('/')
  fireEvent.click(screen.getByRole('button', { name: '메뉴 접기' }))
  expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '메뉴 접기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }))
  expect(screen.getByRole('button', { name: '메뉴 접기' })).toBeInTheDocument()
})

test('LNB: 접힘 상태 링크 수는 4(메뉴만), 라벨·나의 기록·프로필 숨김', () => {
  at('/', true)
  MENU.forEach((label) => {
    expect(screen.queryByText(label)).toBeNull()
  })
  expect(screen.getAllByRole('link')).toHaveLength(4)
  expect(screen.queryByRole('button', { name: '새로운 검색' })).toBeNull()
  expect(screen.queryByText('나의 기록')).toBeNull()
})

// ── 프로필/로고 진입점 ───────────────────────────────────────────────────
test('LNB: 프로필 블록이 /account 로 링크된다', () => {
  at('/')
  const link = screen.getByRole('link', { name: '계정 설정' })
  expect(link).toHaveAttribute('href', '/account')
  expect(link).toHaveClass('lnb_profile_info')
})

// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 프로필 블록에서
// .lnb_profile_email 줄을 걷어냈다(구 퍼블 원문 줄).
test('LNB: 프로필 블록에 이메일이 더 이상 노출되지 않는다', () => {
  at('/')
  expect(document.querySelector('.lnb_profile_email')).toBeNull()
  expect(screen.queryByText(/@/)).toBeNull()
})

test('LNB: 좌상단 로고가 홈(/)으로 링크되며 "홈" 메뉴 링크와 별개 요소다', () => {
  at('/')
  const logo = screen.getByRole('link', { name: '홈으로 이동' })
  expect(logo).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: '홈' })).not.toBe(logo)
})

test('LNB: 접힘 상태에서는 로고 링크가 없다(로고마크가 펼치기 버튼을 겸한다)', () => {
  at('/', true)
  expect(screen.queryByRole('link', { name: '홈으로 이동' })).toBeNull()
})

// ── 차단 항목 클릭 ───────────────────────────────────────────────────────
// Red 조건: 비권한 역할로 클릭하면 (a) 라우트 이동이 일어나지 않고 (b) 셸에 사유가 전달된다.
function LocationProbe() {
  const { pathname } = useLocation()
  return <span data-testid="probe-path">{pathname}</span>
}

// role을 바꿔가며 차단 판정을 보려면 AuthContext.Provider로 직접 시드해야 한다.
// 기본값 '사용자'는 시스템관리 차단 테스트의 전제다.
function renderLnb(onBlocked = () => {}, path = '/', role = '사용자', appEnv) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthContext.Provider value={{ user: { username: 'test', display_name: '김연구', role }, status: 'authed', login: async () => {}, logout: async () => {}, appEnv }}>
          <ScenarioProvider>
            <Lnb collapsed={false} onToggle={() => {}} onBlocked={onBlocked} />
            <LocationProbe />
          </ScenarioProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

test('시스템관리 클릭(사용자 role): 라우트 이동이 일어나지 않고 onBlocked("system_access", 트리거)가 호출된다', () => {
  const onBlocked = vi.fn()
  renderLnb(onBlocked, '/', '사용자')

  const link = screen.getByRole('link', { name: '시스템관리' })
  fireEvent.click(link)

  expect(onBlocked).toHaveBeenCalledTimes(1)
  expect(onBlocked.mock.calls[0][0]).toBe('system_access')
  // 두 번째 인자는 포커스 복귀용 트리거 엘리먼트다
  expect(onBlocked.mock.calls[0][1]).toBe(link)
  // 이동이 없어야 한다 — preventDefault 누락이면 여기서 걸린다
  expect(screen.getByTestId('probe-path')).toHaveTextContent('/')
})

// round06c 최종 리뷰 must-fix I-1: /system/monitoring은 system-ops(통합관리자 전용)라
// 관리자는 그 경로에서 차단되지만, 계획 §3.3("시스템관리 LNB: 관리자·통합관리자 접근,
// 사용자만 차단")은 관리자도 시스템관리에 들어갈 수 있어야 한다고 못박는다. 관리자가 가진
// 유일한 system area는 system-accounts(계정·권한)이므로, 시스템관리 NAV의 목적지가
// role별로 갈린다 — 통합관리자→/system/monitoring, 관리자→/system/accounts(둘 다
// permissions.js의 firstSystemEntry가 판정, Lnb는 판정하지 않는다). 그래서 이 테스트는
// 더 이상 차단을 기대하지 않는다 — 이전 계약(차단)은 미이행이었다.
test('시스템관리 클릭(관리자 role): system-accounts 권한으로 /system/accounts 로 정상 이동한다', () => {
  const onBlocked = vi.fn()
  renderLnb(onBlocked, '/', '관리자')

  fireEvent.click(screen.getByRole('link', { name: '시스템관리' }))

  expect(onBlocked).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe-path')).toHaveTextContent('/system/accounts')
})

test('시스템관리 클릭(통합관리자 role): system-ops 권한이 있어 정상 이동한다', () => {
  const onBlocked = vi.fn()
  renderLnb(onBlocked, '/', '통합관리자')

  fireEvent.click(screen.getByRole('link', { name: '시스템관리' }))

  expect(onBlocked).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe-path')).toHaveTextContent('/system/monitoring')
})

// round06c F2: Lnb의 자료관리 NAV 항목에 requires:'manage' 가 붙어 표시 게이트가 라우트
// 게이트(canAccess)와 같은 영역을 덮는다. round06c-ext D1-1이 manage area를 세 역할
// 전부에 허용했다(자료관리 화면은 전부 "준비중"이라 열람 자체를 막을 이유가 없다, §3.3) —
// 개명 전에는 사용자가 차단됐으나 이 규칙은 D1-1이 의도적으로 넓혔다.
test('자료관리 클릭(사용자 role): manage 권한이 있어 정상 이동하고 onBlocked를 호출하지 않는다', () => {
  const onBlocked = vi.fn()
  renderLnb(onBlocked, '/', '사용자')

  fireEvent.click(screen.getByRole('link', { name: '자료관리' }))

  expect(onBlocked).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe-path')).toHaveTextContent('/manage/ocr')
})

test('자료관리 클릭(관리자 role): manage 권한이 있어 정상 이동하고 onBlocked를 호출하지 않는다', () => {
  const onBlocked = vi.fn()
  renderLnb(onBlocked, '/', '관리자')

  fireEvent.click(screen.getByRole('link', { name: '자료관리' }))

  expect(onBlocked).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe-path')).toHaveTextContent('/manage/ocr')
})

// ── 로그아웃이 세션을 종료한다(round06c 리뷰 fix1, 배선 보존) ────────────────
test('LNB: 로그아웃 버튼 클릭 시 logout()이 호출되고 /login으로 이동한다', async () => {
  const logout = vi.fn(async () => {})
  render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <AuthContext.Provider value={{ user: { username: 'test', display_name: '김연구', role: '사용자' }, status: 'authed', login: async () => {}, logout }}>
          <ScenarioProvider>
            <Lnb collapsed={false} onToggle={() => {}} />
            <LocationProbe />
          </ScenarioProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  )

  // 더 이상 link가 아니어야 한다(퍼블 원본은 <a>였으나 실제 로그아웃을 위해 button으로 바꿨다).
  expect(screen.queryByRole('link', { name: '로그아웃' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

  expect(logout).toHaveBeenCalledTimes(1)
  await waitFor(() => {
    expect(screen.getByTestId('probe-path')).toHaveTextContent('/login')
  })
})

// logout()은 네트워크 실패 시 reject할 수 있다(F1-M1, AuthContext.logout()의 finally가
// 클라 상태는 정리하지만 promise 자체는 던진다). handleLogout의 try/catch가 없으면
// unhandled rejection 이 나고 /login 이동도 되지 않는다.
test('LNB: logout()이 실패(reject)해도 /login으로 이동한다(unhandled rejection 없이)', async () => {
  const logout = vi.fn(async () => { throw new Error('network down') })
  render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <AuthContext.Provider value={{ user: { username: 'test', display_name: '김연구', role: '사용자' }, status: 'authed', login: async () => {}, logout }}>
          <ScenarioProvider>
            <Lnb collapsed={false} onToggle={() => {}} />
            <LocationProbe />
          </ScenarioProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

  expect(logout).toHaveBeenCalledTimes(1)
  await waitFor(() => {
    expect(screen.getByTestId('probe-path')).toHaveTextContent('/login')
  })
})

// ── round06e 갈래 B(R6E-8): prod에서 시스템관리 진입점이 /system/accounts로 바뀐다 ──
// 이유: /system/monitoring은 prod에서 AppShell 게이트에 걸려 곧바로 준비중이 된다.
// 실질 가드는 통합관리자 케이스 하나로 단일화한다(교차검증 M1) — firstSystemEntry('관리자')는
// local에서도 이미 '/system/accounts'를 돌려주므로(permissions.js — 관리자는 애초에 모니터링
// 접근 권한이 없다) 관리자 role은 prod 분기가 있든 없든 같은 값이 나와 그 분기를 전혀
// 잠그지 못한다. 통합관리자는 local '/system/monitoring' → prod '/system/accounts'로
// 실제로 값이 바뀌므로 이 role만이 진짜 red/green 신호다.
test('시스템관리 클릭(prod, 통합관리자 role): local과 달리 목적지가 /system/accounts로 바뀐다', () => {
  const onBlocked = vi.fn()
  renderLnb(onBlocked, '/', '통합관리자', 'prod')

  fireEvent.click(screen.getByRole('link', { name: '시스템관리' }))

  expect(onBlocked).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe-path')).toHaveTextContent('/system/accounts')
})

// 관리자 role은 위 이유로 prod 분기를 검증할 수 없다 — 그래서 이 테스트는 다른 목적으로
// 존재한다. "관리자 role의 목적지가 local과 prod에서 서로 달라지지 않는다"는 명시적
// 회귀 가드다. 두 환경을 같은 렌더 함수로 각각 돌려 비교하고, 그 값이 실제로
// '/system/accounts'라는 것까지 단언한다 — local·prod가 그저 같은 값으로 함께
// 틀리는 경우(예: 둘 다 엉뚱한 경로로 깨지는 경우)까지 잡기 위함이다.
test('시스템관리 클릭(관리자 role): local·prod 목적지가 같다(회귀 가드 — 이 role은 prod 분기를 검증하지 않는다)', () => {
  const onBlockedLocal = vi.fn()
  const { unmount } = renderLnb(onBlockedLocal, '/', '관리자', 'local')
  fireEvent.click(screen.getByRole('link', { name: '시스템관리' }))
  expect(onBlockedLocal).not.toHaveBeenCalled()
  const localPath = screen.getByTestId('probe-path').textContent
  expect(localPath).toBe('/system/accounts')
  unmount()

  const onBlockedProd = vi.fn()
  renderLnb(onBlockedProd, '/', '관리자', 'prod')
  fireEvent.click(screen.getByRole('link', { name: '시스템관리' }))
  expect(onBlockedProd).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe-path')).toHaveTextContent(localPath)
})
