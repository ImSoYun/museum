import { useState } from 'react'
import icFirst from '../assets/icons/ic_double_arrow_left.svg'
import icPrev from '../assets/icons/ic_chevron_left.svg'
import icNext from '../assets/icons/ic_chevron_right.svg'
import icLast from '../assets/icons/ic_double_arrow_right.svg'

/**
 * 이 파일의 책임: 표 하단 페이지 이동.
 *
 * 마크업은 퍼블 nav.data_pagination(manage_ocr.html:293-310 · component.css:131-136)이며
 * [첫 페이지][이전][번호][다음][마지막 페이지] 5블록이다. 현행 3블록에 양 끝 2개를 더했다.
 *
 * 채택하지 않은 것 — 퍼블의 "1~10 고정 번호"와 "총 100건" 하드코딩. 그 수치는 정적
 * 마크업의 예시값이지 페이지 크기 규약이 아니며, 그대로 옮기면 실제 데이터가 붙는 순간
 * 표시 건수와 페이지 수가 어긋난다. 번호는 계속 totalPages 로 실계산하고
 * totalPages<=1 이면 null 을 반환하는 현행 동작도 유지한다(§8.0.5).
 *
 * D2a — component.css의 data_pagination 그룹(R6c-ext A1)은 구 요소 선택자
 * (`.data_pagination > button` 등)와 신 클래스 선택자(`.data_pagination_arrow` 등)를
 * 값 그대로 브리지해 두고 "유일 소비처가 아직 갱신되지 않았다"고 적어 두었다.
 * 그 소비처가 이 파일이므로 여기서 신규 클래스를 마저 붙인다(값은 이미 있어 회귀 없음).
 *
 * 아이콘은 퍼블 SVG를 <img alt="">로 쓴다 — 색이 고정인 장식이므로 §6.5.4의 규약대로다.
 * 버튼의 접근성 이름은 aria-label 이 담당한다.
 */
export default function Pagination({ page: externalPage, totalPages = 1, onChange }) {
  const [internalPage, setInternalPage] = useState(externalPage ?? 1)
  const page = externalPage ?? internalPage

  function go(p) {
    if (p < 1 || p > totalPages) return
    setInternalPage(p)
    onChange?.(p)
  }

  if (totalPages <= 1) return null

  // 항상 첫·마지막·현재±1 을 보이고 사이는 말줄임으로 접는다.
  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  return (
    <nav className="data_pagination" aria-label="페이지네이션">
      <button type="button" className="data_pagination_arrow" aria-label="첫 페이지" disabled={page <= 1} onClick={() => go(1)}>
        <img src={icFirst} alt="" className="data_pagination_arrow_icon" />
      </button>
      <button type="button" className="data_pagination_arrow" aria-label="이전 페이지" disabled={page <= 1} onClick={() => go(page - 1)}>
        <img src={icPrev} alt="" className="data_pagination_arrow_icon" />
      </button>

      <div className="data_pagination_pages">
        {pages.map((p, i) =>
          p === '…' ? (
            // 퍼블에 말줄임 표기가 없으므로(1~10 고정) 이 한 요소만 Tailwind 로 쓴다(§5.6 규칙 2).
            // 색은 임의값 문법(text-[var(--gray70)])이 아니라 R6d-02 가 만든 브리지 키를 쓴다 —
            // 그래야 tokens.test.js 가 지키는 키에 실사용 소비처가 생긴다.
            <span key={`ellipsis-${i}`} className="text-pub-gray70">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className="data_pagination_page_btn"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => go(p)}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button type="button" className="data_pagination_arrow" aria-label="다음 페이지" disabled={page >= totalPages} onClick={() => go(page + 1)}>
        <img src={icNext} alt="" className="data_pagination_arrow_icon" />
      </button>
      <button type="button" className="data_pagination_arrow" aria-label="마지막 페이지" disabled={page >= totalPages} onClick={() => go(totalPages)}>
        <img src={icLast} alt="" className="data_pagination_arrow_icon" />
      </button>
    </nav>
  )
}
