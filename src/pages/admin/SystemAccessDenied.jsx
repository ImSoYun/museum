import { useNavigate } from 'react-router-dom'
import AlertPopup from '../../components/AlertPopup.jsx'

/**
 * 이 파일의 책임: 권한 없는 role이 /system/* URL로 직접 진입했을 때 보여주는 화면.
 *
 * 퍼블 admin_access_denied.html은 본문 없이 main.mng_main#system_access_view 하나와
 * sr_only 제목("시스템관리")만 두고, 실제 알림은 공용 alert_popup(이 앱에서는
 * AlertPopup.jsx, kind="system_access")이 얹는다는 계약을 그대로 계승한다 — 새 팝업을
 * 만들지 않고 §13 U-3에서 이미 확정한 문구(제목 "접근 권한 제한", 역할 어휘 "통합관리자")를
 * 재사용한다.
 *
 * RequireAuth(context/RequireAuth.jsx)가 canAccess=false이고 대상 area가
 * system-ops/system-accounts일 때 이 컴포넌트를 렌더한다(원장 주입 사항 #2, 최소 배선) —
 * AppShell을 거치지 않고 RequireAuth가 children 자리에 직접 꽂으므로 LNB는 이 화면에
 * 없다(설계 v2의 전체 2단 레이아웃과 다른 점 — "최소 배선"이 명시적으로 택한
 * 단순화다. §4 디자인 참조 — 미참조 사유: LNB 유지를 위해 AppShell을 이 경로에서도
 * 통과시키려면 라우트 가드를 추가로 분기해야 하는데, 그 복잡도가 이번 배선 범위 밖이라
 * 판단했다).
 *
 * AlertPopup은 kind가 참이면 즉시·항상 열려 있다(v2 admin_access_denied.html이 알림을
 * 조건 없이 띄우는 것과 같다) — 닫을 때(확인 버튼·Esc·dim 클릭 전부) onClose가 홈으로
 * 이동시키므로, 팝업이 사라져도 사용자가 접근거부 화면에 갇히지 않는다.
 */
export default function SystemAccessDenied() {
  const navigate = useNavigate()

  return (
    <main className="mng_main" id="system_access_view">
      <h2 className="sr_only">시스템관리</h2>
      <AlertPopup kind="system_access" onClose={() => navigate('/', { replace: true })} />
    </main>
  )
}
