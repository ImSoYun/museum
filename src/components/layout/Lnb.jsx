/**
 * 이 파일의 책임: 퍼블 publish-v2의 좌측 내비게이션(nav.lnb) 1벌(round06c-ext A2 — v2화).
 * 원본 마크업은 workspace/design/publish-v2/js/lnb.js, 스타일은
 * workspace/app/web/src/styles/publish/layout.css(A1이 v2 전량 반입) 다.
 *
 * 블록은 정확히 4개다.
 *   .lnb_top   (로고 + 접기 토글 + "새로운 검색")
 *   ul.lnb_menu(고정 4항목 — v1의 5항목에서 '자료검색' 삭제, round06c-ext §3 확정 #3)
 *   .lnb_divider + .lnb_history (나의 기록 + 케밥 저장/삭제 드롭다운, v2 신규)
 *   .lnb_profile(프로필 + 로그아웃)
 *
 * round06c Task E5: .lnb_history 블록(mock searchHistory + 콜백 props onSaveHistory/
 * onDeleteHistory)은 `LnbHistory.jsx`로 분리 이관했다 — 실데이터(listConversations)·재개
 * (resumeConversation)·삭제(deleteConversation)를 그 컴포넌트가 직접 다루므로 Lnb는 더 이상
 * 히스토리 데이터나 useScenario에 의존하지 않는다(`.lnb_divider`만 이 파일에 남는다).
 *
 * v1 → v2 변경 요지(과업 A2 브리프 §3 확정 사항):
 *  - NAV가 4항목으로 준다: '자료검색' 삭제(검색은 "새로운 검색" 버튼이 곧 홈이다), 기존
 *    '계정 승인'(/approvals)도 별도 메뉴 항목에서 빠진다 — 시스템관리 > 계정·권한 탭으로
 *    이관 예정(D1 소유, 여기서 만들지 않는다 — YAGNI).
 *  - 시스템관리 라우트가 /admin/monitoring → /system/monitoring 으로 바뀌었다(D1-2가 라우터
 *    자체를 재편해 구 라우트를 라우트 테이블에서 완전히 제거했다). requires는 'admin' →
 *    'system'(A2의 최소 seam) → 'system-ops'(D1-1이 정밀화 — permissions.js 참고)로 이어졌다.
 *  - **[round06c 최종 리뷰 must-fix I-1]** 시스템관리 NAV 항목의 목적지를 role별로 파생한다.
 *    D1-1 직후에는 목적지가 /system/monitoring(system-ops) 하나로 고정돼 있어, system-ops가
 *    없는 관리자는 이 라운드가 만든 계정·권한 화면(/system/accounts, system-accounts)에
 *    LNB로는 도달할 방법이 없었다(URL 직접입력만 가능) — 계획 §3.3("시스템관리 LNB:
 *    관리자·통합관리자 접근, 사용자만 차단")의 미이행이었다. 이제 목적지는
 *    `permissions.js`의 `firstSystemEntry(role)`이 판정한다: 통합관리자→/system/monitoring,
 *    관리자→/system/accounts, 사용자→(둘 다 없음) fallback 경로가 남아 requires가 그대로
 *    차단한다. 판정 로직 자체는 permissions.js에 있고 Lnb는 그 결과를 NAV 항목의 to에
 *    꽂기만 한다 — role별 분기를 이 파일에 하드코딩하지 않는다(이 프로젝트는 권한 판정을
 *    permissions.js 단일 출처로 유지한다).
 *  - 시스템관리 활성-판정 match 배열에서 '/account'를 뺐다(D1-2 — A2가 남긴 '/account'는
 *    AdminTabs(구 3탭: 모니터링·노드관리·계정관리)가 '계정관리' 탭을 /account로 연결하던
 *    옛 설계의 잔재다. 새 IA에서 '/account'는 "내 계정"(전 역할 공통, LNB 프로필 블록이
 *    링크)이고 시스템관리와는 무관한 별도 화면이다 — 사용자 role이 /account에 있을 때
 *    좌측 NAV의 '시스템관리'가 켜지는 것은 오신호다(자신이 권한 없는 영역에 있다고
 *    착각하게 한다). "시스템관리 > 계정·권한"은 이제 별도 라우트 /system/accounts로
 *    존재하므로(match 배열에 이미 '/system'이 있어 자동 포함) '/account'를 남겨 둘
 *    근거가 사라졌다.
 *  - "새로운 검색" 버튼의 목적지가 /search → /(홈)로 바뀐다 — /search 전용 화면 개념이
 *    사라졌기 때문이다.
 *  - .lnb_menu의 자식이 명시 클래스로 바뀐다(a→.lnb_menu_link, li→.lnb_menu_item,
 *    img→.lnb_menu_icon, span→.lnb_menu_label) — v2 layout.css가 자손 선택자 대신 이
 *    클래스들을 쓰므로(css-contract.test.js INTENDED_PUBLISH_CLASSNAMES에도 추가) 마크업을
 *    맞춘다.
 *  - 나의 기록 항목마다 케밥(더보기) 드롭다운이 열린다 — round06c Task E5부터 실데이터·재개·
 *    삭제까지 전부 `LnbHistory.jsx`가 소유한다(아래 참조).
 *
 * 접힘(collapsed)은 부모(AppShell)가 보유한다. Lnb는 여전히 상태를 갖지 않고 props로만 받는다.
 * 접힘 시 숨는 요소를 CSS(display:none)가 아니라 **조건부 렌더**로 구현하는 이유는 v1과 동일하다
 * — jsdom이 CSS를 로드하지 않아 클래스 토글은 테스트로 관측할 수 없기 때문이다.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../Icon.jsx'
import LnbHistory from './LnbHistory.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { blockReasonOf, firstSystemEntry } from '../../data/permissions.js'
import logoSvg from '../../assets/layout/logo.svg'
import avatarSvg from '../../assets/layout/profile_avatar.svg'
import lnbToggleSvg from '../../assets/icons/ic_lnb_toggle.svg'
import logoMarkSvg from '../../assets/icons/ic_logo_mark.svg'
import plusSvg from '../../assets/icons/ic_plus.svg'
import logoutSvg from '../../assets/icons/ic_logout.svg'

// v2 4항목 ↔ 우리 라우트 매핑(과업 A2 브리프 §3). 앞 3항목은 role과 무관하게 목적지가
// 고정이다(모든 role에게 같은 경로) — 시스템관리만 목적지가 role별로 갈리므로 아래
// systemNavItem()이 렌더 시점에 따로 만든다.
const NAV_BASE = [
  { label: '홈',         to: '/',           icon: 'home',    match: 'end' },
  { label: '라이브러리', to: '/library',    icon: 'library', match: ['/library'] },
  { label: '자료관리',   to: '/manage/ocr', icon: 'data',    match: ['/manage'], requires: 'manage' },
]

// round06c 최종 리뷰 must-fix I-1 — 시스템관리 NAV 항목. 목적지는 permissions.js의
// firstSystemEntry(role)가 판정한다(통합관리자→monitoring, 관리자→accounts, 사용자→null).
//
// round06e R6E-8 — prod에서는 모니터링·노드관리·이용로그가 AppShell 게이트(envGates.js)에
// 걸려 전부 준비중이다. firstSystemEntry가 통합관리자에게 돌려주는 /system/monitoring으로
// 그대로 보내면 곧바로 ComingSoon으로 튕긴다. 그래서 prod에서는 role과 무관하게 살아있는
// 유일한 system-* 화면(/system/accounts)으로 직행한다 — canAccess가 없는 role(사용자)은
// 여전히 blockReasonOf가 system_access로 잡는다(아래 분기 대상이 아니다, 로직 불변).
function systemNavItem(role, appEnv) {
  const to = appEnv === 'prod'
    ? '/system/accounts'
    : (firstSystemEntry(role) ?? '/system/monitoring')
  return { label: '시스템관리', to, icon: 'system', match: ['/system'], requires: 'system-ops' }
}

/** 활성 판정(순수 함수) — 'end'는 완전일치, 배열은 prefix 일치다. */
export function isNavActive(item, pathname) {
  if (item.match === 'end') return pathname === '/'
  return item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export default function Lnb({
  collapsed = false,
  onToggle,
  onBlocked = () => {},
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout, appEnv } = useAuth()
  // 세션 사용자 요약 필드는 display_name이다(name이 아니다 — museum/auth/routes.py:_summarize
  // ·AuthContext.DEMO_MOCK_USER와 동일 계약).
  // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": email을 더 이상
  // 구조분해하지 않는다(세션 응답 자체에 그 키가 없다 — auth/routes.py:_summarize).
  const { display_name: name, role } = user ?? {}
  // 시스템관리 항목만 role·appEnv에 따라 목적지가 달라지므로(I-1, R6E-8) 매 렌더 다시
  // 만든다 — role이 바뀌면(로그인 전환 등) NAV도 즉시 갱신돼야 한다.
  const NAV = [...NAV_BASE, systemNavItem(role, appEnv)]

  // round06c 리뷰 fix1 — 기존 <Link to="/login">은 이동만 하고 세션을 종료하지 않았다.
  // logout()은 네트워크 실패 시 reject할 수 있으므로(로그아웃 요청 자체가 실패해도 클라
  // 상태는 AuthContext가 finally에서 이미 anon으로 정리한다) 여기서 반드시 잡아야
  // unhandled rejection 없이 항상 /login으로 이동한다.
  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* 무시 — 클라 상태는 AuthContext.logout()의 finally가 이미 정리했다 */
    }
    navigate('/login')
  }

  return (
    <nav className={collapsed ? 'lnb is_collapsed' : 'lnb'} id="lnb" aria-label="주요메뉴">
      {/* ── .lnb_top ── */}
      <div className="lnb_top">
        <div className="lnb_head">
          {!collapsed && (
            <h1 className="lnb_logo">
              {/* 로고 클릭 → 홈. 접근명은 '홈' 메뉴 링크와 겹치지 않게 '홈으로 이동'으로 둔다
                  — 같은 이름이면 getByRole('link',{name:'홈'})이 둘을 집는다. */}
              <Link to="/" aria-label="홈으로 이동">
                <img
                  src={logoSvg}
                  alt="SA:I - 학예 업무를 위한 근현대사 지능형 학예 지식 플랫폼"
                  className="lnb_logo_full"
                />
              </Link>
            </h1>
          )}
          {/* 접히면 토글 아이콘 대신 로고마크가 드러나 '로고마크가 곧 펼치기 버튼'이 된다(layout.css) */}
          <button
            type="button"
            className="lnb_toggle icon_btn"
            id="lnb_toggle"
            aria-expanded={collapsed ? 'false' : 'true'}
            aria-controls="lnb"
            aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            onClick={onToggle}
          >
            {collapsed
              ? <img src={logoMarkSvg} alt="" className="lnb_logo_mark" />
              : <img src={lnbToggleSvg} alt="" className="lnb_toggle_icon" />}
          </button>
        </div>
        {!collapsed && (
          // 브리프 §3: "새로운 검색" 버튼 = 홈(/)으로 이동(새 검색 시작). v1은 /search로
          // 보냈으나 /search 전용 화면 개념이 사라져 홈이 새 검색의 진입점이다.
          <button type="button" className="lnb_new_btn" onClick={() => navigate('/')}>
            <img src={plusSvg} alt="" />
            <span className="lnb_new_txt">새로운 검색</span>
          </button>
        )}
      </div>

      {/* ── ul.lnb_menu ── */}
      <ul className="lnb_menu">
        {NAV.map((item) => {
          const active = isNavActive(item, pathname)
          // 차단 사유는 권한 정책 모듈이 판정한다. 여기서는 사유 문자열을 셸에 넘기기만 한다.
          const reason = blockReasonOf(item, role)
          const linkClassName = active ? 'lnb_menu_link active' : 'lnb_menu_link'
          // 아이콘과 라벨은 두 갈래가 완전히 같다 — 분기 때문에 마크업이 갈라지지 않게 뽑아 둔다.
          const inner = (
            <>
              <Icon name={item.icon} active={active} alt="" className="lnb_menu_icon" />
              {!collapsed && <span className="lnb_menu_label">{item.label}</span>}
            </>
          )
          return (
            <li key={item.to} className="lnb_menu_item">
              {reason ? (
                // <a>를 유지하는 이유: v2 CSS의 `.lnb_menu_link` 선택자가 링크 요소를 전제한다.
                // href 는 남겨 두어 role='link' 와 접근명이 정상 화면과 같게 유지된다.
                <a
                  href={item.to}
                  className={linkClassName}
                  onClick={(e) => {
                    e.preventDefault()          // 퍼블 common.js:57과 같은 동작
                    onBlocked(reason, e.currentTarget)
                  }}
                >
                  {inner}
                </a>
              ) : (
                <Link to={item.to} className={linkClassName}>
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      {/* ── .lnb_divider + .lnb_history ── */}
      {/* round06c Task E5: .lnb_history 블록 전체(실데이터·재개·삭제·케밥)를 LnbHistory가
          소유한다. collapsed는 그대로 넘기고(그 안에서 collapsed면 null을 반환), lnb_divider
          만 이 파일에 남긴다(퍼블 마크업 순서 유지). */}
      {!collapsed && <div className="lnb_divider" />}
      <LnbHistory collapsed={collapsed} />

      {/* ── .lnb_profile ── */}
      <div className="lnb_profile">
        <img src={avatarSvg} alt="" className="lnb_profile_avatar" />
        {!collapsed && (
          <>
            {/* 프로필 블록 클릭 → /account. 퍼블 마크업(.lnb_profile_info 이하)은 손대지 않고
                바깥만 감싼다(v1과 동일 계약 유지). */}
            <Link to="/account" className="lnb_profile_info" aria-label="계정 설정">
              <p className="lnb_profile_name">
                {name} <span className="lnb_profile_role">{role}</span>
              </p>
              {/* round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 퍼블
                  원문의 .lnb_profile_email 줄(이메일 노출)을 제거했다. */}
            </Link>
            {/* round06c 리뷰 fix1: 퍼블 원본은 <a href="login.html">(role=link)이었으나 이동만
                하고 세션을 종료하지 않는 결함이 있었다. 실제 로그아웃(세션 종료)이 필요하므로
                <button>으로 바꾸고 handleLogout()이 logout() 이후 /login으로 이동한다. */}
            <button type="button" className="lnb_logout icon_btn" aria-label="로그아웃" onClick={handleLogout}>
              <img src={logoutSvg} alt="" />
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
