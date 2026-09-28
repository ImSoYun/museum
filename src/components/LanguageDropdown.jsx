import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import icArrowTop from '../assets/icons/ic_arrow_top.svg'

const OPTIONS = ['한국어', 'English', '中文', '日本語', 'Русский', 'Deutsch']

export default function LanguageDropdown({ value, onChange, noLabel }) {
  const [open, setOpen] = useState(false)
  const current = OPTIONS.find((item) => item === value) ?? OPTIONS[0]
  const uid = useId()
  const panelId = `${uid}-panel`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

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
    <div className="dropdown_box ty_labeled relative" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="dropdown_box_trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {!noLabel && <span className="dropdown_box_label">언어</span>}
        <span className="dropdown_box_value">{current}</span>
        <ChevronDown size={14} className={`dropdown_box_arrow ${!noLabel ? '' : 'white'}`}/>
      </button>

      {/* z-[60] 및 position absolute 보강으로 잘림 현상 방지 */}
      <div
        id={panelId}
        className="dropdown_box_panel absolute right-0 top-full mt-1 z-[60]"
        hidden={!open}
        onKeyDown={(e) => { if (e.key === 'Escape') close() }}
      >
        <button type="button" className="dropdown_box_panel_head" onClick={close}>
          <span className="dropdown_box_label">언어</span>
          <img src={icArrowTop} alt="" className="dropdown_box_arrow" />
        </button>

        <ul role="listbox" aria-label="언어" className="dropdown_box_list max-h-48 overflow-y-auto">
          {OPTIONS.map((item) => (
            <li
              key={item}
              className="dropdown_box_list_item"
              role="option"
              aria-selected={item === value}
            >
              <button
                type="button"
                className={`dropdown_box_item${item === value ? ' is_selected' : ''}`}
                onClick={() => {
                  onChange(item)
                  close()
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}