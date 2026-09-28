// 이 파일의 책임: 퍼블 `form.data_filter_bar` 마크업을 그대로 담은 공용 필터 바.
// history와 list 두 화면이 같은 구조를 쓰므로 한 벌만 만든다.
//
// 구조상의 핵심 — 테두리는 바깥 form 하나에만 있고 안쪽 select는 border:0이며
// 구분은 span.data_filter_divider가 담당한다. 각 select의 첫 옵션이 라벨 역할을 하고
// 실제 라벨은 label.sr_only로 숨는다.
//
// D2a 결정 — 퍼블 v2는 이 select들을 .dropdown_box(버튼+listbox) 위젯으로 갈아탔지만,
// 그 위젯은 상태(열림/닫힘·키보드 탐색)를 가진 별도 컴포넌트가 필요하다. D1-7이 산출물
// 화면의 "유형 선택"에서 같은 이유로 dropdown_box를 스킵하고 네이티브 select를 유지한
// 선례를 그대로 따른다 — 이번 라운드 어떤 과업에도 dropdown_box 위젯 구현이 없다(§4
// 디자인 참조 — 미참조 사유). 그래서 select_box는 계속 v1 클래스·CSS를 쓴다.
import { Fragment, useId } from 'react'
import icSearchTable from '../assets/icons/ic_search_table.svg'

/**
 * DataFilterBar
 * Props:
 *   fields  {Array<{id, name, placeholderLabel, options: Array<{value, label}>}>}
 *   searchPlaceholder {string}
 *   onSubmit {(values: Record<string, string>) => void}
 *            values = { [field.name]: 선택값(''=미선택), keyword: 검색어 }
 */
export default function DataFilterBar({
  fields,
  searchPlaceholder = '검색어를 입력해주세요.',
  onSubmit,
}) {
  // 검색 input의 id는 퍼블처럼 화면별 하드코딩이 아니라 useId로 만든다 —
  // 같은 화면에 필터 바가 둘 이상 놓여도 for/id가 충돌하지 않는다.
  const uid = useId()
  const keywordId = `${uid}_keyword`

  function handleSubmit(e) {
    // 퍼블 원본은 <form action="#;" method="get">이다. 막지 않으면 제출 시
    // 페이지가 리로드되고 SPA 라우팅이 끊긴다.
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const values = {}
    fields.forEach((f) => { values[f.name] = data.get(f.name) ?? '' })
    values.keyword = data.get('keyword') ?? ''
    onSubmit?.(values)
  }

  return (
    <form className="data_filter_bar" onSubmit={handleSubmit}>
      {fields.map((f) => (
        <Fragment key={f.id}>
          <label className="sr_only" htmlFor={f.id}>{f.placeholderLabel}</label>
          <div className="select_box">
            <select id={f.id} name={f.name} defaultValue="">
              <option value="">{f.placeholderLabel}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <span className="data_filter_divider" aria-hidden="true" />
        </Fragment>
      ))}

      <div className="data_filter_search">
        <label className="sr_only" htmlFor={keywordId}>자료명 검색</label>
        {/* D2a: 퍼블 v2(design/publish-v2/page/manage_list.html:84 · css/component.css의
            data_filter_bar 그룹)는 input·icon에 각각 data_filter_search_input/
            data_filter_search_btn_icon 명시 클래스를 준다 — 값은 기존 요소 선택자와
            동일하므로 회귀 없이 클래스만 맞춘다(select_box는 아래 참조로 v1 유지). */}
        <input
          type="search"
          id={keywordId}
          name="keyword"
          className="data_filter_search_input"
          placeholder={searchPlaceholder}
        />
        <button type="submit" className="data_filter_search_btn icon_btn" aria-label="검색">
          <img src={icSearchTable} alt="" className="data_filter_search_btn_icon" />
        </button>
      </div>
    </form>
  )
}
