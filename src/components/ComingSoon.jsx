/**
 * 이 파일의 책임: prod 환경에서 감춘 화면의 자리 표시자(round06e 갈래 B, spec R6E-7).
 *
 * 퍼블에 준비중 전용 화면이 없다(spec §1.4 #6) — 가장 가까운 원본 admin_access_denied.html은
 * 안내를 alert_popup(모달)로 띄우고, 이 앱의 SystemAccessDenied.jsx(권한 없음 화면)가 그
 * 패턴을 그대로 재현한다(AlertPopup kind="system_access", dim + 확인/Esc 시 홈 이동).
 *
 * 이 컴포넌트는 그 모달 방식을 따르지 않는다 — spec R6E-7이 "AlertPopup의 미사용 wip
 * 모달은 되살리지 않는다(세 번째 표현 방지)"고 명시했다. system_access(권한 없음 → 강제
 * 이동)와 wip(제품 결정상 미공개)는 의미가 다르다 — 후자는 그냥 "아직 준비 중인 페이지"이지
 * 벗어나야 하는 경고가 아니므로, dim도 확인 버튼도 자동 이동도 없이 이 라우트의 본문
 * 자체로 렌더한다(AppShell.jsx가 main 안에서 <Outlet/> 대신 이 컴포넌트를 꽂는다).
 *
 * 문구는 기존 두 표현과 글자 그대로 같다: showToast('준비 중입니다')(round06c 계약) ·
 * AlertPopup.ALERTS.wip.desc(components/AlertPopup.jsx). 세 번째 문구를 만들지 않기
 * 위함이다. alert_popup_tit·alert_popup_desc는 이미 AlertPopup.jsx가 쓰는 퍼블 클래스라
 * (component.css:68,293) 새 텍스트 스타일 CSS가 필요 없다 — 래퍼(.coming_soon_view)만
 * 자체 설계라 publish-ext.css에 둔다.
 */
export default function ComingSoon() {
  return (
    <div className="coming_soon_view">
      <p className="alert_popup_tit">준비 중입니다</p>
      <p className="alert_popup_desc">빠른 시일 내에 서비스할 예정입니다.</p>
    </div>
  )
}
