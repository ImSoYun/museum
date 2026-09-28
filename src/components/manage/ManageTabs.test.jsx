import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ManageTabs from './ManageTabs.jsx'

test('ManageTabs renders 5 tab links with correct labels', () => {
  const { container } = render(<MemoryRouter><ManageTabs /></MemoryRouter>)
  expect(screen.getByRole('link', { name: '유물자료 OCR' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '메타 정보 등록' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '데이터 임베딩 관리' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '학습 반영 이력' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '자료관리' })).toBeInTheDocument()
  // 퍼블 구조 — h2.mng_page_tit 과 nav.page_tabs 는 형제다(manage_ocr.html:71-79)
  expect(screen.getByRole('heading', { level: 2, name: '자료관리' }).className).toBe('mng_page_tit')
  expect(container.querySelector('nav.page_tabs')).not.toBeNull()
})

test('ManageTabs OCR tab links to /manage/ocr', () => {
  render(<MemoryRouter initialEntries={['/manage/ocr']}><ManageTabs /></MemoryRouter>)
  const ocr = screen.getByRole('link', { name: '유물자료 OCR' })
  expect(ocr).toHaveAttribute('href', '/manage/ocr')
  // 활성 표시는 클래스가 아니라 aria-current 속성 셀렉터가 담당한다(component.css:75).
  // 없으면 활성 탭이 시각적으로 사라진다.
  expect(ocr).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '메타 정보 등록' })).not.toHaveAttribute('aria-current')
})

test('ManageTabs: 5번째 탭명은 "자료관리" (퍼블 manage_ocr.html:77)', () => {
  render(<MemoryRouter><ManageTabs /></MemoryRouter>)
  expect(screen.getByRole('link', { name: '자료관리' })).toHaveAttribute('href', '/manage/materials')
  expect(screen.queryByRole('link', { name: '자료 목록' })).not.toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: '자료관리 하위 메뉴' })).toBeInTheDocument()
})

test('ManageTabs: 탭 링크마다 component.css page_tabs 그룹이 기대하는 page_tabs_link가 붙는다', () => {
  render(<MemoryRouter><ManageTabs /></MemoryRouter>)
  for (const name of ['유물자료 OCR', '메타 정보 등록', '데이터 임베딩 관리', '학습 반영 이력', '자료관리']) {
    expect(screen.getByRole('link', { name }).className).toBe('page_tabs_link')
  }
})
