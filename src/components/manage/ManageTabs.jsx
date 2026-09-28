import { NavLink } from 'react-router-dom'

/**
 * 이 파일의 책임: 자료관리 5화면 공통의 페이지 제목 + 부착형 하위 탭.
 *
 * 퍼블 manage_ocr.html:71-79는 h2.mng_page_tit 과 nav.page_tabs 를 형제로 두고
 * 그 아래 div.data_panel 을 붙인다. drop-shadow는 .data_panel 에만 걸려 있고
 * .page_tabs 에는 없다 — 탭과 패널이 한 덩어리로 보이는 것은 탭의 아래 모서리가
 * 각지고 border-bottom:0 인 점과 패널의 위 모서리가 각진 점이 맞물린 결과다.
 * 그래서 탭과 패널 사이에 gap·margin을 넣으면 카드가 끊겨 보인다(§6.7.1).
 *
 * 활성 표시는 클래스 분기가 아니라 a[aria-current="page"] 속성 셀렉터가 한다
 * (component.css:75). NavLink가 활성 시 aria-current="page"를 자동으로 붙이므로
 * isActive 분기를 지우고 CSS에 맡기면 React 코드가 오히려 줄어든다(§6.7.2).
 *
 * 제목을 페이지가 아니라 이 컴포넌트가 렌더하는 이유 — 퍼블 5화면 모두 같은
 * "자료관리" 문자열이라 탭 그룹의 이름이지 개별 화면 이름이 아니고, 폐기되는
 * AppBreadcrumb가 담당하던 "여기가 어디인가"의 최소 대체물이기 때문이다(§6.7.3).
 */
const TABS = [
  { label: '유물자료 OCR',       to: '/manage/ocr' },
  { label: '메타 정보 등록',     to: '/manage/meta' },
  { label: '데이터 임베딩 관리', to: '/manage/embedding' },
  { label: '학습 반영 이력',     to: '/manage/history' },
  // 퍼블 manage_ocr.html:77의 라벨은 "자료관리"다. 라우트 경로는 /manage/materials 그대로 둔다 —
  // 퍼블 파일명(manage_list.html)은 정적 산출물의 이름일 뿐 URL 규약이 아니다(§8.0.2).
  { label: '자료관리',           to: '/manage/materials' },
]

export default function ManageTabs() {
  return (
    <>
      <h2 className="mng_page_tit">자료관리</h2>
      {/* 한 화면에 <nav>가 둘 이상(lnb·page_tabs)이므로 구분 라벨이 필수다(§6.8.5) */}
      <nav className="page_tabs" aria-label="자료관리 하위 메뉴">
        {/* D2a: component.css의 page_tabs 그룹(R6c-ext A1)이 약속한 .page_tabs_link를
            부여한다. 활성 표시는 여전히 aria-current="page" 속성 셀렉터가 한다 —
            className 자체는 active/비active 모두 동일(A3 PageTabs.jsx와 같은 패턴). */}
        {TABS.map(({ label, to }) => (
          <NavLink key={to} to={to} className="page_tabs_link">{label}</NavLink>
        ))}
      </nav>
    </>
  )
}
