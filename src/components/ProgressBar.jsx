/**
 * ProgressBar — horizontal progress bar for processing status.
 * Matches BASE OCR·번역 학습 데이터 처리 현황 panel.
 * colorClass prop lets callers override the bar fill colour.
 *   - default: bg-primary-600
 *   - '완료':   bg-ok      (green)
 *   - '학습중': bg-prog    (blue)
 *   - '오류':   bg-bad     (red)
 */
export default function ProgressBar({ label, percent, colorClass }) {
  const fill = colorClass ?? 'bg-primary-600'
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center text-xs text-[#5A6173] mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="font-bold text-ink">{percent}%</span>
      </div>
      <div className="h-2 bg-[#F0F2F7] rounded-full">
        <div
          className={`h-2 rounded-full ${fill}`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  )
}
