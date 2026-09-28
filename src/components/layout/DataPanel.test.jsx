import { render, screen } from '@testing-library/react'
import DataPanel from './DataPanel.jsx'

test('body 슬롯과 자식을 렌더한다', () => {
  const { container } = render(<DataPanel><p>내용</p></DataPanel>)
  expect(container.querySelector('.data_panel')).toBeTruthy()
  expect(container.querySelector('.data_panel_body')).toBeTruthy()
  expect(screen.getByText('내용')).toBeInTheDocument()
})

test('head 지정 시 제목·설명을 렌더한다', () => {
  render(<DataPanel head={{ title: '계정 목록', desc: '하위 전부' }}>x</DataPanel>)
  expect(screen.getByText('계정 목록')).toHaveClass('data_panel_tit')
  expect(screen.getByText('하위 전부')).toHaveClass('data_panel_desc')
})

// head 미지정 시 .data_panel_head 자체가 DOM에 없어야 한다 — 빈 카드 여백이 남지 않게.
test('head 미지정 시 .data_panel_head를 렌더하지 않는다', () => {
  const { container } = render(<DataPanel>x</DataPanel>)
  expect(container.querySelector('.data_panel_head')).toBeNull()
})

// head.desc만 없는 경우도 대응해야 한다(제목만 있는 패널).
test('head.desc 미지정 시 .data_panel_desc를 렌더하지 않는다', () => {
  const { container } = render(<DataPanel head={{ title: '계정 목록' }}>x</DataPanel>)
  expect(screen.getByText('계정 목록')).toHaveClass('data_panel_tit')
  expect(container.querySelector('.data_panel_desc')).toBeNull()
})
