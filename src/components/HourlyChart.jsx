/**
 * HourlyChart — CSS flex bar chart for hourly usage.
 * Bars use a gradient from #3A82F0 (from-[#3A82F0]) to primary-600.
 * Converted from recharts to pure CSS for BASE fidelity.
 */
export default function HourlyChart({ data, height = 220 }) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex items-end gap-1 w-full" style={{ height }}>
      {data.map((d, i) => {
        const pct = Math.round((d.value / max) * 100)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
            {/* bar wrapper: fills remaining space above label */}
            <div className="flex-1 w-full flex items-end">
              <div
                className="w-full rounded-t-sm bg-gradient-to-b from-[#3A82F0] to-primary-600"
                style={{ height: `${pct}%` }}
                aria-label={`${d.hour}: ${d.value}`}
              />
            </div>
            <span className="text-[9px] text-[#8A90A2] shrink-0">{d.hour}</span>
          </div>
        )
      })}
    </div>
  )
}
