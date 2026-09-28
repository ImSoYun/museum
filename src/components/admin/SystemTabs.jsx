import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { canAccess } from '../../data/permissions.js'

/**
 * 이 파일의 책임: 시스템관리 4탭(모니터링/노드관리/이용로그/계정·권한) — role별 노출 필터링.
 *
 * round06c-ext D2b — AdminTabs.jsx(모니터링·노드관리·계정관리 3탭, 권한 필터 없음)를
 * 대체한다. v2 admin_dashboard.html:27-31이 page_tabs에 4개 탭을 두고, 계획서 계약(§3.3)에
 * 따르면 모니터링/노드관리/이용로그는 system-ops(통합관리자 전용), 계정·권한은
 * system-accounts(관리자+통합관리자)다 — 그래서 관리자는 계정·권한 1탭만, 사용자는
 * 0탭을 본다. data/permissions.js의 canAccess(role, to)가 이미 그 매트릭스를 알고
 * 있으므로 여기서 정책을 다시 적지 않고 그대로 위임한다(§6.7.2와 같은 원리).
 *
 * ManageTabs.jsx와 같은 이유로 h2.mng_page_tit + nav.page_tabs를 이 컴포넌트가 직접
 * 그린다(PageTabs.jsx로 리팩터하지 않는다 — round06c-ext 계획 검토정정 D2b 항목은
 * "PageTabs 재사용 또는 미재사용 사유 명시"를 요구했고, 컨트롤러가 형제 컴포넌트
 * ManageTabs.jsx와의 패턴 일관성을 이유로 이 자리에서 verbatim 하드코딩을 택했다).
 */
// F3(round06c 배치 리뷰): 순서는 계획 문면(모니터링/노드관리/이용로그/계정·권한)이 아니라
// 퍼블 v2(admin_dashboard.html:28-31 · admin_log.html:27-30)를 따른다 — 모니터링/노드관리/
// 계정·권한/이용로그. 퍼블이 정본이므로 재배열한다(순서를 단언하는 기존 테스트는 없다).
const TABS = [
  { label: '모니터링', to: '/system/monitoring' },
  { label: '노드관리', to: '/system/nodes' },
  { label: '계정·권한', to: '/system/accounts' },
  { label: '이용로그', to: '/system/log' },
]

export default function SystemTabs() {
  const { user } = useAuth()
  const role = user?.role
  // round06f 갈래 E(spec §10.3) — env 필터를 걷어낸다. round06e는 prod에서 모니터링·
  // 노드관리·이용로그를 여기서 뺐지만, 그 근거는 "AppShell이 그 화면을 통째로 준비중으로
  // 바꿔 탭이 죽은 링크가 된다"였다. 이제 각 페이지가 <EnvGate>로 본문만 가리므로
  // (Monitoring/Nodes/Log.jsx) 탭줄은 살아남고 탭도 정상 링크다 — 눌러 들어가면 이
  // 탭줄은 그대로고 본문만 준비중이다. 사용자 요구가 정확히 그것이었다(spec §2-5).
  //
  // 남은 판정은 role 하나뿐이다. prod에서도 통합관리자 4탭 / 관리자 계정·권한 1탭 /
  // 사용자 0탭이며(spec §10.4), 그것은 env가 아니라 PERMISSION_MATRIX의 정책이라
  // 이번 변경과 무관하게 불변이다 — 권한 경계는 넓어지지 않는다(spec §10.5).
  const visible = TABS.filter((t) => canAccess(role, t.to))

  return (
    <>
      <h2 className="mng_page_tit">시스템관리</h2>
      <nav className="page_tabs" aria-label="시스템관리 하위 메뉴">
        {visible.map(({ label, to }) => (
          <NavLink key={to} to={to} className="page_tabs_link">{label}</NavLink>
        ))}
      </nav>
    </>
  )
}
