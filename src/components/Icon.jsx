import icHome from '../assets/icons/ic_nav_home.svg'
import icHomeActive from '../assets/icons/ic_nav_home_active.svg'
import icSearch from '../assets/icons/ic_nav_search.svg'
import icSearchActive from '../assets/icons/ic_nav_search_active.svg'
import icLibrary from '../assets/icons/ic_nav_library.svg'
import icLibraryActive from '../assets/icons/ic_nav_library_active.svg'
import icData from '../assets/icons/ic_nav_data.svg'
import icDataActive from '../assets/icons/ic_nav_data_active.svg'
import icSystem from '../assets/icons/ic_nav_system.svg'
import icSystemActive from '../assets/icons/ic_nav_system_active.svg'

/**
 * 이 파일의 책임: LNB 내비게이션 아이콘 5종의 렌더 방식을 한 곳으로 모은다.
 *
 * 왜 <img>인가 — 이 라운드의 아이콘 규약은 "색이 변해야 하는 아이콘은
 * mask-image + currentColor, 색이 고정인 장식 아이콘은 <img>"다(§6.5.4).
 * LNB 5종은 퍼블이 활성/비활성 2벌 파일로 색을 이미 갈라 두었으므로
 * 색 계산이 필요 없고, 따라서 <img> + 경로 교체가 맞다.
 *
 * 왜 alt=""인가 — 퍼블 main.html:35-39의 nav 아이콘은 전부 alt=""이고,
 * 의미는 옆의 <span>텍스트가 전달한다. 아이콘에 이름을 또 붙이면
 * 스크린리더가 같은 항목을 두 번 읽는다(§6.8.5).
 *
 * 크기·정렬은 퍼블 CSS가 잡는다(layout.css:62 `.lnb_menu a img{width:.8rem;height:.8rem}`).
 * 그래서 이 컴포넌트에 size prop을 두지 않는다.
 *
 * 범위 — lucide-react는 제거하지 않는다. 셸 바깥(Modal의 X 등)에서 계속 쓰이며,
 * lucide ↔ <img> ↔ mask-image 3중 공존의 전면 정리는 round06b 몫이다(§4.3).
 */

/**
 * round10b B-1(시트 #5) — search·library도 이제 5종 전부가 활성 변형을 쓴다.
 *
 * 이전 주석은 「퍼블 배포본에 ic_nav_search_active.svg · ic_nav_library_active.svg가
 * 실제로 없다」며 이 둘을 null로 묶어 두었다. 그런데 **자산은 이미 2026-07-24
 * `165bab3`(퍼블 v2 정적자산 반입)에서 두 파일과 함께 들어와 있었다** — 그 뒤
 * 두 달간 아무도 `NAV_ICONS`를 갱신하지 않아 메뉴 바에서 라이브러리를 선택해도
 * 아이콘 색이 안 바뀌는 결함으로 남았다(round10b 기획 이슈 #5). 이 파일을 고치는
 * 김에 「자산이 없다」는 확인되지 않은 이유를 실제 시점으로 바로잡는다.
 *
 * 키 이름 5종(home·search·library·data·system)이 Lnb 의 NAV[].icon 값과
 * 글자 그대로 같아야 한다 — 이 계약이 어긋나면 아이콘이 조용히 사라진다.
 */
export const NAV_ICONS = {
  home:    { base: icHome,    active: icHomeActive },
  search:  { base: icSearch,  active: icSearchActive },
  library: { base: icLibrary, active: icLibraryActive },
  data:    { base: icData,    active: icDataActive },
  system:  { base: icSystem,  active: icSystemActive },
}

/** 이름과 활성 여부로 실제 파일 경로를 고른다. 결번이면 비활성 경로로 폴백한다
 *  (round10b 기준 결번은 없다 — 5종 모두 active를 갖지만, 다음에 자산이 다시
 *  빠지는 kind가 생겨도 조용히 죽지 않도록 폴백 자체는 남겨 둔다). */
export function iconSrc(name, active = false) {
  const entry = NAV_ICONS[name]
  if (!entry) return undefined
  return active && entry.active ? entry.active : entry.base
}

export default function Icon({ name, active = false, alt = '', className }) {
  const src = iconSrc(name, active)
  if (!src) return null
  return <img src={src} alt={alt} className={className} />
}
