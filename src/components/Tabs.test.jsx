import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Tabs, { TabPanel } from './Tabs.jsx'

const tabs = [
  { key: 'results', label: '검색결과', badge: undefined },
  { key: 'ai', label: 'AI대화' },
  { key: 'output', label: '산출물', badge: 2 },
]

test('Tabs pill variant: active tab has bg-white class', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} variant="pill" />)
  const activeBtn = screen.getByText('검색결과').closest('button')
  expect(activeBtn.className).toMatch(/bg-white/)
})

test('Tabs pill variant: inactive tab has bg-[#E7EAF4] class', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} variant="pill" />)
  const inactiveBtn = screen.getByText('AI대화').closest('button')
  expect(inactiveBtn.className).toMatch(/bg-\[#E7EAF4\]/)
})

test('Tabs badge renders with correct text', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} variant="pill" />)
  expect(screen.getByText('2')).toBeInTheDocument()
})

test('Tabs badge has primary pill styling', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} variant="pill" />)
  const badge = screen.getByText('2')
  expect(badge.className).toMatch(/bg-primary-600/)
  expect(badge.className).toMatch(/text-white/)
  expect(badge.className).toMatch(/rounded-full/)
})

test('Tabs underline variant: active tab has border-primary-600 class', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} variant="underline" />)
  const activeBtn = screen.getByText('검색결과').closest('button')
  expect(activeBtn.className).toMatch(/border-primary-600/)
  expect(activeBtn.className).not.toMatch(/border-transparent/)
})

test('Tabs underline variant: inactive tab has border-transparent', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} variant="underline" />)
  const inactiveBtn = screen.getByText('AI대화').closest('button')
  expect(inactiveBtn.className).toMatch(/border-transparent/)
})

test('Tabs default variant (no prop) behaves as underline', () => {
  render(<Tabs tabs={tabs} active="results" onChange={() => {}} />)
  const activeBtn = screen.getByText('검색결과').closest('button')
  expect(activeBtn.className).toMatch(/border-primary-600/)
})

test('Tabs fires onChange (pill)', () => {
  const fn = vi.fn()
  render(<Tabs tabs={tabs} active="results" onChange={fn} variant="pill" />)
  fireEvent.click(screen.getByText('AI대화'))
  expect(fn).toHaveBeenCalledWith('ai')
})

// ───────── segmented 변형 + WAI-ARIA Tabs 패턴 (퍼블 find.html / common.js:78-108) ─────────

const segTabs = [
  { key: 'findid', label: '아이디 찾기',   id: 'tab_findid', panelId: 'panel_findid' },
  { key: 'findpw', label: '비밀번호 찾기', id: 'tab_findpw', panelId: 'panel_findpw' },
]

function SegHarness() {
  const [active, setActive] = useState('findid')
  return (
    <>
      <Tabs
        tabs={segTabs}
        active={active}
        onChange={setActive}
        variant="segmented"
        ariaLabel="아이디·비밀번호 찾기"
      />
      <TabPanel id="panel_findid" tabId="tab_findid" active={active === 'findid'} className="tab_seg_panel form_section">
        아이디 찾기 패널
      </TabPanel>
      <TabPanel id="panel_findpw" tabId="tab_findpw" active={active === 'findpw'} className="tab_seg_panel form_section">
        비밀번호 찾기 패널
      </TabPanel>
    </>
  )
}

test('Tabs segmented: ArrowRight로 다음 탭, 끝에서 처음으로 순환한다', () => {
  render(<SegHarness />)
  const first = screen.getByRole('tab', { name: '아이디 찾기' })
  const second = screen.getByRole('tab', { name: '비밀번호 찾기' })

  fireEvent.keyDown(first, { key: 'ArrowRight' })
  expect(second).toHaveAttribute('aria-selected', 'true')
  expect(document.activeElement).toBe(second)   // 자동 활성화 — 이동과 선택이 함께 일어난다

  fireEvent.keyDown(second, { key: 'ArrowRight' })
  expect(first).toHaveAttribute('aria-selected', 'true')
  expect(document.activeElement).toBe(first)
})

test('Tabs segmented: ArrowLeft로 이전 탭, 처음에서 끝으로 순환한다', () => {
  render(<SegHarness />)
  const first = screen.getByRole('tab', { name: '아이디 찾기' })
  const second = screen.getByRole('tab', { name: '비밀번호 찾기' })

  fireEvent.keyDown(first, { key: 'ArrowLeft' })
  expect(second).toHaveAttribute('aria-selected', 'true')

  fireEvent.keyDown(second, { key: 'ArrowLeft' })
  expect(first).toHaveAttribute('aria-selected', 'true')
})

test('Tabs segmented: 활성 탭만 aria-selected=true·tabIndex=0, 클래스는 퍼블 tab_seg_btn 단독', () => {
  render(<SegHarness />)
  const first = screen.getByRole('tab', { name: '아이디 찾기' })
  const second = screen.getByRole('tab', { name: '비밀번호 찾기' })

  expect(first).toHaveAttribute('aria-selected', 'true')
  expect(second).toHaveAttribute('aria-selected', 'false')
  expect(first.tabIndex).toBe(0)
  expect(second.tabIndex).toBe(-1)   // roving tabindex

  // 퍼블 클래스와 Tailwind를 한 요소에 섞지 않는다(§5.6 규칙 3)
  expect(first.className).toBe('tab_seg_btn')
  expect(second.className).toBe('tab_seg_btn')

  // tablist에 이름이 붙는다 — 한 화면에 tablist가 둘 이상일 수 있다
  expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', '아이디·비밀번호 찾기')
})

test('Tabs segmented: aria-controls가 가리키는 패널만 노출되고 나머지는 hidden이다', () => {
  render(<SegHarness />)
  const first = screen.getByRole('tab', { name: '아이디 찾기' })
  expect(first.getAttribute('aria-controls')).toBe('panel_findid')

  // 조건부 렌더가 아니라 hidden 속성이어야 aria-controls가 실재하는 id를 가리킨다
  expect(document.getElementById('panel_findid').hidden).toBe(false)
  expect(document.getElementById('panel_findpw').hidden).toBe(true)

  fireEvent.click(screen.getByRole('tab', { name: '비밀번호 찾기' }))
  expect(document.getElementById('panel_findid').hidden).toBe(true)
  expect(document.getElementById('panel_findpw').hidden).toBe(false)
})
