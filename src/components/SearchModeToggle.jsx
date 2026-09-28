/**
 * 이 파일의 책임: 검색 대상(메타/본문) 선택 토글 — 검색바 좌측 진입점 + 팝오버.
 *
 * 퍼블에 이 위젯이 없어 자체 설계다(spec §1.4 #1). 체크박스 마크업은 이식된
 * form_check.ty_02 자산을 그대로 쓴다 — DataTable.jsx(§8.0.3)가 이미 쓰는 실제 구조
 * (input과 label이 형제, label이 htmlFor로 연결)를 따른다. component.css의
 * `.form_check.ty_02 input:checked + label:before` 선택자가 인접 형제 결합자라서,
 * label로 input을 감싸면(선택자가 맞지 않아) 체크박스 시각 요소 자체가 사라진다 —
 * 그래서 신규 체크박스 CSS를 만들지 않고도 기존 자산이 그대로 먹도록 이 구조를 쓴다.
 *
 * 최소 1개 강제(R6E-1): 마지막 하나 남은 체크박스를 disabled 로 만든다.
 * 백엔드 SearchMode 는 enum 3값이라 "0개 선택" 을 표현할 수 없고, 여기서
 * 막으면 새 에러 경로(422)가 생기지 않는다.
 *
 * 팝오버 닫힘(spec §6.3, round06e 리뷰 지적2): ESC·바깥클릭 닫기 + 포커스 복귀는
 * DropdownMenu.jsx 가 이미 쓰는 패턴을 그대로 따른다 — mousedown 문서 리스너로
 * 바깥클릭을 닫고, 팝오버의 keydown 에서 Escape 를 잡아 닫은 뒤 triggerRef 로 포커스를
 * 되돌린다. 새 방식을 만들지 않는다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useScenario } from '../context/ScenarioContext.jsx'

const toMode = (meta, ocr) => (meta && ocr ? 'both' : ocr ? 'ocr' : 'meta')

export default function SearchModeToggle() {
  const { searchModesEnabled } = useAuth()
  const { searchMode, setSearchMode } = useScenario()
  const [open, setOpen] = useState(false)
  const uid = useId()
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

  // 기능 플래그가 꺼져 있으면 위젯 자체를 내보내지 않는다(§7.5).
  if (!searchModesEnabled) return null

  const meta = searchMode === 'meta' || searchMode === 'both'
  const ocr = searchMode === 'ocr' || searchMode === 'both'
  const onlyOne = meta !== ocr   // 하나만 켜져 있으면 그 하나는 못 끈다

  return (
    <div className="search_mode" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="search_mode_btn"
        aria-label="검색 대상 선택"
        aria-expanded={open}
        aria-controls={`${uid}-popover`}
        onClick={() => setOpen((v) => !v)}
      >
        +
      </button>

      {open && (
        <div id={`${uid}-popover`} className="search_mode_popover" role="group"
             aria-label="검색 대상"
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 setOpen(false)
                 triggerRef.current?.focus()
               }
             }}>
          <div className="form_check ty_02">
            <input
              type="checkbox"
              id={`${uid}-meta`}
              checked={meta}
              disabled={meta && onlyOne}
              onChange={(e) => setSearchMode(toMode(e.target.checked, ocr))}
            />
            <label htmlFor={`${uid}-meta`}>메타기반</label>
          </div>
          <div className="form_check ty_02">
            <input
              type="checkbox"
              id={`${uid}-ocr`}
              checked={ocr}
              disabled={ocr && onlyOne}
              onChange={(e) => setSearchMode(toMode(meta, e.target.checked))}
            />
            <label htmlFor={`${uid}-ocr`}>본문 내 기반</label>
          </div>
        </div>
      )}
    </div>
  )
}
