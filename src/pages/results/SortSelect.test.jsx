// round07h 후속 — SortSelect가 드롭다운(열림/닫힘)에서 버튼 셋(radiogroup)으로
// 바뀌었으므로 옛 테스트(aria-expanded·바깥클릭·Esc)를 통째로 다시 쓴다. 그 동작
// 자체가 컴포넌트에서 사라졌으니 옛 단언은 지운다 — 약화가 아니라 새 모양에 맞춘
// 재작성이다.
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SortSelect from './SortSelect.jsx'

describe('SortSelect', () => {
  // ★ 드롭다운으로 되돌아가는 회귀를 막는 단언 — 열지 않아도(클릭 없이) 세 항목이
  //   처음부터 모두 DOM에 있어야 한다.
  it('열지 않아도 세 항목이 처음부터 모두 보인다', () => {
    render(<SortSelect value="relevance" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: '적합도순' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '최신순' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '과거순' })).toBeInTheDocument()
  })

  it('role=radiogroup 컨테이너를 갖는다', () => {
    render(<SortSelect value="relevance" onChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: '정렬기준' })).toBeInTheDocument()
  })

  it('「정렬기준」라벨을 보여준다', () => {
    render(<SortSelect value="relevance" onChange={() => {}} />)
    expect(screen.getByText('정렬기준')).toBeInTheDocument()
  })

  it('선택된 항목만 aria-checked=true, 나머지는 false다', () => {
    render(<SortSelect value="recent" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: '적합도순' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: '최신순' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '과거순' })).toHaveAttribute('aria-checked', 'false')
  })

  it('고르면 API 계약 문자열을 올려보낸다', () => {
    const onChange = vi.fn()
    render(<SortSelect value="relevance" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: '과거순' }))
    // ★ 한국어 라벨이 아니라 백엔드 계약 값이어야 한다.
    //   onChange(o.value)를 onChange(o.label)로 바꾸면 이 테스트가 빨개진다.
    expect(onChange).toHaveBeenCalledWith('past')
  })

  it('고를 때 다른 항목의 계약 문자열이 섞이지 않는다', () => {
    const onChange = vi.fn()
    render(<SortSelect value="relevance" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: '최신순' }))
    expect(onChange).toHaveBeenCalledWith('recent')
    expect(onChange).not.toHaveBeenCalledWith('최신순')
  })

  // round07h 2차 정정 — 피그마 Figma API 실측: 선택 표시는 글씨 굵기·색이
  // 아니라 배경 알약(#EEF2F7)이다. 아래 두 단언이 그 방향을 잠근다.

  it('선택된 항목에만 배경 알약 클래스가 붙는다', () => {
    render(<SortSelect value="recent" onChange={() => {}} />)
    const relevance = screen.getByRole('radio', { name: '적합도순' })
    const recent = screen.getByRole('radio', { name: '최신순' })
    const past = screen.getByRole('radio', { name: '과거순' })
    expect(recent.className).toContain('bg-[#EEF2F7]')
    expect(relevance.className).not.toContain('bg-[#EEF2F7]')
    expect(past.className).not.toContain('bg-[#EEF2F7]')
  })

  // ★ 선택 표시가 다시 "선택된 것만 굵게·진하게"로 돌아가는 회귀를 막는 단언 —
  //   배경 알약 클래스를 뺀 나머지 글씨 스타일 클래스가 선택 여부와 무관하게
  //   셋 다 완전히 같아야 한다. checked 분기에 font-bold 같은 걸 다시 넣으면
  //   이 단언이 빨개진다(변이 확인: 실제로 되돌려 확인함 — 아래 커밋/보고서 참조).
  it('세 항목의 글씨 색·굵기 클래스가 서로 같다', () => {
    render(<SortSelect value="relevance" onChange={() => {}} />)
    const relevance = screen.getByRole('radio', { name: '적합도순' })
    const recent = screen.getByRole('radio', { name: '최신순' })
    const past = screen.getByRole('radio', { name: '과거순' })
    const textStyle = (el) => el.className.replace(/\s*bg-\[#EEF2F7\]/, '').trim()
    expect(textStyle(relevance)).toBe(textStyle(recent))
    expect(textStyle(recent)).toBe(textStyle(past))
    expect(relevance.className).toMatch(/\btext-17\b/)
    expect(relevance.className).toMatch(/\bfont-normal\b/)
    expect(relevance.className).toMatch(/\btext-ink\b/)
  })
})
