// 이 파일의 책임: 검색결과 왼쪽 **라이브** 소장처 목록(round07m).
//
// 항목·순서·건수는 서버 facets.holder 를 그대로 그린다 — 기관(건수 내림차순) → 개인 보유 →
// 정보 없음, 0건 제외, 선택 중인 값은 0건이어도 유지(museum/search/holder.py). 프론트가
// 정렬하거나 거르지 않는다(R6F-15 — 규칙이 두 곳에 생기면 갈라진다).
//
// 「전체」 옆 숫자는 목록 건수의 합이다. 한 자료는 정확히 한 소장처 라벨에 들어가므로 합이 곧
// 「다른 필터를 반영한 모집단」이다(서버 파셋 규칙 — 자기 축 제외).
//
// 실명은 이 목록에 올 수 없다 — DB 에 기관명·「개인 보유」·NULL 셋만 있다(spec §5).
//
// 마크업은 비라이브 기관 필터(ResultsTab 의 !isLive 분기, 퍼블 search_result.html L184-233)와
// 같은 클래스를 쓴다. 단일선택 토글이라 aria-pressed 로 상태를 알린다.
export default function HolderFilterList({ options, selected, onSelect }) {
  const total = options.reduce((sum, o) => sum + o.count, 0)
  const rows = [{ value: null, label: '전체', count: total }, ...options.map((o) => ({ value: o.value, label: o.value, count: o.count }))]

  return (
    <div className="result_filter_list">
      <p className="sr_only">소장처별 필터</p>
      <ul className="result_filter_list_menu gap-0.5">
        {rows.map((row) => {
          const active = row.value === selected
          return (
            <li key={row.value ?? '__all__'}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(row.value)}
                className={`result_filter_btn transition-colors ${active ? 'is_active' : 'hover:bg-offwhite hover:text-primary-700'}`}
              >
                {row.label}
                <span className="result_filter_count">{row.count.toLocaleString()}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
