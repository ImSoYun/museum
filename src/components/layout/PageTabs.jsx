/**
 * 이 파일의 책임: "제목 + 부착형 하위 탭" 골격의 범용화(round06c-ext A3).
 *
 * ManageTabs.jsx·AdminTabs.jsx가 각자 하드코딩해 온 h2.mng_page_tit + nav.page_tabs
 * 구조가 자료관리·시스템관리·계정탭(D·E)에서 반복된다. 탭 목록 자체(무엇을 몇 개
 * 보여줄지)는 각 화면의 관심사이므로 여기서 정하지 않는다(YAGNI) — 이 컴포넌트는
 * {title, tabs, ariaLabel}을 받아 뼈대만 렌더한다. 기존 두 파일의 리팩터(TABS 상수를
 * 이 컴포넌트 호출로 교체)는 그 파일의 소유자(D)가 선택한다.
 *
 * 활성 표시는 클래스 분기가 아니라 NavLink가 자동으로 붙이는 aria-current="page"를
 * CSS(.page_tabs_link[aria-current="page"])가 잡는다 — ManageTabs.jsx의 판단과 동일하다.
 * LNB는 이 속성을 쓰지 않으므로(A2) App.test가 aria-current로 라우트를 판정할 때
 * 서로 다른 <nav>가 섞이지 않는다.
 *
 * tabs가 1개여도 nav는 그대로 렌더한다 — 관리자 계정·권한 등 단일탭 화면(Part E/D)에서도
 * "이 화면이 하위 탭 그룹의 일부"라는 시각 골격(.page_tabs 카드 이음매)을 유지해야 하기
 * 때문이다. 배열이 비면(tabs=[]) nav는 렌더되되 링크가 없다 — 호출부 실수를 여기서
 * 숨기지 않는다.
 */
import { NavLink } from 'react-router-dom'

export default function PageTabs({ title, tabs = [], ariaLabel }) {
  return (
    <>
      {title && <h2 className="mng_page_tit">{title}</h2>}
      <nav className="page_tabs" aria-label={ariaLabel}>
        {tabs.map(({ label, to }) => (
          <NavLink key={to} to={to} className="page_tabs_link">{label}</NavLink>
        ))}
      </nav>
    </>
  )
}
