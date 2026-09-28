/**
 * 이 파일의 책임: "패널 카드(div.data_panel)" 골격의 범용화(round06c-ext A3).
 *
 * 퍼블 component.css(96-115행)의 .data_panel은 head(제목+설명, 선택)와 body(항상)
 * 두 구역으로 이뤄진다. 자료관리 5화면(Ocr·Meta·Embedding·History·Materials)이
 * 이미 이 마크업을 각자 인라인으로 반복해 왔다 — 여기서 컴포넌트로 뽑아 D2·E가
 * 재사용하게 한다. head가 없는 화면(OCR 업로드 카드처럼 제목 없이 표만 있는 경우)을
 * 위해 head는 선택 prop이다.
 */
export default function DataPanel({ head, children }) {
  return (
    <div className="data_panel">
      {head && (
        <div className="data_panel_head">
          {head.title && <p className="data_panel_tit">{head.title}</p>}
          {head.desc && <p className="data_panel_desc">{head.desc}</p>}
        </div>
      )}
      <div className="data_panel_body">{children}</div>
    </div>
  )
}
