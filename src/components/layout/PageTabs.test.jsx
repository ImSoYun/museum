import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PageTabs from './PageTabs.jsx'

const tabs = [{ label: '모니터링', to: '/system/monitoring' }, { label: '계정·권한', to: '/system/accounts' }]
function at(path) {
  return render(<MemoryRouter initialEntries={[path]}><PageTabs title="시스템관리" tabs={tabs} ariaLabel="시스템관리 하위 메뉴" /></MemoryRouter>)
}

test('제목과 탭 링크를 렌더한다', () => {
  at('/system/monitoring')
  expect(screen.getByRole('heading', { name: '시스템관리' })).toHaveClass('mng_page_tit')
  expect(screen.getByRole('navigation', { name: '시스템관리 하위 메뉴' })).toBeInTheDocument()
  tabs.forEach((t) => expect(screen.getByRole('link', { name: t.label })).toBeInTheDocument())
})

test('현재 경로 탭만 aria-current=page 다', () => {
  at('/system/accounts')
  expect(screen.getByRole('link', { name: '계정·권한' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '모니터링' })).not.toHaveAttribute('aria-current', 'page')
})

// A3 브리프 §요구사항: tabs가 1개여도 nav는 렌더한다(관리자 계정·권한 단일탭 대응, Part E/D).
test('tabs가 1개여도 nav.page_tabs를 렌더한다', () => {
  const { container } = render(
    <MemoryRouter>
      <PageTabs title="계정" tabs={[{ label: '내 정보', to: '/account' }]} ariaLabel="계정 하위 메뉴" />
    </MemoryRouter>,
  )
  expect(container.querySelector('nav.page_tabs')).not.toBeNull()
  expect(screen.getByRole('link', { name: '내 정보' })).toBeInTheDocument()
})

// title 없이도 안전해야 한다 — 호출부가 그룹명을 별도로 렌더하는 경우(YAGNI 대비).
test('title 미지정 시 h2를 렌더하지 않는다', () => {
  const { container } = render(
    <MemoryRouter>
      <PageTabs tabs={tabs} ariaLabel="시스템관리 하위 메뉴" />
    </MemoryRouter>,
  )
  expect(container.querySelector('h2.mng_page_tit')).toBeNull()
  expect(container.querySelector('nav.page_tabs')).not.toBeNull()
})
