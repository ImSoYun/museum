// round07h 리뷰 반영 → round07m — 단일선택 드롭다운(퍼블 dropdown_box ty_labeled)을 라벨·선택지를
// prop 으로 받는 LabeledSelect 로 일반화했다. 옛 VisibilitySelect.test 의 단언은 공개여부
// 선택지를 넘겨 그대로 잠그고, 라벨이 트리거·패널 머리·listbox 이름 세 곳에 함께 쓰이는지를
// 새로 잠근다(옛 컴포넌트는 title prop 이 트리거만 바꾸고 나머지 둘은 「등록유형」 고정이었다).
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LabeledSelect from './LabeledSelect.jsx'

const OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'public', label: '공개' },
  { value: 'private', label: '미공개' },
]

function renderSelect({ value = 'all', onChange = () => {}, label = '공개여부', options = OPTIONS } = {}) {
  return render(<LabeledSelect label={label} options={options} value={value} onChange={onChange} />)
}

describe('LabeledSelect', () => {
  it('라벨이 트리거·패널 머리·listbox 이름에 모두 쓰인다', () => {
    const { container } = renderSelect({ label: '종류' })
    const labels = [...container.querySelectorAll('.dropdown_box_label')].map((n) => n.textContent)
    expect(labels).toEqual(['종류', '종류'])
    expect(screen.getByRole('listbox', { hidden: true })).toHaveAttribute('aria-label', '종류')
  })

  it('없는 value 면 첫 선택지를 보인다', () => {
    const { container } = renderSelect({ value: '없는값' })
    expect(container.querySelector('.dropdown_box_value')?.textContent).toBe('전체')
  })

  it('선택된 값의 라벨을 보여준다', () => {
    renderSelect({ value: 'public' })
    expect(screen.getByRole('button')).toHaveTextContent('공개')
  })

  it('기본값은 전체다', () => {
    renderSelect({ value: 'all' })
    expect(screen.getByRole('button')).toHaveTextContent('전체')
  })

  it('열면 셋을 모두 보여준다', () => {
    renderSelect({ value: 'all' })
    fireEvent.click(screen.getByRole('button'))
    const listbox = within(screen.getByRole('listbox'))
    expect(listbox.getByText('전체')).toBeInTheDocument()
    expect(listbox.getByText('공개')).toBeInTheDocument()
    expect(listbox.getByText('미공개')).toBeInTheDocument()
  })

  it('고르면 API 계약 문자열을 올려보낸다', () => {
    const onChange = vi.fn()
    renderSelect({ value: 'all', onChange })
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(within(screen.getByRole('listbox')).getByText('미공개'))
    // ★ 한국어 라벨이 아니라 백엔드 계약 값이어야 한다.
    expect(onChange).toHaveBeenCalledWith('private')
  })

  it('고르면 닫힌다', () => {
    renderSelect({ value: 'all' })
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(within(screen.getByRole('listbox')).getByText('공개'))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  // ── 리뷰 반영: 퍼블 마크업·CSS 재사용(SortSelect.test.jsx와 동형) ──────────
  it('패널은 dropdown_box_panel 래퍼 안에 있다', () => {
    renderSelect({ value: 'all' })
    fireEvent.click(screen.getByRole('button'))
    const listbox = screen.getByRole('listbox')
    expect(listbox.closest('.dropdown_box_panel')).not.toBeNull()
  })

  it('트리거 현재값은 dropdown_box_value로 감싼다', () => {
    const { container } = renderSelect({ value: 'private' })
    expect(container.querySelector('.dropdown_box_value')?.textContent).toBe('미공개')
  })

  it('열려 있어도 트리거의 현재값을 감추지 않는다', () => {
    renderSelect({ value: 'all' })
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(trigger.querySelector('.dropdown_box_value')?.textContent).toBe('전체')
  })

  it('닫힘 상태에서도 aria-controls가 실재하는 패널 id를 가리킨다', () => {
    renderSelect({ value: 'all' })
    const trigger = screen.getByRole('button')
    const controlsId = trigger.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    expect(document.getElementById(controlsId)).not.toBeNull()
  })

  it('옵션 항목은 퍼블대로 li=dropdown_box_list_item, button=dropdown_box_item이다', () => {
    const { container } = renderSelect({ value: 'all' })
    fireEvent.click(screen.getByRole('button'))
    const li = container.querySelector('li.dropdown_box_list_item')
    expect(li).not.toBeNull()
    expect(li.querySelector('button.dropdown_box_item')).not.toBeNull()
  })

  // ── 리뷰 반영: 바깥클릭·Esc 닫기(레포 관행) ────────────────────────────────
  it('바깥을 클릭하면 닫힌다', () => {
    const { container } = renderSelect({ value: 'all' })
    fireEvent.click(screen.getByRole('button'))
    expect(container.querySelector('.dropdown_box_panel')).not.toHaveAttribute('hidden')
    fireEvent.mouseDown(document.body)
    expect(container.querySelector('.dropdown_box_panel')).toHaveAttribute('hidden')
  })

  it('Esc를 누르면 닫히고 포커스가 트리거로 돌아온다', () => {
    const { container } = renderSelect({ value: 'all' })
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    fireEvent.keyDown(container.querySelector('.dropdown_box_panel'), { key: 'Escape' })
    expect(container.querySelector('.dropdown_box_panel')).toHaveAttribute('hidden')
    expect(trigger).toHaveFocus()
  })
})
