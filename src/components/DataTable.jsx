import { useId } from 'react'

/**
 * 이 파일의 책임: 자료관리·모니터링 화면이 공유하는 데이터 표.
 *
 * 마크업은 퍼블 table.data_table(manage_ocr.html:114-142 · component.css:117-127)을 따른다.
 * props 시그니처는 바꾸지 않는다 — 호출부가 자료관리 5화면 + Monitoring 으로 6곳이라
 * 시그니처를 건드리면 파급이 커진다. 퍼블 마크업이 요구하는 caption·colWidths·variant
 * 3개만 추가한다(§8.0.3).
 *
 * 폭·정렬·행 높이·선택 행 강조는 전부 퍼블 CSS가 한다.
 *  - table-layout:fixed + colgroup 으로 폭을 잡는다(Tailwind 셀별 폭 클래스 폐기).
 *  - 선택 행 배경은 :has() 가 처리하므로 JS로 클래스를 토글하지 않는다
 *    (.data_table tbody tr:has(.form_check input:checked), component.css:126).
 */
export default function DataTable({
  columns,
  rows,
  selectable = false,
  onRowClick,
  selectedIds,
  onToggle,
  onToggleAll,
  caption,
  colWidths,
  variant,
}) {
  // 체크박스 id는 퍼블처럼 정수 카운터(ocr_check_1)로 만들지 않는다.
  // 한 페이지에 표가 둘 이상이면 충돌하고 StrictMode 이중 렌더에서 값이 흔들린다(§8.0.3-3).
  const uid = useId()

  const controlled = Array.isArray(selectedIds)
  const selectedSet = controlled ? new Set(selectedIds) : null
  const allSelected = controlled && rows.length > 0 && rows.every((r) => selectedSet.has(r.id))
  const someSelected = controlled && rows.some((r) => selectedSet.has(r.id))

  return (
    <table className={['data_table', variant].filter(Boolean).join(' ')}>
      {caption && <caption className="sr_only">{caption}</caption>}
      {colWidths && (
        // 폭 값은 퍼블의 .w_*p 유틸이 아니라 Tailwind 임의값으로 쓴다(§5.2.4 · §5.6 규칙 2).
        // 배열 길이는 (selectable ? 1 : 0) + columns.length 여야 한다.
        <colgroup>
          {colWidths.map((w, i) => <col key={i} className={w} width={w}/>)}
        </colgroup>
      )}
      <thead>
        <tr>
          {selectable && (
            <th scope="col">
              <div className="form_check ty_02">
                <input
                  type="checkbox"
                  id={`${uid}-all`}
                  checked={controlled ? allSelected : undefined}
                  onChange={controlled ? (e) => onToggleAll?.(e.target.checked) : undefined}
                  // indeterminate 는 HTML 속성이 아니라 DOM 프로퍼티라 JSX 로는 걸리지 않는다.
                  // 퍼블 common.js:132 가 하던 처리를 ref 콜백으로 옮긴 것이다(§8.0.3-4).
                  ref={(el) => { if (el) el.indeterminate = Boolean(someSelected && !allSelected) }}
                />
                <label htmlFor={`${uid}-all`}><span className="sr_only">전체선택</span></label>
              </div>
            </th>
          )}
          {columns.map((c) => (
            <th key={c.key} scope="col" className={c.className}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          // key는 row.id 다. 파일명은 퍼블 더미가 그렇듯 실제로 중복될 수 있고,
          // 인덱스는 승급·삭제로 행이 빠질 때 잘못된 행에 상태가 붙는다(§8.0.6 · §14 결함 4).
          <tr
            key={row.id}
            className={onRowClick ? 'cursor-pointer' : ''}
            onClick={() => onRowClick?.(row)}
          >
            {selectable && (
              // 체크박스 칸의 클릭은 행 클릭으로 올라가지 않게 여기서 멈춘다.
              // input 이 아니라 td 에 두는 이유는 label 클릭도 같은 셀에서 발생하기 때문이다.
              <td onClick={(e) => e.stopPropagation()}>
                <div className="form_check ty_02">
                  <input
                    type="checkbox"
                    id={`${uid}-${row.id}`}
                    checked={controlled ? selectedSet.has(row.id) : undefined}
                    onChange={controlled ? () => onToggle?.(row.id) : undefined}
                  />
                  <label htmlFor={`${uid}-${row.id}`}>
                    <span className="sr_only">{`선택 ${row.id}`}</span>
                  </label>
                </div>
              </td>
            )}
            {columns.map((c) => (
              <td key={c.key} className={c.className}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
