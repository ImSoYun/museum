/**
 * 이 파일의 책임: "툴바 + 표 + 페이지네이션" 세로 묶음(div.data_table_group)의
 * 범용화(round06c-ext A3, component.css:134).
 *
 * 세 슬롯 모두 prop으로 받은 노드를 그대로 순서대로 배치할 뿐 내부 구조를 알지
 * 못한다 — 툴바가 무엇을 담는지(검색·필터·삭제 버튼)는 호출부(D2)의 관심사다.
 * 슬롯을 지정하지 않으면 해당 영역 자체를 렌더하지 않는다(undefined는 React가
 * 아무것도 그리지 않으므로 별도 조건 분기 없이 그대로 넘겨도 안전하다).
 */
export default function DataTableGroup({ toolbar, table, pagination }) {
  return (
    <div className="data_table_group">
      {toolbar}
      {table}
      {pagination}
    </div>
  )
}
