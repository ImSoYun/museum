import { X } from 'lucide-react'

export default function Chip({ label, onRemove, variant }) {
  if (variant === 'box') {
    return (
      <button
        type="button"
        className="rounded-xl px-4 py-3 text-sm text-left border border-[#C5DCF8] bg-primary-50 text-primary-700 w-full hover:bg-primary-100 transition-colors"
      >
        {label}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 border border-[#C5DCF8] text-[11px] rounded-full px-2 py-1">
      {label}{onRemove && <button onClick={onRemove} aria-label="제거"><X size={12} /></button>}
    </span>
  )
}
