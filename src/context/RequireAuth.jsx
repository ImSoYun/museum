/**
 * RequireAuth.jsx — 전면 게이트(round06c F2, spec §9.2·계획 Global Constraints #13).
 *
 * app 계층(AppShell)만 감싼다 — auth 계층(login/join/find)은 이 게이트 밖에 있어
 * anon이어도 그대로 렌더된다(router.jsx의 라우트 배치가 그 경계를 이미 긋는다).
 *
 * 분기 넷:
 *  ① status==='loading' → 스플래시(간단 로딩, Spinner 재사용).
 *  ② status==='anon'    → `/login`으로 리다이렉트(`replace` — 뒤로가기로 게이트 뒤에 남지 않게).
 *  ③ authed·canAccess=false·area가 system-ops/system-accounts → SystemAccessDenied를
 *     그 자리에 렌더한다(round06c-ext D2b, 원장 주입 사항 #2 "최소 배선"). URL은 바뀌지
 *     않는다 — 접근거부 알림의 확인 버튼(또는 Esc)을 눌러야 홈으로 이동한다. children
 *     (AppShell)을 거치지 않으므로 이 화면에는 LNB가 없다(SystemAccessDenied.jsx 상단
 *     주석 참조 — 의도된 단순화).
 *  ④ authed·canAccess=false·그 외 area(예: manage) → 기존대로 '/'로 즉시 리다이렉트한다.
 *     '/'(area='search')는 전 역할 공통 허용이라 무한 리다이렉트 루프가 생기지 않는다
 *     (data/permissions.js PERMISSION_MATRIX 참고).
 *  가능하면 children(AppShell)을 그대로 렌더한다.
 *
 * 이 게이트는 프론트 UX다 — 실제 보안 경계는 백엔드 require_user/require_role이다.
 * 데모(!isLive · AuthContext 기본값 DEMO_MOCK_USER=통합관리자)에서는 리다이렉트가 거의
 * 걸리지 않는다 — F1의 C-D3와 같은 근거로, 이 라운드의 자율 범위에서 의도한 동작이다.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { areaOf, canAccess } from '../data/permissions.js'
import Spinner from '../components/Spinner.jsx'
import SystemAccessDenied from '../pages/admin/SystemAccessDenied.jsx'

export default function RequireAuth({ children }) {
  const { user, status } = useAuth()
  const { pathname } = useLocation()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Spinner size={32} />
      </div>
    )
  }

  if (status === 'anon') {
    return <Navigate to="/login" replace />
  }

  if (!canAccess(user?.role, pathname)) {
    const area = areaOf(pathname)
    if (area === 'system-ops' || area === 'system-accounts') {
      return <SystemAccessDenied />
    }
    return <Navigate to="/" replace />
  }

  return children
}
