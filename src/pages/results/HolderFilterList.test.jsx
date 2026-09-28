// round07m — 라이브 소장처 목록. 테스트 기관명은 공공기관만 쓴다(실명 금지).
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HolderFilterList from './HolderFilterList.jsx'

const OPTIONS = [
  { value: '대한민국역사박물관', count: 98 },
  { value: '국가기록원', count: 12 },
  { value: '개인 보유', count: 7 },
  { value: '정보 없음', count: 41 },
]

function rows(container) {
  return [...container.querySelectorAll('.result_filter_btn')].map((b) => ({
    name: b.firstChild.textContent,
    count: b.querySelector('.result_filter_count').textContent,
    active: b.classList.contains('is_active'),
  }))
}

describe('HolderFilterList', () => {
  it('맨 위 「전체」는 목록 건수의 합이고, 서버 순서를 그대로 그린다', () => {
    const { container } = render(<HolderFilterList options={OPTIONS} selected={null} onSelect={() => {}} />)
    expect(rows(container)).toEqual([
      { name: '전체', count: '158', active: true },
      { name: '대한민국역사박물관', count: '98', active: false },
      { name: '국가기록원', count: '12', active: false },
      { name: '개인 보유', count: '7', active: false },
      { name: '정보 없음', count: '41', active: false },
    ])
  })

  it('항목을 누르면 그 값, 「전체」를 누르면 null 로 onSelect', () => {
    const onSelect = vi.fn()
    render(<HolderFilterList options={OPTIONS} selected="국가기록원" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /정보 없음/ }))
    expect(onSelect).toHaveBeenLastCalledWith('정보 없음')
    fireEvent.click(screen.getByRole('button', { name: /전체/ }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('선택된 항목만 is_active 이고 aria-pressed 로 상태를 알린다', () => {
    const { container } = render(<HolderFilterList options={OPTIONS} selected="국가기록원" onSelect={() => {}} />)
    const active = rows(container).filter((r) => r.active).map((r) => r.name)
    expect(active).toEqual(['국가기록원'])
    expect(screen.getByRole('button', { name: /국가기록원/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('퍼블 마크업(result_filter_list > ul.result_filter_list_menu)을 쓴다', () => {
    const { container } = render(<HolderFilterList options={OPTIONS} selected={null} onSelect={() => {}} />)
    expect(container.querySelector('.result_filter_list > ul.result_filter_list_menu')).not.toBeNull()
  })
})
