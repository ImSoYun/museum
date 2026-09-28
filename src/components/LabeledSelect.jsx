// round07h VisibilitySelect → round07m LabeledSelect — 퍼블 dropdown_box ty_labeled 의
// 단일선택(listbox) 변형(publish-v2 page/search_result.html L99-118). SortSelect.jsx 와 같은
// 구조다. **결과 필터**이지 검색 게이트가 아니다 — 검색 모집단 297,154건은 그대로다.
//
// [round07m — 왜 일반화했나]
// 종류 드롭다운이 생기면서 마크업·키보드·바깥클릭 동작이 완전히 같고 라벨·선택지만 다른
// 사본이 둘이 됐다. 세 번째 사본을 만들지 않고 라벨과 선택지를 prop 으로 받는다. 옛 `title`
// prop(트리거 라벨만 바꾸고 패널 머리·listbox 이름은 「등록유형」 고정이던 반쪽 계약)은 없앴다.
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import icArrowTop from '../assets/icons/ic_arrow_top.svg'

export default function LabeledSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value) ?? options[0]
  const uid = useId()
  const panelId = `${uid}-panel`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  // 바깥클릭·Esc 로 닫기 — DropdownMenu.jsx·SearchModeToggle.jsx·DropdownCheckBox.jsx·
  // TaskSelect.jsx 네 곳 모두가 쓰는 관행 그대로다. 새 방식을 만들지 않는다.
  useEffect(() => {
    if (!open) return undefined
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="dropdown_box ty_labeled" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="dropdown_box_trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dropdown_box_label">{label}</span>
        <span className="dropdown_box_value">{current.label}</span>
        <ChevronDown size={14} className="dropdown_box_arrow" />
      </button>

      {/* 패널은 항상 DOM 에 두고 hidden 으로만 감춘다(DropdownCheckBox.jsx 관행) —
          퍼블 .dropdown_box_panel[hidden]{ display:none } 규칙이 죽지 않고, aria-controls 도
          닫힘 상태에서 존재하지 않는 요소를 가리키지 않는다. Esc 는 패널 안 어디서 눌러도
          잡히도록 여기에 건다. */}
      <div
        id={panelId}
        className="dropdown_box_panel"
        hidden={!open}
        onKeyDown={(e) => { if (e.key === 'Escape') close() }}
      >
        <button type="button" className="dropdown_box_panel_head" onClick={close}>
          <span className="dropdown_box_label">{label}</span>
          <img src={icArrowTop} alt="" className="dropdown_box_arrow" />
        </button>

        {/* 퍼블 마크업 그대로: role/aria-selected 는 <li> 에, 클래스는
            dropdown_box_list_item(li)·dropdown_box_item(button)으로 나뉜다. */}
        <ul role="listbox" aria-label={label} className="dropdown_box_list">
          {options.map((o) => (
            <li
              key={o.value}
              className="dropdown_box_list_item"
              role="option"
              aria-selected={o.value === value}
            >
              <button
                type="button"
                className={`dropdown_box_item${o.value === value ? ' is_selected' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  close()
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
