import { render, screen } from '@testing-library/react'
import Icon, { iconSrc, NAV_ICONS } from './Icon.jsx'

test('Icon: 퍼블 SVG를 <img>로 렌더하고 장식용이므로 alt는 빈 문자열이다', () => {
  const { container } = render(<Icon name="home" />)
  const img = container.querySelector('img')
  expect(img).not.toBeNull()
  expect(img.getAttribute('alt')).toBe('')
  expect(img.getAttribute('src')).toContain('ic_nav_home.svg')
  // 장식 아이콘이므로 접근성 트리에 이름을 남기지 않는다
  expect(screen.queryByRole('img')).toBeNull()
})

// round10b B-1(기획 이슈 #5) — search·library의 active 자산은 2026-07-24
// `165bab3`(퍼블 v2 정적자산 반입)에서 이미 들어왔다. 예전 시험은 그 사실을
// 모른 채 「결번 2종은 비활성 경로로 폴백한다」를 정면으로 잠그고 있었다 —
// 그 잠금 자체가 결함을 통과시키는 원인이었다(라이브러리 메뉴를 눌러도 아이콘
// 색이 안 바뀐다). 이제는 5종 전부가 active 변형을 실제로 쓰는지를 잠근다.
test('Icon: active면 5종 전부 _active 변형을 쓴다(과거엔 search·library가 결번이었다)', () => {
  expect(iconSrc('home', true)).toContain('ic_nav_home_active.svg')
  expect(iconSrc('search', true)).toContain('ic_nav_search_active.svg')
  expect(iconSrc('library', true)).toContain('ic_nav_library_active.svg')
  expect(iconSrc('data', true)).toContain('ic_nav_data_active.svg')
  expect(iconSrc('system', true)).toContain('ic_nav_system_active.svg')

  // active가 아니면 5종 전부 base로 돌아온다.
  for (const name of ['home', 'search', 'library', 'data', 'system']) {
    expect(iconSrc(name, false)).not.toContain('_active')
  }

  // NAV_ICONS 자체도 결번(null)이 하나도 없다는 것을 직접 잠근다 — iconSrc의
  // 폴백 동작 뒤에 결번이 숨어도 위 문자열 단언만으로는 못 잡는다.
  for (const name of ['home', 'search', 'library', 'data', 'system']) {
    expect(NAV_ICONS[name].active).not.toBeNull()
  }

  // 컴포넌트 경로로도 같은 판정이 나온다 — search를 대표로 확인한다.
  const { container } = render(<Icon name="search" active />)
  expect(container.querySelector('img').getAttribute('src')).toContain('ic_nav_search_active.svg')
})

// 결번(폴백) 자체를 없애지는 않았다 — 계약 밖 이름이 들어오면 여전히 조용히
// 죽는다(undefined). NAV[].icon 계약(파일 머리 주석)이 깨지는 순간을 대비한 것이다.
test('Icon: NAV_ICONS 에 없는 이름은 undefined 를 내고 컴포넌트는 아무것도 그리지 않는다', () => {
  expect(iconSrc('unknown')).toBeUndefined()
  const { container } = render(<Icon name="unknown" />)
  expect(container.querySelector('img')).toBeNull()
})
