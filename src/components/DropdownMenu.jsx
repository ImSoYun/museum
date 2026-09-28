import { useEffect, useRef, useState } from 'react'

export default function DropdownMenu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex items-center justify-center rounded-lg hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              triggerRef.current?.focus()
            }
          }}
          className={`absolute z-50 mt-1 min-w-[140px] rounded-lg border border-line bg-white py-1 shadow-[0_12px_30px_-10px_rgba(8,15,38,.35)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                it.onSelect?.()
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-canvas ${
                it.danger ? 'text-red-600' : 'text-[#4A5266]'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
